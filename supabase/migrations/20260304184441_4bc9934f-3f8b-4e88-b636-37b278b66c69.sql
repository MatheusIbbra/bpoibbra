-- Ensure current_balance is initialized from initial_balance on account creation
-- This fixes manual accounts that never had transactions (trigger never fired)
CREATE OR REPLACE FUNCTION public.initialize_account_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- On INSERT: if current_balance is 0 or null, seed it with initial_balance
  IF TG_OP = 'INSERT' THEN
    IF (NEW.current_balance IS NULL OR NEW.current_balance = 0) AND NEW.initial_balance IS NOT NULL AND NEW.initial_balance != 0 THEN
      NEW.current_balance := NEW.initial_balance;
    END IF;
  END IF;

  -- On UPDATE of initial_balance: recalc only if there are no transactions yet
  IF TG_OP = 'UPDATE' AND NEW.initial_balance IS DISTINCT FROM OLD.initial_balance THEN
    IF NOT EXISTS (SELECT 1 FROM transactions WHERE account_id = NEW.id LIMIT 1) THEN
      NEW.current_balance := NEW.initial_balance;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_initialize_account_balance ON public.accounts;
CREATE TRIGGER trg_initialize_account_balance
  BEFORE INSERT OR UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_account_balance();

-- Backfill: fix existing accounts where current_balance = 0 but initial_balance > 0 and no transactions
UPDATE public.accounts
SET current_balance = initial_balance
WHERE (current_balance IS NULL OR current_balance = 0)
  AND initial_balance IS NOT NULL
  AND initial_balance != 0
  AND NOT EXISTS (SELECT 1 FROM transactions WHERE account_id = accounts.id LIMIT 1);