import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
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

    // Verify the caller is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create client with caller's token to verify role
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get the user from the token
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser(authHeader.replace("Bearer ", ""));

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is admin
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

    // Get role of user to delete
    const { data: targetRoleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userIdToDelete)
      .maybeSingle();

    const targetRole = targetRoleData?.role;

    // RULE: Cannot delete clients - only block their organization
    if (targetRole === "cliente") {
      return new Response(JSON.stringify({ 
        error: "Clientes não podem ser excluídos. Use o bloqueio de organização." 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For non-client roles, replacement is mandatory
    if (!replacementUserId && targetRole && targetRole !== "admin") {
      return new Response(JSON.stringify({ 
        error: "É obrigatório selecionar um usuário substituto para transferir os vínculos." 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Perform reassignments based on role
    if (replacementUserId && targetRole) {
      // 1. Supervisor: Transfer all supervised FAs to the replacement
      if (targetRole === "supervisor") {
        await adminClient
          .from("user_hierarchy")
          .update({ supervisor_id: replacementUserId })
          .eq("supervisor_id", userIdToDelete);
      }

      // 2. FA: Transfer all supervised KAMs to the replacement
      if (targetRole === "fa") {
        await adminClient
          .from("user_hierarchy")
          .update({ supervisor_id: replacementUserId })
          .eq("supervisor_id", userIdToDelete);
      }

      // 3. KAM: Transfer all organizations (clients) to the replacement
      if (targetRole === "kam") {
        await adminClient
          .from("organizations")
          .update({ kam_id: replacementUserId })
          .eq("kam_id", userIdToDelete);
      }
    }

    // Delete the user's hierarchy entry
    await adminClient
      .from("user_hierarchy")
      .delete()
      .eq("user_id", userIdToDelete);

    // Delete the user's role
    await adminClient
      .from("user_roles")
      .delete()
      .eq("user_id", userIdToDelete);

    // Delete organization_members entries (for non-clients)
    await adminClient
      .from("organization_members")
      .delete()
      .eq("user_id", userIdToDelete);

    // Delete the profile
    await adminClient
      .from("profiles")
      .delete()
      .eq("user_id", userIdToDelete);

    // Delete the auth user
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
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
