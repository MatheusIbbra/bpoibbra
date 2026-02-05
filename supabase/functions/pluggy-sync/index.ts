import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PLUGGY_API_URL = 'https://api.pluggy.ai';

interface PluggyToken {
  accessToken: string;
}

// Get Pluggy API access token
async function getPluggyToken(clientId: string, clientSecret: string): Promise<string> {
  const response = await fetch(`${PLUGGY_API_URL}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId,
      clientSecret,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Pluggy auth failed:', response.status, errorText);
    throw new Error('Falha na autenticação com Pluggy');
  }

  const data: PluggyToken = await response.json();
  return data.accessToken;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const PLUGGY_CLIENT_ID = Deno.env.get('PLUGGY_CLIENT_ID');
  const PLUGGY_CLIENT_SECRET = Deno.env.get('PLUGGY_CLIENT_SECRET');

  // Validate required secrets
  if (!PLUGGY_CLIENT_ID || !PLUGGY_CLIENT_SECRET) {
    console.error('Missing Pluggy configuration', {
      hasClientId: !!PLUGGY_CLIENT_ID,
      hasClientSecret: !!PLUGGY_CLIENT_SECRET
    });
    return new Response(
      JSON.stringify({ error: 'Configuração Pluggy incompleta. Verifique os secrets.' }),
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

    const { organization_id, bank_connection_id, item_id, from_date, to_date } = await req.json();

    if (!organization_id && !bank_connection_id) {
      return new Response(
        JSON.stringify({ error: 'organization_id or bank_connection_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user has access to this organization
    const { data: viewableOrgs } = await supabaseUser.rpc('get_viewable_organizations', {
      _user_id: user.id
    });

    const orgIdToCheck = organization_id || (bank_connection_id ? 
      (await supabaseAdmin.from('bank_connections').select('organization_id').eq('id', bank_connection_id).single()).data?.organization_id 
      : null);

    if (!viewableOrgs?.includes(orgIdToCheck)) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Pluggy access token
    console.log('Authenticating with Pluggy...');
    const pluggyToken = await getPluggyToken(PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET);
    console.log('Pluggy authentication successful');

    const pluggyHeaders = {
      'X-API-KEY': pluggyToken,
      'Content-Type': 'application/json'
    };

    // Get or create bank connection
    let connectionToSync: any = null;
    
    if (bank_connection_id) {
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
      connectionToSync = connection;
    } else {
      // Find or create connection for this organization
      const { data: existingConnection } = await supabaseAdmin
        .from('bank_connections')
        .select('*')
        .eq('organization_id', organization_id)
        .eq('provider', 'pluggy')
        .eq('status', 'active')
        .maybeSingle();

      if (existingConnection) {
        connectionToSync = existingConnection;
      } else {
        // Create new connection record
        const { data: newConnection, error: createError } = await supabaseAdmin
          .from('bank_connections')
          .insert({
            organization_id,
            user_id: user.id,
            provider: 'pluggy',
            provider_name: 'Open Finance (Pluggy)',
            status: 'active'
          })
          .select()
          .single();

        if (createError) {
          console.error('Failed to create bank connection:', createError);
          throw new Error('Failed to create bank connection');
        }
        connectionToSync = newConnection;
      }
    }

    // If we have an item_id from Pluggy, use it to fetch accounts and transactions
    const pluggyItemId = item_id || connectionToSync.external_account_id;
    
    if (!pluggyItemId) {
      console.log('No Pluggy item ID found, skipping sync');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No Pluggy item linked. Connect a bank first.',
          imported: 0,
          skipped: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching accounts for item ${pluggyItemId}...`);

    // Fetch accounts from Pluggy
    let accounts: any[] = [];
    try {
      const accountsResponse = await fetch(`${PLUGGY_API_URL}/accounts?itemId=${pluggyItemId}`, {
        method: 'GET',
        headers: pluggyHeaders
      });

      if (accountsResponse.ok) {
        const accountsData = await accountsResponse.json();
        accounts = accountsData.results || [];
        console.log(`Received ${accounts.length} accounts from Pluggy`);
      } else {
        const errorText = await accountsResponse.text();
        console.warn('Failed to fetch accounts:', accountsResponse.status, errorText);
      }
    } catch (accountsError) {
      console.warn('Error fetching accounts:', accountsError);
    }

    // Fetch transactions from Pluggy
    let allTransactions: any[] = [];
    for (const account of accounts) {
      try {
        let url = `${PLUGGY_API_URL}/transactions?accountId=${account.id}`;
        if (from_date) url += `&from=${from_date}`;
        if (to_date) url += `&to=${to_date}`;

        console.log(`Fetching transactions for account ${account.id}...`);
        const transactionsResponse = await fetch(url, {
          method: 'GET',
          headers: pluggyHeaders
        });

        if (transactionsResponse.ok) {
          const transactionsData = await transactionsResponse.json();
          const transactions = transactionsData.results || [];
          console.log(`Received ${transactions.length} transactions for account ${account.id}`);
          allTransactions.push(...transactions.map((tx: any) => ({ ...tx, pluggyAccountId: account.id })));
        } else {
          const errorText = await transactionsResponse.text();
          console.warn('Failed to fetch transactions:', transactionsResponse.status, errorText);
        }
      } catch (txError) {
        console.warn('Error fetching transactions:', txError);
      }
    }

    console.log(`Total transactions fetched: ${allTransactions.length}`);

    // Get a default account for this organization to link transactions
    const { data: defaultAccount } = await supabaseAdmin
      .from('accounts')
      .select('id')
      .eq('organization_id', connectionToSync.organization_id)
      .eq('status', 'active')
      .limit(1)
      .single();

    if (!defaultAccount) {
      await supabaseAdmin.from('integration_logs').insert({
        organization_id: connectionToSync.organization_id,
        bank_connection_id: connectionToSync.id,
        provider: 'pluggy',
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

    let imported = 0;
    let skipped = 0;

    // Process each transaction
    for (const tx of allTransactions) {
      const externalId = tx.id || `${tx.date}-${tx.amount}-${tx.description}`;
      
      // Check for duplicate using external_transaction_id (idempotency)
      const { data: existing } = await supabaseAdmin
        .from('transactions')
        .select('id')
        .eq('external_transaction_id', externalId)
        .eq('bank_connection_id', connectionToSync.id)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      // Determine transaction type
      const rawAmount = tx.amount || 0;
      const amount = Math.abs(rawAmount);
      const type = tx.type === 'CREDIT' || rawAmount > 0 ? 'income' : 'expense';

      // Parse date correctly - Pluggy returns YYYY-MM-DD format
      const txDate = tx.date ? tx.date.split('T')[0] : new Date().toISOString().split('T')[0];

      // Insert transaction
      const { error: insertError } = await supabaseAdmin
        .from('transactions')
        .insert({
          organization_id: connectionToSync.organization_id,
          user_id: connectionToSync.user_id,
          bank_connection_id: connectionToSync.id,
          external_transaction_id: externalId,
          account_id: defaultAccount.id,
          date: txDate,
          description: tx.description || tx.descriptionRaw || 'Transação via Open Finance',
          raw_description: JSON.stringify(tx),
          amount: amount,
          type: type,
          status: 'completed',
          classification_source: 'open_finance',
          notes: `Importado via Open Finance (Pluggy)`
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
        status: 'active',
        external_account_id: pluggyItemId,
        updated_at: new Date().toISOString()
      })
      .eq('id', connectionToSync.id);

    // Log sync success
    await supabaseAdmin.from('integration_logs').insert({
      organization_id: connectionToSync.organization_id,
      bank_connection_id: connectionToSync.id,
      provider: 'pluggy',
      event_type: 'sync',
      status: 'success',
      message: `Sync completed: ${imported} imported, ${skipped} skipped`,
      payload: { imported, skipped, total: allTransactions.length, accounts_count: accounts.length }
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        imported,
        skipped,
        total: allTransactions.length,
        accounts: accounts.length,
        connection_id: connectionToSync.id
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in pluggy-sync:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
