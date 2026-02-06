import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PLUGGY_API_URL = 'https://api.pluggy.ai';

// Get Pluggy API access token
async function getPluggyToken(clientId: string, clientSecret: string): Promise<string> {
  const response = await fetch(`${PLUGGY_API_URL}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, clientSecret }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Pluggy auth failed:', response.status, errorText);
    throw new Error('Falha na autenticação com Pluggy');
  }

  const data = await response.json();
  // Pluggy API returns the token in the 'apiKey' field
  const token = data.apiKey;
  if (!token) {
    console.error('Pluggy auth response missing apiKey:', JSON.stringify(data));
    throw new Error('Pluggy auth response missing apiKey');
  }
  console.log(`[PLUGGY-AUTH] Token obtained (${token.length} chars)`);
  return token;
}

// ========================================
// CREDIT CARD PAYMENT DETECTION HELPER
// CREDIT CARD RULE:
// credit_card accounts are liabilities (passivo).
// Payments must be classified as TRANSFER, never income.
// ========================================
function isCreditCardPayment(description: string): boolean {
  const text = (description || '').toLowerCase();
  const keywords = [
    "pagamento fatura",
    "pgto fatura",
    "pgto cartao",
    "pgto cartão",
    "pagamento cartao",
    "pagamento cartão",
    "fatura cartao",
    "fatura cartão",
    "cartao credito",
    "cartão crédito",
    "liq fatura",
    "liquidacao cartao",
    "liquidação cartão",
    "pag fatura",
    "pag cartao",
    "pag cartão",
  ];
  return keywords.some(keyword => text.includes(keyword));
}

// ========================================
// INLINE CLASSIFICATION (rules + patterns only, no AI)
// ========================================
function normalizeText(text: string): string {
  let result = text.toLowerCase();
  result = result.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  result = result.replace(/\b\d{1,4}\b/g, "");
  const bankStopwords = /\b(pix|ted|doc|tev|transf|deb|cred|pag|rec|ref|nr|num|nf|cp|dp|de|para|em|do|da|dos|das|o|a|os|as|e|ou|que|com|por|no|na|nos|nas|um|uma|uns|umas)\b/gi;
  result = result.replace(bankStopwords, "");
  result = result.replace(/[^a-z0-9\s]/g, "");
  result = result.replace(/\s+/g, " ");
  return result.trim();
}

function calculateSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;
  const words1 = text1.split(" ").filter(w => w.length > 0);
  const words2 = text2.split(" ").filter(w => w.length > 0);
  if (words1.length === 0 || words2.length === 0) return 0;
  const set2 = new Set(words2);
  const commonWords = words1.filter(w => set2.has(w)).length;
  return commonWords / Math.max(words1.length, words2.length);
}

function containsKeyword(description: string, keyword: string): number {
  const normalizedDesc = normalizeText(description);
  const normalizedKeyword = normalizeText(keyword);
  if (normalizedDesc.includes(normalizedKeyword)) {
    const matchScore = normalizedKeyword.length / Math.max(normalizedDesc.length, 1);
    return Math.min(0.75 + matchScore * 0.25, 1.0);
  }
  return 0;
}

async function classifyTransaction(
  supabaseAdmin: any,
  txId: string,
  description: string,
  amount: number,
  type: string,
  organizationId: string
): Promise<void> {
  const normalizedDescription = normalizeText(description);

  // Update normalized_description
  await supabaseAdmin
    .from("transactions")
    .update({ normalized_description: normalizedDescription })
    .eq("id", txId);

  // STEP 1: Reconciliation Rules (>= 70% similarity)
  const { data: rules } = await supabaseAdmin
    .from("reconciliation_rules")
    .select("id, description, category_id, cost_center_id, transaction_type, amount")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .eq("transaction_type", type);

  if (rules && rules.length > 0) {
    let bestMatch: { rule: any; similarity: number } | null = null;

    for (const rule of rules) {
      const keywordSim = containsKeyword(description, rule.description);
      const normalizedSim = calculateSimilarity(normalizedDescription, normalizeText(rule.description));
      let similarity = Math.max(keywordSim, normalizedSim);

      if (rule.amount && Math.abs(amount - rule.amount) / rule.amount <= 0.01) {
        similarity = Math.min(similarity + 0.1, 1.0);
      }

      if (similarity >= 0.70 && (!bestMatch || similarity > bestMatch.similarity)) {
        bestMatch = { rule, similarity };
      }
    }

    if (bestMatch && bestMatch.similarity >= 0.8) {
      await supabaseAdmin
        .from("transactions")
        .update({
          category_id: bestMatch.rule.category_id,
          cost_center_id: bestMatch.rule.cost_center_id,
          classification_source: "rule",
          validation_status: "validated",
          validated_at: new Date().toISOString(),
        })
        .eq("id", txId);
      console.log(`[CLASSIFY] TX ${txId}: rule match (${(bestMatch.similarity * 100).toFixed(0)}%)`);
      return;
    }
  }

  // STEP 2: Transaction Patterns (confidence >= 85%, occurrences >= 3)
  const { data: patterns } = await supabaseAdmin
    .from("transaction_patterns")
    .select("id, normalized_description, category_id, cost_center_id, confidence, occurrences")
    .eq("organization_id", organizationId)
    .eq("transaction_type", type)
    .gte("confidence", 0.6)
    .order("confidence", { ascending: false })
    .limit(50);

  if (patterns && patterns.length > 0) {
    let bestPattern: { pattern: any; similarity: number } | null = null;

    for (const pattern of patterns) {
      const similarity = calculateSimilarity(normalizedDescription, pattern.normalized_description);
      if (similarity >= 0.70 && (!bestPattern || similarity > bestPattern.similarity)) {
        bestPattern = { pattern, similarity };
      }
    }

    if (bestPattern) {
      const patternConfidence = bestPattern.pattern.confidence || 0.5;
      const finalConfidence = Math.min(bestPattern.similarity * patternConfidence * 1.2, 0.95);
      const shouldAutoValidate = finalConfidence >= 0.85 && (bestPattern.pattern.occurrences || 1) >= 3;

      await supabaseAdmin
        .from("transactions")
        .update({
          category_id: bestPattern.pattern.category_id,
          cost_center_id: bestPattern.pattern.cost_center_id,
          classification_source: "pattern",
          ...(shouldAutoValidate ? {
            validation_status: "validated",
            validated_at: new Date().toISOString(),
          } : {}),
        })
        .eq("id", txId);
      console.log(`[CLASSIFY] TX ${txId}: pattern match (conf=${(finalConfidence * 100).toFixed(0)}%, auto=${shouldAutoValidate})`);
      return;
    }
  }

  // No match - leave for manual/AI classification via Pendências
  console.log(`[CLASSIFY] TX ${txId}: no match, left for manual classification`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const PLUGGY_CLIENT_ID = Deno.env.get('PLUGGY_CLIENT_ID');
  const PLUGGY_CLIENT_SECRET = Deno.env.get('PLUGGY_CLIENT_SECRET');

  if (!PLUGGY_CLIENT_ID || !PLUGGY_CLIENT_SECRET) {
    console.error('Missing Pluggy configuration');
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

    const pluggyItemId = item_id || connectionToSync.external_account_id;
    
    if (!pluggyItemId) {
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

    // ========================================
    // FETCH ITEM DETAILS (connector info, bank name, logo)
    // ========================================
    let itemDetails: any = null;
    try {
      const itemResponse = await fetch(`${PLUGGY_API_URL}/items/${pluggyItemId}`, {
        method: 'GET',
        headers: pluggyHeaders
      });
      if (itemResponse.ok) {
        itemDetails = await itemResponse.json();
        console.log(`Item details: connector=${itemDetails?.connector?.name}, status=${itemDetails?.status}`);
      }
    } catch (itemError) {
      console.warn('Error fetching item details:', itemError);
    }

    // ========================================
    // FETCH ACCOUNTS FROM PLUGGY
    // ========================================
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

    // ========================================
    // SAVE BANK METADATA TO bank_connections
    // ========================================
    const connectorName = itemDetails?.connector?.name || connectionToSync.provider_name || 'Open Finance';
    const connectorLogo = itemDetails?.connector?.imageUrl || null;
    
    const pluggyAccountsSummary = accounts.map((acc: any) => ({
      id: acc.id,
      type: acc.type,
      subtype: acc.subtype,
      name: acc.name,
      number: acc.number || null,
      agency: acc.bankData?.branch || null,
      balance: acc.balance ?? null,
      available_balance: acc.creditData?.availableCreditLimit ?? acc.balance ?? null,
      currency: acc.currencyCode || 'BRL',
    }));

    const totalBalance = accounts.reduce((sum: number, acc: any) => sum + (acc.balance || 0), 0);

    const existingMetadata = connectionToSync.metadata || {};
    const updatedMetadata = {
      ...existingMetadata,
      bank_name: connectorName,
      bank_logo_url: connectorLogo,
      connector_id: itemDetails?.connector?.id || null,
      connector_name: itemDetails?.connector?.name || null,
      pluggy_accounts: pluggyAccountsSummary,
      last_balance: totalBalance,
      last_sync_accounts_count: accounts.length,
      item_status: itemDetails?.status || null,
    };

    // Update connection with metadata and connector name
    await supabaseAdmin
      .from('bank_connections')
      .update({
        provider_name: connectorName,
        metadata: updatedMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', connectionToSync.id);

    console.log(`Saved metadata for connection ${connectionToSync.id}: bank=${connectorName}, accounts=${accounts.length}, balance=${totalBalance}`);

    // ========================================
    // CREATE/UPDATE ACCOUNTS IN accounts TABLE
    // ========================================
    const pluggyAccountToLocalAccount: Record<string, string> = {}; // pluggyAccountId -> local account id

    function mapPluggyAccountType(pluggyType: string): string {
      const typeMap: Record<string, string> = {
        'BANK': 'checking',
        'CHECKING': 'checking',
        'SAVINGS': 'savings',
        'CREDIT': 'credit_card',
        'INVESTMENT': 'investment',
      };
      return typeMap[pluggyType?.toUpperCase()] || 'checking';
    }

    for (const acc of accounts) {
      const accountType = mapPluggyAccountType(acc.type || acc.subtype || 'BANK');
      const accountName = acc.name || `${connectorName} - ${acc.type || 'Conta'}`;
      const accountNumber = acc.number || null;
      const agency = acc.bankData?.branch || null;
      const balance = acc.balance ?? 0;

      // Check if we already have a local account for this Pluggy account
      const { data: existingAccount } = await supabaseAdmin
        .from('accounts')
        .select('id')
        .eq('organization_id', connectionToSync.organization_id)
        .eq('bank_name', connectorName)
        .eq('name', accountName)
        .maybeSingle();

      if (existingAccount) {
        // Update existing account balance
        await supabaseAdmin
          .from('accounts')
          .update({
            current_balance: balance,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingAccount.id);
        
        pluggyAccountToLocalAccount[acc.id] = existingAccount.id;
        console.log(`[ACCOUNTS] Updated existing account ${existingAccount.id}: balance=${balance}`);
      } else {
        // Create new account
        const { data: newAccount, error: accountError } = await supabaseAdmin
          .from('accounts')
          .insert({
            organization_id: connectionToSync.organization_id,
            user_id: connectionToSync.user_id,
            name: accountName,
            account_type: accountType,
            bank_name: connectorName,
            current_balance: balance,
            initial_balance: balance,
            status: 'active',
            start_date: new Date().toISOString().split('T')[0],
          })
          .select('id')
          .single();

        if (accountError) {
          console.error(`[ACCOUNTS] Failed to create account for ${acc.id}:`, accountError);
        } else {
          pluggyAccountToLocalAccount[acc.id] = newAccount.id;
          console.log(`[ACCOUNTS] Created new account ${newAccount.id}: ${accountName}, balance=${balance}`);
        }
      }
    }

    console.log(`[ACCOUNTS] Mapped ${Object.keys(pluggyAccountToLocalAccount).length} Pluggy accounts to local accounts`);

    // ========================================
    // FETCH AND IMPORT TRANSACTIONS
    // ========================================
    let allTransactions: any[] = [];
    for (const account of accounts) {
      try {
        let url = `${PLUGGY_API_URL}/transactions?accountId=${account.id}`;
        if (from_date) url += `&from=${from_date}`;
        if (to_date) url += `&to=${to_date}`;

        console.log(`[TX] Fetching transactions for Pluggy account ${account.id}...`);
        const transactionsResponse = await fetch(url, {
          method: 'GET',
          headers: pluggyHeaders
        });

        if (transactionsResponse.ok) {
          const transactionsData = await transactionsResponse.json();
          const transactions = transactionsData.results || [];
          console.log(`[TX] Received ${transactions.length} transactions for account ${account.id}`);
          allTransactions.push(...transactions.map((tx: any) => ({ ...tx, pluggyAccountId: account.id })));
        } else {
          const errorText = await transactionsResponse.text();
          console.warn(`[TX] Failed to fetch transactions for account ${account.id}:`, transactionsResponse.status, errorText);
        }
      } catch (txError) {
        console.warn('[TX] Error fetching transactions:', txError);
      }
    }

    console.log(`[TX] Total transactions fetched: ${allTransactions.length}`);

    // Fallback: if no pluggy accounts mapped, try to find an existing account
    let fallbackAccountId: string | null = null;
    if (Object.keys(pluggyAccountToLocalAccount).length === 0) {
      const { data: fallbackAccount } = await supabaseAdmin
        .from('accounts')
        .select('id')
        .eq('organization_id', connectionToSync.organization_id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      
      fallbackAccountId = fallbackAccount?.id || null;
      
      if (!fallbackAccountId && allTransactions.length > 0) {
        console.warn('[TX] No accounts available and transactions to import. Creating a default account.');
        const { data: createdDefault } = await supabaseAdmin
          .from('accounts')
          .insert({
            organization_id: connectionToSync.organization_id,
            user_id: connectionToSync.user_id,
            name: `${connectorName} - Conta`,
            account_type: 'checking',
            bank_name: connectorName,
            current_balance: 0,
            initial_balance: 0,
            status: 'active',
            start_date: new Date().toISOString().split('T')[0],
          })
          .select('id')
          .single();
        
        fallbackAccountId = createdDefault?.id || null;
      }
    }

    let imported = 0;
    let skipped = 0;
    const newTransactionIds: { id: string; description: string; amount: number; type: string }[] = [];

    // Process each transaction
    for (const tx of allTransactions) {
      const externalId = tx.id || `${tx.date}-${tx.amount}-${tx.description}`;
      
      // Check for duplicate
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

      const rawAmount = tx.amount || 0;
      const amount = Math.abs(rawAmount);
      let type = tx.type === 'CREDIT' || rawAmount > 0 ? 'income' : 'expense';
      const txDate = tx.date ? tx.date.split('T')[0] : new Date().toISOString().split('T')[0];
      const description = tx.description || tx.descriptionRaw || 'Movimentação via Open Finance';

      // Map to the correct local account
      const localAccountId = pluggyAccountToLocalAccount[tx.pluggyAccountId] || fallbackAccountId;
      if (!localAccountId) {
        console.warn(`[TX] No local account for Pluggy account ${tx.pluggyAccountId}, skipping transaction`);
        skipped++;
        continue;
      }

      // ========================================
      // CREDIT CARD PAYMENT DETECTION
      // CREDIT CARD RULE:
      // credit_card accounts are liabilities (passivo).
      // Payments are TRANSFERS, never income/revenue.
      // They reduce checking balance and card debt.
      // They do NOT impact DRE, only cash flow.
      // ========================================
      const accountForTx = accounts.find((a: any) => a.id === tx.pluggyAccountId);
      const pluggyAccountType = accountForTx ? mapPluggyAccountType(accountForTx.type || accountForTx.subtype || 'BANK') : 'checking';
      let isCreditCardPaymentTx = false;
      
      if (pluggyAccountType === 'credit_card' && type === 'income') {
        // Income on credit card = bill payment received → mark as transfer
        type = 'transfer';
        isCreditCardPaymentTx = true;
        console.log(`[CC-RULE] TX on credit_card account reclassified: income → transfer (payment received): ${description}`);
      } else if (pluggyAccountType !== 'credit_card' && isCreditCardPayment(description)) {
        // Any transaction on checking/savings that matches credit card payment keywords
        // regardless of original type (income OR expense) → mark as transfer
        type = 'transfer';
        isCreditCardPaymentTx = true;
        console.log(`[CC-RULE] TX on ${pluggyAccountType} reclassified → transfer (bill payment detected): ${description}`);
      }

      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('transactions')
        .insert({
          organization_id: connectionToSync.organization_id,
          user_id: connectionToSync.user_id,
          bank_connection_id: connectionToSync.id,
          external_transaction_id: externalId,
          account_id: localAccountId,
          date: txDate,
          description: description,
          raw_description: JSON.stringify(tx),
          amount: amount,
          type: type,
          status: 'completed',
          // CREDIT CARD RULE: payments are system-classified transfers with no category
          ...(isCreditCardPaymentTx ? {
            classification_source: 'system',
            validation_status: 'validated',
            validated_at: new Date().toISOString(),
          } : {}),
          notes: `Importado via Open Finance (${connectorName})`
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('Failed to insert transaction:', insertError);
        skipped++;
      } else {
        imported++;
        newTransactionIds.push({ id: inserted.id, description, amount, type });
      }
    }

    // ========================================
    // CLASSIFY NEW TRANSACTIONS (rules + patterns)
    // ========================================
    if (newTransactionIds.length > 0) {
      console.log(`[CLASSIFY] Starting classification for ${newTransactionIds.length} new transactions...`);
      let classified = 0;
      
      for (const tx of newTransactionIds) {
        try {
          await classifyTransaction(
            supabaseAdmin,
            tx.id,
            tx.description,
            tx.amount,
            tx.type,
            connectionToSync.organization_id
          );
          classified++;
        } catch (classifyError) {
          console.warn(`[CLASSIFY] Error classifying TX ${tx.id}:`, classifyError);
        }
      }
      
      console.log(`[CLASSIFY] Classification complete: ${classified}/${newTransactionIds.length} processed`);
    }

    // ========================================
    // UPDATE CONNECTION STATUS
    // ========================================
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
