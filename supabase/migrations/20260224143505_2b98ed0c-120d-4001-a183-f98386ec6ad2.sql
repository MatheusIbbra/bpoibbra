
DO $$
DECLARE
  v_user_id uuid := '5223d070-830c-4ca6-b25e-73b453ab7967';
  v_org_id uuid := 'f0d43dfb-cef7-4dc1-84e4-a01893c14585';
  v_account_ids uuid[];
  v_item_ids uuid[];
BEGIN
  -- Collect account IDs
  SELECT array_agg(id) INTO v_account_ids FROM public.accounts WHERE organization_id = v_org_id;
  -- Collect open finance item IDs
  SELECT array_agg(id) INTO v_item_ids FROM public.open_finance_items WHERE organization_id = v_org_id;

  -- Open Finance cascade
  IF v_item_ids IS NOT NULL THEN
    DELETE FROM public.open_finance_accounts WHERE item_id = ANY(v_item_ids);
    DELETE FROM public.open_finance_raw_data WHERE item_id = ANY(v_item_ids);
    DELETE FROM public.open_finance_sync_logs WHERE item_id = ANY(v_item_ids);
  END IF;
  DELETE FROM public.open_finance_items WHERE organization_id = v_org_id;

  -- Account snapshots
  IF v_account_ids IS NOT NULL THEN
    DELETE FROM public.account_balance_snapshots WHERE account_id = ANY(v_account_ids);
  END IF;

  -- Org-scoped tables
  DELETE FROM public.transactions WHERE organization_id = v_org_id;
  DELETE FROM public.budgets WHERE organization_id = v_org_id;
  DELETE FROM public.cashflow_forecasts WHERE organization_id = v_org_id;
  DELETE FROM public.financial_simulations WHERE organization_id = v_org_id;
  DELETE FROM public.ai_strategic_insights WHERE organization_id = v_org_id;
  DELETE FROM public.reconciliation_rules WHERE organization_id = v_org_id;
  DELETE FROM public.categories WHERE organization_id = v_org_id AND parent_id IS NOT NULL;
  DELETE FROM public.categories WHERE organization_id = v_org_id;
  DELETE FROM public.cost_centers WHERE organization_id = v_org_id;
  DELETE FROM public.import_batches WHERE organization_id = v_org_id;
  DELETE FROM public.accounts WHERE organization_id = v_org_id;
  DELETE FROM public.bank_connections WHERE organization_id = v_org_id;
  DELETE FROM public.materialized_metrics WHERE organization_id = v_org_id;
  DELETE FROM public.api_usage_logs WHERE organization_id = v_org_id;
  DELETE FROM public.integration_logs WHERE organization_id = v_org_id;
  DELETE FROM public.organization_subscriptions WHERE organization_id = v_org_id;
  DELETE FROM public.organization_members WHERE organization_id = v_org_id;

  -- Disable audit trigger to allow org deletion
  ALTER TABLE public.organizations DISABLE TRIGGER audit_organizations;
  DELETE FROM public.organizations WHERE id = v_org_id;
  ALTER TABLE public.organizations ENABLE TRIGGER audit_organizations;

  -- User-scoped tables
  DELETE FROM public.user_hierarchy WHERE user_id = v_user_id;
  DELETE FROM public.user_roles WHERE user_id = v_user_id;
  DELETE FROM public.family_members WHERE user_id = v_user_id;
  DELETE FROM public.consent_logs WHERE user_id = v_user_id;
  DELETE FROM public.data_export_requests WHERE user_id = v_user_id;
  DELETE FROM public.data_deletion_requests WHERE user_id = v_user_id;
  DELETE FROM public.profiles WHERE user_id = v_user_id;

  -- Delete auth user
  DELETE FROM auth.users WHERE id = v_user_id;

  RAISE NOTICE 'Deleted user % and org %', v_user_id, v_org_id;
END $$;
