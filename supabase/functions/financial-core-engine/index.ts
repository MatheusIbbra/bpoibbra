import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Auth: accept service_role or valid user JWT
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const token = authHeader.replace('Bearer ', '');
  const isServiceRole = token === SUPABASE_SERVICE_ROLE_KEY;
  if (!isServiceRole) {
    const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }

  try {
    const { action, organization_id, transaction_data, source } = await req.json();

    if (action !== 'process_transaction') {
      return new Response(
        JSON.stringify({ error: 'Invalid action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[ENGINE] Processing transaction:', transaction_data?.id);

    // 1. Check for duplicates by external_transaction_id OR hash
    if (transaction_data?.id) {
      const { data: existing } = await supabaseAdmin
        .from('transactions')
        .select('id')
        .eq('organization_id', organization_id)
        .eq('external_transaction_id', transaction_data.id)
        .maybeSingle();

      if (existing) {
        console.log('[ENGINE] Duplicate transaction (external_id), skipping');
        return new Response(
          JSON.stringify({ status: 'skipped', reason: 'duplicate' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 1b. Hash-based dedup: date + amount + normalized description + local account
    // We resolve the local account first so duplicate OF items (same bank reconnected) produce the same hash
    const rawAmount = transaction_data?.amount || 0;
    const description = transaction_data?.description || transaction_data?.descriptionRaw || 'Via Open Finance';
    const txDate = transaction_data?.date ? transaction_data.date.split('T')[0] : new Date().toISOString().split('T')[0];
    
    // Resolve local account early for hash consistency
    let localAccountId: string | null = null;
    if (transaction_data?.accountId) {
      const { data: ofAccount } = await supabaseAdmin
        .from('open_finance_accounts')
        .select('local_account_id')
        .eq('organization_id', organization_id)
        .eq('pluggy_account_id', transaction_data.accountId)
        .maybeSingle();
      localAccountId = ofAccount?.local_account_id || null;
    }
    if (!localAccountId) {
      const { data: fallback } = await supabaseAdmin
        .from('accounts')
        .select('id')
        .eq('organization_id', organization_id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      localAccountId = fallback?.id || null;
    }
    
    // Use localAccountId in hash so reconnected banks produce same hash
    const hashInput = `${txDate}|${Math.abs(rawAmount).toFixed(2)}|${normalizeText(description)}|${localAccountId || transaction_data?.accountId || ''}`;
    const txHash = await computeHash(hashInput);

    {
      const { data: hashDup } = await supabaseAdmin
        .from('transactions')
        .select('id')
        .eq('organization_id', organization_id)
        .eq('transaction_hash', txHash)
        .maybeSingle();

      if (hashDup) {
        console.log('[ENGINE] Duplicate transaction (hash), skipping');
        return new Response(
          JSON.stringify({ status: 'skipped', reason: 'duplicate_hash' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 2. Local account already resolved above for hash dedup
    if (!localAccountId) {
      return new Response(
        JSON.stringify({ status: 'error', reason: 'no_account_found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Determine transaction type (rawAmount, description, txDate already computed in dedup step)
    const amount = Math.abs(rawAmount);

    let txType: string;
    const creditDebitType = (transaction_data?.creditDebitType || transaction_data?.type || '').toUpperCase();
    if (creditDebitType === 'CREDIT') {
      txType = 'income';
    } else if (creditDebitType === 'DEBIT') {
      txType = 'expense';
    } else {
      txType = rawAmount > 0 ? 'income' : 'expense';
    }

    // Check if it's a credit card bill payment
    if (isInvoicePayment(description)) {
      txType = 'transfer';
    }

    // 4. Auto-classify using patterns
    let categoryId: string | null = null;
    let costCenterId: string | null = null;
    let classificationSource: string | null = null;

    // Check exact description matches in existing transactions
    const { data: exactMatch } = await supabaseAdmin
      .from('transactions')
      .select('category_id, cost_center_id')
      .eq('organization_id', organization_id)
      .eq('description', description)
      .not('category_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (exactMatch?.category_id) {
      categoryId = exactMatch.category_id;
      costCenterId = exactMatch.cost_center_id;
      classificationSource = 'pattern';
    }

    // Check transaction_patterns table
    if (!categoryId) {
      const normalizedDesc = normalizeText(description);
      const { data: patterns } = await supabaseAdmin
        .from('transaction_patterns')
        .select('normalized_description, category_id, cost_center_id, confidence')
        .eq('organization_id', organization_id)
        .eq('transaction_type', txType)
        .gte('confidence', 0.7)
        .order('confidence', { ascending: false })
        .limit(20);

      if (patterns) {
        for (const pattern of patterns) {
          const similarity = calculateSimilarity(normalizedDesc, pattern.normalized_description);
          if (similarity >= 0.80) {
            categoryId = pattern.category_id;
            costCenterId = pattern.cost_center_id;
            classificationSource = 'pattern';
            break;
          }
        }
      }
    }

    // 5. Insert transaction
    const insertData: Record<string, unknown> = {
      organization_id,
      external_transaction_id: transaction_data?.id || null,
      transaction_hash: txHash,
      account_id: localAccountId,
      date: txDate,
      description,
      amount,
      type: txType,
      status: 'completed',
      notes: `Importado via ${source === 'open_finance' ? 'Open Finance' : source}`,
      user_id: transaction_data?._user_id || null,
    };

    if (categoryId) {
      insertData.category_id = categoryId;
      insertData.cost_center_id = costCenterId;
      insertData.classification_source = classificationSource;
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('transactions')
      .insert(insertData)
      .select('id')
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        return new Response(
          JSON.stringify({ status: 'skipped', reason: 'duplicate' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw insertError;
    }

    console.log('[ENGINE] Transaction processed:', inserted.id);

    return new Response(
      JSON.stringify({ status: 'success', transaction_id: inserted.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[ENGINE] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function isInvoicePayment(description: string): boolean {
  const text = (description || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const patterns = [
    'pagamento fatura', 'pagamento cartao', 'pag fatura', 'pgto fatura',
    'pagamento recebido', 'pgto cartao', 'liq fatura', 'fatura cartao'
  ];
  return patterns.some(p => text.includes(p));
}

function normalizeText(text: string): string {
  let result = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  result = result.replace(/\b\d{1,4}\b/g, "");
  result = result.replace(/\b(pix|ted|doc|tev|transf|deb|cred|pag|rec|ref|nr|num|nf|cp|dp)\b/gi, "");
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

async function computeHash(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
