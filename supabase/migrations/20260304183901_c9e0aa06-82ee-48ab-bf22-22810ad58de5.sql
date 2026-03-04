-- Fix check_transaction_limit: default to 5000 (matching Starter plan) instead of 500
CREATE OR REPLACE FUNCTION public.check_transaction_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  org_limit INT;
  current_count INT;
BEGIN
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT p.max_transactions INTO org_limit
  FROM organization_subscriptions os
  JOIN plans p ON p.id = os.plan_id
  WHERE os.organization_id = NEW.organization_id
    AND os.status = 'active'
  LIMIT 1;
  
  IF org_limit IS NULL THEN
    SELECT max_transactions INTO org_limit
    FROM plans
    WHERE slug = 'starter' AND is_active = true
    LIMIT 1;
  END IF;

  IF org_limit IS NULL THEN
    org_limit := 5000;
  END IF;
  
  SELECT COUNT(*) INTO current_count
  FROM transactions
  WHERE organization_id = NEW.organization_id
    AND created_at >= date_trunc('month', now());
  
  IF current_count >= org_limit THEN
    RAISE EXCEPTION 'Limite de transações do plano atingido (% de %). Faça upgrade para continuar.', current_count, org_limit;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_bank_connection_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  org_limit INT;
  current_count INT;
BEGIN
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT p.max_bank_connections INTO org_limit
  FROM organization_subscriptions os
  JOIN plans p ON p.id = os.plan_id
  WHERE os.organization_id = NEW.organization_id
    AND os.status = 'active'
  LIMIT 1;
  
  IF org_limit IS NULL THEN
    SELECT max_bank_connections INTO org_limit
    FROM plans
    WHERE slug = 'starter' AND is_active = true
    LIMIT 1;
  END IF;

  IF org_limit IS NULL THEN
    org_limit := 10;
  END IF;
  
  SELECT COUNT(*) INTO current_count
  FROM bank_connections
  WHERE organization_id = NEW.organization_id
    AND status = 'active';
  
  IF current_count >= org_limit THEN
    RAISE EXCEPTION 'Limite de conexões bancárias do plano atingido (% de %). Faça upgrade para continuar.', current_count, org_limit;
  END IF;
  
  RETURN NEW;
END;
$function$;