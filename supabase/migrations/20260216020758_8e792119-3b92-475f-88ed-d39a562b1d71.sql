
-- =============================================
-- ETAPA 1: SEGURANÇA NÍVEL FINTECH
-- =============================================

-- 1.3 Tabela de eventos de segurança
CREATE TABLE public.security_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  user_id UUID,
  event_type TEXT NOT NULL, -- 'login_suspicious', 'access_blocked', 'pdf_export', 'plan_change', 'failed_auth', 'hmac_invalid', 'rate_limit_exceeded'
  severity TEXT NOT NULL DEFAULT 'info', -- 'info', 'warning', 'critical'
  ip_address INET,
  user_agent TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- RLS: Admins can view all, users can view their own org events
CREATE POLICY "Admins can view all security events"
  ON public.security_events FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own org security events"
  ON public.security_events FOR SELECT
  USING (
    organization_id IN (SELECT public.get_viewable_organizations(auth.uid()))
  );

-- Service role inserts only (no user inserts)
CREATE POLICY "Service role can insert security events"
  ON public.security_events FOR INSERT
  WITH CHECK (true);

-- Index for querying
CREATE INDEX idx_security_events_org_created ON public.security_events (organization_id, created_at DESC);
CREATE INDEX idx_security_events_type ON public.security_events (event_type);
CREATE INDEX idx_security_events_severity ON public.security_events (severity) WHERE severity IN ('warning', 'critical');

-- 1.2 Add encryption versioning to bank_connections
ALTER TABLE public.bank_connections
  ADD COLUMN IF NOT EXISTS encryption_version INTEGER DEFAULT 1;

-- 1.4 Rate limiting: add rate limit config to plans
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS max_sync_per_day INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS max_reports_per_day INTEGER DEFAULT 20;

-- Rate limit check function
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_organization_id UUID,
  p_endpoint TEXT,
  p_window_minutes INTEGER DEFAULT 60,
  p_max_requests INTEGER DEFAULT 100
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count INTEGER;
  v_window_start TIMESTAMPTZ;
BEGIN
  v_window_start := now() - (p_window_minutes || ' minutes')::INTERVAL;
  
  SELECT COUNT(*) INTO v_count
  FROM api_usage_logs
  WHERE organization_id = p_organization_id
    AND endpoint = p_endpoint
    AND created_at >= v_window_start;
  
  RETURN jsonb_build_object(
    'allowed', v_count < p_max_requests,
    'current_count', v_count,
    'max_requests', p_max_requests,
    'window_minutes', p_window_minutes,
    'remaining', GREATEST(0, p_max_requests - v_count)
  );
END;
$$;
