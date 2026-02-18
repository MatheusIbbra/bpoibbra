
-- Backend enforcement: block transaction INSERT when plan limit exceeded
CREATE OR REPLACE FUNCTION public.check_transaction_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_limit INT;
  current_count INT;
BEGIN
  -- Skip check for service_role (imports, syncs, etc.)
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Get plan limit for the organization
  SELECT p.max_transactions INTO org_limit
  FROM organization_subscriptions os
  JOIN plans p ON p.id = os.plan_id
  WHERE os.organization_id = NEW.organization_id
    AND os.status = 'active'
  LIMIT 1;
  
  -- Default to free tier if no subscription found
  IF org_limit IS NULL THEN
    org_limit := 500;
  END IF;
  
  -- Count transactions this month for the organization
  SELECT COUNT(*) INTO current_count
  FROM transactions
  WHERE organization_id = NEW.organization_id
    AND created_at >= date_trunc('month', now());
  
  IF current_count >= org_limit THEN
    RAISE EXCEPTION 'Limite de transações do plano atingido (% de %). Faça upgrade para continuar.', current_count, org_limit;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_transaction_limit
  BEFORE INSERT ON transactions
  FOR EACH ROW EXECUTE FUNCTION public.check_transaction_limit();

-- Backend enforcement: block bank_connections INSERT when plan limit exceeded
CREATE OR REPLACE FUNCTION public.check_bank_connection_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    org_limit := 2;
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
$$;

CREATE TRIGGER enforce_bank_connection_limit
  BEFORE INSERT ON bank_connections
  FOR EACH ROW EXECUTE FUNCTION public.check_bank_connection_limit();
