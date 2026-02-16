
-- =============================================
-- STRATEGIC HISTORY: Monthly snapshots for Wealth Intelligence
-- =============================================
CREATE TABLE public.strategic_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  snapshot_month DATE NOT NULL, -- First day of month (e.g., 2026-01-01)
  
  -- Core metrics
  financial_health_score NUMERIC,
  runway_months NUMERIC,
  burn_rate NUMERIC,
  savings_rate NUMERIC,
  
  -- Balances
  total_balance NUMERIC DEFAULT 0,
  total_revenue NUMERIC DEFAULT 0,
  total_expenses NUMERIC DEFAULT 0,
  
  -- Concentration
  bank_concentration_max_pct NUMERIC,
  bank_concentration_risk TEXT,
  
  -- Currency exposure
  currency_exposure JSONB DEFAULT '[]'::jsonb,
  has_foreign_currency BOOLEAN DEFAULT false,
  
  -- Liquidity
  liquidity_immediate NUMERIC DEFAULT 0,
  liquidity_30d NUMERIC DEFAULT 0,
  liquidity_90d NUMERIC DEFAULT 0,
  committed_capital NUMERIC DEFAULT 0,
  
  -- Lifestyle
  lifestyle_avg_monthly NUMERIC DEFAULT 0,
  lifestyle_trend TEXT DEFAULT 'stable',
  lifestyle_volatility NUMERIC DEFAULT 0,
  
  -- AI insights (optional, versionado)
  ai_insights JSONB,
  ai_model TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Ensure one snapshot per org per month
  CONSTRAINT unique_org_month UNIQUE (organization_id, snapshot_month)
);

-- Index for fast lookups
CREATE INDEX idx_strategic_history_org_month ON public.strategic_history(organization_id, snapshot_month DESC);

-- Enable RLS
ALTER TABLE public.strategic_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their org strategic history"
ON public.strategic_history FOR SELECT
USING (can_view_organization(organization_id, auth.uid()));

CREATE POLICY "Service role can manage strategic history"
ON public.strategic_history FOR ALL
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

CREATE POLICY "Authenticated users can insert for their org"
ON public.strategic_history FOR INSERT
WITH CHECK (can_view_organization(organization_id, auth.uid()));

-- =============================================
-- RPC: Generate and save monthly strategic snapshot
-- =============================================
CREATE OR REPLACE FUNCTION public.generate_strategic_snapshot(p_organization_id UUID, p_month DATE DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_month DATE;
  v_health JSONB;
  v_bank JSONB;
  v_currency JSONB;
  v_liquidity JSONB;
  v_lifestyle JSONB;
  v_result JSONB;
BEGIN
  -- Default to current month
  v_month := COALESCE(p_month, date_trunc('month', current_date)::date);

  -- Gather all metrics using existing RPCs
  v_health := generate_financial_health_score(p_organization_id);
  v_bank := get_bank_concentration(p_organization_id);
  v_currency := get_currency_exposure(p_organization_id);
  v_liquidity := get_structured_liquidity(p_organization_id);
  v_lifestyle := get_lifestyle_pattern(p_organization_id);

  -- Upsert the snapshot
  INSERT INTO public.strategic_history (
    organization_id, snapshot_month,
    financial_health_score, runway_months, burn_rate, savings_rate,
    total_balance, total_revenue, total_expenses,
    bank_concentration_max_pct, bank_concentration_risk,
    currency_exposure, has_foreign_currency,
    liquidity_immediate, liquidity_30d, liquidity_90d, committed_capital,
    lifestyle_avg_monthly, lifestyle_trend, lifestyle_volatility
  ) VALUES (
    p_organization_id, v_month,
    (v_health->>'score')::numeric,
    (v_health->>'runway_months')::numeric,
    (v_health->>'burn_rate')::numeric,
    (v_health->>'savings_rate')::numeric,
    (v_health->>'total_balance')::numeric,
    (v_health->>'total_revenue')::numeric,
    (v_health->>'total_expenses')::numeric,
    (v_bank->>'max_concentration_pct')::numeric,
    v_bank->>'risk_level',
    v_currency->'exposures',
    COALESCE((v_currency->>'has_foreign_currency')::boolean, false),
    (v_liquidity->>'immediate')::numeric,
    (v_liquidity->>'liquidity_30d')::numeric,
    (v_liquidity->>'liquidity_90d')::numeric,
    (v_liquidity->>'committed_capital')::numeric,
    (v_lifestyle->>'avg_monthly_12m')::numeric,
    v_lifestyle->>'trend',
    (v_lifestyle->>'volatility')::numeric
  )
  ON CONFLICT (organization_id, snapshot_month)
  DO UPDATE SET
    financial_health_score = EXCLUDED.financial_health_score,
    runway_months = EXCLUDED.runway_months,
    burn_rate = EXCLUDED.burn_rate,
    savings_rate = EXCLUDED.savings_rate,
    total_balance = EXCLUDED.total_balance,
    total_revenue = EXCLUDED.total_revenue,
    total_expenses = EXCLUDED.total_expenses,
    bank_concentration_max_pct = EXCLUDED.bank_concentration_max_pct,
    bank_concentration_risk = EXCLUDED.bank_concentration_risk,
    currency_exposure = EXCLUDED.currency_exposure,
    has_foreign_currency = EXCLUDED.has_foreign_currency,
    liquidity_immediate = EXCLUDED.liquidity_immediate,
    liquidity_30d = EXCLUDED.liquidity_30d,
    liquidity_90d = EXCLUDED.liquidity_90d,
    committed_capital = EXCLUDED.committed_capital,
    lifestyle_avg_monthly = EXCLUDED.lifestyle_avg_monthly,
    lifestyle_trend = EXCLUDED.lifestyle_trend,
    lifestyle_volatility = EXCLUDED.lifestyle_volatility;

  v_result := jsonb_build_object(
    'organization_id', p_organization_id,
    'snapshot_month', v_month,
    'health_score', (v_health->>'score')::numeric,
    'runway_months', (v_health->>'runway_months')::numeric,
    'status', 'saved'
  );

  RETURN v_result;
END;
$function$;

-- =============================================
-- RPC: Macro Simulation
-- =============================================
CREATE OR REPLACE FUNCTION public.simulate_macro_scenario(
  p_organization_id UUID,
  p_currency_shock_pct NUMERIC DEFAULT 0,      -- e.g., 20 = dollar +20%
  p_income_change_pct NUMERIC DEFAULT 0,        -- e.g., -30 = income drops 30%
  p_expense_change_pct NUMERIC DEFAULT 0,       -- e.g., 15 = expenses up 15%
  p_extraordinary_amount NUMERIC DEFAULT 0,     -- one-time event (positive=income, negative=expense)
  p_months_ahead INTEGER DEFAULT 12
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_health JSONB;
  v_liquidity JSONB;
  v_currency JSONB;
  
  v_current_balance NUMERIC;
  v_monthly_income NUMERIC;
  v_monthly_expense NUMERIC;
  v_foreign_balance NUMERIC := 0;
  v_base_currency TEXT;
  
  v_sim_balance NUMERIC;
  v_sim_runway NUMERIC;
  v_sim_liquidity NUMERIC;
  v_sim_monthly_entries JSONB := '[]'::jsonb;
  v_month_balance NUMERIC;
  i INTEGER;
BEGIN
  -- Get current state
  v_health := generate_financial_health_score(p_organization_id);
  v_liquidity := get_structured_liquidity(p_organization_id);
  v_currency := get_currency_exposure(p_organization_id);
  
  v_current_balance := COALESCE((v_health->>'total_balance')::numeric, 0);
  v_monthly_income := COALESCE((v_health->>'total_revenue')::numeric, 0);
  v_monthly_expense := COALESCE((v_health->>'total_expenses')::numeric, 0);
  
  SELECT COALESCE(base_currency, 'BRL') INTO v_base_currency
  FROM organizations WHERE id = p_organization_id;
  
  -- Calculate foreign currency impact
  IF p_currency_shock_pct != 0 AND v_currency IS NOT NULL THEN
    SELECT COALESCE(SUM((elem->>'balance_converted')::numeric), 0) INTO v_foreign_balance
    FROM jsonb_array_elements(v_currency->'exposures') elem
    WHERE elem->>'currency' != v_base_currency;
  END IF;
  
  -- Apply scenario adjustments
  v_sim_balance := v_current_balance 
    + (v_foreign_balance * p_currency_shock_pct / 100)  -- currency impact on foreign holdings
    + p_extraordinary_amount;                             -- one-time event
    
  v_monthly_income := v_monthly_income * (1 + p_income_change_pct / 100);
  v_monthly_expense := v_monthly_expense * (1 + p_expense_change_pct / 100);
  
  -- Project month by month
  v_month_balance := v_sim_balance;
  FOR i IN 1..p_months_ahead LOOP
    v_month_balance := v_month_balance + v_monthly_income - v_monthly_expense;
    v_sim_monthly_entries := v_sim_monthly_entries || jsonb_build_object(
      'month', i,
      'date', (current_date + (i || ' months')::interval)::date,
      'balance', ROUND(v_month_balance, 2),
      'cumulative_income', ROUND(v_monthly_income * i, 2),
      'cumulative_expense', ROUND(v_monthly_expense * i, 2)
    );
  END LOOP;
  
  -- Calculate simulated runway
  IF v_monthly_expense > v_monthly_income AND v_monthly_expense > 0 THEN
    v_sim_runway := ROUND(v_sim_balance / (v_monthly_expense - v_monthly_income), 1);
  ELSIF v_monthly_expense <= v_monthly_income THEN
    v_sim_runway := 999; -- sustainable
  ELSE
    v_sim_runway := 0;
  END IF;
  
  v_sim_liquidity := (COALESCE((v_liquidity->>'immediate')::numeric, 0))
    + (v_foreign_balance * p_currency_shock_pct / 100)
    + p_extraordinary_amount;

  RETURN jsonb_build_object(
    'scenario', jsonb_build_object(
      'currency_shock_pct', p_currency_shock_pct,
      'income_change_pct', p_income_change_pct,
      'expense_change_pct', p_expense_change_pct,
      'extraordinary_amount', p_extraordinary_amount,
      'months_ahead', p_months_ahead
    ),
    'baseline', jsonb_build_object(
      'balance', v_current_balance,
      'monthly_income', (v_health->>'total_revenue')::numeric,
      'monthly_expense', (v_health->>'total_expenses')::numeric,
      'runway', (v_health->>'runway_months')::numeric,
      'health_score', (v_health->>'score')::numeric,
      'liquidity_immediate', (v_liquidity->>'immediate')::numeric
    ),
    'simulated', jsonb_build_object(
      'initial_balance', ROUND(v_sim_balance, 2),
      'monthly_income', ROUND(v_monthly_income, 2),
      'monthly_expense', ROUND(v_monthly_expense, 2),
      'runway_months', v_sim_runway,
      'liquidity_immediate', ROUND(v_sim_liquidity, 2),
      'final_balance', ROUND(v_month_balance, 2),
      'currency_impact', ROUND(v_foreign_balance * p_currency_shock_pct / 100, 2)
    ),
    'monthly_projection', v_sim_monthly_entries,
    'generated_at', now()
  );
END;
$function$;
