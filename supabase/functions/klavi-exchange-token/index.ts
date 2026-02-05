import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple XOR encryption for tokens (in production, use a proper encryption library)
function encryptToken(token: string, key: string): string {
  const keyBytes = new TextEncoder().encode(key);
  const tokenBytes = new TextEncoder().encode(token);
  const encrypted = new Uint8Array(tokenBytes.length);
  
  for (let i = 0; i < tokenBytes.length; i++) {
    encrypted[i] = tokenBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  
  return btoa(String.fromCharCode(...encrypted));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const KLAVI_CLIENT_ID = Deno.env.get('KLAVI_CLIENT_ID');
    const KLAVI_CLIENT_SECRET = Deno.env.get('KLAVI_CLIENT_SECRET');
    const KLAVI_BASE_URL = Deno.env.get('KLAVI_BASE_URL');
    const KLAVI_REDIRECT_URI = Deno.env.get('KLAVI_REDIRECT_URI');

    if (!KLAVI_CLIENT_ID || !KLAVI_CLIENT_SECRET || !KLAVI_BASE_URL || !KLAVI_REDIRECT_URI) {
      console.error('Missing Open Finance configuration');
      throw new Error('Configuração Open Finance incompleta');
    }

    // Validate that KLAVI_BASE_URL is a valid URL
    if (!KLAVI_BASE_URL.startsWith('http://') && !KLAVI_BASE_URL.startsWith('https://')) {
      console.error('Invalid KLAVI_BASE_URL format');
      throw new Error('KLAVI_BASE_URL deve ser uma URL válida. Verifique a configuração dos secrets.');
    }

    const { code, state } = await req.json();

    if (!code || !state) {
      return new Response(
        JSON.stringify({ error: 'code and state are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate state from database
    const { data: oauthState, error: stateError } = await supabaseAdmin
      .from('oauth_states')
      .select('*')
      .eq('state', state)
      .eq('provider', 'klavi')
      .gt('expires_at', new Date().toISOString())
      .single();

    if (stateError || !oauthState) {
      await supabaseAdmin.from('integration_logs').insert({
        provider: 'klavi',
        event_type: 'oauth_callback',
        status: 'error',
        message: 'Invalid or expired OAuth state',
        payload: { state }
      });

      return new Response(
        JSON.stringify({ error: 'Invalid or expired state' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Exchange code for tokens with Klavi
    console.log('Exchanging code for tokens with Klavi...');
    
    const tokenResponse = await fetch(`${KLAVI_BASE_URL}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${KLAVI_CLIENT_ID}:${KLAVI_CLIENT_SECRET}`)}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: KLAVI_REDIRECT_URI
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Klavi token exchange failed:', errorText);
      
      await supabaseAdmin.from('integration_logs').insert({
        organization_id: oauthState.organization_id,
        provider: 'klavi',
        event_type: 'token_exchange',
        status: 'error',
        message: 'Failed to exchange authorization code',
        error_details: errorText
      });

      throw new Error('Failed to exchange authorization code');
    }

    const tokenData = await tokenResponse.json();
    console.log('Token exchange successful');

    // Encrypt tokens before storage
    const encryptionKey = KLAVI_CLIENT_SECRET; // Use a dedicated key in production
    const accessTokenEncrypted = encryptToken(tokenData.access_token, encryptionKey);
    const refreshTokenEncrypted = tokenData.refresh_token 
      ? encryptToken(tokenData.refresh_token, encryptionKey)
      : null;

    // Calculate token expiration
    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);

    // Create bank connection
    const { data: connection, error: connectionError } = await supabaseAdmin
      .from('bank_connections')
      .insert({
        organization_id: oauthState.organization_id,
        user_id: oauthState.user_id,
        provider: 'klavi',
        provider_name: tokenData.institution_name || 'Banco via Open Finance',
        external_consent_id: tokenData.consent_id || null,
        external_account_id: tokenData.account_id || null,
        access_token_encrypted: accessTokenEncrypted,
        refresh_token_encrypted: refreshTokenEncrypted,
        token_expires_at: expiresAt.toISOString(),
        status: 'active',
        metadata: {
          scope: tokenData.scope,
          token_type: tokenData.token_type
        }
      })
      .select()
      .single();

    if (connectionError) {
      console.error('Failed to create bank connection:', connectionError);
      throw new Error('Failed to save bank connection');
    }

    // Clean up used oauth state
    await supabaseAdmin
      .from('oauth_states')
      .delete()
      .eq('id', oauthState.id);

    // Log success
    await supabaseAdmin.from('integration_logs').insert({
      organization_id: oauthState.organization_id,
      bank_connection_id: connection.id,
      provider: 'klavi',
      event_type: 'token_exchange',
      status: 'success',
      message: 'Bank connection established successfully',
      payload: { 
        provider_name: connection.provider_name,
        expires_at: expiresAt.toISOString()
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        connection_id: connection.id,
        provider_name: connection.provider_name,
        redirect_path: oauthState.redirect_path
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in klavi-exchange-token:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
