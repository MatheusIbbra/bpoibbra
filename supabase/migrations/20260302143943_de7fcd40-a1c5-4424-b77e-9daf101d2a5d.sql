
-- Drop audit trigger, delete org, recreate trigger
DROP TRIGGER IF EXISTS audit_organizations ON public.organizations;

DO $$
DECLARE
  user_ids UUID[] := ARRAY[
    '548984b2-8b31-4d36-8446-eec40ce7e1d9'::UUID,
    '673d2bd3-3158-4b7d-ab25-cdaef88d58e4'::UUID
  ];
  org_ids UUID[] := ARRAY['6f2a1420-193a-4ea3-8d1d-9ea85d9500ff'::UUID];
  uid UUID;
BEGIN
  DELETE FROM public.organization_subscriptions WHERE organization_id = ANY(org_ids);
  DELETE FROM public.open_finance_sync_logs WHERE organization_id = ANY(org_ids);
  DELETE FROM public.open_finance_raw_data WHERE organization_id = ANY(org_ids);
  DELETE FROM public.open_finance_accounts WHERE organization_id = ANY(org_ids);
  DELETE FROM public.open_finance_items WHERE organization_id = ANY(org_ids);
  DELETE FROM public.bank_connections WHERE organization_id = ANY(org_ids);
  DELETE FROM public.integration_logs WHERE organization_id = ANY(org_ids);
  DELETE FROM public.cashflow_forecasts WHERE organization_id = ANY(org_ids);
  DELETE FROM public.financial_simulations WHERE organization_id = ANY(org_ids);
  DELETE FROM public.materialized_metrics WHERE organization_id = ANY(org_ids);
  DELETE FROM public.ai_strategic_insights WHERE organization_id = ANY(org_ids);
  DELETE FROM public.api_usage_logs WHERE organization_id = ANY(org_ids);
  DELETE FROM public.import_batches WHERE organization_id = ANY(org_ids);
  DELETE FROM public.ai_suggestions WHERE transaction_id IN (SELECT id FROM public.transactions WHERE organization_id = ANY(org_ids));
  DELETE FROM public.transactions WHERE organization_id = ANY(org_ids);
  DELETE FROM public.account_balance_snapshots WHERE account_id IN (SELECT id FROM public.accounts WHERE organization_id = ANY(org_ids));
  DELETE FROM public.accounts WHERE organization_id = ANY(org_ids);
  DELETE FROM public.budgets WHERE organization_id = ANY(org_ids);
  DELETE FROM public.categories WHERE organization_id = ANY(org_ids);
  DELETE FROM public.cost_centers WHERE organization_id = ANY(org_ids);
  DELETE FROM public.transaction_patterns WHERE organization_id = ANY(org_ids);
  DELETE FROM public.data_export_requests WHERE organization_id = ANY(org_ids);
  DELETE FROM public.organization_members WHERE organization_id = ANY(org_ids);
  UPDATE public.audit_log SET organization_id = NULL WHERE organization_id = ANY(org_ids);
  DELETE FROM public.organizations WHERE id = ANY(org_ids);

  FOREACH uid IN ARRAY user_ids LOOP
    DELETE FROM public.family_members WHERE user_id = uid;
    DELETE FROM public.consent_logs WHERE user_id = uid;
    DELETE FROM public.data_deletion_requests WHERE user_id = uid;
    DELETE FROM public.data_export_requests WHERE user_id = uid;
    DELETE FROM public.file_imports WHERE user_id = uid;
    DELETE FROM public.user_hierarchy WHERE user_id = uid OR supervisor_id = uid;
    DELETE FROM public.user_roles WHERE user_id = uid;
    UPDATE public.audit_log SET user_id = NULL WHERE user_id = uid;
    DELETE FROM public.profiles WHERE user_id = uid;
  END LOOP;

  FOREACH uid IN ARRAY user_ids LOOP
    DELETE FROM auth.users WHERE id = uid;
  END LOOP;
END $$;

-- Recreate the audit trigger on organizations
CREATE TRIGGER audit_organizations
  AFTER INSERT OR UPDATE OR DELETE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
