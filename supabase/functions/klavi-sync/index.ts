import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Decrypt token (matching the encrypt function)
function decryptToken(encryptedToken: string, key: string): string {
  const keyBytes = new TextEncoder().encode(key);
  const encryptedBytes = new Uint8Array(atob(encryptedToken).split('').map(c => c.charCodeAt(0)));
  const decrypted = new Uint8Array(encryptedBytes.length);
  
  for (let i = 0; i < encryptedBytes.length; i++) {
    decrypted[i] = encryptedBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  
  return new TextDecoder().decode(decrypted);
}

// Encrypt token for storage
function encryptToken(token: string, key: string): string {
  const keyBytes = new TextEncoder().encode(key);
  const tokenBytes = new TextEncoder().encode(token);
  const encrypted = new Uint8Array(tokenBytes.length);
  
  for (let i = 0; i < tokenBytes.length; i++) {
    encrypted[i] = tokenBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  
  return btoa(String.fromCharCode(...encrypted));
}

// Refresh access token if expired
async function refreshAccessToken(
  supabaseAdmin: any, 
  connection: any, 
  klaviBaseUrl: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const now = new Date();
  const expiresAt = new Date(connection.token_expires_at);
  
  // If token is still valid (with 5 min buffer), return decrypted token
  if (expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
    return decryptToken(connection.access_token_encrypted, clientSecret);
  }

  console.log('Token expired, refreshing...');

  if (!connection.refresh_token_encrypted) {
    throw new Error('No refresh token available');
  }

  const refreshToken = decryptToken(connection.refresh_token_encrypted, clientSecret);

  const response = await fetch(`${klaviBaseUrl}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Token refresh failed:', errorText);
    
    // Update connection status to expired
    await supabaseAdmin
      .from('bank_connections')
      .update({ status: 'expired', sync_error: 'Token refresh failed' })
      .eq('id', connection.id);
    
    throw new Error('Token refresh failed');
  }

  const tokenData = await response.json();
  
  // Update tokens in database
  const newExpiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);
  
  await supabaseAdmin
    .from('bank_connections')
    .update({
      access_token_encrypted: encryptToken(tokenData.access_token, clientSecret),
      refresh_token_encrypted: tokenData.refresh_token 
        ? encryptToken(tokenData.refresh_token, clientSecret)
        : connection.refresh_token_encrypted,
      token_expires_at: newExpiresAt.toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', connection.id);

  // Log refresh
  await supabaseAdmin.from('integration_logs').insert({
    organization_id: connection.organization_id,
    bank_connection_id: connection.id,
    provider: 'klavi',
    event_type: 'token_refresh',
    status: 'success',
    message: 'Access token refreshed successfully'
  });

  return tokenData.access_token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const KLAVI_CLIENT_ID = Deno.env.get('KLAVI_CLIENT_ID')!;
  const KLAVI_CLIENT_SECRET = Deno.env.get('KLAVI_CLIENT_SECRET')!;
  const KLAVI_BASE_URL = Deno.env.get('KLAVI_BASE_URL')!;

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

    const { bank_connection_id, from_date, to_date } = await req.json();

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

    // Verify user has access to this connection's organization
    const { data: viewableOrgs } = await supabaseUser.rpc('get_viewable_organizations', {
      _user_id: user.id
    });

    if (!viewableOrgs?.includes(connection.organization_id)) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (connection.status !== 'active') {
      return new Response(
        JSON.stringify({ error: `Connection is ${connection.status}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get valid access token (refresh if needed)
    const accessToken = await refreshAccessToken(
      supabaseAdmin, 
      connection, 
      KLAVI_BASE_URL,
      KLAVI_CLIENT_ID,
      KLAVI_CLIENT_SECRET
    );

    // Build transactions request URL
    const transactionsUrl = new URL(`${KLAVI_BASE_URL}/transactions`);
    if (from_date) transactionsUrl.searchParams.set('from', from_date);
    if (to_date) transactionsUrl.searchParams.set('to', to_date);

    console.log('Fetching transactions from Klavi...');

    const transactionsResponse = await fetch(transactionsUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!transactionsResponse.ok) {
      const errorText = await transactionsResponse.text();
      console.error('Klavi transactions fetch failed:', errorText);
      
      // Update connection with error
      await supabaseAdmin
        .from('bank_connections')
        .update({ 
          sync_error: `Fetch failed: ${transactionsResponse.status}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', connection.id);

      await supabaseAdmin.from('integration_logs').insert({
        organization_id: connection.organization_id,
        bank_connection_id: connection.id,
        provider: 'klavi',
        event_type: 'sync',
        status: 'error',
        message: 'Failed to fetch transactions',
        error_details: errorText
      });

      throw new Error('Failed to fetch transactions from Klavi');
    }

    const transactionsData = await transactionsResponse.json();
    const transactions = transactionsData.data || transactionsData.transactions || [];

    console.log(`Received ${transactions.length} transactions from Klavi`);

    let imported = 0;
    let skipped = 0;

    // Get a default account for this organization to link transactions
    const { data: defaultAccount } = await supabaseAdmin
      .from('accounts')
      .select('id')
      .eq('organization_id', connection.organization_id)
      .eq('status', 'active')
      .limit(1)
      .single();

    if (!defaultAccount) {
      await supabaseAdmin.from('integration_logs').insert({
        organization_id: connection.organization_id,
        bank_connection_id: connection.id,
        provider: 'klavi',
        event_type: 'sync',
        status: 'warning',
        message: 'No active account found for organization'
      });

      return new Response(
        JSON.stringify({ 
          error: 'No active account found. Please create an account first.',
          imported: 0,
          skipped: 0
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process each transaction
    for (const tx of transactions) {
      const externalId = tx.id || tx.transaction_id;
      
      // Check for duplicate
      const { data: existing } = await supabaseAdmin
        .from('transactions')
        .select('id')
        .eq('external_transaction_id', externalId)
        .eq('bank_connection_id', connection.id)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      // Determine transaction type
      const amount = Math.abs(parseFloat(tx.amount) || 0);
      const type = tx.type === 'credit' || tx.amount > 0 ? 'income' : 'expense';

      // Insert transaction
      const { error: insertError } = await supabaseAdmin
        .from('transactions')
        .insert({
          organization_id: connection.organization_id,
          user_id: connection.user_id,
          bank_connection_id: connection.id,
          external_transaction_id: externalId,
          account_id: defaultAccount.id,
          date: tx.date || tx.transaction_date || new Date().toISOString().split('T')[0],
          description: tx.description || tx.memo || 'Transação via Open Finance',
          raw_description: tx.description || tx.memo,
          amount: amount,
          type: type,
          status: 'completed',
          classification_source: 'open_finance',
          notes: `Importado via Klavi - ${connection.provider_name || 'Open Finance'}`
        });

      if (insertError) {
        console.error('Failed to insert transaction:', insertError);
        skipped++;
      } else {
        imported++;
      }
    }

    // Update connection last sync
    await supabaseAdmin
      .from('bank_connections')
      .update({ 
        last_sync_at: new Date().toISOString(),
        sync_error: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', connection.id);

    // Log sync success
    await supabaseAdmin.from('integration_logs').insert({
      organization_id: connection.organization_id,
      bank_connection_id: connection.id,
      provider: 'klavi',
      event_type: 'sync',
      status: 'success',
      message: `Sync completed: ${imported} imported, ${skipped} skipped`,
      payload: { imported, skipped, total: transactions.length }
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        imported,
        skipped,
        total: transactions.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in klavi-sync:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
