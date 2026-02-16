import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { organizationId, confirmedName } = await req.json();

    if (!organizationId || !confirmedName) {
      return new Response(JSON.stringify({ error: "organizationId e confirmedName são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Get caller identity
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await adminClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const adminId = user.id;

    // Check admin role
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", adminId)
      .maybeSingle();

    if (roleData?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Apenas administradores podem excluir clientes" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the client user linked to this organization
    const { data: clientMember } = await adminClient
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", organizationId)
      .eq("role", "cliente")
      .maybeSingle();

    if (!clientMember) {
      return new Response(JSON.stringify({ error: "Nenhum cliente encontrado para esta base" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientUserId = clientMember.user_id;

    if (clientUserId === adminId) {
      return new Response(JSON.stringify({ error: "Não é possível excluir a si mesmo" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify name matches
    const { data: clientProfile } = await adminClient
      .from("profiles")
      .select("full_name")
      .eq("user_id", clientUserId)
      .maybeSingle();

    const realName = clientProfile?.full_name?.trim() || "";
    if (realName !== confirmedName.trim()) {
      return new Response(JSON.stringify({ error: "Nome digitado não confere com o cadastro do cliente" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === HARD DELETE CASCADE ===
    await adminClient.from("transactions").delete().eq("organization_id", organizationId);
    await adminClient.from("budgets").delete().eq("organization_id", organizationId);
    await adminClient.from("cashflow_forecasts").delete().eq("organization_id", organizationId);
    await adminClient.from("financial_simulations").delete().eq("organization_id", organizationId);
    await adminClient.from("ai_strategic_insights").delete().eq("organization_id", organizationId);
    await adminClient.from("reconciliation_rules").delete().eq("organization_id", organizationId);
    await adminClient.from("categories").delete().eq("organization_id", organizationId).not("parent_id", "is", null);
    await adminClient.from("categories").delete().eq("organization_id", organizationId);
    await adminClient.from("cost_centers").delete().eq("organization_id", organizationId);
    await adminClient.from("import_batches").delete().eq("organization_id", organizationId);

    const { data: accountIds } = await adminClient
      .from("accounts")
      .select("id")
      .eq("organization_id", organizationId);
    if (accountIds && accountIds.length > 0) {
      await adminClient.from("account_balance_snapshots").delete().in("account_id", accountIds.map(a => a.id));
    }
    await adminClient.from("accounts").delete().eq("organization_id", organizationId);

    const { data: ofItems } = await adminClient
      .from("open_finance_items")
      .select("id")
      .eq("organization_id", organizationId);
    if (ofItems && ofItems.length > 0) {
      const itemIds = ofItems.map(i => i.id);
      await adminClient.from("open_finance_accounts").delete().in("item_id", itemIds);
      await adminClient.from("open_finance_raw_data").delete().in("item_id", itemIds);
      await adminClient.from("open_finance_sync_logs").delete().in("item_id", itemIds);
    }
    await adminClient.from("open_finance_items").delete().eq("organization_id", organizationId);
    await adminClient.from("bank_connections").delete().eq("organization_id", organizationId);
    await adminClient.from("materialized_metrics").delete().eq("organization_id", organizationId);
    await adminClient.from("api_usage_logs").delete().eq("organization_id", organizationId);
    await adminClient.from("integration_logs").delete().eq("organization_id", organizationId);
    await adminClient.from("organization_subscriptions").delete().eq("organization_id", organizationId);
    await adminClient.from("organization_members").delete().eq("organization_id", organizationId);
    await adminClient.from("organizations").delete().eq("id", organizationId);
    await adminClient.from("user_hierarchy").delete().eq("user_id", clientUserId);
    await adminClient.from("user_roles").delete().eq("user_id", clientUserId);
    await adminClient.from("family_members").delete().eq("user_id", clientUserId);
    await adminClient.from("consent_logs").delete().eq("user_id", clientUserId);
    await adminClient.from("data_export_requests").delete().eq("user_id", clientUserId);
    await adminClient.from("profiles").delete().eq("user_id", clientUserId);

    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(clientUserId);
    if (deleteAuthError) {
      console.error("Error deleting auth user:", deleteAuthError);
    }

    await adminClient.from("audit_log").insert({
      user_id: adminId,
      table_name: "organizations",
      action: "ADMIN_DELETE_CLIENT",
      record_id: organizationId,
      old_values: { client_name: realName, client_user_id: clientUserId },
      organization_id: organizationId,
    });

    console.log(`Client deleted: org=${organizationId}, user=${clientUserId}, by admin=${adminId}`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in delete-client:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
