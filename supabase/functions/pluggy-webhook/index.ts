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

  try {
    const body = await req.json();
    console.log('Pluggy webhook received:', JSON.stringify(body));

    const { event, itemId, data } = body;

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
          // Update connection status
          await supabaseAdmin
            .from('bank_connections')
            .update({
              status: 'active',
              sync_error: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', connection.id);

          // Log status update
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

      case 'item/deleted':
        console.log('Item deleted:', itemId);
        
        if (connection) {
          // Mark connection as disconnected
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
        // This is informational about the bank connector status
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
