import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PLUGGY_API_URL = 'https://api.pluggy.ai';

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

  try {
    const body = await req.json();
    console.log('Pluggy webhook received:', JSON.stringify(body));

    const { event, itemId, data, accountId } = body;

    // Log the webhook event
    await supabaseAdmin.from('integration_logs').insert({
      provider: 'pluggy',
      event_type: `webhook_${event}`,
      status: 'received',
      message: `Webhook event: ${event}`,
      payload: body
    });

    // Find the bank connection associated with this item
    const { data: connection } = await supabaseAdmin
      .from('bank_connections')
      .select('*')
      .eq('external_account_id', itemId)
      .eq('provider', 'pluggy')
      .maybeSingle();

    switch (event) {
      case 'item/created':
      case 'item/updated':
        console.log(`Item ${event}:`, itemId);
        
        if (connection) {
          await supabaseAdmin
            .from('bank_connections')
            .update({
              status: 'active',
              sync_error: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', connection.id);

          await supabaseAdmin.from('integration_logs').insert({
            organization_id: connection.organization_id,
            bank_connection_id: connection.id,
            provider: 'pluggy',
            event_type: event,
            status: 'success',
            message: `Connection status updated to active`
          });
        }
        break;

      case 'transactions/created':
        console.log(`Transactions created for item ${itemId}, account ${accountId}`);
        
        if (connection && PLUGGY_CLIENT_ID && PLUGGY_CLIENT_SECRET) {
          // Auto-sync: fetch new transactions from Pluggy and import them
          try {
            console.log(`[WEBHOOK-SYNC] Starting auto-sync for connection ${connection.id}...`);
            
            const pluggyToken = await getPluggyToken(PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET);
            const pluggyHeaders = { 'X-API-KEY': pluggyToken, 'Content-Type': 'application/json' };

            // Fetch item details for connector name
            let connectorName = connection.provider_name || 'Open Finance';
            try {
              const itemResp = await fetch(`${PLUGGY_API_URL}/items/${itemId}`, { headers: pluggyHeaders });
              if (itemResp.ok) {
                const itemData = await itemResp.json();
                connectorName = itemData.connector?.name || connectorName;
              }
            } catch (e) { console.warn('Failed to get item details:', e); }

            // Fetch transactions for the specific account
            const txUrl = accountId 
              ? `${PLUGGY_API_URL}/transactions?accountId=${accountId}`
              : `${PLUGGY_API_URL}/transactions?itemId=${itemId}`;
            
            const txResp = await fetch(txUrl, { headers: pluggyHeaders });
            if (!txResp.ok) {
              console.error(`[WEBHOOK-SYNC] Failed to fetch transactions: ${txResp.status}`);
              break;
            }

            const txData = await txResp.json();
            const transactions = txData.results || [];
            console.log(`[WEBHOOK-SYNC] Fetched ${transactions.length} transactions`);

            // Get or create local account
            let localAccountId: string | null = null;

            // Find existing account by org + bank_name
            const { data: existingAccount } = await supabaseAdmin
              .from('accounts')
              .select('id')
              .eq('organization_id', connection.organization_id)
              .eq('bank_name', connectorName)
              .limit(1)
              .maybeSingle();

            if (existingAccount) {
              localAccountId = existingAccount.id;
            } else {
              // Find any active account for this org
              const { data: fallback } = await supabaseAdmin
                .from('accounts')
                .select('id')
                .eq('organization_id', connection.organization_id)
                .eq('status', 'active')
                .limit(1)
                .maybeSingle();
              localAccountId = fallback?.id || null;
            }

            if (!localAccountId) {
              console.warn('[WEBHOOK-SYNC] No local account found, skipping');
              break;
            }

            let imported = 0;
            let skipped = 0;

            for (const tx of transactions) {
              const externalId = tx.id || `${tx.date}-${tx.amount}-${tx.description}`;
              const rawAmount = tx.amount || 0;
              const amount = Math.abs(rawAmount);
              const txDate = tx.date ? tx.date.split('T')[0] : new Date().toISOString().split('T')[0];
              const description = tx.description || tx.descriptionRaw || 'Via Open Finance';

              // Check for duplicates
              const { data: existing } = await supabaseAdmin
                .from('transactions')
                .select('id')
                .eq('external_transaction_id', externalId)
                .eq('bank_connection_id', connection.id)
                .maybeSingle();

              if (existing) { skipped++; continue; }

              const type = tx.type === 'CREDIT' || rawAmount > 0 ? 'income' : 'expense';

              const { error: insertError } = await supabaseAdmin
                .from('transactions')
                .insert({
                  organization_id: connection.organization_id,
                  user_id: connection.user_id,
                  bank_connection_id: connection.id,
                  external_transaction_id: externalId,
                  account_id: localAccountId,
                  date: txDate,
                  description,
                  amount,
                  type,
                  status: 'completed',
                  notes: `Importado via Open Finance (${connectorName})`
                });

              if (insertError) {
                if (insertError.code === '23505') { skipped++; } 
                else { console.warn('[WEBHOOK-SYNC] Insert error:', insertError); skipped++; }
              } else {
                imported++;
              }
            }

            // Update connection
            await supabaseAdmin
              .from('bank_connections')
              .update({
                last_sync_at: new Date().toISOString(),
                sync_error: null,
                status: 'active',
                updated_at: new Date().toISOString()
              })
              .eq('id', connection.id);

            await supabaseAdmin.from('integration_logs').insert({
              organization_id: connection.organization_id,
              bank_connection_id: connection.id,
              provider: 'pluggy',
              event_type: 'webhook_auto_sync',
              status: 'success',
              message: `Auto-sync via webhook: ${imported} imported, ${skipped} skipped`
            });

            console.log(`[WEBHOOK-SYNC] Complete: ${imported} imported, ${skipped} skipped`);
          } catch (syncError) {
            console.error('[WEBHOOK-SYNC] Auto-sync error:', syncError);
            await supabaseAdmin.from('integration_logs').insert({
              organization_id: connection.organization_id,
              bank_connection_id: connection.id,
              provider: 'pluggy',
              event_type: 'webhook_auto_sync',
              status: 'error',
              message: `Auto-sync failed: ${syncError instanceof Error ? syncError.message : 'Unknown'}`
            });
          }
        } else {
          console.log('No connection found for item or missing Pluggy credentials');
        }
        break;

      case 'item/deleted':
        console.log('Item deleted:', itemId);
        
        if (connection) {
          await supabaseAdmin
            .from('bank_connections')
            .update({
              status: 'disconnected',
              updated_at: new Date().toISOString()
            })
            .eq('id', connection.id);

          await supabaseAdmin.from('integration_logs').insert({
            organization_id: connection.organization_id,
            bank_connection_id: connection.id,
            provider: 'pluggy',
            event_type: 'item_deleted',
            status: 'success',
            message: 'Connection marked as disconnected'
          });
        }
        break;

      case 'item/error':
        console.log('Item error:', itemId, data);
        
        if (connection) {
          await supabaseAdmin
            .from('bank_connections')
            .update({
              status: 'error',
              sync_error: data?.message || 'Unknown error',
              updated_at: new Date().toISOString()
            })
            .eq('id', connection.id);

          await supabaseAdmin.from('integration_logs').insert({
            organization_id: connection.organization_id,
            bank_connection_id: connection.id,
            provider: 'pluggy',
            event_type: 'item_error',
            status: 'error',
            message: data?.message || 'Unknown error',
            error_details: JSON.stringify(data)
          });
        }
        break;

      case 'connector/status_updated':
        console.log('Connector status updated:', data);
        break;

      default:
        console.log('Unhandled webhook event:', event);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error processing Pluggy webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
