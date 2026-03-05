import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
  reason?: string;
}

/**
 * Check AI rate limits for an organization + user.
 * Limits: org hourly (default 100), org daily (default 500), user hourly (default 20).
 * Uses ai_usage_quotas for custom limits, falls back to defaults.
 */
export async function checkAIRateLimit(
  supabaseAdmin: ReturnType<typeof createClient>,
  organizationId: string,
  userId: string
): Promise<RateLimitResult> {
  // Fetch custom quotas or use defaults
  const { data: quota } = await supabaseAdmin
    .from("ai_usage_quotas")
    .select("hourly_limit, daily_limit, user_hourly_limit")
    .eq("organization_id", organizationId)
    .maybeSingle();

  const orgHourlyLimit = quota?.hourly_limit ?? 100;
  const orgDailyLimit = quota?.daily_limit ?? 500;
  const userHourlyLimit = quota?.user_hourly_limit ?? 20;

  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  // Run all 3 counts in parallel
  const [orgHourly, orgDaily, userHourly] = await Promise.all([
    supabaseAdmin
      .from("api_usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("endpoint", "ai")
      .gte("created_at", oneHourAgo),
    supabaseAdmin
      .from("api_usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("endpoint", "ai")
      .gte("created_at", startOfDay.toISOString()),
    supabaseAdmin
      .from("api_usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("endpoint", "ai")
      .gte("created_at", oneHourAgo)
      .eq("request_metadata->>user_id", userId),
  ]);

  const orgH = orgHourly.count ?? 0;
  const orgD = orgDaily.count ?? 0;
  const userH = userHourly.count ?? 0;

  if (userH >= userHourlyLimit) {
    return { allowed: false, retryAfter: 300, reason: `Limite pessoal: ${userH}/${userHourlyLimit} chamadas/hora` };
  }
  if (orgH >= orgHourlyLimit) {
    return { allowed: false, retryAfter: 600, reason: `Limite da organização: ${orgH}/${orgHourlyLimit} chamadas/hora` };
  }
  if (orgD >= orgDailyLimit) {
    return { allowed: false, retryAfter: 3600, reason: `Limite diário: ${orgD}/${orgDailyLimit} chamadas/dia` };
  }

  return { allowed: true };
}

/**
 * Log an AI usage event.
 */
export async function logAIUsage(
  supabaseAdmin: ReturnType<typeof createClient>,
  organizationId: string,
  userId: string,
  tokensUsed: number,
  metadata?: Record<string, unknown>
) {
  await supabaseAdmin.from("api_usage_logs").insert({
    organization_id: organizationId,
    endpoint: "ai",
    tokens_used: tokensUsed,
    request_metadata: { user_id: userId, ...metadata },
  });
}
