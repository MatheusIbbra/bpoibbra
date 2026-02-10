import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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
// ========================================
function isCreditCardPayment(description: string): boolean {
  const text = (description || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const strictPatterns = [
    "pagamento recebido",
    "pagamento da fatura",
    "pagamento fatura",
    "pgto fatura",
    "pagamento cartao",
    "pgto cartao",
    "liq fatura",
    "liquidacao fatura",
    "liquidacao cartao",
    "pag fatura cartao",
    "pagto fatura",
  ];
  return strictPatterns.some(keyword => text.includes(keyword));
}

// ========================================
// SAFE API RESPONSE EXTRACTION
// Handles various Pluggy API response structures
// ========================================
function extractItems<T>(response: unknown): T[] {
  if (!response || typeof response !== "object") {
    console.error("[EXTRACT] Invalid response:", typeof response);
    return [];
  }
  const r = response as Record<string, unknown>;
  if (Array.isArray(r)) return r;
  if (Array.isArray(r.results)) return r.results;
  if (Array.isArray(r.data)) return r.data;
  if (Array.isArray(r.items)) return r.items;
  if (r.data && typeof r.data === "object") {
    const d = r.data as Record<string, unknown>;
    if (Array.isArray(d.items)) return d.items;
    if (Array.isArray(d.results)) return d.results;
  }
  console.error("[EXTRACT] Unknown response structure:", Object.keys(r));
  return [];
}

// ========================================
// DEDUPLICATION KEY GENERATOR
// Creates a composite key from date + amount + description for robust dedup
// ========================================
function generateDedupKey(date: string, amount: number, description: string, externalId: string): string {
  // Primary: use external ID if available
  if (externalId && externalId !== `${date}-${amount}-${description}`) {
    return `ext:${externalId}`;
  }
  // Fallback: composite key
  const normalizedDesc = (description || '').toLowerCase().trim().replace(/\s+/g, ' ').substring(0, 100);
  return `comp:${date}|${Math.abs(amount).toFixed(2)}|${normalizedDesc}`;
}

// ========================================
// INLINE CLASSIFICATION (rules + patterns only, no AI)
// Only classifies if: similarity >= 80%, value match, single match found
// NEVER auto-classifies as transfer
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

  // STEP 1: Reconciliation Rules (>= 80% similarity)
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

      if (similarity >= 0.80 && (!bestMatch || similarity > bestMatch.similarity)) {
        bestMatch = { rule, similarity };
      }
    }

    // Only auto-classify if exactly ONE match found (avoid ambiguity)
    const allMatches = rules.filter((rule: any) => {
      const keywordSim = containsKeyword(description, rule.description);
      const normalizedSim = calculateSimilarity(normalizedDescription, normalizeText(rule.description));
      let similarity = Math.max(keywordSim, normalizedSim);
      if (rule.amount && Math.abs(amount - rule.amount) / rule.amount <= 0.01) {
        similarity = Math.min(similarity + 0.1, 1.0);
      }
      return similarity >= 0.80;
    });

    if (bestMatch && bestMatch.similarity >= 0.80 && allMatches.length === 1) {
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

      // Audit log for auto-classification
      await supabaseAdmin.from('integration_logs').insert({
        organization_id: organizationId,
        provider: 'system',
        event_type: 'auto_classification',
        status: 'info',
        message: `TX ${txId} auto-classified by rule "${bestMatch.rule.description}" (${(bestMatch.similarity * 100).toFixed(0)}%)`,
        payload: {
          transaction_id: txId,
          rule_id: bestMatch.rule.id,
          similarity: bestMatch.similarity,
          source: 'rule',
        }
      });

      console.log(`[CLASSIFY] TX ${txId}: rule match (${(bestMatch.similarity * 100).toFixed(0)}%)`);
      return;
    } else if (bestMatch && allMatches.length > 1) {
      console.log(`[CLASSIFY] TX ${txId}: multiple rule matches (${allMatches.length}), leaving as pending`);
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
      if (similarity >= 0.80 && (!bestPattern || similarity > bestPattern.similarity)) {
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
      
      // AUTO-SAVE: Save learned pattern as a reconciliation rule
      if (shouldAutoValidate && bestPattern.pattern.category_id) {
        const { data: existingRule } = await supabaseAdmin
          .from("reconciliation_rules")
          .select("id")
          .eq("organization_id", organizationId)
          .eq("description", description)
          .eq("transaction_type", type)
          .maybeSingle();

        if (!existingRule) {
          await supabaseAdmin
            .from("reconciliation_rules")
            .insert({
              organization_id: organizationId,
              user_id: (await supabaseAdmin.from("organization_members").select("user_id").eq("organization_id", organizationId).limit(1).single()).data?.user_id || '',
              description: description,
              amount: amount,
              transaction_type: type,
              category_id: bestPattern.pattern.category_id,
              cost_center_id: bestPattern.pattern.cost_center_id,
              is_active: true,
            });
          console.log(`[CLASSIFY] TX ${txId}: auto-saved pattern as reconciliation rule`);
        }
      }

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

    const token = authHeader.replace('Bearer ', '');
    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser(token);
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
    // FETCH ITEM DETAILS & VALIDATE CONSENT
    // ========================================
    let itemDetails: any = null;
    try {
      const itemResponse = await fetch(`${PLUGGY_API_URL}/items/${pluggyItemId}`, {
        method: 'GET',
        headers: pluggyHeaders
      });
      if (itemResponse.ok) {
        itemDetails = await itemResponse.json();
        console.log(`[ITEM] Details: connector=${itemDetails?.connector?.name}, status=${itemDetails?.status}`);
        
        // Validate that consent includes ACCOUNTS and TRANSACTIONS
        const products = itemDetails?.parameter?.products || itemDetails?.products || [];
        console.log(`[ITEM] Consent products: ${JSON.stringify(products)}`);
        if (products.length > 0) {
          const hasAccounts = products.some((p: string) => p.toUpperCase().includes('ACCOUNT'));
          const hasTransactions = products.some((p: string) => p.toUpperCase().includes('TRANSACTION'));
          if (!hasAccounts) console.warn('[CONSENT] ⚠️ Consent may NOT include ACCOUNTS scope');
          if (!hasTransactions) console.warn('[CONSENT] ⚠️ Consent may NOT include TRANSACTIONS scope');
        }

        // Handle LOGIN_ERROR / OUTDATED - save status and return early with clear message
        if (itemDetails?.status === 'LOGIN_ERROR' || itemDetails?.status === 'OUTDATED') {
          console.warn(`[ITEM] Item has status ${itemDetails.status} - consent expired or login failed`);
          
          // Save the error status to metadata
          const connectorName = itemDetails?.connector?.name || connectionToSync.provider_name || 'Open Finance';
          const connectorLogo = itemDetails?.connector?.imageUrl || null;
          await supabaseAdmin
            .from('bank_connections')
            .update({
              provider_name: connectorName,
              sync_error: `Status: ${itemDetails.status}. Reconecte o banco.`,
              metadata: {
                ...(connectionToSync.metadata || {}),
                bank_name: connectorName,
                bank_logo_url: connectorLogo,
                item_status: itemDetails.status,
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', connectionToSync.id);

          await supabaseAdmin.from('integration_logs').insert({
            organization_id: connectionToSync.organization_id,
            bank_connection_id: connectionToSync.id,
            provider: 'pluggy',
            event_type: 'sync',
            status: 'error',
            message: `Item com status ${itemDetails.status}. O consentimento expirou ou houve erro de login. Necessário reconectar.`,
          });

          return new Response(
            JSON.stringify({ 
              success: false,
              error: `O banco reportou "${itemDetails.status}". O consentimento pode ter expirado. Desconecte e reconecte o banco.`,
              imported: 0,
              skipped: 0,
              item_status: itemDetails.status,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        const errorText = await itemResponse.text();
        console.warn(`[ITEM] Failed to fetch item details (${itemResponse.status}):`, errorText);
      }
    } catch (itemError) {
      console.warn('[ITEM] Error fetching item details:', itemError);
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
        accounts = extractItems(accountsData);
        console.log(`[ACCOUNTS] Received ${accounts.length} accounts from Pluggy. Response keys: ${Object.keys(accountsData || {}).join(', ')}`);
        
        if (accounts.length === 0) {
          console.warn('[ACCOUNTS] No accounts returned. Full response:', JSON.stringify(accountsData).substring(0, 500));
        }
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

    // Update connection with metadata
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
    // CREATE/UPDATE ACCOUNTS + SAVE OFFICIAL BALANCE
    // ========================================
    const pluggyAccountToLocalAccount: Record<string, string> = {};

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
      const apiBalance = acc.balance ?? 0;
      const now = new Date().toISOString();

      // Check if we already have a local account for this Pluggy account
      const { data: existingAccount } = await supabaseAdmin
        .from('accounts')
        .select('id')
        .eq('organization_id', connectionToSync.organization_id)
        .eq('bank_name', connectorName)
        .eq('name', accountName)
        .maybeSingle();

      if (existingAccount) {
        // Update existing account with OFFICIAL balance from API
        await supabaseAdmin
          .from('accounts')
          .update({
            official_balance: apiBalance,
            last_official_balance_at: now,
            current_balance: apiBalance,
            updated_at: now,
          })
          .eq('id', existingAccount.id);
        
        pluggyAccountToLocalAccount[acc.id] = existingAccount.id;
        console.log(`[ACCOUNTS] Updated account ${existingAccount.id}: official_balance=${apiBalance}`);
      } else {
        // Create new account with official balance
        const { data: newAccount, error: accountError } = await supabaseAdmin
          .from('accounts')
          .insert({
            organization_id: connectionToSync.organization_id,
            user_id: connectionToSync.user_id,
            name: accountName,
            account_type: accountType,
            bank_name: connectorName,
            current_balance: apiBalance,
            initial_balance: apiBalance,
            official_balance: apiBalance,
            last_official_balance_at: now,
            status: 'active',
            start_date: new Date().toISOString().split('T')[0],
          })
          .select('id')
          .single();

        if (accountError) {
          console.error(`[ACCOUNTS] Failed to create account for ${acc.id}:`, accountError);
        } else {
          pluggyAccountToLocalAccount[acc.id] = newAccount.id;
          console.log(`[ACCOUNTS] Created account ${newAccount.id}: ${accountName}, official_balance=${apiBalance}`);
        }
      }
    }

    console.log(`[ACCOUNTS] Mapped ${Object.keys(pluggyAccountToLocalAccount).length} Pluggy accounts`);

    // ========================================
    // FETCH AND IMPORT TRANSACTIONS WITH IMPROVED DEDUPLICATION
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
          const transactions = extractItems(transactionsData);
          console.log(`[TX] Received ${transactions.length} transactions for account ${account.id}. Response keys: ${Object.keys(transactionsData || {}).join(', ')}`);
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

    // Fallback account
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
            official_balance: 0,
            last_official_balance_at: new Date().toISOString(),
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
    let duplicatesDetected = 0;
    const newTransactionIds: { id: string; description: string; amount: number; type: string }[] = [];

    for (const tx of allTransactions) {
      const externalId = tx.id || `${tx.date}-${tx.amount}-${tx.description}`;
      const rawAmount = tx.amount || 0;
      const amount = Math.abs(rawAmount);
      const txDate = tx.date ? tx.date.split('T')[0] : new Date().toISOString().split('T')[0];
      const description = tx.description || tx.descriptionRaw || 'Movimentação via Open Finance';
      
      // Generate dedup key for composite deduplication
      const dedupKey = generateDedupKey(txDate, rawAmount, description, externalId);
      
      // CHECK 1: By external_transaction_id (legacy)
      const { data: existingByExtId } = await supabaseAdmin
        .from('transactions')
        .select('id')
        .eq('external_transaction_id', externalId)
        .eq('bank_connection_id', connectionToSync.id)
        .maybeSingle();

      if (existingByExtId) {
        skipped++;
        duplicatesDetected++;
        continue;
      }
      
      // CHECK 2: By sync_dedup_key (composite: date + amount + description)
      const { data: existingByDedup } = await supabaseAdmin
        .from('transactions')
        .select('id')
        .eq('bank_connection_id', connectionToSync.id)
        .eq('sync_dedup_key', dedupKey)
        .maybeSingle();

      if (existingByDedup) {
        skipped++;
        duplicatesDetected++;
        console.log(`[DEDUP] Skipped duplicate by composite key: ${dedupKey}`);
        continue;
      }

      // CHECK 3: By date + amount + similar description (fuzzy dedup)
      const { data: existingByComposite } = await supabaseAdmin
        .from('transactions')
        .select('id, description')
        .eq('bank_connection_id', connectionToSync.id)
        .eq('date', txDate)
        .eq('amount', amount)
        .limit(5);
      
      if (existingByComposite && existingByComposite.length > 0) {
        const normalizedNewDesc = normalizeText(description);
        const isDuplicate = existingByComposite.some(existing => {
          const similarity = calculateSimilarity(normalizedNewDesc, normalizeText(existing.description || ''));
          return similarity >= 0.90; // Very high threshold for fuzzy dedup
        });
        
        if (isDuplicate) {
          skipped++;
          duplicatesDetected++;
          console.log(`[DEDUP] Skipped fuzzy duplicate: ${description} on ${txDate}`);
          continue;
        }
      }

      // Map to the correct local account
      const localAccountId = pluggyAccountToLocalAccount[tx.pluggyAccountId] || fallbackAccountId;
      if (!localAccountId) {
        console.warn(`[TX] No local account for Pluggy account ${tx.pluggyAccountId}, skipping`);
        skipped++;
        continue;
      }

      // ========================================
      // DETERMINE TRANSACTION TYPE
      // For credit cards: ALL movements are expense EXCEPT bill payments (transfer)
      // Credit card APIs report all values as positive, so sign is NOT reliable
      // ========================================
      const accountForTx = accounts.find((a: any) => a.id === tx.pluggyAccountId);
      const pluggyAccountType = accountForTx ? mapPluggyAccountType(accountForTx.type || accountForTx.subtype || 'BANK') : 'checking';
      let isCreditCardPaymentTx = false;
      let type: string;

      if (pluggyAccountType === 'credit_card') {
        // Credit card: check description for bill payment keywords
        if (isCreditCardPayment(description)) {
          type = 'transfer';
          isCreditCardPaymentTx = true;
          console.log(`[CC-RULE] Credit card bill payment → transfer: "${description}"`);
        } else {
          // ALL other credit card movements are expenses (purchases, installments, reversals, adjustments)
          type = 'expense';
          console.log(`[CC-RULE] Credit card movement → expense: "${description}"`);
        }
      } else {
        // Non-credit-card accounts: use normal sign-based logic
        type = tx.type === 'CREDIT' || rawAmount > 0 ? 'income' : 'expense';
        
        // Check if it's a bill payment from checking/savings account
        if (type === 'expense' && isCreditCardPayment(description)) {
          type = 'transfer';
          isCreditCardPaymentTx = true;
          console.log(`[CC-RULE] Bill payment from regular account → transfer: "${description}"`);
        }
      }

      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('transactions')
        .insert({
          organization_id: connectionToSync.organization_id,
          user_id: connectionToSync.user_id,
          bank_connection_id: connectionToSync.id,
          external_transaction_id: externalId,
          sync_dedup_key: dedupKey,
          account_id: localAccountId,
          date: txDate,
          description: description,
          raw_description: JSON.stringify(tx),
          amount: amount,
          type: type,
          status: 'completed',
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
        // Handle unique constraint violation (dedup index)
        if (insertError.code === '23505') {
          skipped++;
          duplicatesDetected++;
          console.log(`[DEDUP] Unique constraint prevented duplicate: ${dedupKey}`);
        } else {
          console.error('Failed to insert transaction:', insertError);
          skipped++;
        }
      } else {
        imported++;
        newTransactionIds.push({ id: inserted.id, description, amount, type });
      }
    }

    // ========================================
    // CLASSIFY NEW TRANSACTIONS (rules + patterns ONLY, >= 80% similarity)
    // NO automatic transfer detection — removed completely
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
    // MIRROR TRANSACTION DETECTION
    // Same account, same day, same amount, one income + one expense → both ignored
    // ========================================
    if (newTransactionIds.length > 0) {
      console.log(`[MIRROR] Checking for mirror transactions...`);
      let mirrorPairsFound = 0;

      // Group new transactions by account+date+amount
      const txByKey = new Map<string, typeof newTransactionIds>();
      for (const tx of newTransactionIds) {
        // Fetch the account_id and date from DB
        const { data: txData } = await supabaseAdmin
          .from('transactions')
          .select('account_id, date')
          .eq('id', tx.id)
          .single();
        
        if (!txData) continue;
        const key = `${txData.account_id}|${txData.date}|${tx.amount.toFixed(2)}`;
        if (!txByKey.has(key)) txByKey.set(key, []);
        txByKey.get(key)!.push(tx);
      }

      for (const [key, txGroup] of txByKey.entries()) {
        const incomes = txGroup.filter(t => t.type === 'income');
        const expenses = txGroup.filter(t => t.type === 'expense');

        // For each income-expense pair on same account/date/amount → ignore both
        const pairCount = Math.min(incomes.length, expenses.length);
        for (let i = 0; i < pairCount; i++) {
          const incomeId = incomes[i].id;
          const expenseId = expenses[i].id;

          await supabaseAdmin
            .from('transactions')
            .update({ is_ignored: true, notes: 'Movimento espelhado detectado automaticamente (entrada+saída mesmo valor/conta/dia)' })
            .in('id', [incomeId, expenseId]);

          // Audit log
          await supabaseAdmin.from('integration_logs').insert({
            organization_id: connectionToSync.organization_id,
            bank_connection_id: connectionToSync.id,
            provider: 'pluggy',
            event_type: 'mirror_detection',
            status: 'info',
            message: `Mirror pair ignored: income=${incomeId}, expense=${expenseId}, amount=${txGroup[0].amount}`,
            payload: {
              income_id: incomeId,
              expense_id: expenseId,
              amount: txGroup[0].amount,
              key,
              rule: 'same_account_same_day_same_amount',
            }
          });

          mirrorPairsFound++;
          console.log(`[MIRROR] Ignored pair: income=${incomeId}, expense=${expenseId}`);
        }
      }
      console.log(`[MIRROR] Found ${mirrorPairsFound} mirror pairs`);
    }

    // ========================================
    // NO MORE AUTOMATIC TRANSFER PAIR DETECTION
    // Transfers are ONLY classified via rules/patterns with >= 80% similarity
    // ========================================

    // ========================================
    // CALCULATE SYSTEM BALANCE FOR RECONCILIATION
    // ========================================
    let totalApiBalance = 0;
    let totalSystemBalance = 0;
    
    for (const acc of accounts) {
      const localId = pluggyAccountToLocalAccount[acc.id];
      if (!localId) continue;
      
      const apiBalance = acc.balance ?? 0;
      totalApiBalance += apiBalance;
      
      // Calculate system balance using the DB function
      const { data: systemBalance } = await supabaseAdmin.rpc('calculate_account_balance', {
        account_uuid: localId
      });
      totalSystemBalance += (systemBalance ?? 0);
    }
    
    const balanceDifference = Math.abs(totalApiBalance - totalSystemBalance);

    // ========================================
    // CREATE DETAILED SYNC AUDIT LOG
    // ========================================
    await supabaseAdmin.from('sync_audit_logs').insert({
      organization_id: connectionToSync.organization_id,
      bank_connection_id: connectionToSync.id,
      sync_date: new Date().toISOString(),
      api_balance: totalApiBalance,
      system_balance: totalSystemBalance,
      balance_difference: balanceDifference,
      transactions_imported: imported,
      transactions_skipped: skipped,
      transactions_total: allTransactions.length,
      duplicates_detected: duplicatesDetected,
      details: {
        connector_name: connectorName,
        accounts_count: accounts.length,
        item_id: pluggyItemId,
        reconciliation_needed: balanceDifference > 0.01,
      }
    });

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
      message: `Sync: ${imported} imported, ${skipped} skipped, ${duplicatesDetected} duplicates. Balance diff: R$${balanceDifference.toFixed(2)}`,
      payload: { 
        imported, 
        skipped, 
        duplicates_detected: duplicatesDetected,
        total: allTransactions.length, 
        accounts_count: accounts.length,
        api_balance: totalApiBalance,
        system_balance: totalSystemBalance,
        balance_difference: balanceDifference,
        reconciliation_needed: balanceDifference > 0.01,
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        imported,
        skipped,
        duplicates_detected: duplicatesDetected,
        total: allTransactions.length,
        accounts: accounts.length,
        connection_id: connectionToSync.id,
        api_balance: totalApiBalance,
        system_balance: totalSystemBalance,
        balance_difference: balanceDifference,
        reconciliation_needed: balanceDifference > 0.01,
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
