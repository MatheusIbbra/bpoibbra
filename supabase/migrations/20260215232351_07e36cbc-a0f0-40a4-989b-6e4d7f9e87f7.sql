
-- =============================================
-- ETAPA 4: PLANOS SAAS
-- =============================================

-- Tabela de planos
CREATE TABLE IF NOT EXISTS public.plans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  price numeric NOT NULL DEFAULT 0,
  max_transactions integer NOT NULL DEFAULT 500,
  max_ai_requests integer NOT NULL DEFAULT 50,
  max_bank_connections integer NOT NULL DEFAULT 2,
  allow_forecast boolean NOT NULL DEFAULT false,
  allow_anomaly_detection boolean NOT NULL DEFAULT false,
  allow_simulator boolean NOT NULL DEFAULT false,
  allow_benchmarking boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- Planos são públicos para leitura
CREATE POLICY "Anyone can view active plans"
  ON public.plans FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage plans"
  ON public.plans FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Seed de planos padrão
INSERT INTO public.plans (name, slug, description, price, max_transactions, max_ai_requests, max_bank_connections, allow_forecast, allow_anomaly_detection, allow_simulator, allow_benchmarking, sort_order)
VALUES
  ('Starter', 'starter', 'Para começar a organizar suas finanças', 0, 200, 10, 1, false, false, false, false, 1),
  ('Professional', 'professional', 'Para gestão financeira completa', 297, 2000, 100, 5, true, true, false, false, 2),
  ('Enterprise', 'enterprise', 'Para BPO e wealth strategy avançado', 997, 99999, 500, 20, true, true, true, true, 3);

-- Tabela de assinaturas
CREATE TABLE IF NOT EXISTS public.organization_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.plans(id),
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  cancelled_at timestamptz,
  stripe_subscription_id text,
  stripe_customer_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

ALTER TABLE public.organization_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org subscription"
  ON public.organization_subscriptions FOR SELECT
  USING (can_view_organization(organization_id, auth.uid()));

CREATE POLICY "Admins can manage subscriptions"
  ON public.organization_subscriptions FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE INDEX idx_org_subscriptions_org ON public.organization_subscriptions (organization_id);

-- =============================================
-- ETAPA 5.2: SIMULADOR FINANCEIRO
-- =============================================

CREATE TABLE IF NOT EXISTS public.financial_simulations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Simulação',
  months_ahead integer NOT NULL DEFAULT 12,
  revenue_growth_rate numeric NOT NULL DEFAULT 0,
  expense_increase_rate numeric NOT NULL DEFAULT 0,
  initial_balance numeric NOT NULL DEFAULT 0,
  results jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org simulations"
  ON public.financial_simulations FOR SELECT
  USING (can_view_organization(organization_id, auth.uid()));

CREATE POLICY "Users can manage their org simulations"
  ON public.financial_simulations FOR ALL
  USING (can_view_organization(organization_id, auth.uid()))
  WITH CHECK (can_view_organization(organization_id, auth.uid()));

CREATE INDEX idx_financial_simulations_org ON public.financial_simulations (organization_id);

-- =============================================
-- RPC: DETECTAR DESPESAS RECORRENTES
-- =============================================

CREATE OR REPLACE FUNCTION public.detect_recurring_expenses(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb := '[]'::jsonb;
BEGIN
  -- Detectar transações com mesma descrição normalizada, intervalo mensal, valor similar
  WITH recurring AS (
    SELECT 
      normalized_description,
      category_id,
      COUNT(*) as occurrences,
      AVG(amount) as avg_amount,
      STDDEV(amount) as stddev_amount,
      MAX(date) as last_date,
      MIN(date) as first_date,
      -- Calcular intervalo médio entre ocorrências
      CASE WHEN COUNT(*) > 1 
        THEN (MAX(date) - MIN(date))::numeric / (COUNT(*) - 1)
        ELSE 0 
      END as avg_interval_days
    FROM transactions
    WHERE organization_id = p_organization_id
      AND type = 'expense'
      AND status = 'completed'
      AND is_ignored IS NOT TRUE
      AND normalized_description IS NOT NULL
      AND normalized_description != ''
      AND date >= (current_date - interval '6 months')::date
    GROUP BY normalized_description, category_id
    HAVING COUNT(*) >= 2
  )
  SELECT jsonb_agg(jsonb_build_object(
    'description', r.normalized_description,
    'category_id', r.category_id,
    'occurrences', r.occurrences,
    'avg_amount', ROUND(r.avg_amount, 2),
    'avg_interval_days', ROUND(r.avg_interval_days),
    'is_monthly', r.avg_interval_days BETWEEN 25 AND 35,
    'confidence', CASE 
      WHEN r.occurrences >= 5 AND r.avg_interval_days BETWEEN 28 AND 32 THEN 0.95
      WHEN r.occurrences >= 3 AND r.avg_interval_days BETWEEN 25 AND 35 THEN 0.85
      WHEN r.occurrences >= 2 AND r.avg_interval_days BETWEEN 20 AND 40 THEN 0.7
      ELSE 0.5
    END,
    'next_due_date', r.last_date + (r.avg_interval_days || ' days')::interval,
    'variation_pct', CASE WHEN r.avg_amount > 0 THEN ROUND((COALESCE(r.stddev_amount, 0) / r.avg_amount) * 100, 2) ELSE 0 END
  ))
  INTO result
  FROM recurring r
  WHERE r.avg_interval_days BETWEEN 15 AND 45  -- intervalo razoável para recorrência
  ORDER BY r.occurrences DESC, r.avg_amount DESC;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- =============================================
-- RPC: GERAR PREVISÃO DE CAIXA (90 DIAS)
-- =============================================

CREATE OR REPLACE FUNCTION public.generate_cashflow_forecast(p_organization_id uuid, p_days integer DEFAULT 90)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb := '[]'::jsonb;
  v_current_balance numeric := 0;
  v_avg_daily_income numeric := 0;
  v_avg_daily_expense numeric := 0;
  v_day_offset integer;
  v_projected_balance numeric;
  v_forecast_entries jsonb := '[]'::jsonb;
BEGIN
  -- Saldo atual
  SELECT COALESCE(SUM(COALESCE(s.balance, a.current_balance, 0)), 0)
  INTO v_current_balance
  FROM accounts a
  LEFT JOIN account_balance_snapshots s ON s.account_id = a.id
  WHERE a.organization_id = p_organization_id
    AND a.account_type IN ('checking', 'savings')
    AND a.status = 'active';

  -- Média diária de receitas e despesas (últimos 90 dias)
  SELECT 
    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) / GREATEST(1, (current_date - (current_date - interval '90 days')::date)), 0),
    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) / GREATEST(1, (current_date - (current_date - interval '90 days')::date)), 0)
  INTO v_avg_daily_income, v_avg_daily_expense
  FROM transactions
  WHERE organization_id = p_organization_id
    AND date >= (current_date - interval '90 days')::date
    AND status = 'completed'
    AND is_ignored IS NOT TRUE;

  -- Gerar projeção dia a dia
  v_projected_balance := v_current_balance;
  FOR v_day_offset IN 1..p_days LOOP
    v_projected_balance := v_projected_balance + v_avg_daily_income - v_avg_daily_expense;
    
    -- Registrar a cada 7 dias ou último dia
    IF v_day_offset % 7 = 0 OR v_day_offset = p_days THEN
      v_forecast_entries := v_forecast_entries || jsonb_build_object(
        'date', (current_date + v_day_offset)::text,
        'projected_balance', ROUND(v_projected_balance, 2),
        'day', v_day_offset,
        'confidence', CASE 
          WHEN v_day_offset <= 30 THEN 0.85
          WHEN v_day_offset <= 60 THEN 0.7
          ELSE 0.55
        END
      );
    END IF;
  END LOOP;

  result := jsonb_build_object(
    'current_balance', ROUND(v_current_balance, 2),
    'avg_daily_income', ROUND(v_avg_daily_income, 2),
    'avg_daily_expense', ROUND(v_avg_daily_expense, 2),
    'net_daily', ROUND(v_avg_daily_income - v_avg_daily_expense, 2),
    'forecast', v_forecast_entries,
    'generated_at', now()
  );

  RETURN result;
END;
$$;
