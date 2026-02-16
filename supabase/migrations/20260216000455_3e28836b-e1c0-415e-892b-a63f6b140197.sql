
CREATE OR REPLACE FUNCTION generate_financial_health_score(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  v_score numeric := 50;
  v_start_date date;
  v_end_date date;
  v_has_transactions boolean := false;
  v_has_accounts boolean := false;
BEGIN
  v_start_date := date_trunc('month', current_date)::date;
  v_end_date := (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date;

  -- Check if there are any accounts
  SELECT EXISTS(
    SELECT 1 FROM accounts 
    WHERE organization_id = p_organization_id AND status = 'active'
  ) INTO v_has_accounts;

  -- Check if there are any transactions at all
  SELECT EXISTS(
    SELECT 1 FROM transactions 
    WHERE organization_id = p_organization_id 
      AND is_ignored IS NOT TRUE
    LIMIT 1
  ) INTO v_has_transactions;

  -- If no accounts and no transactions, return NULL
  IF NOT v_has_accounts AND NOT v_has_transactions THEN
    RETURN NULL;
  END IF;

  -- Receitas e despesas do mês atual
  SELECT 
    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)
  INTO v_total_revenue, v_total_expenses
  FROM transactions
  WHERE organization_id = p_organization_id
    AND date BETWEEN v_start_date AND v_end_date
    AND is_ignored IS NOT TRUE;

  -- Receitas e despesas do mês anterior
  SELECT 
    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)
  INTO v_prev_revenue, v_prev_expenses
  FROM transactions
  WHERE organization_id = p_organization_id
    AND date BETWEEN (v_start_date - interval '1 month')::date AND (v_start_date - interval '1 day')::date
    AND is_ignored IS NOT TRUE;

  -- Saldo total das contas
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

  -- Concentração de despesas
  SELECT COALESCE(MAX(cat_pct), 0) INTO v_concentration
  FROM (
    SELECT CASE WHEN v_total_expenses > 0 THEN (SUM(amount) / v_total_expenses) * 100 ELSE 0 END as cat_pct
    FROM transactions
    WHERE organization_id = p_organization_id
      AND type = 'expense'
      AND date BETWEEN v_start_date AND v_end_date
      AND is_ignored IS NOT TRUE
    GROUP BY category_id
  ) cat_dist;

  -- Calcular score (0-100)
  v_score := 50;
  
  -- Only apply bonuses if there's actual data
  IF v_has_transactions THEN
    IF v_runway_months > 6 THEN v_score := v_score + 20;
    ELSIF v_runway_months > 3 THEN v_score := v_score + 10;
    ELSIF v_runway_months < 1 THEN v_score := v_score - 15;
    END IF;
    IF v_savings_rate > 20 THEN v_score := v_score + 15;
    ELSIF v_savings_rate > 0 THEN v_score := v_score + 5;
    ELSIF v_savings_rate < 0 THEN v_score := v_score - 10;
    END IF;
    IF v_concentration > 50 THEN v_score := v_score - 10; END IF;
    IF v_prev_revenue > 0 AND v_total_revenue > v_prev_revenue THEN v_score := v_score + 5; END IF;
    IF v_prev_expenses > 0 AND v_total_expenses < v_prev_expenses THEN v_score := v_score + 5; END IF;
  END IF;

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
