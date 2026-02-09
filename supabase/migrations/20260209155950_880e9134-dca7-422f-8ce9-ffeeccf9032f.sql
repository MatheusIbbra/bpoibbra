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
  tables_with_org text[] := ARRAY['transactions', 'accounts', 'categories', 'cost_centers', 'import_batches', 'transfers', 'budgets', 'organizations'];
BEGIN
  action_type := TG_OP;
  
  IF TG_OP = 'DELETE' THEN
    old_data := to_jsonb(OLD);
    rec_id := OLD.id;
    IF TG_TABLE_NAME = ANY(tables_with_org) THEN
      IF TG_TABLE_NAME = 'organizations' THEN
        org_id := OLD.id;
      ELSE
        org_id := (to_jsonb(OLD)->>'organization_id')::uuid;
      END IF;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    old_data := to_jsonb(OLD);
    new_data := to_jsonb(NEW);
    rec_id := NEW.id;
    IF TG_TABLE_NAME = ANY(tables_with_org) THEN
      IF TG_TABLE_NAME = 'organizations' THEN
        org_id := NEW.id;
      ELSE
        org_id := (to_jsonb(NEW)->>'organization_id')::uuid;
      END IF;
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    new_data := to_jsonb(NEW);
    rec_id := NEW.id;
    IF TG_TABLE_NAME = ANY(tables_with_org) THEN
      IF TG_TABLE_NAME = 'organizations' THEN
        org_id := NEW.id;
      ELSE
        org_id := (to_jsonb(NEW)->>'organization_id')::uuid;
      END IF;
    END IF;
  END IF;

  INSERT INTO public.audit_log (
    user_id, organization_id, action, table_name, record_id, old_values, new_values
  ) VALUES (
    auth.uid(), org_id, action_type, TG_TABLE_NAME, rec_id, old_data, new_data
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$function$;