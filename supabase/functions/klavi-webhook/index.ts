import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-klavi-signature',
};

// Verify webhook signature
function verifySignature(payload: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false;
  
  const hmac = createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');
  
  return signature === expectedSignature || signature === `sha256=${expectedSignature}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const KLAVI_WEBHOOK_SECRET = Deno.env.get('KLAVI_WEBHOOK_SECRET');

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const payload = await req.text();
    const signature = req.headers.get('x-klavi-signature') || req.headers.get('x-webhook-signature');

    // Verify webhook signature if secret is configured
    if (KLAVI_WEBHOOK_SECRET && signature) {
      if (!verifySignature(payload, signature, KLAVI_WEBHOOK_SECRET)) {
        console.error('Invalid webhook signature');
        
        await supabaseAdmin.from('integration_logs').insert({
          provider: 'klavi',
          event_type: 'webhook',
          status: 'error',
          message: 'Invalid webhook signature',
          ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
        });

        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const event = JSON.parse(payload);
    console.log('Received webhook event:', event.type || event.event);

    const eventType = event.type || event.event;
    const consentId = event.consent_id || event.data?.consent_id;

    // Log webhook receipt
    await supabaseAdmin.from('integration_logs').insert({
      provider: 'klavi',
      event_type: 'webhook',
      status: 'info',
      message: `Webhook received: ${eventType}`,
      payload: event
    });

    // Handle different event types
    switch (eventType) {
      case 'consent.revoked':
      case 'consent_revoked': {
        if (consentId) {
          const { data: connection } = await supabaseAdmin
            .from('bank_connections')
            .update({ status: 'revoked', updated_at: new Date().toISOString() })
            .eq('external_consent_id', consentId)
            .select('id, organization_id')
            .single();

          if (connection) {
            await supabaseAdmin.from('integration_logs').insert({
              organization_id: connection.organization_id,
              bank_connection_id: connection.id,
              provider: 'klavi',
              event_type: 'webhook',
              status: 'warning',
              message: 'Consent revoked by user or institution'
            });
          }
        }
        break;
      }

      case 'consent.expired':
      case 'consent_expired': {
        if (consentId) {
          const { data: connection } = await supabaseAdmin
            .from('bank_connections')
            .update({ status: 'expired', updated_at: new Date().toISOString() })
            .eq('external_consent_id', consentId)
            .select('id, organization_id')
            .single();

          if (connection) {
            await supabaseAdmin.from('integration_logs').insert({
              organization_id: connection.organization_id,
              bank_connection_id: connection.id,
              provider: 'klavi',
              event_type: 'webhook',
              status: 'warning',
              message: 'Consent expired'
            });
          }
        }
        break;
      }

      case 'transaction.created':
      case 'transactions.available': {
        // New transactions are available - could trigger auto-sync
        // For now, just log it
        if (consentId) {
          const { data: connection } = await supabaseAdmin
            .from('bank_connections')
            .select('id, organization_id')
            .eq('external_consent_id', consentId)
            .single();

          if (connection) {
            await supabaseAdmin.from('integration_logs').insert({
              organization_id: connection.organization_id,
              bank_connection_id: connection.id,
              provider: 'klavi',
              event_type: 'webhook',
              status: 'info',
              message: 'New transactions available - sync recommended'
            });
          }
        }
        break;
      }

      default:
        console.log('Unhandled webhook event type:', eventType);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error processing webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await supabaseAdmin.from('integration_logs').insert({
      provider: 'klavi',
      event_type: 'webhook',
      status: 'error',
      message: 'Failed to process webhook',
      error_details: errorMessage
    });

    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
