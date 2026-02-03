import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Verify the requesting user is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !requestingUser) {
      throw new Error('Invalid token');
    }

    // Check if requesting user is admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUser.id)
      .single();

    if (roleError || roleData?.role !== 'admin') {
      throw new Error('Only admins can manage user access');
    }

    const { action, userId, email, blocked, blockedReason } = await req.json();

    console.log(`Managing user access: action=${action}, userId=${userId}`);

    let result: { success: boolean; message?: string } = { success: true };

    switch (action) {
      case 'update_email': {
        if (!email) throw new Error('Email is required');
        
        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          email: email,
          email_confirm: true
        });
        
        if (error) throw error;
        result.message = 'Email atualizado com sucesso';
        break;
      }

      case 'reset_password': {
        // Get user's current email
        const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (userError || !userData.user) throw new Error('User not found');

        const { error } = await supabaseAdmin.auth.resetPasswordForEmail(userData.user.email!, {
          redirectTo: `${req.headers.get('origin')}/auth?mode=reset`
        });
        
        if (error) throw error;
        result.message = 'Email de redefinição de senha enviado';
        break;
      }

      case 'toggle_block': {
        const now = new Date().toISOString();
        
        const { error } = await supabaseAdmin
          .from('profiles')
          .update({
            is_blocked: blocked,
            blocked_at: blocked ? now : null,
            blocked_reason: blocked ? (blockedReason || 'Acesso bloqueado pelo administrador') : null
          })
          .eq('user_id', userId);
        
        if (error) throw error;
        result.message = blocked ? 'Usuário bloqueado' : 'Usuário desbloqueado';
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: unknown) {
    console.error('Error managing user access:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
