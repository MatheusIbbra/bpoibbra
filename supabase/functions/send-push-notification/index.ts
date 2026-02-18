import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Web Push VAPID signing using Web Crypto API
async function sendWebPush(subscription: any, payload: string, vapidPublicKey: string, vapidPrivateKey: string) {
  // For Web Push in Deno, we use the fetch API to send directly
  // This is a simplified implementation - in production consider using a proper web-push library
  const endpoint = subscription.endpoint;
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'TTL': '86400',
    },
    body: payload,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Push failed (${response.status}): ${text}`);
  }
  
  return response;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
  const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return new Response(
      JSON.stringify({ error: 'VAPID keys not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Auth check
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const token = authHeader.replace('Bearer ', '');
  const isServiceRole = token === SUPABASE_SERVICE_ROLE_KEY;
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  if (!isServiceRole) {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  try {
    const body = await req.json();
    const { user_id, title, body: messageBody, url } = body;

    if (!user_id || !title) {
      return new Response(
        JSON.stringify({ error: 'user_id and title are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's push subscription
    const { data: subs, error: subError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('subscription_json')
      .eq('user_id', user_id);

    if (subError) throw subError;

    if (!subs || subs.length === 0) {
      return new Response(
        JSON.stringify({ status: 'no_subscription', message: 'User has no push subscription' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload = JSON.stringify({
      title,
      body: messageBody || '',
      url: url || '/',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
    });

    let sent = 0;
    let failed = 0;

    for (const sub of subs) {
      try {
        await sendWebPush(sub.subscription_json, payload, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
        sent++;
      } catch (e) {
        console.error('[Push] Send error:', e);
        failed++;
        // Remove invalid subscriptions (410 Gone)
        if (e instanceof Error && e.message.includes('410')) {
          await supabaseAdmin
            .from('push_subscriptions')
            .delete()
            .eq('user_id', user_id)
            .eq('subscription_json', sub.subscription_json);
        }
      }
    }

    return new Response(
      JSON.stringify({ status: 'ok', sent, failed }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[Push] Error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
