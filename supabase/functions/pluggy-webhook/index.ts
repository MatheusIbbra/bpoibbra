import { createClient } from "npm:@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-pluggy-signature, x-webhook-signature',
};

const PLUGGY_API_URL = 'https://api.pluggy.ai';

// HMAC signature verification — MANDATORY for all webhook calls
function verifyPluggySignature(payload: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) return false;
  const hmac = createHmac('sha256', secret);
  hmac.update(payload);
  const expected = hmac.digest('hex');
  return signature === expected || signature === `sha256=${expected}`;
}

async function logSecurityEvent(supabase: any, event: {
  organization_id?: string | null;
  user_id?: string | null;
  event_type: string;
  severity: string;
  ip_address?: string | null;
  user_agent?: string | null;
  details?: Record<string, unknown>;
}) {
  try {
    await supabase.from('security_events').insert(event);
  } catch (e) {
    console.error('[SECURITY] Failed to log security event:', e);
  }
}

async function getPluggyToken(clientId: string, clientSecret: string): Promise<string> {
  const response = await fetch(`${PLUGGY_API_URL}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, clientSecret }),
  });
  if (!response.ok) throw new Error('Pluggy auth failed');
  const data = await response.json();
  return data.apiKey;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const PLUGGY_CLIENT_ID = Deno.env.get('PLUGGY_CLIENT_ID');
  const PLUGGY_CLIENT_SECRET = Deno.env.get('PLUGGY_CLIENT_SECRET');

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null;
  const userAgent = req.headers.get('user-agent') || null;

  try {
    const rawBody = await req.text();
    
    // ===== MANDATORY HMAC SIGNATURE VERIFICATION =====
    const signature = req.headers.get('x-pluggy-signature') || req.headers.get('x-webhook-signature');
    
    if (!PLUGGY_CLIENT_SECRET) {
      console.error('[WEBHOOK] PLUGGY_CLIENT_SECRET not configured — cannot verify signatures');
      await logSecurityEvent(supabaseAdmin, {
        event_type: 'hmac_invalid',
        severity: 'critical',
        ip_address: clientIp,
        user_agent: userAgent,
        details: { reason: 'PLUGGY_CLIENT_SECRET not configured', provider: 'pluggy' }
      });
      return new Response(JSON.stringify({ error: 'Webhook secret not configured' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!signature) {
      console.error('[WEBHOOK] Missing signature header — blocking request');
      await logSecurityEvent(supabaseAdmin, {
        event_type: 'hmac_invalid',
        severity: 'critical',
        ip_address: clientIp,
        user_agent: userAgent,
        details: { reason: 'Missing signature header', provider: 'pluggy' }
      });
      await supabaseAdmin.from('integration_logs').insert({
        provider: 'pluggy', event_type: 'webhook', status: 'error',
        message: 'Blocked: Missing webhook signature',
        ip_address: clientIp
      });
      return new Response(JSON.stringify({ error: 'Missing signature' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!verifyPluggySignature(rawBody, signature, PLUGGY_CLIENT_SECRET)) {
      console.error('[WEBHOOK] Invalid signature — blocking request');
      await logSecurityEvent(supabaseAdmin, {
        event_type: 'hmac_invalid',
        severity: 'critical',
        ip_address: clientIp,
        user_agent: userAgent,
        details: { reason: 'Invalid HMAC signature', provider: 'pluggy' }
      });
      await supabaseAdmin.from('integration_logs').insert({
        provider: 'pluggy', event_type: 'webhook', status: 'error',
        message: 'Blocked: Invalid webhook signature',
        ip_address: clientIp
      });
      return new Response(JSON.stringify({ error: 'Invalid signature' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = JSON.parse(rawBody);
    console.log('[WEBHOOK] Verified & received:', JSON.stringify(body));

    const { event, itemId, data, accountId } = body;

    // Log the webhook event
    await supabaseAdmin.from('integration_logs').insert({
      provider: 'pluggy',
      event_type: `webhook_${event}`,
      status: 'received',
      message: `Webhook event: ${event}`,
      payload: body
    });

    // =============================================
    // LOOKUP: Try new open_finance_items table first, fallback to bank_connections
    // =============================================
    let ofItem: any = null;
    let connection: any = null;

    const { data: ofItemData } = await supabaseAdmin
      .from('open_finance_items')
      .select('*')
      .eq('pluggy_item_id', itemId)
      .maybeSingle();
    ofItem = ofItemData;

    const { data: connData } = await supabaseAdmin
      .from('bank_connections')
      .select('*')
      .eq('external_account_id', itemId)
      .eq('provider', 'pluggy')
      .maybeSingle();
    connection = connData;

    const organizationId = ofItem?.organization_id || connection?.organization_id;

    switch (event) {
      case 'item/created':
      case 'item/updated': {
        console.log(`[WEBHOOK] ${event}: ${itemId}`);
        if (ofItem) {
          const executionStatus = data?.executionStatus || data?.status || 'UNKNOWN';
          const isSuccess = executionStatus === 'SUCCESS' || executionStatus === 'UPDATED';
          await supabaseAdmin.from('open_finance_items').update({
            status: isSuccess ? 'completed' : 'in_progress',
            execution_status: executionStatus,
            last_sync_at: isSuccess ? new Date().toISOString() : ofItem.last_sync_at,
            error_message: data?.error?.message || null,
            error_code: data?.error?.code || null,
            consecutive_failures: isSuccess ? 0 : (ofItem.consecutive_failures || 0) + 1,
            updated_at: new Date().toISOString()
          }).eq('id', ofItem.id);
        }
        if (connection) {
          await supabaseAdmin.from('bank_connections').update({
            status: 'active', sync_error: null, updated_at: new Date().toISOString()
          }).eq('id', connection.id);
        }
        if (organizationId) {
          await supabaseAdmin.from('integration_logs').insert({
            organization_id: organizationId, bank_connection_id: connection?.id || null,
            provider: 'pluggy', event_type: event, status: 'success', message: 'Connection status updated'
          });
        }
        break;
      }

      case 'transactions/created': {
        console.log(`[WEBHOOK] Transactions created for item ${itemId}, account ${accountId}`);
        if (connection && PLUGGY_CLIENT_ID && PLUGGY_CLIENT_SECRET) {
          try {
            const pluggyToken = await getPluggyToken(PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET);
            const pluggyHeaders = { 'X-API-KEY': pluggyToken, 'Content-Type': 'application/json' };

            let connectorName = connection.provider_name || 'Open Finance';
            try {
              const itemResp = await fetch(`${PLUGGY_API_URL}/items/${itemId}`, { headers: pluggyHeaders });
              if (itemResp.ok) {
                const itemData = await itemResp.json();
                connectorName = itemData.connector?.name || connectorName;
              }
            } catch (_e) { /* best-effort */ }

            const txUrl = accountId
              ? `${PLUGGY_API_URL}/transactions?accountId=${accountId}`
              : `${PLUGGY_API_URL}/transactions?itemId=${itemId}`;
            const txResp = await fetch(txUrl, { headers: pluggyHeaders });
            if (!txResp.ok) { console.error(`[WEBHOOK-SYNC] Failed: ${txResp.status}`); break; }

            const txData = await txResp.json();
            const transactions = txData.results || [];

            let localAccountId: string | null = null;
            const { data: existingAccount } = await supabaseAdmin.from('accounts').select('id')
              .eq('organization_id', connection.organization_id).eq('bank_name', connectorName).limit(1).maybeSingle();
            if (existingAccount) { localAccountId = existingAccount.id; }
            else {
              const { data: fallback } = await supabaseAdmin.from('accounts').select('id')
                .eq('organization_id', connection.organization_id).eq('status', 'active').limit(1).maybeSingle();
              localAccountId = fallback?.id || null;
            }
            if (!localAccountId) break;

            let imported = 0, skipped = 0;
            const newTxIds: { id: string; description: string; amount: number; type: string }[] = [];

            for (const tx of transactions) {
              const externalId = tx.id || `${tx.date}-${tx.amount}-${tx.description}`;
              const rawAmount = tx.amount || 0;
              const txDate = tx.date ? tx.date.split('T')[0] : new Date().toISOString().split('T')[0];
              const description = tx.description || tx.descriptionRaw || 'Via Open Finance';
              const normalizedDesc = (description || '').toLowerCase().trim().replace(/\s+/g, ' ').substring(0, 100);
              const dedupKey = externalId && externalId !== `${txDate}-${rawAmount}-${description}`
                ? `ext:${externalId}`
                : `comp:${txDate}|${Math.abs(rawAmount).toFixed(2)}|${normalizedDesc}`;

              // DEDUP: org-wide external ID check
              const { data: dup1 } = await supabaseAdmin.from('transactions').select('id')
                .eq('external_transaction_id', externalId).eq('organization_id', connection.organization_id).maybeSingle();
              if (dup1) { skipped++; continue; }

              // DEDUP: org-wide composite key check
              const { data: dup2 } = await supabaseAdmin.from('transactions').select('id')
                .eq('organization_id', connection.organization_id).eq('sync_dedup_key', dedupKey).maybeSingle();
              if (dup2) { skipped++; continue; }

              const type = tx.type === 'CREDIT' || tx.creditDebitType === 'CREDIT' || rawAmount > 0 ? 'income' : 'expense';
              const { data: inserted, error: insertError } = await supabaseAdmin.from('transactions').insert({
                organization_id: connection.organization_id, user_id: connection.user_id,
                bank_connection_id: connection.id, external_transaction_id: externalId,
                sync_dedup_key: dedupKey,
                account_id: localAccountId,
                date: txDate,
                description,
                amount: Math.abs(rawAmount), type, status: 'completed',
                notes: `Importado via Open Finance (${connectorName})`
              }).select('id').single();
              if (insertError) { if (insertError.code === '23505') skipped++; else skipped++; }
              else { imported++; newTxIds.push({ id: inserted.id, description, amount: Math.abs(rawAmount), type }); }
            }

            // AUTO-CLASSIFY new transactions
            if (newTxIds.length > 0) {
              console.log(`[WEBHOOK-CLASSIFY] Classifying ${newTxIds.length} transactions...`);
              const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

              for (const tx of newTxIds) {
                if (tx.type === 'transfer' || tx.type === 'investment' || tx.type === 'redemption') continue;
                try {
                  // Try rules first
                  const { data: rules } = await supabaseAdmin
                    .from("reconciliation_rules").select("id, description, category_id, cost_center_id, transaction_type, amount")
                    .eq("organization_id", connection.organization_id).eq("is_active", true).eq("transaction_type", tx.type);

                  const normalizedTx = tx.description.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
                  let classified = false;

                  if (rules && rules.length > 0) {
                    for (const rule of rules) {
                      const normalizedRule = (rule.description || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
                      if (normalizedTx.includes(normalizedRule) || normalizedRule.includes(normalizedTx)) {
                        await supabaseAdmin.from("transactions").update({
                          category_id: rule.category_id, cost_center_id: rule.cost_center_id,
                          classification_source: "rule", validation_status: "validated", validated_at: new Date().toISOString(),
                        }).eq("id", tx.id);
                        classified = true;
                        break;
                      }
                    }
                  }

                  // Try patterns
                  if (!classified) {
                    const { data: patterns } = await supabaseAdmin
                      .from("transaction_patterns").select("id, normalized_description, category_id, cost_center_id, confidence, occurrences")
                      .eq("organization_id", connection.organization_id).eq("transaction_type", tx.type).gte("confidence", 0.6)
                      .order("confidence", { ascending: false }).limit(20);

                    if (patterns && patterns.length > 0) {
                      for (const pattern of patterns) {
                        const words1 = normalizedTx.split(' ').filter((w: string) => w.length > 0);
                        const set2 = new Set(pattern.normalized_description.split(' ').filter((w: string) => w.length > 0));
                        const common = words1.filter((w: string) => set2.has(w)).length;
                        const sim = common / Math.max(words1.length, set2.size);
                        if (sim >= 0.8) {
                          const autoValidate = pattern.confidence >= 0.85 && (pattern.occurrences || 1) >= 3;
                          await supabaseAdmin.from("transactions").update({
                            category_id: pattern.category_id, cost_center_id: pattern.cost_center_id,
                            classification_source: "pattern",
                            ...(autoValidate ? { validation_status: "validated", validated_at: new Date().toISOString() } : {}),
                          }).eq("id", tx.id);
                          classified = true;
                          break;
                        }
                      }
                    }
                  }

                  // AI fallback - try Gemini directly first, then Lovable gateway
                  if (!classified) {
                    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
                    const { data: categories } = await supabaseAdmin
                      .from("categories").select("id, name, type")
                      .or(`organization_id.eq.${connection.organization_id},is_system_template.eq.true`)
                      .eq("type", tx.type);
                    const categoryList = categories?.map((c: any) => `- ${c.name} (ID: ${c.id})`).join("\n") || "Nenhuma";

                    let aiContent = "";
                    const prompt = `Você é um assistente financeiro. Classifique transações bancárias. Retorne APENAS JSON. Categorias (${tx.type}):\n${categoryList}\nFormato: {"category_id":"uuid|null","confidence":0-1}\n\nClassifique: "${tx.description}" R$${tx.amount.toFixed(2)} ${tx.type === "income" ? "Receita" : "Despesa"}`;

                    // Try Gemini directly
                    if (GEMINI_API_KEY) {
                      try {
                        const geminiResp = await fetch(
                          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
                          {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              contents: [{ parts: [{ text: prompt }] }],
                              generationConfig: { temperature: 0.3, maxOutputTokens: 200 },
                            }),
                          }
                        );
                        if (geminiResp.ok) {
                          const geminiData = await geminiResp.json();
                          aiContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
                        }
                      } catch (_e) { /* fallback below */ }
                    }

                    // Fallback to Lovable gateway
                    if (!aiContent && LOVABLE_API_KEY) {
                      try {
                        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                          method: "POST",
                          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
                          body: JSON.stringify({
                            model: "google/gemini-3-flash-preview",
                            messages: [
                              { role: "system", content: `Classifique transações. APENAS JSON. Categorias (${tx.type}):\n${categoryList}\nFormato: {"category_id":"uuid|null","confidence":0-1}` },
                              { role: "user", content: `"${tx.description}" R$${tx.amount.toFixed(2)} ${tx.type === "income" ? "Receita" : "Despesa"}` }
                            ],
                            temperature: 0.3, max_tokens: 200,
                          }),
                        });
                        if (aiResponse.ok) {
                          const aiData = await aiResponse.json();
                          aiContent = aiData.choices?.[0]?.message?.content || "";
                        }
                      } catch (_e) { /* silent */ }
                    }

                    if (aiContent) {
                      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
                      if (jsonMatch) {
                        const result = JSON.parse(jsonMatch[0]);
                        if (result.category_id && categories?.some((c: any) => c.id === result.category_id)) {
                          await supabaseAdmin.from("transactions").update({
                            category_id: result.category_id, classification_source: "ai",
                          }).eq("id", tx.id);
                        }
                      }
                    }
                  }
                } catch (classErr) {
                  console.warn(`[WEBHOOK-CLASSIFY] Error for TX ${tx.id}:`, classErr);
                }
              }
            }

            if (ofItem) {
              for (const tx of transactions) {
                try {
                  await supabaseAdmin.from('open_finance_raw_data').upsert({
                    organization_id: ofItem.organization_id, item_id: ofItem.id,
                    data_type: 'transaction', external_id: tx.id, raw_json: tx,
                    processed: true, processed_at: new Date().toISOString()
                  }, { onConflict: 'organization_id,data_type,external_id' });
                } catch (_e) { /* best-effort */ }
              }
              await supabaseAdmin.from('open_finance_sync_logs').insert({
                organization_id: ofItem.organization_id, item_id: ofItem.id,
                sync_type: 'transactions', status: 'success',
                records_fetched: transactions.length, records_imported: imported, records_skipped: skipped,
                completed_at: new Date().toISOString(), duration_ms: 0,
                metadata: { trigger: 'webhook', event: 'transactions/created' }
              });
            }

            await supabaseAdmin.from('bank_connections').update({
              last_sync_at: new Date().toISOString(), sync_error: null, status: 'active', updated_at: new Date().toISOString()
            }).eq('id', connection.id);

            await supabaseAdmin.from('integration_logs').insert({
              organization_id: connection.organization_id, bank_connection_id: connection.id,
              provider: 'pluggy', event_type: 'webhook_auto_sync', status: 'success',
              message: `Auto-sync via webhook: ${imported} imported, ${skipped} skipped, ${newTxIds.length} classified`
            });
          } catch (syncError) {
            console.error('[WEBHOOK-SYNC] Error:', syncError);
            await supabaseAdmin.from('integration_logs').insert({
              organization_id: connection?.organization_id, bank_connection_id: connection?.id,
              provider: 'pluggy', event_type: 'webhook_auto_sync', status: 'error',
              message: `Auto-sync failed: ${syncError instanceof Error ? syncError.message : 'Unknown'}`
            });
          }
        }
        break;
      }

      case 'item/deleted': {
        if (ofItem) await supabaseAdmin.from('open_finance_items').update({ status: 'disconnected', updated_at: new Date().toISOString() }).eq('id', ofItem.id);
        if (connection) {
          await supabaseAdmin.from('bank_connections').update({ status: 'disconnected', updated_at: new Date().toISOString() }).eq('id', connection.id);
          await supabaseAdmin.from('integration_logs').insert({
            organization_id: connection.organization_id, bank_connection_id: connection.id,
            provider: 'pluggy', event_type: 'item_deleted', status: 'success', message: 'Connection marked as disconnected'
          });
        }
        break;
      }

      case 'item/error': {
        if (ofItem) {
          await supabaseAdmin.from('open_finance_items').update({
            status: 'error', execution_status: 'ERROR',
            error_message: data?.message || data?.error?.message || 'Unknown error',
            error_code: data?.code || data?.error?.code || 'UNKNOWN',
            consecutive_failures: (ofItem.consecutive_failures || 0) + 1, updated_at: new Date().toISOString()
          }).eq('id', ofItem.id);
        }
        if (connection) {
          await supabaseAdmin.from('bank_connections').update({
            status: 'error', sync_error: data?.message || 'Unknown error', updated_at: new Date().toISOString()
          }).eq('id', connection.id);
          await supabaseAdmin.from('integration_logs').insert({
            organization_id: connection.organization_id, bank_connection_id: connection.id,
            provider: 'pluggy', event_type: 'item_error', status: 'error',
            message: data?.message || 'Unknown error', error_details: JSON.stringify(data)
          });
        }
        break;
      }

      default:
        console.log('[WEBHOOK] Unhandled event:', event);
    }

    return new Response(JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: unknown) {
    console.error('[WEBHOOK] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
