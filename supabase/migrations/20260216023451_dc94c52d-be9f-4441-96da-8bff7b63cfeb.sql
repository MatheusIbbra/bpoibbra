
-- =====================================================
-- ETAPA 3: WEALTH INTELLIGENCE RPCs
-- =====================================================

-- 3.1 Exposição Cambial
CREATE OR REPLACE FUNCTION public.get_currency_exposure(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
  v_total numeric := 0;
  v_base_currency text;
BEGIN
  SELECT COALESCE(base_currency, 'BRL') INTO v_base_currency
  FROM organizations WHERE id = p_organization_id;

  WITH account_balances AS (
    SELECT
      a.currency_code,
      COALESCE(s.balance, a.current_balance, 0) as balance
    FROM accounts a
    LEFT JOIN account_balance_snapshots s ON s.account_id = a.id
    WHERE a.organization_id = p_organization_id
      AND a.status = 'active'
      AND a.account_type IN ('checking', 'savings', 'cash', 'investment')
  ),
  by_currency AS (
    SELECT
      currency_code,
      SUM(balance) as total_balance,
      COUNT(*) as account_count
    FROM account_balances
    GROUP BY currency_code
  ),
  with_conversion AS (
    SELECT
      bc.currency_code,
      bc.total_balance,
      bc.account_count,
      CASE
        WHEN bc.currency_code = v_base_currency THEN bc.total_balance
        ELSE convert_currency(bc.total_balance, bc.currency_code, v_base_currency)
      END as converted_balance
    FROM by_currency bc
  )
  SELECT
    COALESCE(SUM(converted_balance), 0),
    jsonb_agg(jsonb_build_object(
      'currency', currency_code,
      'balance_original', total_balance,
      'balance_converted', converted_balance,
      'account_count', account_count,
      'percentage', 0 -- placeholder, calculated below
    ))
  INTO v_total, v_result
  FROM with_conversion;

  -- Calculate percentages
  IF v_total > 0 AND v_result IS NOT NULL THEN
    v_result := (
      SELECT jsonb_agg(
        elem || jsonb_build_object(
          'percentage', ROUND(((elem->>'balance_converted')::numeric / v_total) * 100, 2)
        )
      )
      FROM jsonb_array_elements(v_result) elem
    );
  END IF;

  RETURN jsonb_build_object(
    'total_patrimony', ROUND(v_total, 2),
    'base_currency', v_base_currency,
    'exposures', COALESCE(v_result, '[]'::jsonb),
    'has_foreign_currency', (
      SELECT COUNT(DISTINCT currency_code) > 1
      FROM accounts
      WHERE organization_id = p_organization_id AND status = 'active'
    ),
    'generated_at', now()
  );
END;
$function$;

-- 3.2 Índice de Concentração Bancária
CREATE OR REPLACE FUNCTION public.get_bank_concentration(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
  v_total numeric := 0;
  v_max_pct numeric := 0;
  v_risk_level text := 'low';
BEGIN
  WITH bank_balances AS (
    SELECT
      COALESCE(a.bank_name, 'Sem Banco') as bank_name,
      SUM(COALESCE(s.balance, a.current_balance, 0)) as total_balance,
      COUNT(*) as account_count
    FROM accounts a
    LEFT JOIN account_balance_snapshots s ON s.account_id = a.id
    WHERE a.organization_id = p_organization_id
      AND a.status = 'active'
      AND a.account_type IN ('checking', 'savings', 'cash', 'investment')
    GROUP BY COALESCE(a.bank_name, 'Sem Banco')
  )
  SELECT
    COALESCE(SUM(total_balance), 0),
    jsonb_agg(jsonb_build_object(
      'bank_name', bank_name,
      'balance', ROUND(total_balance, 2),
      'account_count', account_count,
      'percentage', 0
    ) ORDER BY total_balance DESC)
  INTO v_total, v_result
  FROM bank_balances;

  IF v_total > 0 AND v_result IS NOT NULL THEN
    v_result := (
      SELECT jsonb_agg(
        elem || jsonb_build_object(
          'percentage', ROUND(((elem->>'balance')::numeric / v_total) * 100, 2)
        )
      )
      FROM jsonb_array_elements(v_result) elem
    );
    v_max_pct := (SELECT MAX((elem->>'percentage')::numeric) FROM jsonb_array_elements(v_result) elem);
  END IF;

  IF v_max_pct > 60 THEN v_risk_level := 'critical';
  ELSIF v_max_pct > 40 THEN v_risk_level := 'high';
  ELSIF v_max_pct > 25 THEN v_risk_level := 'moderate';
  END IF;

  RETURN jsonb_build_object(
    'total_patrimony', ROUND(v_total, 2),
    'banks', COALESCE(v_result, '[]'::jsonb),
    'max_concentration_pct', ROUND(v_max_pct, 2),
    'risk_level', v_risk_level,
    'generated_at', now()
  );
END;
$function$;

-- 3.3 Liquidez Estruturada
CREATE OR REPLACE FUNCTION public.get_structured_liquidity(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_immediate numeric := 0;
  v_30d numeric := 0;
  v_90d numeric := 0;
  v_committed numeric := 0;
  v_total numeric := 0;
BEGIN
  -- Immediate liquidity: checking + cash + savings
  SELECT COALESCE(SUM(COALESCE(s.balance, a.current_balance, 0)), 0)
  INTO v_immediate
  FROM accounts a
  LEFT JOIN account_balance_snapshots s ON s.account_id = a.id
  WHERE a.organization_id = p_organization_id
    AND a.status = 'active'
    AND a.account_type IN ('checking', 'cash', 'savings');

  -- 30-day liquidity: immediate + projected income - projected expenses (30 days)
  SELECT
    v_immediate
    + COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0)
  INTO v_30d
  FROM transactions t
  WHERE t.organization_id = p_organization_id
    AND t.date BETWEEN current_date AND (current_date + interval '30 days')
    AND t.status IN ('completed', 'pending')
    AND t.is_ignored IS NOT TRUE;

  -- If no future transactions, estimate from average
  IF v_30d = v_immediate THEN
    WITH monthly_avg AS (
      SELECT
        COALESCE(AVG(CASE WHEN type = 'income' THEN amount END), 0) as avg_income,
        COALESCE(AVG(CASE WHEN type = 'expense' THEN amount END), 0) as avg_expense
      FROM (
        SELECT type, SUM(amount) as amount
        FROM transactions
        WHERE organization_id = p_organization_id
          AND date >= (current_date - interval '3 months')
          AND is_ignored IS NOT TRUE
        GROUP BY type, date_trunc('month', date)
      ) sub
    )
    SELECT v_immediate + (avg_income - avg_expense) INTO v_30d FROM monthly_avg;
  END IF;

  -- 90-day liquidity
  v_90d := v_immediate + ((v_30d - v_immediate) * 3);

  -- Committed capital: investments
  SELECT COALESCE(SUM(COALESCE(s.balance, a.current_balance, 0)), 0)
  INTO v_committed
  FROM accounts a
  LEFT JOIN account_balance_snapshots s ON s.account_id = a.id
  WHERE a.organization_id = p_organization_id
    AND a.status = 'active'
    AND a.account_type = 'investment';

  v_total := v_immediate + v_committed;

  RETURN jsonb_build_object(
    'immediate', ROUND(v_immediate, 2),
    'liquidity_30d', ROUND(v_30d, 2),
    'liquidity_90d', ROUND(v_90d, 2),
    'committed_capital', ROUND(v_committed, 2),
    'total_patrimony', ROUND(v_total, 2),
    'immediate_pct', CASE WHEN v_total > 0 THEN ROUND((v_immediate / v_total) * 100, 2) ELSE 0 END,
    'generated_at', now()
  );
END;
$function$;

-- 3.4 Padrão de Vida Mensal
CREATE OR REPLACE FUNCTION public.get_lifestyle_pattern(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
  v_avg_12m numeric := 0;
  v_avg_3m numeric := 0;
  v_stddev numeric := 0;
  v_trend text := 'stable';
  v_months jsonb := '[]'::jsonb;
BEGIN
  WITH monthly_expenses AS (
    SELECT
      date_trunc('month', date)::date as month,
      SUM(amount) as total
    FROM transactions
    WHERE organization_id = p_organization_id
      AND type = 'expense'
      AND is_ignored IS NOT TRUE
      AND date >= (current_date - interval '12 months')
    GROUP BY date_trunc('month', date)
    ORDER BY month
  )
  SELECT
    COALESCE(AVG(total), 0),
    COALESCE(STDDEV(total), 0),
    jsonb_agg(jsonb_build_object('month', month, 'total', ROUND(total, 2)) ORDER BY month)
  INTO v_avg_12m, v_stddev, v_months
  FROM monthly_expenses;

  -- Average last 3 months
  WITH recent AS (
    SELECT SUM(amount) as total
    FROM transactions
    WHERE organization_id = p_organization_id
      AND type = 'expense'
      AND is_ignored IS NOT TRUE
      AND date >= (current_date - interval '3 months')
    GROUP BY date_trunc('month', date)
  )
  SELECT COALESCE(AVG(total), 0) INTO v_avg_3m FROM recent;

  -- Determine trend
  IF v_avg_12m > 0 THEN
    IF v_avg_3m > v_avg_12m * 1.10 THEN v_trend := 'increasing';
    ELSIF v_avg_3m < v_avg_12m * 0.90 THEN v_trend := 'decreasing';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'avg_monthly_12m', ROUND(v_avg_12m, 2),
    'avg_monthly_3m', ROUND(v_avg_3m, 2),
    'volatility', CASE WHEN v_avg_12m > 0 THEN ROUND((v_stddev / v_avg_12m) * 100, 2) ELSE 0 END,
    'trend', v_trend,
    'monthly_data', COALESCE(v_months, '[]'::jsonb),
    'generated_at', now()
  );
END;
$function$;

-- 3.5 Runway Pessoal
CREATE OR REPLACE FUNCTION public.get_personal_runway(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_liquid_assets numeric := 0;
  v_avg_monthly_expense numeric := 0;
  v_runway_months numeric := 0;
  v_risk_level text := 'safe';
BEGIN
  -- Liquid assets (checking + savings + cash)
  SELECT COALESCE(SUM(COALESCE(s.balance, a.current_balance, 0)), 0)
  INTO v_liquid_assets
  FROM accounts a
  LEFT JOIN account_balance_snapshots s ON s.account_id = a.id
  WHERE a.organization_id = p_organization_id
    AND a.status = 'active'
    AND a.account_type IN ('checking', 'savings', 'cash');

  -- Average monthly expenses (last 6 months)
  SELECT COALESCE(AVG(monthly_total), 0)
  INTO v_avg_monthly_expense
  FROM (
    SELECT SUM(amount) as monthly_total
    FROM transactions
    WHERE organization_id = p_organization_id
      AND type = 'expense'
      AND is_ignored IS NOT TRUE
      AND date >= (current_date - interval '6 months')
    GROUP BY date_trunc('month', date)
  ) sub;

  IF v_avg_monthly_expense > 0 THEN
    v_runway_months := ROUND(v_liquid_assets / v_avg_monthly_expense, 1);
  ELSE
    v_runway_months := 99;
  END IF;

  IF v_runway_months < 3 THEN v_risk_level := 'critical';
  ELSIF v_runway_months < 6 THEN v_risk_level := 'warning';
  ELSIF v_runway_months < 12 THEN v_risk_level := 'moderate';
  END IF;

  RETURN jsonb_build_object(
    'runway_months', v_runway_months,
    'liquid_assets', ROUND(v_liquid_assets, 2),
    'avg_monthly_expense', ROUND(v_avg_monthly_expense, 2),
    'risk_level', v_risk_level,
    'generated_at', now()
  );
END;
$function$;

-- 3.6 Evolução Patrimonial 12 meses
CREATE OR REPLACE FUNCTION public.get_patrimony_evolution(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
  v_current_total numeric := 0;
  v_12m_ago_total numeric := 0;
  v_growth_pct numeric := 0;
BEGIN
  -- Current total balance
  SELECT COALESCE(SUM(COALESCE(s.balance, a.current_balance, 0)), 0)
  INTO v_current_total
  FROM accounts a
  LEFT JOIN account_balance_snapshots s ON s.account_id = a.id
  WHERE a.organization_id = p_organization_id
    AND a.status = 'active';

  -- Monthly net flow (income - expense) for last 12 months
  WITH monthly_flows AS (
    SELECT
      date_trunc('month', date)::date as month,
      SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
      SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense,
      SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as net_flow
    FROM transactions
    WHERE organization_id = p_organization_id
      AND is_ignored IS NOT TRUE
      AND date >= (current_date - interval '12 months')
      AND type IN ('income', 'expense')
    GROUP BY date_trunc('month', date)
    ORDER BY month
  ),
  cumulative AS (
    SELECT
      month,
      income,
      expense,
      net_flow,
      SUM(net_flow) OVER (ORDER BY month) as cumulative_net
    FROM monthly_flows
  )
  SELECT jsonb_agg(jsonb_build_object(
    'month', month,
    'income', ROUND(income, 2),
    'expense', ROUND(expense, 2),
    'net_flow', ROUND(net_flow, 2),
    'cumulative_net', ROUND(cumulative_net, 2)
  ) ORDER BY month)
  INTO v_result
  FROM cumulative;

  -- Estimate 12 months ago balance
  v_12m_ago_total := v_current_total - COALESCE(
    (SELECT SUM(net_flow) FROM (
      SELECT SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as net_flow
      FROM transactions
      WHERE organization_id = p_organization_id
        AND is_ignored IS NOT TRUE
        AND date >= (current_date - interval '12 months')
        AND type IN ('income', 'expense')
    ) sub), 0
  );

  IF v_12m_ago_total > 0 THEN
    v_growth_pct := ROUND(((v_current_total - v_12m_ago_total) / v_12m_ago_total) * 100, 2);
  END IF;

  RETURN jsonb_build_object(
    'current_patrimony', ROUND(v_current_total, 2),
    'estimated_12m_ago', ROUND(v_12m_ago_total, 2),
    'growth_pct', v_growth_pct,
    'monthly_data', COALESCE(v_result, '[]'::jsonb),
    'generated_at', now()
  );
END;
$function$;
