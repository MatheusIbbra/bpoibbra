import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const KLAVI_BASE_URL = Deno.env.get('KLAVI_BASE_URL');
  const KLAVI_ACCESS_KEY = Deno.env.get('KLAVI_ACCESS_KEY');
  const KLAVI_SECRET_KEY = Deno.env.get('KLAVI_SECRET_KEY');

  // Validate required secrets
  if (!KLAVI_BASE_URL || !KLAVI_ACCESS_KEY || !KLAVI_SECRET_KEY) {
    console.error('Missing Open Finance configuration', {
      hasBaseUrl: !!KLAVI_BASE_URL,
      hasAccessKey: !!KLAVI_ACCESS_KEY,
      hasSecretKey: !!KLAVI_SECRET_KEY
    });
    return new Response(
      JSON.stringify({ error: 'Configuração Open Finance incompleta. Verifique os secrets.' }),
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

    const { organization_id, bank_connection_id, from_date, to_date } = await req.json();

    // If bank_connection_id provided, sync that specific connection
    // Otherwise, sync all active connections for the organization
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
    } else if (organization_id) {
      // Create or get connection for this organization
      const { data: existingConnection } = await supabaseAdmin
        .from('bank_connections')
        .select('*')
        .eq('organization_id', organization_id)
        .eq('provider', 'klavi')
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
            provider: 'klavi',
            provider_name: 'Open Finance',
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
    } else {
      return new Response(
        JSON.stringify({ error: 'organization_id or bank_connection_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user has access to this connection's organization
    const { data: viewableOrgs } = await supabaseUser.rpc('get_viewable_organizations', {
      _user_id: user.id
    });

    if (!viewableOrgs?.includes(connectionToSync.organization_id)) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build headers for Klavi API (Basic WhiteLabel authentication)
    const klaviHeaders = {
      'accessKey': KLAVI_ACCESS_KEY,
      'secretKey': KLAVI_SECRET_KEY,
      'Content-Type': 'application/json'
    };

    console.log('Fetching accounts from Klavi...');

    // Fetch accounts
    let accounts: any[] = [];
    try {
      const accountsResponse = await fetch(`${KLAVI_BASE_URL}/data/v1/accounts`, {
        method: 'GET',
        headers: klaviHeaders
      });

      if (accountsResponse.ok) {
        const accountsData = await accountsResponse.json();
        accounts = accountsData.data || accountsData.accounts || accountsData || [];
        console.log(`Received ${accounts.length} accounts from Klavi`);
      } else {
        const errorText = await accountsResponse.text();
        console.warn('Failed to fetch accounts:', accountsResponse.status, errorText);
      }
    } catch (accountsError) {
      console.warn('Error fetching accounts:', accountsError);
    }

    // Build transactions request URL
    const transactionsUrl = new URL(`${KLAVI_BASE_URL}/data/v1/transactions`);
    if (from_date) transactionsUrl.searchParams.set('from', from_date);
    if (to_date) transactionsUrl.searchParams.set('to', to_date);

    console.log('Fetching transactions from Klavi...', transactionsUrl.toString());

    const transactionsResponse = await fetch(transactionsUrl.toString(), {
      method: 'GET',
      headers: klaviHeaders
    });

    if (!transactionsResponse.ok) {
      const errorText = await transactionsResponse.text();
      console.error('Klavi transactions fetch failed:', transactionsResponse.status, errorText);
      
      // Update connection with error
      await supabaseAdmin
        .from('bank_connections')
        .update({ 
          sync_error: `Fetch failed: ${transactionsResponse.status}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', connectionToSync.id);

      await supabaseAdmin.from('integration_logs').insert({
        organization_id: connectionToSync.organization_id,
        bank_connection_id: connectionToSync.id,
        provider: 'klavi',
        event_type: 'sync',
        status: 'error',
        message: 'Failed to fetch transactions',
        error_details: errorText
      });

      return new Response(
        JSON.stringify({ error: 'Failed to fetch transactions from Open Finance', details: errorText }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const transactionsData = await transactionsResponse.json();
    const transactions = transactionsData.data || transactionsData.transactions || transactionsData || [];

    console.log(`Received ${transactions.length} transactions from Klavi`);

    let imported = 0;
    let skipped = 0;

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
      const externalId = tx.id || tx.transaction_id || tx.externalId || `${tx.date}-${tx.amount}-${tx.description}`;
      
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
      const rawAmount = parseFloat(tx.amount) || 0;
      const amount = Math.abs(rawAmount);
      const type = tx.type === 'credit' || tx.type === 'CREDIT' || rawAmount > 0 ? 'income' : 'expense';

      // Insert transaction
      const { error: insertError } = await supabaseAdmin
        .from('transactions')
        .insert({
          organization_id: connectionToSync.organization_id,
          user_id: connectionToSync.user_id,
          bank_connection_id: connectionToSync.id,
          external_transaction_id: externalId,
          account_id: defaultAccount.id,
          date: tx.date || tx.transactionDate || tx.transaction_date || new Date().toISOString().split('T')[0],
          description: tx.description || tx.memo || tx.name || 'Transação via Open Finance',
          raw_description: JSON.stringify(tx),
          amount: amount,
          type: type,
          status: 'completed',
          classification_source: 'open_finance',
          notes: `Importado via Open Finance`
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
        updated_at: new Date().toISOString()
      })
      .eq('id', connectionToSync.id);

    // Log sync success
    await supabaseAdmin.from('integration_logs').insert({
      organization_id: connectionToSync.organization_id,
      bank_connection_id: connectionToSync.id,
      provider: 'klavi',
      event_type: 'sync',
      status: 'success',
      message: `Sync completed: ${imported} imported, ${skipped} skipped`,
      payload: { imported, skipped, total: transactions.length, accounts_count: accounts.length }
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        imported,
        skipped,
        total: transactions.length,
        accounts: accounts.length,
        connection_id: connectionToSync.id
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
