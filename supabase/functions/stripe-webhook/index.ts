import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PLAN_SLUG_MAP: Record<string, string> = {
  [Deno.env.get("STRIPE_PRICE_PLUS") ?? ""]: "Plus",
  [Deno.env.get("STRIPE_PRICE_PRO") ?? ""]: "Pro",
};

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const body = await req.text();

  if (!signature || !webhookSecret) {
    return new Response("Missing signature or webhook secret", { status: 400 });
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2023-10-16" });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response(`Webhook Error: ${(err as Error).message}`, { status: 400 });
  }

  console.log(`Processing Stripe event: ${event.type}`);

  // Helper: sync subscription to organization_subscriptions table
  async function syncOrgSubscription(userId: string, planSlug: string, status: string, expiresAt: string | null) {
    // Normalize slug to match DB (capitalize first letter)
    const normalizedSlug = planSlug.charAt(0).toUpperCase() + planSlug.slice(1).toLowerCase();

    // Get the plan id
    const { data: plan } = await supabase
      .from("plans")
      .select("id")
      .ilike("slug", normalizedSlug)
      .maybeSingle();

    if (!plan) {
      console.error(`Plan not found for slug: ${normalizedSlug}`);
      return;
    }

    // Get the user's organization
    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (!membership) {
      console.error(`No organization found for user: ${userId}`);
      return;
    }

    const orgId = membership.organization_id;

    // Upsert the organization subscription
    const { error } = await supabase
      .from("organization_subscriptions")
      .upsert({
        organization_id: orgId,
        plan_id: plan.id,
        status: status,
        expires_at: expiresAt,
        started_at: new Date().toISOString(),
      }, {
        onConflict: "organization_id",
        ignoreDuplicates: false,
      });

    if (error) {
      console.error("Error upserting organization_subscriptions:", error);
    } else {
      console.log(`Synced org subscription: org=${orgId}, plan=${normalizedSlug}, status=${status}`);
    }
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.supabase_user_id;
        const plan = session.metadata?.plan;
        if (!userId) break;

        if (session.mode === "subscription" && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
          const priceId = subscription.items.data[0]?.price.id;
          const planSlug = plan || PLAN_SLUG_MAP[priceId] || "Plus";
          const expiresAt = new Date(subscription.current_period_end * 1000).toISOString();

          await supabase.from("profiles").update({
            subscription_status: subscription.status,
            subscription_id: subscription.id,
            current_period_end: expiresAt,
            plan: planSlug.toLowerCase(),
          }).eq("user_id", userId);

          // Sync to organization_subscriptions
          await syncOrgSubscription(userId, planSlug, subscription.status, expiresAt);
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.trial_will_end": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id;
        if (!userId) break;

        const priceId = subscription.items.data[0]?.price.id;
        const planSlug = PLAN_SLUG_MAP[priceId] || "Plus";
        const expiresAt = new Date(subscription.current_period_end * 1000).toISOString();

        await supabase.from("profiles").update({
          subscription_status: subscription.status,
          subscription_id: subscription.id,
          current_period_end: expiresAt,
          plan: planSlug.toLowerCase(),
        }).eq("user_id", userId);

        await syncOrgSubscription(userId, planSlug, subscription.status, expiresAt);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        let userId = subscription.metadata?.supabase_user_id;

        if (!userId) {
          // Fallback: find by customer id
          const { data: profile } = await supabase
            .from("profiles")
            .select("user_id")
            .eq("stripe_customer_id", subscription.customer as string)
            .single();
          if (profile) userId = profile.user_id;
        }

        if (userId) {
          await supabase.from("profiles").update({
            subscription_status: "inactive",
            subscription_id: null,
            current_period_end: null,
            plan: "free",
          }).eq("user_id", userId);

          // Revert to Starter plan in organization_subscriptions
          await syncOrgSubscription(userId, "Starter", "active", null);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
          const userId = subscription.metadata?.supabase_user_id;
          if (userId) {
            await supabase.from("profiles").update({
              subscription_status: "past_due",
            }).eq("user_id", userId);

            // Update org subscription status
            const { data: membership } = await supabase
              .from("organization_members")
              .select("organization_id")
              .eq("user_id", userId)
              .limit(1)
              .maybeSingle();
            if (membership) {
              await supabase
                .from("organization_subscriptions")
                .update({ status: "past_due" })
                .eq("organization_id", membership.organization_id);
            }
          }
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
          const userId = subscription.metadata?.supabase_user_id;
          if (userId) {
            const expiresAt = new Date(subscription.current_period_end * 1000).toISOString();
            await supabase.from("profiles").update({
              subscription_status: "active",
              current_period_end: expiresAt,
            }).eq("user_id", userId);

            // Update org subscription status
            const { data: membership } = await supabase
              .from("organization_members")
              .select("organization_id")
              .eq("user_id", userId)
              .limit(1)
              .maybeSingle();
            if (membership) {
              await supabase
                .from("organization_subscriptions")
                .update({ status: "active", expires_at: expiresAt })
                .eq("organization_id", membership.organization_id);
            }
          }
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error(`Error processing event ${event.type}:`, err);
    return new Response(`Error processing event: ${(err as Error).message}`, { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
