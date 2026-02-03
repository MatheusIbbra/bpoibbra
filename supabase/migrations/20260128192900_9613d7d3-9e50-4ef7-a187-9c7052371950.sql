-- Create audit logging trigger function
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_data jsonb := NULL;
  new_data jsonb := NULL;
  org_id uuid := NULL;
  action_type text;
BEGIN
  -- Determine action type
  action_type := TG_OP;
  
  -- Capture old/new values
  IF TG_OP = 'DELETE' THEN
    old_data := to_jsonb(OLD);
    org_id := CASE 
      WHEN TG_TABLE_NAME IN ('transactions', 'accounts', 'categories', 'cost_centers', 'import_batches', 'transfers', 'budgets') THEN OLD.organization_id
      ELSE NULL
    END;
  ELSIF TG_OP = 'UPDATE' THEN
    old_data := to_jsonb(OLD);
    new_data := to_jsonb(NEW);
    org_id := CASE 
      WHEN TG_TABLE_NAME IN ('transactions', 'accounts', 'categories', 'cost_centers', 'import_batches', 'transfers', 'budgets') THEN NEW.organization_id
      ELSE NULL
    END;
  ELSIF TG_OP = 'INSERT' THEN
    new_data := to_jsonb(NEW);
    org_id := CASE 
      WHEN TG_TABLE_NAME IN ('transactions', 'accounts', 'categories', 'cost_centers', 'import_batches', 'transfers', 'budgets') THEN NEW.organization_id
      ELSE NULL
    END;
  END IF;

  -- Insert audit log entry
  INSERT INTO public.audit_log (
    user_id,
    organization_id,
    action,
    table_name,
    record_id,
    old_values,
    new_values
  ) VALUES (
    auth.uid(),
    org_id,
    action_type,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id)::text,
    old_data,
    new_data
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Create triggers for main tables
DROP TRIGGER IF EXISTS audit_transactions ON public.transactions;
CREATE TRIGGER audit_transactions
  AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS audit_accounts ON public.accounts;
CREATE TRIGGER audit_accounts
  AFTER INSERT OR UPDATE OR DELETE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS audit_categories ON public.categories;
CREATE TRIGGER audit_categories
  AFTER INSERT OR UPDATE OR DELETE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS audit_cost_centers ON public.cost_centers;
CREATE TRIGGER audit_cost_centers
  AFTER INSERT OR UPDATE OR DELETE ON public.cost_centers
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS audit_transfers ON public.transfers;
CREATE TRIGGER audit_transfers
  AFTER INSERT OR UPDATE OR DELETE ON public.transfers
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS audit_import_batches ON public.import_batches;
CREATE TRIGGER audit_import_batches
  AFTER INSERT OR UPDATE OR DELETE ON public.import_batches
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS audit_user_roles ON public.user_roles;
CREATE TRIGGER audit_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS audit_organizations ON public.organizations;
CREATE TRIGGER audit_organizations
  AFTER INSERT OR UPDATE OR DELETE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Update RLS policy to allow users to view their own audit entries
DROP POLICY IF EXISTS "Users can view own audit entries" ON public.audit_log;
CREATE POLICY "Users can view own audit entries" 
  ON public.audit_log 
  FOR SELECT 
  USING (user_id = auth.uid());

-- Allow authenticated users to insert (for manual logs from frontend)
DROP POLICY IF EXISTS "Authenticated users can create audit entries" ON public.audit_log;
CREATE POLICY "Authenticated users can create audit entries"
  ON public.audit_log
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');