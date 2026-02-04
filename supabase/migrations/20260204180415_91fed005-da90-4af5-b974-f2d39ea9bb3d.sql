-- Corrigir função para não contar transações de "Saldo inicial" que já estão no campo initial_balance
CREATE OR REPLACE FUNCTION public.calculate_account_balance(account_uuid uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  initial DECIMAL(15,2);
  transaction_total DECIMAL(15,2);
BEGIN
  SELECT initial_balance INTO initial FROM accounts WHERE id = account_uuid;
  
  SELECT COALESCE(SUM(
    CASE 
      WHEN type IN ('income', 'redemption') THEN amount
      WHEN type IN ('expense', 'investment') THEN -amount
      ELSE 0
    END
  ), 0) INTO transaction_total
  FROM transactions 
  WHERE account_id = account_uuid 
    AND status = 'completed'
    -- Excluir transações de saldo inicial para evitar duplicação
    AND (description IS NULL OR description NOT LIKE 'Saldo inicial -%');
  
  RETURN COALESCE(initial, 0) + transaction_total;
END;
$function$;