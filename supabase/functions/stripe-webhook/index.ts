import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PLAN_SLUG_MAP: Record<string, string> = {
  "price_1T6XCyKCPyKzKOXK1hXKff8h": "plus",
  "price_1T6XDZKCPyKzKOXK9kQPmKEn": "pro",
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
          const planSlug = plan || PLAN_SLUG_MAP[priceId] || "plus";

          await supabase.from("profiles").update({
            subscription_status: subscription.status,
            subscription_id: subscription.id,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            plan: planSlug,
          }).eq("user_id", userId);
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.trial_will_end": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id;
        if (!userId) break;

        const priceId = subscription.items.data[0]?.price.id;
        const planSlug = PLAN_SLUG_MAP[priceId] || "plus";

        await supabase.from("profiles").update({
          subscription_status: subscription.status,
          subscription_id: subscription.id,
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          plan: planSlug,
        }).eq("user_id", userId);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id;
        if (!userId) {
          // Fallback: find by customer id
          const { data: profile } = await supabase
            .from("profiles")
            .select("user_id")
            .eq("stripe_customer_id", subscription.customer as string)
            .single();
          if (profile) {
            await supabase.from("profiles").update({
              subscription_status: "inactive",
              subscription_id: null,
              current_period_end: null,
              plan: "free",
            }).eq("user_id", profile.user_id);
          }
          break;
        }
        await supabase.from("profiles").update({
          subscription_status: "inactive",
          subscription_id: null,
          current_period_end: null,
          plan: "free",
        }).eq("user_id", userId);
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
            await supabase.from("profiles").update({
              subscription_status: "active",
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            }).eq("user_id", userId);
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
