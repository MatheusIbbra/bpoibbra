import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const PLUGGY_API_URL = 'https://api.pluggy.ai';

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const PLUGGY_CLIENT_ID = Deno.env.get('PLUGGY_CLIENT_ID');
  const PLUGGY_CLIENT_SECRET = Deno.env.get('PLUGGY_CLIENT_SECRET');

  if (!PLUGGY_CLIENT_ID || !PLUGGY_CLIENT_SECRET) {
    console.error('Missing PLUGGY_CLIENT_ID or PLUGGY_CLIENT_SECRET');
    return jsonResponse({ error: 'Configuração Pluggy incompleta. Verifique as variáveis de ambiente PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET.' }, 500);
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.warn('Request without Authorization header');
      return jsonResponse({ error: 'Authorization required' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser(token);
    if (userError || !user) {
      console.warn('Invalid auth token:', userError?.message);
      return jsonResponse({ error: 'Token de autenticação inválido' }, 401);
    }

    console.log(`User ${user.id} requesting Pluggy connect token`);

    const { organization_id } = await req.json();

    if (!organization_id) {
      return jsonResponse({ error: 'organization_id is required' }, 400);
    }

    // Verify user has access to this organization
    const { data: viewableOrgs } = await supabaseUser.rpc('get_viewable_organizations', {
      _user_id: user.id
    });

    if (!viewableOrgs?.includes(organization_id)) {
      console.warn(`User ${user.id} denied access to org ${organization_id}`);
      return jsonResponse({ error: 'Acesso negado a esta organização' }, 403);
    }

    // Step 1: Get Pluggy API access token
    console.log('Step 1: Authenticating with Pluggy API...');
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
      console.error(`Pluggy auth failed [${authResponse.status}]:`, errorText);
      return jsonResponse({ 
        error: 'Falha na autenticação com Pluggy. Verifique credenciais.',
        details: `Status: ${authResponse.status}`
      }, 500);
    }

    const authData = await authResponse.json();
    const accessToken = authData.apiKey;

    if (!accessToken) {
      console.error('Pluggy auth response missing apiKey:', JSON.stringify(authData));
      return jsonResponse({ error: 'Resposta inválida da autenticação Pluggy (sem apiKey)' }, 500);
    }

    console.log('Step 1 OK: Pluggy API authenticated');

    // Step 2: Create a connect token for the Pluggy Connect widget
    console.log('Step 2: Creating connect token...');
    const connectResponse = await fetch(`${PLUGGY_API_URL}/connect_token`, {
      method: 'POST',
      headers: { 
        'X-API-KEY': accessToken,
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({}),
    });

    if (!connectResponse.ok) {
      const errorText = await connectResponse.text();
      console.error(`Failed to create connect token [${connectResponse.status}]:`, errorText);
      return jsonResponse({ 
        error: 'Falha ao criar token de conexão Pluggy',
        details: `Status: ${connectResponse.status}`
      }, 500);
    }

    const connectData = await connectResponse.json();
    
    if (!connectData.accessToken) {
      console.error('Connect token response missing accessToken:', JSON.stringify(connectData));
      return jsonResponse({ error: 'Token de conexão inválido recebido do Pluggy' }, 500);
    }

    console.log(`Step 2 OK: Connect token created (${connectData.accessToken.length} chars)`);

    // Log the connection attempt
    await supabaseAdmin.from('integration_logs').insert({
      organization_id,
      provider: 'pluggy',
      event_type: 'connect_token_created',
      status: 'success',
      message: `Connect token created for user ${user.id}`
    });

    return jsonResponse({ 
      accessToken: connectData.accessToken,
    });

  } catch (error: unknown) {
    console.error('Unhandled error in pluggy-connect:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return jsonResponse({ error: errorMessage }, 500);
  }
});
