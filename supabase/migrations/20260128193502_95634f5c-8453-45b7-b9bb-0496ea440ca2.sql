-- Fix the audit log trigger to properly handle UUID record_id
CREATE OR REPLACE FUNCTION public.log_audit_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  old_data jsonb := NULL;
  new_data jsonb := NULL;
  org_id uuid := NULL;
  rec_id uuid := NULL;
  action_type text;
BEGIN
  -- Determine action type
  action_type := TG_OP;
  
  -- Capture old/new values and record_id
  IF TG_OP = 'DELETE' THEN
    old_data := to_jsonb(OLD);
    rec_id := OLD.id;
    org_id := CASE 
      WHEN TG_TABLE_NAME IN ('transactions', 'accounts', 'categories', 'cost_centers', 'import_batches', 'transfers', 'budgets') THEN OLD.organization_id
      ELSE NULL
    END;
  ELSIF TG_OP = 'UPDATE' THEN
    old_data := to_jsonb(OLD);
    new_data := to_jsonb(NEW);
    rec_id := NEW.id;
    org_id := CASE 
      WHEN TG_TABLE_NAME IN ('transactions', 'accounts', 'categories', 'cost_centers', 'import_batches', 'transfers', 'budgets') THEN NEW.organization_id
      ELSE NULL
    END;
  ELSIF TG_OP = 'INSERT' THEN
    new_data := to_jsonb(NEW);
    rec_id := NEW.id;
    org_id := CASE 
      WHEN TG_TABLE_NAME IN ('transactions', 'accounts', 'categories', 'cost_centers', 'import_batches', 'transfers', 'budgets') THEN NEW.organization_id
      ELSE NULL
    END;
  END IF;

  -- Insert audit log entry (record_id is now properly typed as UUID)
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
    rec_id,
    old_data,
    new_data
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$function$;