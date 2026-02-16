import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const PLUGGY_API_URL = 'https://api.pluggy.ai';

// ========================================
// PLUGGY AUTH
// ========================================
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
  if (!token) throw new Error('Pluggy auth response missing apiKey');
  console.log(`[AUTH] Token obtained (${token.length} chars)`);
  return token;
}

// ========================================
// CREDIT CARD HELPERS
// ========================================
function isCreditCardPayment(description: string): boolean {
  const text = (description || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const patterns = [
    "pagamento recebido", "pagamento da fatura", "pagamento fatura",
    "pgto fatura", "pagamento cartao", "pgto cartao", "liq fatura",
    "liquidacao fatura", "liquidacao cartao", "pag fatura cartao", "pagto fatura",
  ];
  return patterns.some(k => text.includes(k));
}

function isReversalOrRefund(description: string): boolean {
  const text = (description || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const patterns = ["estorno", "devolucao", "reembolso", "chargeback", "reversal", "refund", "cancelamento"];
  return patterns.some(k => text.includes(k));
}

// ========================================
// SAFE API RESPONSE EXTRACTION
// ========================================
function extractItems<T>(response: unknown): { items: T[]; totalPages: number; page: number } {
  if (!response || typeof response !== "object") return { items: [], totalPages: 1, page: 1 };
  const r = response as Record<string, unknown>;
  const totalPages = typeof r.totalPages === 'number' ? r.totalPages : 1;
  const page = typeof r.page === 'number' ? r.page : 1;
  if (Array.isArray(r)) return { items: r, totalPages, page };
  if (Array.isArray(r.results)) return { items: r.results, totalPages, page };
  if (Array.isArray(r.data)) return { items: r.data, totalPages, page };
  if (Array.isArray(r.items)) return { items: r.items, totalPages, page };
  if (r.data && typeof r.data === "object") {
    const d = r.data as Record<string, unknown>;
    if (Array.isArray(d.items)) return { items: d.items, totalPages, page };
    if (Array.isArray(d.results)) return { items: d.results, totalPages, page };
  }
  console.warn("[EXTRACT] Unknown response structure:", Object.keys(r));
  return { items: [], totalPages, page };
}

// ========================================
// PAGINATED FETCH
// ========================================
async function fetchAllPages<T>(baseUrl: string, headers: Record<string, string>, label: string): Promise<T[]> {
  const allItems: T[] = [];
  let currentPage = 1;
  let totalPages = 1;
  do {
    const sep = baseUrl.includes('?') ? '&' : '?';
    const url = `${baseUrl}${sep}page=${currentPage}&pageSize=500`;
    console.log(`[${label}] Fetching page ${currentPage}/${totalPages}`);
    const response = await fetch(url, { method: 'GET', headers });
    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[${label}] Failed page ${currentPage} (${response.status}):`, errorText);
      break;
    }
    const data = await response.json();
    const extracted = extractItems<T>(data);
    allItems.push(...extracted.items);
    totalPages = extracted.totalPages;
    console.log(`[${label}] Page ${currentPage}/${totalPages}: ${extracted.items.length} items (total: ${allItems.length})`);
    currentPage++;
  } while (currentPage <= totalPages);
  return allItems;
}

// ========================================
// DEDUP KEY
// ========================================
function generateDedupKey(date: string, amount: number, description: string, externalId: string): string {
  if (externalId && externalId !== `${date}-${amount}-${description}`) return `ext:${externalId}`;
  const normalizedDesc = (description || '').toLowerCase().trim().replace(/\s+/g, ' ').substring(0, 100);
  return `comp:${date}|${Math.abs(amount).toFixed(2)}|${normalizedDesc}`;
}

// ========================================
// TEXT NORMALIZATION & SIMILARITY
// ========================================
function normalizeText(text: string): string {
  let result = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  result = result.replace(/\b\d{1,4}\b/g, "");
  result = result.replace(/\b(pix|ted|doc|tev|transf|deb|cred|pag|rec|ref|nr|num|nf|cp|dp|de|para|em|do|da|dos|das|o|a|os|as|e|ou|que|com|por|no|na|nos|nas|um|uma|uns|umas)\b/gi, "");
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
  const nd = normalizeText(description);
  const nk = normalizeText(keyword);
  if (nd.includes(nk)) return Math.min(0.75 + nk.length / Math.max(nd.length, 1) * 0.25, 1.0);
  return 0;
}

// ========================================
// CLASSIFY TRANSACTION (rules + patterns only)
// ========================================
async function classifyTransaction(supabaseAdmin: any, txId: string, description: string, amount: number, type: string, organizationId: string): Promise<void> {
  const normalizedDescription = normalizeText(description);
  await supabaseAdmin.from("transactions").update({ normalized_description: normalizedDescription }).eq("id", txId);

  // STEP 1: Reconciliation Rules (>= 80%)
  const { data: rules } = await supabaseAdmin
    .from("reconciliation_rules").select("id, description, category_id, cost_center_id, transaction_type, amount")
    .eq("organization_id", organizationId).eq("is_active", true).eq("transaction_type", type);

  if (rules && rules.length > 0) {
    let bestMatch: { rule: any; similarity: number } | null = null;
    let matchCount = 0;
    for (const rule of rules) {
      const kSim = containsKeyword(description, rule.description);
      const nSim = calculateSimilarity(normalizedDescription, normalizeText(rule.description));
      let similarity = Math.max(kSim, nSim);
      if (rule.amount && Math.abs(amount - rule.amount) / rule.amount <= 0.01) similarity = Math.min(similarity + 0.1, 1.0);
      if (similarity >= 0.80) {
        matchCount++;
        if (!bestMatch || similarity > bestMatch.similarity) bestMatch = { rule, similarity };
      }
    }
    if (bestMatch && matchCount === 1) {
      await supabaseAdmin.from("transactions").update({
        category_id: bestMatch.rule.category_id, cost_center_id: bestMatch.rule.cost_center_id,
        classification_source: "rule", validation_status: "validated", validated_at: new Date().toISOString(),
      }).eq("id", txId);
      console.log(`[CLASSIFY] TX ${txId}: rule match (${(bestMatch.similarity * 100).toFixed(0)}%)`);
      return;
    }
  }

  // STEP 2: Transaction Patterns (confidence >= 85%, occurrences >= 3)
  const { data: patterns } = await supabaseAdmin
    .from("transaction_patterns").select("id, normalized_description, category_id, cost_center_id, confidence, occurrences")
    .eq("organization_id", organizationId).eq("transaction_type", type).gte("confidence", 0.6)
    .order("confidence", { ascending: false }).limit(50);

  if (patterns && patterns.length > 0) {
    let bestPattern: { pattern: any; similarity: number } | null = null;
    for (const pattern of patterns) {
      const similarity = calculateSimilarity(normalizedDescription, pattern.normalized_description);
      if (similarity >= 0.80 && (!bestPattern || similarity > bestPattern.similarity)) bestPattern = { pattern, similarity };
    }
    if (bestPattern) {
      const finalConf = Math.min(bestPattern.similarity * (bestPattern.pattern.confidence || 0.5) * 1.2, 0.95);
      const autoValidate = finalConf >= 0.85 && (bestPattern.pattern.occurrences || 1) >= 3;
      await supabaseAdmin.from("transactions").update({
        category_id: bestPattern.pattern.category_id, cost_center_id: bestPattern.pattern.cost_center_id,
        classification_source: "pattern",
        ...(autoValidate ? { validation_status: "validated", validated_at: new Date().toISOString() } : {}),
      }).eq("id", txId);
      console.log(`[CLASSIFY] TX ${txId}: pattern match (conf=${(finalConf * 100).toFixed(0)}%)`);
      return;
    }
  }
  console.log(`[CLASSIFY] TX ${txId}: no match, pending manual classification`);
}

// ========================================
// WAIT FOR ITEM SUCCESS (polling with retries)
// ========================================
async function waitForItemSuccess(pluggyItemId: string, headers: Record<string, string>, maxAttempts = 15, intervalMs = 4000): Promise<{ item: any; success: boolean; errorReason: string | null }> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[POLL] Checking item status (attempt ${attempt}/${maxAttempts})...`);
    try {
      const response = await fetch(`${PLUGGY_API_URL}/items/${pluggyItemId}`, { method: 'GET', headers });
      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[POLL] HTTP ${response.status}: ${errText}`);
        if (attempt === maxAttempts) return { item: null, success: false, errorReason: `HTTP ${response.status}: ${errText}` };
        await new Promise(r => setTimeout(r, intervalMs));
        continue;
      }
      const item = await response.json();
      const status = item?.status;
      console.log(`[POLL] Item status: ${status}`);

      if (status === 'UPDATED' || status === 'LOGIN_ERROR' || status === 'OUTDATED') {
        // Terminal states
        if (status === 'UPDATED') {
          return { item, success: true, errorReason: null };
        }
        // Error states - provide specific reason
        const executionStatus = item?.statusDetail?.accounts?.message || item?.statusDetail?.creditCards?.message || item?.statusDetail?.identity?.message;
        let reason = `Status: ${status}`;
        if (status === 'LOGIN_ERROR') reason = 'Erro de login no banco. Verifique suas credenciais ou MFA pendente e reconecte.';
        if (status === 'OUTDATED') reason = 'Consentimento expirado. Reconecte o banco para renovar o acesso.';
        if (executionStatus) reason += ` (${executionStatus})`;
        return { item, success: false, errorReason: reason };
      }
      
      // Still processing
      if (status === 'UPDATING' || status === 'WAITING' || status === 'MERGING' || status === 'CREATED') {
        if (attempt === maxAttempts) {
          return { item, success: false, errorReason: `Tempo limite excedido. O banco ainda está processando (status: ${status}). Tente sincronizar novamente em alguns minutos.` };
        }
        await new Promise(r => setTimeout(r, intervalMs));
        continue;
      }

      // Unknown status - try to proceed
      console.warn(`[POLL] Unknown item status: ${status}`);
      return { item, success: true, errorReason: null };
    } catch (err) {
      console.warn(`[POLL] Error on attempt ${attempt}:`, err);
      if (attempt === maxAttempts) return { item: null, success: false, errorReason: `Erro ao verificar status: ${err}` };
      await new Promise(r => setTimeout(r, intervalMs));
    }
  }
  return { item: null, success: false, errorReason: 'Tempo limite excedido ao aguardar sincronização do banco.' };
}

// ========================================
// ACCOUNT TYPE MAPPING
// ========================================
function mapPluggyAccountType(pluggyType: string): string {
  const typeMap: Record<string, string> = {
    'BANK': 'checking', 'CHECKING': 'checking', 'SAVINGS': 'savings',
    'CREDIT': 'credit_card', 'INVESTMENT': 'investment',
  };
  return typeMap[pluggyType?.toUpperCase()] || 'checking';
}

// ========================================
// MAIN HANDLER
// ========================================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const PLUGGY_CLIENT_ID = Deno.env.get('PLUGGY_CLIENT_ID');
  const PLUGGY_CLIENT_SECRET = Deno.env.get('PLUGGY_CLIENT_SECRET');

  if (!PLUGGY_CLIENT_ID || !PLUGGY_CLIENT_SECRET) {
    return new Response(JSON.stringify({ error: 'Configuração Pluggy incompleta. Verifique os secrets.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Authorization required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const token = authHeader.replace('Bearer ', '');
    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser(token);
    if (userError || !user) return new Response(JSON.stringify({ error: 'Token inválido' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { organization_id, bank_connection_id, item_id, from_date, to_date } = await req.json();
    if (!organization_id && !bank_connection_id) {
      return new Response(JSON.stringify({ error: 'organization_id or bank_connection_id is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Access check
    const { data: viewableOrgs } = await supabaseUser.rpc('get_viewable_organizations', { _user_id: user.id });
    const orgIdToCheck = organization_id || (bank_connection_id ? (await supabaseAdmin.from('bank_connections').select('organization_id').eq('id', bank_connection_id).single()).data?.organization_id : null);
    if (!viewableOrgs?.includes(orgIdToCheck)) {
      return new Response(JSON.stringify({ error: 'Acesso negado' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Pluggy auth
    const pluggyToken = await getPluggyToken(PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET);
    const pluggyHeaders = { 'X-API-KEY': pluggyToken, 'Content-Type': 'application/json' };

    // Get or create bank connection
    let connectionToSync: any = null;
    if (bank_connection_id) {
      const { data: conn, error: connErr } = await supabaseAdmin.from('bank_connections').select('*').eq('id', bank_connection_id).single();
      if (connErr || !conn) return new Response(JSON.stringify({ error: 'Conexão bancária não encontrada' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      connectionToSync = conn;
    } else {
      const { data: existing } = await supabaseAdmin.from('bank_connections').select('*').eq('organization_id', organization_id).eq('provider', 'pluggy').eq('status', 'active').maybeSingle();
      if (existing) {
        connectionToSync = existing;
      } else {
        const { data: newConn, error: createErr } = await supabaseAdmin.from('bank_connections').insert({
          organization_id, user_id: user.id, provider: 'pluggy', provider_name: 'Open Finance (Pluggy)', status: 'active'
        }).select().single();
        if (createErr) throw new Error('Falha ao criar conexão bancária');
        connectionToSync = newConn;
      }
    }

    const pluggyItemId = item_id || connectionToSync.external_account_id;
    if (!pluggyItemId) {
      return new Response(JSON.stringify({ success: true, message: 'Nenhum item Pluggy vinculado. Conecte um banco primeiro.', imported: 0, skipped: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ========================================
    // STEP 1: WAIT FOR ITEM TO REACH SUCCESS
    // ========================================
    console.log(`[SYNC] Waiting for item ${pluggyItemId} to finish syncing...`);
    const { item: itemDetails, success: itemReady, errorReason } = await waitForItemSuccess(pluggyItemId, pluggyHeaders);

    if (!itemReady) {
      console.error(`[SYNC] Item not ready: ${errorReason}`);
      const connectorName = itemDetails?.connector?.name || connectionToSync.provider_name || 'Open Finance';
      const connectorLogo = itemDetails?.connector?.imageUrl || null;

      await supabaseAdmin.from('bank_connections').update({
        provider_name: connectorName,
        sync_error: errorReason,
        metadata: { ...(connectionToSync.metadata || {}), bank_name: connectorName, bank_logo_url: connectorLogo, item_status: itemDetails?.status || 'ERROR' },
        updated_at: new Date().toISOString(),
      }).eq('id', connectionToSync.id);

      await supabaseAdmin.from('integration_logs').insert({
        organization_id: connectionToSync.organization_id, bank_connection_id: connectionToSync.id,
        provider: 'pluggy', event_type: 'sync', status: 'error', message: errorReason,
      });

      return new Response(JSON.stringify({ success: false, error: errorReason, imported: 0, skipped: 0, item_status: itemDetails?.status || 'ERROR' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[SYNC] Item ready! Connector: ${itemDetails?.connector?.name}, Status: ${itemDetails?.status}`);

    // ========================================
    // STEP 2: FETCH ALL ACCOUNTS
    // ========================================
    let accounts: any[] = [];
    try {
      accounts = await fetchAllPages(`${PLUGGY_API_URL}/accounts?itemId=${pluggyItemId}`, pluggyHeaders, 'ACCOUNTS');
      console.log(`[ACCOUNTS] Total: ${accounts.length} — Types: ${accounts.map((a: any) => `${a.type}(${a.name})`).join(', ')}`);
    } catch (e) { console.warn('Error fetching accounts:', e); }

    // ========================================
    // STEP 3: FETCH INVESTMENTS (separate endpoint)
    // ========================================
    let investments: any[] = [];
    try {
      investments = await fetchAllPages(`${PLUGGY_API_URL}/investments?itemId=${pluggyItemId}`, pluggyHeaders, 'INVESTMENTS');
      console.log(`[INVESTMENTS] Total: ${investments.length}`);
    } catch (e) { console.warn('Error fetching investments:', e); }

    // ========================================
    // SAVE METADATA
    // ========================================
    const connectorName = itemDetails?.connector?.name || connectionToSync.provider_name || 'Open Finance';
    const connectorLogo = itemDetails?.connector?.imageUrl || null;
    const pluggyAccountsSummary = accounts.map((acc: any) => ({
      id: acc.id, type: acc.type, subtype: acc.subtype, name: acc.name,
      number: acc.number || null, agency: acc.bankData?.branch || null,
      balance: acc.balance ?? null, available_balance: acc.creditData?.availableCreditLimit ?? acc.balance ?? null,
    }));
    const totalBalance = accounts.reduce((sum: number, acc: any) => sum + (acc.balance || 0), 0);

    await supabaseAdmin.from('bank_connections').update({
      provider_name: connectorName,
      metadata: {
        ...(connectionToSync.metadata || {}), bank_name: connectorName, bank_logo_url: connectorLogo,
        connector_id: itemDetails?.connector?.id || null, connector_name: itemDetails?.connector?.name || null,
        pluggy_accounts: pluggyAccountsSummary, last_balance: totalBalance,
        last_sync_accounts_count: accounts.length, item_status: itemDetails?.status || null,
      },
      updated_at: new Date().toISOString(),
    }).eq('id', connectionToSync.id);

    // ========================================
    // STEP 4: CREATE/UPDATE LOCAL ACCOUNTS
    // ========================================
    const pluggyAccountToLocal: Record<string, string> = {};
    for (const acc of accounts) {
      const accountType = mapPluggyAccountType(acc.type || acc.subtype || 'BANK');
      const accountName = acc.name || `${connectorName} - ${acc.type || 'Conta'}`;
      const apiBalance = acc.balance ?? 0;
      const now = new Date().toISOString();

      const { data: existing } = await supabaseAdmin.from('accounts').select('id')
        .eq('organization_id', connectionToSync.organization_id).eq('bank_name', connectorName).eq('name', accountName).maybeSingle();

      if (existing) {
        await supabaseAdmin.from('accounts').update({ official_balance: apiBalance, last_official_balance_at: now, current_balance: apiBalance, updated_at: now }).eq('id', existing.id);
        pluggyAccountToLocal[acc.id] = existing.id;
        console.log(`[ACC] Updated ${existing.id}: ${accountName} balance=${apiBalance}`);
      } else {
        const { data: newAcc, error: accErr } = await supabaseAdmin.from('accounts').insert({
          organization_id: connectionToSync.organization_id, user_id: connectionToSync.user_id,
          name: accountName, account_type: accountType, bank_name: connectorName,
          current_balance: apiBalance, initial_balance: apiBalance, official_balance: apiBalance,
          last_official_balance_at: now, status: 'active', start_date: now.split('T')[0],
        }).select('id').single();
        if (accErr) { console.error(`[ACC] Failed to create for ${acc.id}:`, accErr); }
        else { pluggyAccountToLocal[acc.id] = newAcc.id; console.log(`[ACC] Created ${newAcc.id}: ${accountName}`); }
      }
    }

    // Investment accounts
    const pluggyInvToLocal: Record<string, string> = {};
    for (const inv of investments) {
      const invName = inv.name || `${connectorName} - Investimento`;
      const apiBalance = inv.balance ?? inv.amount ?? 0;
      const now = new Date().toISOString();
      const { data: existing } = await supabaseAdmin.from('accounts').select('id')
        .eq('organization_id', connectionToSync.organization_id).eq('bank_name', connectorName).eq('name', invName).maybeSingle();
      if (existing) {
        await supabaseAdmin.from('accounts').update({ official_balance: apiBalance, last_official_balance_at: now, current_balance: apiBalance, updated_at: now }).eq('id', existing.id);
        pluggyInvToLocal[inv.id] = existing.id;
      } else {
        const { data: newAcc, error: accErr } = await supabaseAdmin.from('accounts').insert({
          organization_id: connectionToSync.organization_id, user_id: connectionToSync.user_id,
          name: invName, account_type: 'investment', bank_name: connectorName,
          current_balance: apiBalance, initial_balance: apiBalance, official_balance: apiBalance,
          last_official_balance_at: now, status: 'active', start_date: now.split('T')[0],
        }).select('id').single();
        if (!accErr && newAcc) pluggyInvToLocal[inv.id] = newAcc.id;
      }
    }

    console.log(`[ACC] Mapped ${Object.keys(pluggyAccountToLocal).length} accounts + ${Object.keys(pluggyInvToLocal).length} investments`);

    // ========================================
    // STEP 5: FETCH ALL TRANSACTIONS
    // ========================================
    let allTransactions: any[] = [];
    for (const account of accounts) {
      try {
        let baseUrl = `${PLUGGY_API_URL}/transactions?accountId=${account.id}`;
        if (from_date) baseUrl += `&from=${from_date}`;
        if (to_date) baseUrl += `&to=${to_date}`;
        console.log(`[TX] Fetching for account ${account.id} (${account.type}: ${account.name})...`);
        const txs = await fetchAllPages(baseUrl, pluggyHeaders, `TX-${account.type}`);
        allTransactions.push(...txs.map((tx: any) => ({ ...tx, _pluggyAccountId: account.id, _pluggyAccountType: account.type })));
      } catch (e) { console.warn(`[TX] Error for account ${account.id}:`, e); }
    }

    // Investment transactions
    for (const inv of investments) {
      try {
        let baseUrl = `${PLUGGY_API_URL}/investments/${inv.id}/transactions`;
        if (from_date) baseUrl += `?from=${from_date}`;
        if (to_date) baseUrl += `${from_date ? '&' : '?'}to=${to_date}`;
        const txs = await fetchAllPages(baseUrl, pluggyHeaders, `INV-TX`);
        const localId = pluggyInvToLocal[inv.id];
        if (localId) {
          allTransactions.push(...txs.map((tx: any) => ({ ...tx, _pluggyAccountId: inv.id, _isInvestment: true, _localAccountId: localId })));
        }
      } catch (e) { console.warn(`[INV-TX] Error for ${inv.id}:`, e); }
    }

    console.log(`[TX] Total fetched: ${allTransactions.length}`);

    // Fallback account if needed
    let fallbackAccountId: string | null = null;
    if (Object.keys(pluggyAccountToLocal).length === 0 && allTransactions.length > 0) {
      const { data: fb } = await supabaseAdmin.from('accounts').select('id').eq('organization_id', connectionToSync.organization_id).eq('status', 'active').limit(1).maybeSingle();
      fallbackAccountId = fb?.id || null;
      if (!fallbackAccountId) {
        const { data: created } = await supabaseAdmin.from('accounts').insert({
          organization_id: connectionToSync.organization_id, user_id: connectionToSync.user_id,
          name: `${connectorName} - Conta`, account_type: 'checking', bank_name: connectorName,
          current_balance: 0, initial_balance: 0, official_balance: 0,
          last_official_balance_at: new Date().toISOString(), status: 'active', start_date: new Date().toISOString().split('T')[0],
        }).select('id').single();
        fallbackAccountId = created?.id || null;
      }
    }

    // ========================================
    // STEP 6: IMPORT TRANSACTIONS WITH DEDUP + CLASSIFICATION
    // ========================================
    let imported = 0, skipped = 0, duplicatesDetected = 0;
    const newTxIds: { id: string; description: string; amount: number; type: string; accountId: string; date: string }[] = [];

    for (const tx of allTransactions) {
      const externalId = tx.id || `${tx.date}-${tx.amount}-${tx.description}`;
      const rawAmount = tx.amount || 0;
      const amount = Math.abs(rawAmount);
      const txDate = tx.date ? tx.date.split('T')[0] : new Date().toISOString().split('T')[0];
      const description = tx.description || tx.descriptionRaw || 'Movimentação via Open Finance';
      const dedupKey = generateDedupKey(txDate, rawAmount, description, externalId);

      // DEDUP: external ID — scoped to ORGANIZATION (not just bank_connection) to prevent cross-connection duplicates
      const { data: dup1 } = await supabaseAdmin.from('transactions').select('id')
        .eq('external_transaction_id', externalId).eq('organization_id', connectionToSync.organization_id).maybeSingle();
      if (dup1) { skipped++; duplicatesDetected++; continue; }

      // DEDUP: composite key — scoped to ORGANIZATION
      const { data: dup2 } = await supabaseAdmin.from('transactions').select('id')
        .eq('organization_id', connectionToSync.organization_id).eq('sync_dedup_key', dedupKey).maybeSingle();
      if (dup2) { skipped++; duplicatesDetected++; continue; }

      // DEDUP: fuzzy — scoped to ORGANIZATION + account
      const resolvedLocalAccount = tx._localAccountId || pluggyAccountToLocal[tx._pluggyAccountId] || pluggyInvToLocal[tx._pluggyAccountId] || fallbackAccountId;
      const { data: fuzzyMatches } = await supabaseAdmin.from('transactions').select('id, description')
        .eq('organization_id', connectionToSync.organization_id).eq('date', txDate).eq('amount', amount)
        .eq('account_id', resolvedLocalAccount).limit(5);
      if (fuzzyMatches && fuzzyMatches.length > 0) {
        const normNew = normalizeText(description);
        const isDup = fuzzyMatches.some((e: any) => calculateSimilarity(normNew, normalizeText(e.description || '')) >= 0.90);
        if (isDup) { skipped++; duplicatesDetected++; continue; }
      }

      // Resolve local account
      const localAccountId = tx._localAccountId || pluggyAccountToLocal[tx._pluggyAccountId] || pluggyInvToLocal[tx._pluggyAccountId] || fallbackAccountId;
      if (!localAccountId) { console.warn(`[TX] No local account for ${tx._pluggyAccountId}`); skipped++; continue; }

      // ========================================
      // CLASSIFY TRANSACTION TYPE
      // Uses: creditDebitType, type, description — NOT just the sign
      // ========================================
      const pluggyAccType = mapPluggyAccountType(tx._pluggyAccountType || 'BANK');
      const creditDebitType = (tx.creditDebitType || tx.type || '').toUpperCase(); // DEBIT or CREDIT from Pluggy
      let isCcPayment = false;
      let txType: string;

      if (tx._isInvestment) {
        // Investment: CREDIT = redemption, DEBIT = investment
        txType = (creditDebitType === 'CREDIT' || rawAmount > 0) ? 'redemption' : 'investment';
      } else if (pluggyAccType === 'credit_card') {
        // Credit card: ALL are expense EXCEPT bill payments and reversals
        if (isCreditCardPayment(description)) {
          txType = 'transfer';
          isCcPayment = true;
          console.log(`[CC] Bill payment → transfer: "${description}"`);
        } else {
          // Everything else on credit card = expense (purchases, fees, interest, etc.)
          txType = 'expense';
        }
      } else {
        // Regular accounts (checking, savings): use creditDebitType field
        if (creditDebitType === 'CREDIT') {
          txType = 'income';
        } else if (creditDebitType === 'DEBIT') {
          txType = 'expense';
        } else {
          // Fallback to sign
          txType = rawAmount > 0 ? 'income' : 'expense';
        }
        // Check if it's a CC bill payment from checking
        if (txType === 'expense' && isCreditCardPayment(description)) {
          txType = 'transfer';
          isCcPayment = true;
          console.log(`[CHECKING] Bill payment → transfer: "${description}"`);
        }
      }

      // INSERT
      const { data: inserted, error: insertErr } = await supabaseAdmin.from('transactions').insert({
        organization_id: connectionToSync.organization_id, user_id: connectionToSync.user_id,
        bank_connection_id: connectionToSync.id, external_transaction_id: externalId, sync_dedup_key: dedupKey,
        account_id: localAccountId, date: txDate, description, raw_description: JSON.stringify(tx),
        amount, type: txType, status: 'completed',
        ...(isCcPayment ? { classification_source: 'system', validation_status: 'validated', validated_at: new Date().toISOString() } : {}),
        notes: `Importado via Open Finance (${connectorName})`
      }).select('id').single();

      if (insertErr) {
        if (insertErr.code === '23505') { skipped++; duplicatesDetected++; }
        else { console.error('Insert error:', insertErr); skipped++; }
      } else {
        imported++;
        newTxIds.push({ id: inserted.id, description, amount, type: txType, accountId: localAccountId, date: txDate });
      }
    }

    // ========================================
    // STEP 7: CLASSIFY NEW TRANSACTIONS
    // ========================================
    if (newTxIds.length > 0) {
      console.log(`[CLASSIFY] Processing ${newTxIds.length} new transactions...`);
      for (const tx of newTxIds) {
        try { await classifyTransaction(supabaseAdmin, tx.id, tx.description, tx.amount, tx.type, connectionToSync.organization_id); }
        catch (e) { console.warn(`[CLASSIFY] Error for TX ${tx.id}:`, e); }
      }
    }

    // ========================================
    // STEP 8: MIRROR DETECTION (same account, same day, same amount, income+expense → ignore both)
    // ========================================
    if (newTxIds.length > 0) {
      console.log(`[MIRROR] Checking for mirror transactions...`);
      let mirrorPairs = 0;
      const byKey = new Map<string, typeof newTxIds>();
      for (const tx of newTxIds) {
        const key = `${tx.accountId}|${tx.date}|${tx.amount.toFixed(2)}`;
        if (!byKey.has(key)) byKey.set(key, []);
        byKey.get(key)!.push(tx);
      }
      for (const [key, group] of byKey.entries()) {
        const incomes = group.filter(t => t.type === 'income');
        const expenses = group.filter(t => t.type === 'expense');
        const pairs = Math.min(incomes.length, expenses.length);
        for (let i = 0; i < pairs; i++) {
          await supabaseAdmin.from('transactions')
            .update({ is_ignored: true, notes: 'Movimento espelhado detectado (entrada+saída mesmo valor/conta/dia)' })
            .in('id', [incomes[i].id, expenses[i].id]);
          await supabaseAdmin.from('integration_logs').insert({
            organization_id: connectionToSync.organization_id, bank_connection_id: connectionToSync.id,
            provider: 'pluggy', event_type: 'mirror_detection', status: 'info',
            message: `Mirror: income=${incomes[i].id}, expense=${expenses[i].id}, amount=${group[0].amount}`,
          });
          mirrorPairs++;
        }
      }
      console.log(`[MIRROR] Found ${mirrorPairs} pairs`);
    }

    // ========================================
    // STEP 9: RECONCILIATION & AUDIT
    // ========================================
    let totalApiBalance = 0, totalSystemBalance = 0;
    for (const acc of accounts) {
      const localId = pluggyAccountToLocal[acc.id];
      if (!localId) continue;
      totalApiBalance += (acc.balance ?? 0);
      const { data: sysBalance } = await supabaseAdmin.rpc('calculate_account_balance', { account_uuid: localId });
      totalSystemBalance += (sysBalance ?? 0);
    }
    const balanceDiff = Math.abs(totalApiBalance - totalSystemBalance);

    await supabaseAdmin.from('sync_audit_logs').insert({
      organization_id: connectionToSync.organization_id, bank_connection_id: connectionToSync.id,
      sync_date: new Date().toISOString(), api_balance: totalApiBalance, system_balance: totalSystemBalance,
      balance_difference: balanceDiff, transactions_imported: imported, transactions_skipped: skipped,
      transactions_total: allTransactions.length, duplicates_detected: duplicatesDetected,
      details: { connector_name: connectorName, accounts_count: accounts.length, item_id: pluggyItemId },
    });

    // Update connection status
    await supabaseAdmin.from('bank_connections').update({
      last_sync_at: new Date().toISOString(), sync_error: null, status: 'active',
      external_account_id: pluggyItemId, updated_at: new Date().toISOString()
    }).eq('id', connectionToSync.id);

    // Success log
    await supabaseAdmin.from('integration_logs').insert({
      organization_id: connectionToSync.organization_id, bank_connection_id: connectionToSync.id,
      provider: 'pluggy', event_type: 'sync', status: 'success',
      message: `Sync OK: ${imported} importadas, ${skipped} ignoradas, ${duplicatesDetected} duplicatas. Saldo API: R$${totalApiBalance.toFixed(2)}, Diff: R$${balanceDiff.toFixed(2)}`,
      payload: { imported, skipped, duplicates_detected: duplicatesDetected, total: allTransactions.length, accounts_count: accounts.length, api_balance: totalApiBalance, balance_difference: balanceDiff },
    });

    // ========================================
    // STEP 10: POPULATE NEW OPEN FINANCE TABLES
    // ========================================
    try {
      // Upsert open_finance_items - use institution_name as conflict key to prevent duplicates on reconnection
      const ofItemData = {
        organization_id: connectionToSync.organization_id,
        user_id: connectionToSync.user_id,
        pluggy_item_id: pluggyItemId,
        connector_id: itemDetails?.connector?.id || null,
        institution_name: connectorName,
        institution_type: itemDetails?.connector?.type || null,
        status: 'completed',
        execution_status: itemDetails?.status || 'UPDATED',
        last_sync_at: new Date().toISOString(),
        products: itemDetails?.connector?.products || [],
        consecutive_failures: 0,
        error_message: null,
        error_code: null,
      };
      const { data: upsertedItem } = await supabaseAdmin
        .from('open_finance_items')
        .upsert(ofItemData, { onConflict: 'organization_id,institution_name' })
        .select('id')
        .single();

      const ofItemId = upsertedItem?.id;

      if (ofItemId) {
        // Upsert open_finance_accounts - use (item_id, name, account_type) as conflict key
        for (const acc of accounts) {
          await supabaseAdmin.from('open_finance_accounts').upsert({
            organization_id: connectionToSync.organization_id,
            item_id: ofItemId,
            pluggy_account_id: acc.id,
            account_number: acc.number || null,
            account_type: acc.type || null,
            subtype: acc.subtype || null,
            name: acc.name || connectorName,
            balance: acc.balance ?? 0,
            currency_code: acc.currencyCode || 'BRL',
            credit_limit: acc.creditData?.limit ?? null,
            available_credit: acc.creditData?.availableCreditLimit ?? null,
            closing_day: acc.creditData?.closingDay ?? null,
            due_day: acc.creditData?.dueDay ?? null,
            local_account_id: pluggyAccountToLocal[acc.id] || null,
            raw_data: acc,
            last_sync_at: new Date().toISOString(),
          }, { onConflict: 'item_id,pluggy_account_id' });
        }

        // Create sync log
        await supabaseAdmin.from('open_finance_sync_logs').insert({
          organization_id: connectionToSync.organization_id,
          item_id: ofItemId,
          sync_type: 'full',
          status: 'success',
          records_fetched: allTransactions.length,
          records_imported: imported,
          records_skipped: skipped,
          records_failed: 0,
          completed_at: new Date().toISOString(),
          duration_ms: 0,
          metadata: { accounts_count: accounts.length, investments_count: investments.length, duplicates: duplicatesDetected },
        });
      }
    } catch (ofErr) {
      console.warn('[OF-TABLES] Error populating open finance tables (non-blocking):', ofErr);
    }

    return new Response(JSON.stringify({
      success: true, imported, skipped, duplicates_detected: duplicatesDetected, total: allTransactions.length,
      accounts: accounts.length, connection_id: connectionToSync.id,
      api_balance: totalApiBalance, system_balance: totalSystemBalance, balance_difference: balanceDiff,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: unknown) {
    console.error('Error in pluggy-sync:', error);
    const msg = error instanceof Error ? error.message : 'Erro interno do servidor';
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
