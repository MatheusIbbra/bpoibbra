import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const KLAVI_CLIENT_ID = Deno.env.get('KLAVI_CLIENT_ID');
    const KLAVI_BASE_URL = Deno.env.get('KLAVI_BASE_URL');
    const KLAVI_REDIRECT_URI = Deno.env.get('KLAVI_REDIRECT_URI');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!KLAVI_CLIENT_ID || !KLAVI_BASE_URL || !KLAVI_REDIRECT_URI) {
      console.error('Missing Open Finance configuration', { 
        hasClientId: !!KLAVI_CLIENT_ID, 
        hasBaseUrl: !!KLAVI_BASE_URL, 
        hasRedirectUri: !!KLAVI_REDIRECT_URI 
      });
      throw new Error('Configuração Open Finance incompleta. Verifique as variáveis de ambiente.');
    }

    // Validate that KLAVI_BASE_URL is a valid URL
    if (!KLAVI_BASE_URL.startsWith('http://') && !KLAVI_BASE_URL.startsWith('https://')) {
      console.error('Invalid KLAVI_BASE_URL format:', KLAVI_BASE_URL.substring(0, 10) + '...');
      throw new Error('KLAVI_BASE_URL deve ser uma URL válida (ex: https://api.klavi.com). Verifique a configuração dos secrets.');
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase configuration');
    }

    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user token
    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get current user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { organization_id, redirect_path } = await req.json();
    
    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: 'organization_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user has access to this organization
    const { data: viewableOrgs } = await supabaseUser.rpc('get_viewable_organizations', {
      _user_id: user.id
    });

    if (!viewableOrgs?.includes(organization_id)) {
      return new Response(
        JSON.stringify({ error: 'Access denied to this organization' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate unique state
    const state = crypto.randomUUID();

    // Create service role client to insert oauth_state
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Store state in database
    const { error: stateError } = await supabaseAdmin
      .from('oauth_states')
      .insert({
        organization_id,
        user_id: user.id,
        state,
        provider: 'klavi',
        redirect_path: redirect_path || '/open-finance',
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes
      });

    if (stateError) {
      console.error('Failed to store oauth state:', stateError);
      throw new Error('Failed to initialize OAuth flow');
    }

    // Log the authorization start
    await supabaseAdmin.from('integration_logs').insert({
      organization_id,
      provider: 'klavi',
      event_type: 'oauth_start',
      status: 'info',
      message: 'OAuth authorization flow initiated',
      payload: { user_id: user.id, state }
    });

    // Build Klavi authorization URL
    const authUrl = new URL(`${KLAVI_BASE_URL}/oauth/authorize`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', KLAVI_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', KLAVI_REDIRECT_URI);
    authUrl.searchParams.set('scope', 'accounts transactions');
    authUrl.searchParams.set('state', state);

    return new Response(
      JSON.stringify({ 
        authorization_url: authUrl.toString(),
        state 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: unknown) {
    console.error('Error in klavi-authorize:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
