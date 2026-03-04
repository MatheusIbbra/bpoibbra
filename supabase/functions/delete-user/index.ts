import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userIdToDelete, replacementUserId } = await req.json();

    if (!userIdToDelete) {
      return new Response(JSON.stringify({ error: "userIdToDelete is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = { id: claimsData.claims.sub as string };

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: roleData, error: roleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (roleError || roleData?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Only admins can delete users" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: targetRoleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userIdToDelete)
      .maybeSingle();

    const targetRole = targetRoleData?.role;

    if (targetRole === "cliente") {
      return new Response(JSON.stringify({ 
        error: "Clientes não podem ser excluídos. Use o bloqueio de organização." 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!replacementUserId && targetRole && targetRole !== "admin") {
      return new Response(JSON.stringify({ 
        error: "É obrigatório selecionar um usuário substituto para transferir os vínculos." 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (replacementUserId && targetRole) {
      if (targetRole === "supervisor") {
        await adminClient
          .from("user_hierarchy")
          .update({ supervisor_id: replacementUserId })
          .eq("supervisor_id", userIdToDelete);
      }
      if (targetRole === "fa") {
        await adminClient
          .from("user_hierarchy")
          .update({ supervisor_id: replacementUserId })
          .eq("supervisor_id", userIdToDelete);
      }
      if (targetRole === "kam") {
        await adminClient
          .from("organizations")
          .update({ kam_id: replacementUserId })
          .eq("kam_id", userIdToDelete);
      }
    }

    await adminClient.from("user_hierarchy").delete().eq("user_id", userIdToDelete);
    await adminClient.from("user_roles").delete().eq("user_id", userIdToDelete);
    await adminClient.from("organization_members").delete().eq("user_id", userIdToDelete);
    await adminClient.from("profiles").delete().eq("user_id", userIdToDelete);

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userIdToDelete);

    if (deleteError) {
      console.error("Error deleting auth user:", deleteError);
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in delete-user:", error);
    const corsHeaders = getCorsHeaders(req);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
