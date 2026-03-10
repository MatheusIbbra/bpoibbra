import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

const PLUGGY_API_URL = 'https://api.pluggy.ai';

function jsonResponse(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const PLUGGY_CLIENT_ID = Deno.env.get('PLUGGY_CLIENT_ID');
  const PLUGGY_CLIENT_SECRET = Deno.env.get('PLUGGY_CLIENT_SECRET');

  if (!PLUGGY_CLIENT_ID || !PLUGGY_CLIENT_SECRET) {
    console.error('Missing PLUGGY_CLIENT_ID or PLUGGY_CLIENT_SECRET');
    return jsonResponse(req, { error: 'Configuração Pluggy incompleta. Verifique as variáveis de ambiente PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET.' }, 500);
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.warn('Request without Authorization header');
      return jsonResponse(req, { error: 'Authorization required' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser(token);
    if (userError || !user) {
      console.warn('Invalid auth token:', userError?.message);
      return jsonResponse(req, { error: 'Token de autenticação inválido' }, 401);
    }

    console.log(`User ${user.id} requesting Pluggy connect token`);

    const { organization_id } = await req.json();

    if (!organization_id) {
      return jsonResponse(req, { error: 'organization_id is required' }, 400);
    }

    const { data: viewableOrgs } = await supabaseUser.rpc('get_viewable_organizations', {
      _user_id: user.id
    });

    if (!viewableOrgs?.includes(organization_id)) {
      console.warn(`User ${user.id} denied access to org ${organization_id}`);
      return jsonResponse(req, { error: 'Acesso negado a esta organização' }, 403);
    }

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
      return jsonResponse(req, { 
        error: 'Falha na autenticação com Pluggy. Verifique credenciais.',
        details: `Status: ${authResponse.status}`
      }, 500);
    }

    const authData = await authResponse.json();
    const accessToken = authData.apiKey;

    if (!accessToken) {
      console.error('Pluggy auth response missing apiKey:', JSON.stringify(authData));
      return jsonResponse(req, { error: 'Resposta inválida da autenticação Pluggy (sem apiKey)' }, 500);
    }

    console.log('Step 1 OK: Pluggy API authenticated');

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
      return jsonResponse(req, { 
        error: 'Falha ao criar token de conexão Pluggy',
        details: `Status: ${connectResponse.status}`
      }, 500);
    }

    const connectData = await connectResponse.json();
    
    if (!connectData.accessToken) {
      console.error('Connect token response missing accessToken:', JSON.stringify(connectData));
      return jsonResponse(req, { error: 'Token de conexão inválido recebido do Pluggy' }, 500);
    }

    console.log(`Step 2 OK: Connect token created (${connectData.accessToken.length} chars)`);

    await supabaseAdmin.from('integration_logs').insert({
      organization_id,
      provider: 'pluggy',
      event_type: 'connect_token_created',
      status: 'success',
      message: `Connect token created for user ${user.id}`
    });

    return jsonResponse(req, { 
      accessToken: connectData.accessToken,
    });

  } catch (error: unknown) {
    console.error('Unhandled error in pluggy-connect:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return jsonResponse(req, { error: errorMessage }, 500);
  }
});
