-- Fix calculate_account_balance to properly handle transfers:
-- Transfer primary leg (is_ignored=false) = debit = -amount
-- Transfer secondary/credit leg (is_ignored=true) = already excluded by the is_ignored filter
CREATE OR REPLACE FUNCTION public.calculate_account_balance(account_uuid uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  initial numeric;
  transaction_total numeric;
BEGIN

  SELECT initial_balance
  INTO initial
  FROM accounts
  WHERE id = account_uuid;

  SELECT COALESCE(SUM(
    CASE
      WHEN type IN ('income', 'redemption') THEN amount
      WHEN type IN ('expense', 'investment', 'transfer') THEN -amount
      ELSE 0
    END
  ), 0)
  INTO transaction_total
  FROM transactions
  WHERE account_id = account_uuid
    AND status != 'cancelled'
    AND (is_ignored IS NOT TRUE)
    AND (description IS NULL OR description NOT LIKE 'Saldo inicial -%');

  RETURN COALESCE(initial, 0) + transaction_total;

END;
$$;