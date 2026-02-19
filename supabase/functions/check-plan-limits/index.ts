import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate user
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role for accurate counts (bypasses RLS)
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { organization_id, action_type } = await req.json();

    if (!organization_id || !action_type) {
      return new Response(
        JSON.stringify({ error: "organization_id and action_type are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user is member of this organization
    const { data: membership } = await adminClient
      .from("organization_members")
      .select("id")
      .eq("user_id", userData.user.id)
      .eq("organization_id", organization_id)
      .maybeSingle();

    if (!membership) {
      return new Response(
        JSON.stringify({ error: "Not a member of this organization" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get plan limits
    const { data: sub } = await adminClient
      .from("organization_subscriptions")
      .select("plan_id, plans!inner(max_transactions, max_ai_requests, max_bank_connections, allow_forecast, allow_simulator, allow_anomaly_detection, allow_benchmarking, name)")
      .eq("organization_id", organization_id)
      .eq("status", "active")
      .maybeSingle();

    const plan = (sub?.plans as any) || {
      max_transactions: 200,
      max_ai_requests: 10,
      max_bank_connections: 1,
      allow_forecast: false,
      allow_simulator: false,
      allow_anomaly_detection: false,
      allow_benchmarking: false,
      name: "Starter",
    };

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const startOfMonthISO = startOfMonth.toISOString();

    let allowed = true;
    let reason = "";
    let current = 0;
    let limit = 0;

    switch (action_type) {
      case "transaction": {
        const { count } = await adminClient
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organization_id)
          .gte("created_at", startOfMonthISO);
        current = count || 0;
        limit = plan.max_transactions;
        if (current >= limit) {
          allowed = false;
          reason = `Limite de transações atingido (${current}/${limit}). Faça upgrade do plano.`;
        }
        break;
      }
      case "ai": {
        const { count } = await adminClient
          .from("api_usage_logs")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organization_id)
          .eq("endpoint", "ai")
          .gte("created_at", startOfMonthISO);
        current = count || 0;
        limit = plan.max_ai_requests;
        if (current >= limit) {
          allowed = false;
          reason = `Limite de requisições de IA atingido (${current}/${limit}). Faça upgrade do plano.`;
        }
        break;
      }
      case "connection": {
        const { count } = await adminClient
          .from("bank_connections")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organization_id)
          .eq("status", "active");
        current = count || 0;
        limit = plan.max_bank_connections;
        if (current >= limit) {
          allowed = false;
          reason = `Limite de conexões bancárias atingido (${current}/${limit}). Faça upgrade do plano.`;
        }
        break;
      }
      case "forecast": {
        allowed = plan.allow_forecast;
        if (!allowed) reason = "Funcionalidade de forecast não disponível no seu plano.";
        break;
      }
      case "simulator": {
        allowed = plan.allow_simulator;
        if (!allowed) reason = "Funcionalidade de simulador não disponível no seu plano.";
        break;
      }
      default:
        return new Response(
          JSON.stringify({ error: `Unknown action_type: ${action_type}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(
      JSON.stringify({ allowed, reason, current, limit, plan_name: plan.name }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[check-plan-limits] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
