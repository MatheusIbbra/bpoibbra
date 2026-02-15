
-- =============================================
-- ETAPA 2.3: SNAPSHOT DE SALDO
-- =============================================

-- Tabela de snapshots incrementais de saldo
CREATE TABLE IF NOT EXISTS public.account_balance_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  balance numeric NOT NULL DEFAULT 0,
  last_transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id)
);

ALTER TABLE public.account_balance_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view snapshots of their accounts"
  ON public.account_balance_snapshots FOR SELECT
  USING (account_id IN (
    SELECT a.id FROM accounts a 
    WHERE has_role(auth.uid(), 'admin') 
       OR a.organization_id IN (SELECT get_viewable_organizations(auth.uid()))
  ));

CREATE POLICY "Service role can manage snapshots"
  ON public.account_balance_snapshots FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Função para atualizar snapshot após insert/update/delete de transação
CREATE OR REPLACE FUNCTION public.update_balance_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  affected_account_id uuid;
  new_balance numeric;
BEGIN
  -- Determinar account_id afetado
  IF TG_OP = 'DELETE' THEN
    affected_account_id := OLD.account_id;
  ELSE
    affected_account_id := NEW.account_id;
  END IF;

  -- Calcular novo saldo usando a função existente
  new_balance := calculate_account_balance(affected_account_id);

  -- Upsert no snapshot
  INSERT INTO account_balance_snapshots (account_id, balance, last_transaction_id, updated_at)
  VALUES (
    affected_account_id,
    new_balance,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.id END,
    now()
  )
  ON CONFLICT (account_id)
  DO UPDATE SET
    balance = EXCLUDED.balance,
    last_transaction_id = EXCLUDED.last_transaction_id,
    updated_at = now();

  -- Atualizar current_balance na tabela accounts
  UPDATE accounts SET current_balance = new_balance WHERE id = affected_account_id;

  -- Se for transferência, atualizar conta de origem (OLD) também
  IF TG_OP = 'UPDATE' AND OLD.account_id != NEW.account_id THEN
    new_balance := calculate_account_balance(OLD.account_id);
    INSERT INTO account_balance_snapshots (account_id, balance, last_transaction_id, updated_at)
    VALUES (OLD.account_id, new_balance, NULL, now())
    ON CONFLICT (account_id)
    DO UPDATE SET balance = EXCLUDED.balance, last_transaction_id = NULL, updated_at = now();
    UPDATE accounts SET current_balance = new_balance WHERE id = OLD.account_id;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Trigger pós-insert/update/delete em transactions
CREATE TRIGGER trg_update_balance_snapshot
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_balance_snapshot();

-- =============================================
-- ETAPA 3.1: PREVISÃO DE CAIXA
-- =============================================

CREATE TABLE IF NOT EXISTS public.cashflow_forecasts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  forecast_date date NOT NULL,
  projected_balance numeric NOT NULL DEFAULT 0,
  projected_income numeric DEFAULT 0,
  projected_expense numeric DEFAULT 0,
  confidence_score numeric DEFAULT 0,
  based_on_patterns boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cashflow_forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org forecasts"
  ON public.cashflow_forecasts FOR SELECT
  USING (can_view_organization(organization_id, auth.uid()));

CREATE POLICY "Users can manage their org forecasts"
  ON public.cashflow_forecasts FOR INSERT
  WITH CHECK (can_view_organization(organization_id, auth.uid()));

CREATE POLICY "Users can delete their org forecasts"
  ON public.cashflow_forecasts FOR DELETE
  USING (can_view_organization(organization_id, auth.uid()));

CREATE INDEX idx_cashflow_forecasts_org_date ON public.cashflow_forecasts (organization_id, forecast_date);

-- =============================================
-- ETAPA 3.2: DETECÇÃO DE ASSINATURAS RECORRENTES
-- =============================================

CREATE TABLE IF NOT EXISTS public.recurring_expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  description text NOT NULL,
  avg_amount numeric NOT NULL DEFAULT 0,
  frequency text NOT NULL DEFAULT 'monthly',
  next_due_date date,
  confidence numeric DEFAULT 0.5,
  occurrences integer DEFAULT 1,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org recurring expenses"
  ON public.recurring_expenses FOR SELECT
  USING (can_view_organization(organization_id, auth.uid()));

CREATE POLICY "Users can manage their org recurring expenses"
  ON public.recurring_expenses FOR ALL
  USING (can_view_organization(organization_id, auth.uid()))
  WITH CHECK (can_view_organization(organization_id, auth.uid()));

CREATE INDEX idx_recurring_expenses_org ON public.recurring_expenses (organization_id);

-- =============================================
-- ETAPA 3.4: DETECÇÃO DE ANOMALIAS
-- =============================================

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS is_anomaly boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS anomaly_score numeric DEFAULT 0;

-- =============================================
-- ETAPA 3.3: SCORE DE SAÚDE FINANCEIRA
-- =============================================

CREATE OR REPLACE FUNCTION public.generate_financial_health_score(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
  v_total_revenue numeric := 0;
  v_total_expenses numeric := 0;
  v_prev_revenue numeric := 0;
  v_prev_expenses numeric := 0;
  v_total_balance numeric := 0;
  v_monthly_burn numeric := 0;
  v_runway_months numeric := 0;
  v_savings_rate numeric := 0;
  v_concentration numeric := 0;
  v_recurring_ratio numeric := 0;
  v_score numeric := 50;
  v_start_date date;
  v_end_date date;
BEGIN
  v_start_date := date_trunc('month', current_date)::date;
  v_end_date := (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date;

  -- Receitas e despesas do mês atual
  SELECT 
    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)
  INTO v_total_revenue, v_total_expenses
  FROM transactions
  WHERE organization_id = p_organization_id
    AND date BETWEEN v_start_date AND v_end_date
    AND status = 'completed'
    AND is_ignored IS NOT TRUE;

  -- Receitas e despesas do mês anterior
  SELECT 
    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)
  INTO v_prev_revenue, v_prev_expenses
  FROM transactions
  WHERE organization_id = p_organization_id
    AND date BETWEEN (v_start_date - interval '1 month')::date AND (v_start_date - interval '1 day')::date
    AND status = 'completed'
    AND is_ignored IS NOT TRUE;

  -- Saldo total das contas correntes
  SELECT COALESCE(SUM(COALESCE(s.balance, a.current_balance, 0)), 0)
  INTO v_total_balance
  FROM accounts a
  LEFT JOIN account_balance_snapshots s ON s.account_id = a.id
  WHERE a.organization_id = p_organization_id
    AND a.account_type IN ('checking', 'savings')
    AND a.status = 'active';

  -- Burn rate mensal (média 3 meses)
  SELECT COALESCE(AVG(monthly_expense), 0) INTO v_monthly_burn
  FROM (
    SELECT SUM(amount) as monthly_expense
    FROM transactions
    WHERE organization_id = p_organization_id
      AND type = 'expense'
      AND status = 'completed'
      AND is_ignored IS NOT TRUE
      AND date >= (current_date - interval '3 months')::date
    GROUP BY date_trunc('month', date)
  ) sub;

  -- Runway
  IF v_monthly_burn > 0 THEN
    v_runway_months := ROUND(v_total_balance / v_monthly_burn, 1);
  ELSE
    v_runway_months := 99;
  END IF;

  -- Taxa de poupança
  IF v_total_revenue > 0 THEN
    v_savings_rate := ROUND(((v_total_revenue - v_total_expenses) / v_total_revenue) * 100, 2);
  END IF;

  -- Concentração de despesas (% da maior categoria)
  SELECT COALESCE(MAX(cat_pct), 0) INTO v_concentration
  FROM (
    SELECT CASE WHEN v_total_expenses > 0 THEN (SUM(amount) / v_total_expenses) * 100 ELSE 0 END as cat_pct
    FROM transactions
    WHERE organization_id = p_organization_id
      AND type = 'expense'
      AND date BETWEEN v_start_date AND v_end_date
      AND status = 'completed'
      AND is_ignored IS NOT TRUE
    GROUP BY category_id
  ) cat_dist;

  -- Calcular score (0-100)
  v_score := 50;
  -- Runway: +20 se > 6 meses, +10 se > 3, -10 se < 1
  IF v_runway_months > 6 THEN v_score := v_score + 20;
  ELSIF v_runway_months > 3 THEN v_score := v_score + 10;
  ELSIF v_runway_months < 1 THEN v_score := v_score - 15;
  END IF;
  -- Savings rate: +15 se > 20%, +5 se > 0, -10 se negativo
  IF v_savings_rate > 20 THEN v_score := v_score + 15;
  ELSIF v_savings_rate > 0 THEN v_score := v_score + 5;
  ELSIF v_savings_rate < 0 THEN v_score := v_score - 10;
  END IF;
  -- Concentração: -10 se > 50% numa categoria
  IF v_concentration > 50 THEN v_score := v_score - 10; END IF;
  -- Crescimento receita vs despesa
  IF v_prev_revenue > 0 AND v_total_revenue > v_prev_revenue THEN v_score := v_score + 5; END IF;
  IF v_prev_expenses > 0 AND v_total_expenses < v_prev_expenses THEN v_score := v_score + 5; END IF;

  v_score := GREATEST(0, LEAST(100, v_score));

  result := jsonb_build_object(
    'score', v_score,
    'runway_months', v_runway_months,
    'burn_rate', v_monthly_burn,
    'savings_rate', v_savings_rate,
    'total_balance', v_total_balance,
    'total_revenue', v_total_revenue,
    'total_expenses', v_total_expenses,
    'expense_concentration', v_concentration,
    'revenue_growth', CASE WHEN v_prev_revenue > 0 THEN ROUND(((v_total_revenue - v_prev_revenue) / v_prev_revenue) * 100, 2) ELSE 0 END,
    'expense_growth', CASE WHEN v_prev_expenses > 0 THEN ROUND(((v_total_expenses - v_prev_expenses) / v_prev_expenses) * 100, 2) ELSE 0 END
  );

  RETURN result;
END;
$$;

-- =============================================
-- ETAPA 7.3: COMENTÁRIOS EM TRANSAÇÕES
-- =============================================

CREATE TABLE IF NOT EXISTS public.transaction_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  comment text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transaction_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view comments on their org transactions"
  ON public.transaction_comments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM transactions t
    WHERE t.id = transaction_comments.transaction_id
    AND can_view_transaction(t.organization_id, auth.uid())
  ));

CREATE POLICY "Users can create comments"
  ON public.transaction_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM transactions t
    WHERE t.id = transaction_comments.transaction_id
    AND can_view_transaction(t.organization_id, auth.uid())
  ));

CREATE POLICY "Users can delete own comments"
  ON public.transaction_comments FOR DELETE
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE INDEX idx_transaction_comments_tx ON public.transaction_comments (transaction_id);

-- Índice para anomalias
CREATE INDEX IF NOT EXISTS idx_transactions_anomaly ON public.transactions (is_anomaly) WHERE is_anomaly = true;
