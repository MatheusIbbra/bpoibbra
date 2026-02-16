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

  // Auth: only service_role or valid JWT
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const token = authHeader.replace('Bearer ', '');
  const isServiceRole = token === SUPABASE_SERVICE_ROLE_KEY;
  if (!isServiceRole) {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }

  try {
    const body = await req.json().catch(() => ({}));
    const jobType = body.job_type || 'all'; // 'all', 'forecast', 'recurring', 'health'

    // Get all active organizations
    const { data: orgs, error: orgsError } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .neq('is_blocked', true);

    if (orgsError) throw orgsError;

    const results: Record<string, number> = { forecast: 0, recurring: 0, health: 0 };

    for (const org of orgs || []) {
      // Cashflow Forecast
      if (jobType === 'all' || jobType === 'forecast') {
        try {
          const { data } = await supabaseAdmin.rpc('generate_cashflow_forecast', {
            p_organization_id: org.id,
            p_days: 90,
          });
          if (data) {
            await supabaseAdmin.from('materialized_metrics').upsert({
              organization_id: org.id,
              metric_type: 'cashflow_forecast',
              data: data,
              computed_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            }, { onConflict: 'organization_id,metric_type' });
            results.forecast++;
          }
        } catch (e) {
          console.error(`[JOBS] Forecast error for ${org.id}:`, e);
        }
      }

      // Recurring Expenses Detection
      if (jobType === 'all' || jobType === 'recurring') {
        try {
          const { data } = await supabaseAdmin.rpc('detect_recurring_expenses', {
            p_organization_id: org.id,
          });
          if (data) {
            await supabaseAdmin.from('materialized_metrics').upsert({
              organization_id: org.id,
              metric_type: 'recurring_expenses',
              data: data,
              computed_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            }, { onConflict: 'organization_id,metric_type' });
            results.recurring++;
          }
        } catch (e) {
          console.error(`[JOBS] Recurring error for ${org.id}:`, e);
        }
      }

      // Financial Health Score
      if (jobType === 'all' || jobType === 'health') {
        try {
          const { data } = await supabaseAdmin.rpc('generate_financial_health_score', {
            p_organization_id: org.id,
          });
          if (data) {
            await supabaseAdmin.from('materialized_metrics').upsert({
              organization_id: org.id,
              metric_type: 'financial_health',
              data: data,
              computed_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            }, { onConflict: 'organization_id,metric_type' });
            results.health++;
          }
        } catch (e) {
          console.error(`[JOBS] Health error for ${org.id}:`, e);
        }
      }
    }

    console.log('[JOBS] Completed:', results);

    return new Response(
      JSON.stringify({ status: 'success', processed: results, total_orgs: orgs?.length || 0 }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[JOBS] Error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
