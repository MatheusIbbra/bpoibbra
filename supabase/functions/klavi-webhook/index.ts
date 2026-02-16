import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-klavi-signature, x-webhook-signature',
};

// MANDATORY HMAC verification
function verifySignature(payload: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false;
  const hmac = createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');
  return signature === expectedSignature || signature === `sha256=${expectedSignature}`;
}

async function logSecurityEvent(supabase: any, event: Record<string, unknown>) {
  try { await supabase.from('security_events').insert(event); } catch (_e) { /* best-effort */ }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const KLAVI_WEBHOOK_SECRET = Deno.env.get('KLAVI_WEBHOOK_SECRET');

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null;
  const userAgent = req.headers.get('user-agent') || null;

  try {
    const payload = await req.text();
    const signature = req.headers.get('x-klavi-signature') || req.headers.get('x-webhook-signature');

    // ===== MANDATORY HMAC SIGNATURE VERIFICATION =====
    if (!KLAVI_WEBHOOK_SECRET) {
      console.error('[KLAVI-WEBHOOK] KLAVI_WEBHOOK_SECRET not configured');
      await logSecurityEvent(supabaseAdmin, {
        event_type: 'hmac_invalid', severity: 'critical',
        ip_address: clientIp, user_agent: userAgent,
        details: { reason: 'KLAVI_WEBHOOK_SECRET not configured', provider: 'klavi' }
      });
      return new Response(JSON.stringify({ error: 'Webhook secret not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!signature) {
      console.error('[KLAVI-WEBHOOK] Missing signature — blocking');
      await logSecurityEvent(supabaseAdmin, {
        event_type: 'hmac_invalid', severity: 'critical',
        ip_address: clientIp, user_agent: userAgent,
        details: { reason: 'Missing signature header', provider: 'klavi' }
      });
      return new Response(JSON.stringify({ error: 'Missing signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!verifySignature(payload, signature, KLAVI_WEBHOOK_SECRET)) {
      console.error('[KLAVI-WEBHOOK] Invalid signature — blocking');
      await logSecurityEvent(supabaseAdmin, {
        event_type: 'hmac_invalid', severity: 'critical',
        ip_address: clientIp, user_agent: userAgent,
        details: { reason: 'Invalid HMAC signature', provider: 'klavi' }
      });
      await supabaseAdmin.from('integration_logs').insert({
        provider: 'klavi', event_type: 'webhook', status: 'error',
        message: 'Blocked: Invalid webhook signature', ip_address: clientIp
      });
      return new Response(JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const event = JSON.parse(payload);
    console.log('Verified webhook event:', event.type || event.event);

    const eventType = event.type || event.event;
    const consentId = event.consent_id || event.data?.consent_id || event.consentId;
    const organizationId = event.organization_id || event.data?.organization_id;

    await supabaseAdmin.from('integration_logs').insert({
      provider: 'klavi', event_type: 'webhook', status: 'info',
      message: `Webhook received: ${eventType}`, payload: event,
      organization_id: organizationId || null
    });

    switch (eventType) {
      case 'consent.approved':
      case 'consent_approved':
      case 'CONSENT_APPROVED': {
        if (organizationId) {
          const { data: existingConnection } = await supabaseAdmin.from('bank_connections')
            .select('*').eq('organization_id', organizationId).eq('provider', 'klavi').maybeSingle();
          if (existingConnection) {
            await supabaseAdmin.from('bank_connections').update({
              status: 'active', external_consent_id: consentId, updated_at: new Date().toISOString()
            }).eq('id', existingConnection.id);
          }
          await supabaseAdmin.from('integration_logs').insert({
            organization_id: organizationId, provider: 'klavi', event_type: 'webhook',
            status: 'success', message: 'Consent approved - ready for sync'
          });
        }
        break;
      }

      case 'consent.revoked':
      case 'consent_revoked':
      case 'CONSENT_REVOKED': {
        if (consentId) {
          const { data: connection } = await supabaseAdmin.from('bank_connections')
            .update({ status: 'revoked', updated_at: new Date().toISOString() })
            .eq('external_consent_id', consentId).select('id, organization_id').single();
          if (connection) {
            await supabaseAdmin.from('integration_logs').insert({
              organization_id: connection.organization_id, bank_connection_id: connection.id,
              provider: 'klavi', event_type: 'webhook', status: 'warning',
              message: 'Consent revoked by user or institution'
            });
          }
        }
        break;
      }

      case 'consent.expired':
      case 'consent_expired':
      case 'CONSENT_EXPIRED': {
        if (consentId) {
          const { data: connection } = await supabaseAdmin.from('bank_connections')
            .update({ status: 'expired', updated_at: new Date().toISOString() })
            .eq('external_consent_id', consentId).select('id, organization_id').single();
          if (connection) {
            await supabaseAdmin.from('integration_logs').insert({
              organization_id: connection.organization_id, bank_connection_id: connection.id,
              provider: 'klavi', event_type: 'webhook', status: 'warning', message: 'Consent expired'
            });
          }
        }
        break;
      }

      case 'transaction.created':
      case 'transactions.available':
      case 'TRANSACTIONS_AVAILABLE':
      case 'NEW_TRANSACTIONS': {
        let connection = null;
        if (consentId) {
          const { data } = await supabaseAdmin.from('bank_connections').select('id, organization_id')
            .eq('external_consent_id', consentId).single();
          connection = data;
        } else if (organizationId) {
          const { data } = await supabaseAdmin.from('bank_connections').select('id, organization_id')
            .eq('organization_id', organizationId).eq('provider', 'klavi').eq('status', 'active').single();
          connection = data;
        }
        if (connection) {
          await supabaseAdmin.from('integration_logs').insert({
            organization_id: connection.organization_id, bank_connection_id: connection.id,
            provider: 'klavi', event_type: 'webhook', status: 'info',
            message: 'New transactions available - sync recommended'
          });
        }
        break;
      }

      default:
        console.log('Unhandled webhook event type:', eventType);
        await supabaseAdmin.from('integration_logs').insert({
          provider: 'klavi', event_type: 'webhook', status: 'info',
          message: `Unhandled event type: ${eventType}`, payload: event
        });
    }

    return new Response(JSON.stringify({ received: true, event_type: eventType }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: unknown) {
    console.error('Error processing webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await supabaseAdmin.from('integration_logs').insert({
      provider: 'klavi', event_type: 'webhook', status: 'error',
      message: 'Failed to process webhook', error_details: errorMessage
    });
    return new Response(JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
