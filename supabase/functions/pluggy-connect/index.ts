import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const PLUGGY_API_URL = 'https://api.pluggy.ai';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const PLUGGY_CLIENT_ID = Deno.env.get('PLUGGY_CLIENT_ID');
  const PLUGGY_CLIENT_SECRET = Deno.env.get('PLUGGY_CLIENT_SECRET');

  if (!PLUGGY_CLIENT_ID || !PLUGGY_CLIENT_SECRET) {
    return new Response(
      JSON.stringify({ error: 'Configuração Pluggy incompleta' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

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

    const { organization_id } = await req.json();

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
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Pluggy access token
    console.log('Authenticating with Pluggy...');
    const authResponse = await fetch(`${PLUGGY_API_URL}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: PLUGGY_CLIENT_ID,
        clientSecret: PLUGGY_CLIENT_SECRET,
      }),
    });

    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      console.error('Pluggy auth failed:', authResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Falha na autenticação com Pluggy' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authData = await authResponse.json();
    const accessToken = authData.accessToken;

    // Create a connect token for the Pluggy Connect widget
    console.log('Creating Pluggy connect token...');
    const connectResponse = await fetch(`${PLUGGY_API_URL}/connect_token`, {
      method: 'POST',
      headers: { 
        'X-API-KEY': accessToken,
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({
        // Optional: pass itemId to update existing connection
      }),
    });

    if (!connectResponse.ok) {
      const errorText = await connectResponse.text();
      console.error('Failed to create connect token:', connectResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Falha ao criar token de conexão' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const connectData = await connectResponse.json();
    console.log('Connect token created successfully');

    // Log the connection attempt
    await supabaseAdmin.from('integration_logs').insert({
      organization_id,
      provider: 'pluggy',
      event_type: 'connect_token_created',
      status: 'success',
      message: 'Connect token created for Pluggy widget'
    });

    return new Response(
      JSON.stringify({ 
        accessToken: connectData.accessToken,
        // The frontend will use this token to open the Pluggy Connect widget
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in pluggy-connect:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
