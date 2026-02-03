
-- =====================================================
-- ETAPA 1: FUNÇÃO DETERMINÍSTICA DE MÉTRICAS FINANCEIRAS
-- =====================================================

-- Função que calcula métricas financeiras sem usar IA
CREATE OR REPLACE FUNCTION public.generate_financial_metrics(
  p_organization_id uuid,
  p_period text DEFAULT 'current_month'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  result jsonb;
  v_start_date date;
  v_end_date date;
  v_prev_start_date date;
  v_prev_end_date date;
  
  -- Métricas calculadas
  v_total_revenue numeric := 0;
  v_total_expenses numeric := 0;
  v_prev_revenue numeric := 0;
  v_prev_expenses numeric := 0;
  v_revenue_growth numeric := 0;
  v_expense_growth numeric := 0;
  v_savings_rate numeric := 0;
  v_budget_total numeric := 0;
  v_actual_expenses numeric := 0;
  v_budget_deviation numeric := 0;
  v_cashflow_risk boolean := false;
  v_top_category_name text := '';
  v_top_category_pct numeric := 0;
BEGIN
  -- Determinar período
  IF p_period = 'current_month' THEN
    v_start_date := date_trunc('month', current_date)::date;
    v_end_date := (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date;
    v_prev_start_date := (date_trunc('month', current_date) - interval '1 month')::date;
    v_prev_end_date := (date_trunc('month', current_date) - interval '1 day')::date;
  ELSIF p_period = 'last_month' THEN
    v_start_date := (date_trunc('month', current_date) - interval '1 month')::date;
    v_end_date := (date_trunc('month', current_date) - interval '1 day')::date;
    v_prev_start_date := (date_trunc('month', current_date) - interval '2 months')::date;
    v_prev_end_date := (date_trunc('month', current_date) - interval '1 month' - interval '1 day')::date;
  ELSE
    -- Default: current month
    v_start_date := date_trunc('month', current_date)::date;
    v_end_date := (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date;
    v_prev_start_date := (date_trunc('month', current_date) - interval '1 month')::date;
    v_prev_end_date := (date_trunc('month', current_date) - interval '1 day')::date;
  END IF;

  -- Calcular receitas e despesas do período atual
  SELECT 
    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)
  INTO v_total_revenue, v_total_expenses
  FROM transactions
  WHERE organization_id = p_organization_id
    AND date BETWEEN v_start_date AND v_end_date
    AND status = 'completed';

  -- Calcular receitas e despesas do período anterior
  SELECT 
    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)
  INTO v_prev_revenue, v_prev_expenses
  FROM transactions
  WHERE organization_id = p_organization_id
    AND date BETWEEN v_prev_start_date AND v_prev_end_date
    AND status = 'completed';

  -- Calcular crescimento de receita
  IF v_prev_revenue > 0 THEN
    v_revenue_growth := ROUND(((v_total_revenue - v_prev_revenue) / v_prev_revenue) * 100, 2);
  ELSE
    v_revenue_growth := 0;
  END IF;

  -- Calcular crescimento de despesas
  IF v_prev_expenses > 0 THEN
    v_expense_growth := ROUND(((v_total_expenses - v_prev_expenses) / v_prev_expenses) * 100, 2);
  ELSE
    v_expense_growth := 0;
  END IF;

  -- Calcular taxa de poupança
  IF v_total_revenue > 0 THEN
    v_savings_rate := ROUND(((v_total_revenue - v_total_expenses) / v_total_revenue) * 100, 2);
  ELSE
    v_savings_rate := 0;
  END IF;

  -- Calcular desvio orçamentário
  SELECT COALESCE(SUM(amount), 0)
  INTO v_budget_total
  FROM budgets
  WHERE organization_id = p_organization_id
    AND year = EXTRACT(YEAR FROM v_start_date)
    AND month = EXTRACT(MONTH FROM v_start_date);

  IF v_budget_total > 0 THEN
    v_budget_deviation := ROUND(((v_total_expenses - v_budget_total) / v_budget_total) * 100, 2);
  ELSE
    v_budget_deviation := 0;
  END IF;

  -- Detectar risco de fluxo de caixa (despesas > 90% das receitas)
  IF v_total_revenue > 0 AND (v_total_expenses / v_total_revenue) > 0.9 THEN
    v_cashflow_risk := true;
  END IF;

  -- Encontrar categoria com maior despesa
  SELECT 
    COALESCE(c.name, 'Não categorizado'),
    CASE 
      WHEN v_total_expenses > 0 
      THEN ROUND((SUM(t.amount) / v_total_expenses) * 100, 2)
      ELSE 0
    END
  INTO v_top_category_name, v_top_category_pct
  FROM transactions t
  LEFT JOIN categories c ON t.category_id = c.id
  WHERE t.organization_id = p_organization_id
    AND t.date BETWEEN v_start_date AND v_end_date
    AND t.type = 'expense'
    AND t.status = 'completed'
  GROUP BY c.name
  ORDER BY SUM(t.amount) DESC
  LIMIT 1;

  -- Montar resultado
  result := jsonb_build_object(
    'savings_rate', v_savings_rate,
    'revenue_growth', v_revenue_growth,
    'expense_growth', v_expense_growth,
    'budget_deviation', v_budget_deviation,
    'cashflow_risk', v_cashflow_risk,
    'top_expense_category', COALESCE(v_top_category_name, 'N/A'),
    'top_expense_percentage', COALESCE(v_top_category_pct, 0),
    'period_start', v_start_date,
    'period_end', v_end_date,
    'total_revenue', v_total_revenue,
    'total_expenses', v_total_expenses
  );

  RETURN result;
END;
$$;

-- =====================================================
-- ETAPA 2: TABELA DE ARMAZENAMENTO DE INSIGHTS
-- =====================================================

CREATE TABLE public.ai_strategic_insights (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period text NOT NULL,
  insights_json jsonb NOT NULL,
  metrics_json jsonb,
  model text DEFAULT 'google/gemini-2.5-flash',
  token_usage integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Índice para busca rápida por org + período
CREATE INDEX idx_ai_strategic_insights_org_period 
  ON public.ai_strategic_insights(organization_id, period);

-- Índice para ordenação por data
CREATE INDEX idx_ai_strategic_insights_created 
  ON public.ai_strategic_insights(created_at DESC);

-- Habilitar RLS
ALTER TABLE public.ai_strategic_insights ENABLE ROW LEVEL SECURITY;

-- Política: SELECT apenas para organizações visíveis
CREATE POLICY "Users can view insights of their organizations"
  ON public.ai_strategic_insights
  FOR SELECT
  USING (
    public.can_view_organization(organization_id, auth.uid())
  );

-- Política: INSERT apenas para membros da organização
CREATE POLICY "Users can insert insights for their organizations"
  ON public.ai_strategic_insights
  FOR INSERT
  WITH CHECK (
    public.can_view_organization(organization_id, auth.uid())
  );

-- Política: DELETE apenas para admins
CREATE POLICY "Only admins can delete insights"
  ON public.ai_strategic_insights
  FOR DELETE
  USING (
    public.has_role(auth.uid(), 'admin')
  );

-- Restrição única para evitar duplicatas no mesmo período
CREATE UNIQUE INDEX idx_ai_strategic_insights_unique_period 
  ON public.ai_strategic_insights(organization_id, period);
