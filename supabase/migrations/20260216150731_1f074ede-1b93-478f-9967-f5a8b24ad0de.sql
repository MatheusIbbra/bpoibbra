
-- =============================================
-- SPRINT 2: LGPD + GOVERNANÇA
-- =============================================

-- Tabela de registro de consentimento
CREATE TABLE public.consent_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  consent_type TEXT NOT NULL, -- 'terms', 'privacy', 'data_processing', 'marketing'
  consent_given BOOLEAN NOT NULL DEFAULT true,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.consent_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own consent" ON public.consent_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own consent" ON public.consent_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all consent" ON public.consent_logs
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Tabela de solicitações de exportação de dados (LGPD Art. 18)
CREATE TABLE public.data_export_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID REFERENCES public.organizations(id),
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  export_type TEXT NOT NULL DEFAULT 'full', -- 'full', 'transactions', 'profile'
  file_url TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.data_export_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can request own exports" ON public.data_export_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own exports" ON public.data_export_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all exports" ON public.data_export_requests
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update exports" ON public.data_export_requests
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- SPRINT 3: FEATURE FLAGS + ROLE VIEWS
-- =============================================

-- Tabela de feature flags por plano/organização
CREATE TABLE public.feature_flags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  feature_key TEXT NOT NULL,
  description TEXT,
  is_global BOOLEAN NOT NULL DEFAULT false,
  enabled_for_plans TEXT[] DEFAULT '{}', -- plan slugs
  enabled_for_roles app_role[] DEFAULT '{}', -- roles que podem ver
  enabled_for_orgs UUID[] DEFAULT '{}', -- org overrides
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(feature_key)
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view flags" ON public.feature_flags
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage flags" ON public.feature_flags
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RPC: Verificar acesso a feature
CREATE OR REPLACE FUNCTION public.check_feature_access(
  p_organization_id UUID,
  p_feature_key TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flag RECORD;
  v_user_role app_role;
  v_plan_slug TEXT;
BEGIN
  -- Get the feature flag
  SELECT * INTO v_flag FROM feature_flags
    WHERE feature_key = p_feature_key AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN false; -- Feature não existe = bloqueada
  END IF;
  
  -- Se global, sempre liberada
  IF v_flag.is_global THEN
    RETURN true;
  END IF;
  
  -- Check org override
  IF p_organization_id = ANY(v_flag.enabled_for_orgs) THEN
    RETURN true;
  END IF;
  
  -- Check role
  SELECT ur.role INTO v_user_role FROM user_roles ur WHERE ur.user_id = auth.uid();
  IF v_user_role IS NOT NULL AND v_user_role = ANY(v_flag.enabled_for_roles) THEN
    RETURN true;
  END IF;
  
  -- Check plan
  SELECT p.slug INTO v_plan_slug
    FROM organization_subscriptions os
    JOIN plans p ON p.id = os.plan_id
    WHERE os.organization_id = p_organization_id AND os.status = 'active'
    LIMIT 1;
  
  IF v_plan_slug IS NOT NULL AND v_plan_slug = ANY(v_flag.enabled_for_plans) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- RPC: Obter todas as features do usuário de uma vez (otimizado)
CREATE OR REPLACE FUNCTION public.get_user_features(p_organization_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB := '{}';
  v_flag RECORD;
  v_user_role app_role;
  v_plan_slug TEXT;
BEGIN
  SELECT ur.role INTO v_user_role FROM user_roles ur WHERE ur.user_id = auth.uid();
  
  SELECT p.slug INTO v_plan_slug
    FROM organization_subscriptions os
    JOIN plans p ON p.id = os.plan_id
    WHERE os.organization_id = p_organization_id AND os.status = 'active'
    LIMIT 1;
  
  FOR v_flag IN SELECT * FROM feature_flags WHERE is_active = true LOOP
    IF v_flag.is_global THEN
      v_result := v_result || jsonb_build_object(v_flag.feature_key, true);
    ELSIF p_organization_id = ANY(v_flag.enabled_for_orgs) THEN
      v_result := v_result || jsonb_build_object(v_flag.feature_key, true);
    ELSIF v_user_role IS NOT NULL AND v_user_role = ANY(v_flag.enabled_for_roles) THEN
      v_result := v_result || jsonb_build_object(v_flag.feature_key, true);
    ELSIF v_plan_slug IS NOT NULL AND v_plan_slug = ANY(v_flag.enabled_for_plans) THEN
      v_result := v_result || jsonb_build_object(v_flag.feature_key, true);
    ELSE
      v_result := v_result || jsonb_build_object(v_flag.feature_key, false);
    END IF;
  END LOOP;
  
  RETURN v_result;
END;
$$;

-- Seed initial feature flags
INSERT INTO public.feature_flags (feature_key, description, is_global, enabled_for_roles, enabled_for_plans) VALUES
  ('strategic_insights', 'Insights estratégicos IA', false, ARRAY['admin','supervisor','fa']::app_role[], ARRAY['professional','enterprise']),
  ('macro_simulation', 'Simulação macroeconômica', false, ARRAY['admin','supervisor','fa']::app_role[], ARRAY['professional','enterprise']),
  ('strategic_history', 'Histórico estratégico persistente', false, ARRAY['admin','supervisor','fa']::app_role[], ARRAY['professional','enterprise']),
  ('anomaly_detection', 'Detecção de anomalias', false, ARRAY['admin','supervisor','fa']::app_role[], ARRAY['professional','enterprise']),
  ('cashflow_forecast', 'Previsão de fluxo de caixa', false, ARRAY['admin','supervisor','fa','kam']::app_role[], ARRAY['professional','enterprise']),
  ('bank_concentration', 'Concentração bancária', false, ARRAY['admin','supervisor','fa']::app_role[], ARRAY['professional','enterprise']),
  ('currency_exposure', 'Exposição cambial', false, ARRAY['admin','supervisor','fa']::app_role[], ARRAY['professional','enterprise']),
  ('financial_simulator', 'Simulador financeiro', false, ARRAY['admin','supervisor','fa']::app_role[], ARRAY['professional','enterprise']),
  ('data_export', 'Exportação de dados LGPD', true, '{}', '{}'),
  ('internal_comments', 'Comentários internos em transações', false, ARRAY['admin','supervisor','fa','projetista']::app_role[], '{}'),
  ('detailed_metrics', 'Métricas técnicas detalhadas', false, ARRAY['admin','supervisor','fa','projetista','kam']::app_role[], '{}'),
  ('comparative_history', 'Histórico comparativo', false, ARRAY['admin','supervisor','fa']::app_role[], ARRAY['professional','enterprise']);

-- Política de retenção (metadata na organização)
-- Adicionamos settings padrão para política de retenção na org
COMMENT ON COLUMN public.organizations.settings IS 'JSON settings including data_retention_months (default 60), consent_required features, etc.';
