
-- Cleanup 3 test clients: cliente-3903cef0, cliente-8907cf00, cliente-5281c872
DO $$
DECLARE
  clients RECORD;
  v_account_ids UUID[];
  v_of_item_ids UUID[];
BEGIN
  FOR clients IN
    SELECT
      unnest(ARRAY[
        '3903cef0-b297-4fc2-b0d3-2378fb2ac128',
        '8907cf00-59bf-4080-8f40-7b2a0f723ded',
        '5281c872-2510-4329-9ad2-10f3ca232f7f'
      ]::UUID[]) AS user_id,
      unnest(ARRAY[
        'c284142f-5bbb-4eb9-bece-96278614d605',
        'ef201128-45d8-45b2-a78a-46d1e3c0caf7',
        '45ab9096-3404-4ddc-9c9b-5d776ee3e2b6'
      ]::UUID[]) AS org_id
  LOOP
    -- Transactions
    DELETE FROM public.transactions WHERE organization_id = clients.org_id;
    -- Budgets
    DELETE FROM public.budgets WHERE organization_id = clients.org_id;
    -- Cashflow forecasts
    DELETE FROM public.cashflow_forecasts WHERE organization_id = clients.org_id;
    -- Financial simulations
    DELETE FROM public.financial_simulations WHERE organization_id = clients.org_id;
    -- AI insights
    DELETE FROM public.ai_strategic_insights WHERE organization_id = clients.org_id;
    -- Reconciliation rules
    DELETE FROM public.reconciliation_rules WHERE organization_id = clients.org_id;
    -- Categories (children first)
    DELETE FROM public.categories WHERE organization_id = clients.org_id AND parent_id IS NOT NULL;
    DELETE FROM public.categories WHERE organization_id = clients.org_id;
    -- Cost centers
    DELETE FROM public.cost_centers WHERE organization_id = clients.org_id;
    -- Import batches
    DELETE FROM public.import_batches WHERE organization_id = clients.org_id;
    -- Account balance snapshots
    SELECT ARRAY(SELECT id FROM public.accounts WHERE organization_id = clients.org_id)
      INTO v_account_ids;
    IF array_length(v_account_ids, 1) > 0 THEN
      DELETE FROM public.account_balance_snapshots WHERE account_id = ANY(v_account_ids);
    END IF;
    -- Accounts
    DELETE FROM public.accounts WHERE organization_id = clients.org_id;
    -- Open finance
    SELECT ARRAY(SELECT id FROM public.open_finance_items WHERE organization_id = clients.org_id)
      INTO v_of_item_ids;
    IF array_length(v_of_item_ids, 1) > 0 THEN
      DELETE FROM public.open_finance_accounts WHERE item_id = ANY(v_of_item_ids);
      DELETE FROM public.open_finance_raw_data WHERE item_id = ANY(v_of_item_ids);
      DELETE FROM public.open_finance_sync_logs WHERE item_id = ANY(v_of_item_ids);
    END IF;
    DELETE FROM public.open_finance_items WHERE organization_id = clients.org_id;
    DELETE FROM public.bank_connections WHERE organization_id = clients.org_id;
    DELETE FROM public.materialized_metrics WHERE organization_id = clients.org_id;
    DELETE FROM public.api_usage_logs WHERE organization_id = clients.org_id;
    DELETE FROM public.integration_logs WHERE organization_id = clients.org_id;
    DELETE FROM public.organization_subscriptions WHERE organization_id = clients.org_id;
    DELETE FROM public.organization_members WHERE organization_id = clients.org_id;
    -- Disable audit trigger temporarily
    ALTER TABLE public.organizations DISABLE TRIGGER audit_organizations;
    DELETE FROM public.organizations WHERE id = clients.org_id;
    ALTER TABLE public.organizations ENABLE TRIGGER audit_organizations;
    -- User data
    DELETE FROM public.user_hierarchy WHERE user_id = clients.user_id;
    DELETE FROM public.user_roles WHERE user_id = clients.user_id;
    DELETE FROM public.family_members WHERE user_id = clients.user_id;
    DELETE FROM public.consent_logs WHERE user_id = clients.user_id;
    DELETE FROM public.data_export_requests WHERE user_id = clients.user_id;
    DELETE FROM public.profiles WHERE user_id = clients.user_id;
    -- Delete auth user
    DELETE FROM auth.users WHERE id = clients.user_id;

    RAISE NOTICE 'Cleaned: org=% user=%', clients.org_id, clients.user_id;
  END LOOP;
END $$;
