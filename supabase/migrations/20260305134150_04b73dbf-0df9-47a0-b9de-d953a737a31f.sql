
-- Table for configurable AI usage quotas per organization
CREATE TABLE IF NOT EXISTS public.ai_usage_quotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL UNIQUE,
  hourly_limit integer NOT NULL DEFAULT 100,
  daily_limit integer NOT NULL DEFAULT 500,
  user_hourly_limit integer NOT NULL DEFAULT 20,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_usage_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage ai_usage_quotas"
ON public.ai_usage_quotas
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members can view own org quotas"
ON public.ai_usage_quotas
FOR SELECT
TO authenticated
USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

-- Circuit breaker state table
CREATE TABLE IF NOT EXISTS public.circuit_breaker_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  state text NOT NULL DEFAULT 'closed' CHECK (state IN ('closed', 'open', 'half_open')),
  failure_count integer NOT NULL DEFAULT 0,
  last_failure_at timestamptz,
  opened_at timestamptz,
  half_open_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, organization_id)
);

ALTER TABLE public.circuit_breaker_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage circuit_breaker_state"
ON public.circuit_breaker_state
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members can view own org circuit breaker"
ON public.circuit_breaker_state
FOR SELECT
TO authenticated
USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));
