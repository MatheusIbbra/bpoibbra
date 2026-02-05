import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const KLAVI_BASE_URL = Deno.env.get('KLAVI_BASE_URL');
  const KLAVI_CLIENT_ID = Deno.env.get('KLAVI_CLIENT_ID');
  const KLAVI_CLIENT_SECRET = Deno.env.get('KLAVI_CLIENT_SECRET');

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { bank_connection_id } = await req.json();

    if (!bank_connection_id) {
      return new Response(
        JSON.stringify({ error: 'bank_connection_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch bank connection
    const { data: connection, error: connectionError } = await supabaseAdmin
      .from('bank_connections')
      .select('*')
      .eq('id', bank_connection_id)
      .single();

    if (connectionError || !connection) {
      return new Response(
        JSON.stringify({ error: 'Bank connection not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user has access
    const { data: viewableOrgs } = await supabaseUser.rpc('get_viewable_organizations', {
      _user_id: user.id
    });

    if (!viewableOrgs?.includes(connection.organization_id)) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try to revoke consent at Klavi (optional)
    if (KLAVI_BASE_URL && connection.external_consent_id && connection.access_token_encrypted) {
      try {
        // Decrypt token
        const keyBytes = new TextEncoder().encode(KLAVI_CLIENT_SECRET!);
        const encryptedBytes = new Uint8Array(atob(connection.access_token_encrypted).split('').map(c => c.charCodeAt(0)));
        const decrypted = new Uint8Array(encryptedBytes.length);
        for (let i = 0; i < encryptedBytes.length; i++) {
          decrypted[i] = encryptedBytes[i] ^ keyBytes[i % keyBytes.length];
        }
        const accessToken = new TextDecoder().decode(decrypted);

        await fetch(`${KLAVI_BASE_URL}/consents/${connection.external_consent_id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        console.log('Revoked consent at Klavi');
      } catch (revokeError) {
        console.error('Failed to revoke at Klavi (continuing anyway):', revokeError);
      }
    }

    // Update connection status to revoked
    await supabaseAdmin
      .from('bank_connections')
      .update({ 
        status: 'revoked',
        access_token_encrypted: null,
        refresh_token_encrypted: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', bank_connection_id);

    // Log disconnection
    await supabaseAdmin.from('integration_logs').insert({
      organization_id: connection.organization_id,
      bank_connection_id: connection.id,
      provider: 'klavi',
      event_type: 'disconnect',
      status: 'success',
      message: 'Bank connection disconnected by user'
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in klavi-disconnect:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
