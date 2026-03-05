import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const FAILURE_THRESHOLD = 3;
const FAILURE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const OPEN_DURATION_MS = 10 * 60 * 1000; // 10 minutes

type CircuitState = "closed" | "open" | "half_open";

interface CircuitBreakerResult {
  allowed: boolean;
  state: CircuitState;
  retryAfterMs?: number;
}

/**
 * Check if a request to the provider is allowed based on circuit breaker state.
 */
export async function checkCircuitBreaker(
  supabaseAdmin: ReturnType<typeof createClient>,
  provider: string,
  organizationId: string
): Promise<CircuitBreakerResult> {
  const { data: cb } = await supabaseAdmin
    .from("circuit_breaker_state")
    .select("*")
    .eq("provider", provider)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!cb || cb.state === "closed") {
    return { allowed: true, state: "closed" };
  }

  if (cb.state === "open") {
    const openedAt = new Date(cb.opened_at).getTime();
    const elapsed = Date.now() - openedAt;
    if (elapsed >= OPEN_DURATION_MS) {
      // Transition to half_open — allow one probe request
      await supabaseAdmin
        .from("circuit_breaker_state")
        .update({ state: "half_open", half_open_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", cb.id);
      return { allowed: true, state: "half_open" };
    }
    return { allowed: false, state: "open", retryAfterMs: OPEN_DURATION_MS - elapsed };
  }

  // half_open — allow the probe
  return { allowed: true, state: "half_open" };
}

/**
 * Record a successful call — close the circuit.
 */
export async function recordSuccess(
  supabaseAdmin: ReturnType<typeof createClient>,
  provider: string,
  organizationId: string
) {
  await supabaseAdmin
    .from("circuit_breaker_state")
    .upsert(
      {
        provider,
        organization_id: organizationId,
        state: "closed",
        failure_count: 0,
        last_failure_at: null,
        opened_at: null,
        half_open_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "provider,organization_id" }
    );
}

/**
 * Record a failure. If threshold reached within window, open the circuit.
 */
export async function recordFailure(
  supabaseAdmin: ReturnType<typeof createClient>,
  provider: string,
  organizationId: string
) {
  const now = new Date();
  const { data: cb } = await supabaseAdmin
    .from("circuit_breaker_state")
    .select("*")
    .eq("provider", provider)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!cb) {
    // First failure — create record
    await supabaseAdmin.from("circuit_breaker_state").insert({
      provider,
      organization_id: organizationId,
      state: "closed",
      failure_count: 1,
      last_failure_at: now.toISOString(),
    });
    return;
  }

  // If half_open probe failed, go back to open
  if (cb.state === "half_open") {
    await supabaseAdmin
      .from("circuit_breaker_state")
      .update({ state: "open", opened_at: now.toISOString(), failure_count: cb.failure_count + 1, last_failure_at: now.toISOString(), updated_at: now.toISOString() })
      .eq("id", cb.id);
    return;
  }

  // Check if previous failures are within the window
  const lastFailure = cb.last_failure_at ? new Date(cb.last_failure_at).getTime() : 0;
  const withinWindow = now.getTime() - lastFailure < FAILURE_WINDOW_MS;
  const newCount = withinWindow ? cb.failure_count + 1 : 1;

  if (newCount >= FAILURE_THRESHOLD) {
    // Open the circuit
    await supabaseAdmin
      .from("circuit_breaker_state")
      .update({ state: "open", failure_count: newCount, last_failure_at: now.toISOString(), opened_at: now.toISOString(), updated_at: now.toISOString() })
      .eq("id", cb.id);
  } else {
    await supabaseAdmin
      .from("circuit_breaker_state")
      .update({ failure_count: newCount, last_failure_at: now.toISOString(), updated_at: now.toISOString() })
      .eq("id", cb.id);
  }
}
