
-- 1. Add currency_code to accounts
ALTER TABLE public.accounts
ADD COLUMN currency_code text NOT NULL DEFAULT 'BRL';

CREATE INDEX idx_accounts_currency ON public.accounts(currency_code);

-- 2. Add base_currency to organizations
ALTER TABLE public.organizations
ADD COLUMN base_currency text NOT NULL DEFAULT 'BRL';

-- 3. Create exchange_rates table
CREATE TABLE public.exchange_rates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  base_currency text NOT NULL,
  target_currency text NOT NULL,
  rate numeric NOT NULL,
  rate_date date NOT NULL,
  source text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (base_currency, target_currency, rate_date)
);

ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view exchange rates (they are global reference data)
CREATE POLICY "Authenticated users can view exchange rates"
ON public.exchange_rates FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Only admins can manage exchange rates
CREATE POLICY "Admins can manage exchange rates"
ON public.exchange_rates FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 4. Add exchange rate snapshot columns to transactions
ALTER TABLE public.transactions
ADD COLUMN exchange_rate_used numeric,
ADD COLUMN converted_amount numeric;

-- 5. Create convert_currency function
CREATE OR REPLACE FUNCTION public.convert_currency(
  p_amount numeric,
  p_from_currency text,
  p_to_currency text,
  p_rate_date date DEFAULT CURRENT_DATE
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rate numeric;
BEGIN
  IF p_from_currency = p_to_currency THEN
    RETURN p_amount;
  END IF;

  -- Try direct rate
  SELECT rate INTO v_rate
  FROM exchange_rates
  WHERE base_currency = p_from_currency
    AND target_currency = p_to_currency
    AND rate_date <= p_rate_date
  ORDER BY rate_date DESC
  LIMIT 1;

  -- Try inverse rate
  IF v_rate IS NULL THEN
    SELECT 1.0 / rate INTO v_rate
    FROM exchange_rates
    WHERE base_currency = p_to_currency
      AND target_currency = p_from_currency
      AND rate_date <= p_rate_date
    ORDER BY rate_date DESC
    LIMIT 1;
  END IF;

  IF v_rate IS NULL THEN
    RETURN NULL; -- No rate available, don't break - return NULL
  END IF;

  RETURN ROUND(p_amount * v_rate, 2);
END;
$$;

-- 6. Create consolidated balance function with multicurrency support
CREATE OR REPLACE FUNCTION public.get_consolidated_balance(
  p_organization_id uuid,
  p_target_currency text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_target_currency text;
  v_result jsonb;
  v_total_converted numeric := 0;
  v_by_currency jsonb := '[]'::jsonb;
  v_rates_used jsonb := '[]'::jsonb;
BEGIN
  -- Determine target currency
  IF p_target_currency IS NOT NULL THEN
    v_target_currency := p_target_currency;
  ELSE
    SELECT COALESCE(base_currency, 'BRL') INTO v_target_currency
    FROM organizations WHERE id = p_organization_id;
  END IF;

  -- Get balances grouped by currency
  WITH currency_balances AS (
    SELECT
      a.currency_code,
      SUM(COALESCE(s.balance, a.current_balance, 0)) as total_balance,
      COUNT(*) as account_count
    FROM accounts a
    LEFT JOIN account_balance_snapshots s ON s.account_id = a.id
    WHERE a.organization_id = p_organization_id
      AND a.status = 'active'
      AND a.account_type IN ('checking', 'savings', 'cash', 'investment')
    GROUP BY a.currency_code
  ),
  converted AS (
    SELECT
      cb.currency_code,
      cb.total_balance,
      cb.account_count,
      CASE
        WHEN cb.currency_code = v_target_currency THEN cb.total_balance
        ELSE convert_currency(cb.total_balance, cb.currency_code, v_target_currency)
      END as converted_balance,
      CASE
        WHEN cb.currency_code = v_target_currency THEN 1.0
        ELSE (
          SELECT rate FROM exchange_rates
          WHERE base_currency = cb.currency_code
            AND target_currency = v_target_currency
            AND rate_date <= CURRENT_DATE
          ORDER BY rate_date DESC LIMIT 1
        )
      END as rate_used
    FROM currency_balances cb
  )
  SELECT
    COALESCE(SUM(converted_balance), 0),
    jsonb_agg(jsonb_build_object(
      'currency', currency_code,
      'balance', total_balance,
      'converted_balance', converted_balance,
      'account_count', account_count
    )),
    jsonb_agg(
      CASE WHEN currency_code != v_target_currency AND rate_used IS NOT NULL
      THEN jsonb_build_object(
        'from', currency_code,
        'to', v_target_currency,
        'rate', rate_used
      )
      ELSE NULL END
    ) FILTER (WHERE currency_code != v_target_currency AND rate_used IS NOT NULL)
  INTO v_total_converted, v_by_currency, v_rates_used
  FROM converted;

  v_result := jsonb_build_object(
    'total_converted', COALESCE(v_total_converted, 0),
    'target_currency', v_target_currency,
    'by_currency', COALESCE(v_by_currency, '[]'::jsonb),
    'rates_used', COALESCE(v_rates_used, '[]'::jsonb),
    'generated_at', now()
  );

  RETURN v_result;
END;
$$;
