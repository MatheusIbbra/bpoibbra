
DO $$
DECLARE
  org_ids uuid[] := ARRAY['22eb01e7-2bab-4f84-adcd-c1bb1396c455', '37dc4bc3-165a-4884-a2ef-cb6c2ce07355'];
  user_ids uuid[] := ARRAY['3d4c26fc-58c9-4a95-82ac-de123317fbb6', '55637ae7-b29b-4ef7-942a-03db0583bdf6'];
BEGIN
  -- Disable user-defined audit trigger on organizations
  ALTER TABLE organizations DISABLE TRIGGER audit_organizations;
  
  DELETE FROM ai_suggestions WHERE transaction_id IN (SELECT id FROM transactions WHERE organization_id = ANY(org_ids));
  DELETE FROM account_balance_snapshots WHERE account_id IN (SELECT id FROM accounts WHERE organization_id = ANY(org_ids));
  DELETE FROM transactions WHERE organization_id = ANY(org_ids);
  DELETE FROM budgets WHERE organization_id = ANY(org_ids);
  DELETE FROM file_imports WHERE account_id IN (SELECT id FROM accounts WHERE organization_id = ANY(org_ids));
  DELETE FROM import_batches WHERE organization_id = ANY(org_ids);
  DELETE FROM cost_centers WHERE organization_id = ANY(org_ids);
  DELETE FROM categories WHERE parent_id IS NOT NULL AND organization_id = ANY(org_ids);
  DELETE FROM categories WHERE organization_id = ANY(org_ids);
  DELETE FROM accounts WHERE organization_id = ANY(org_ids);
  DELETE FROM open_finance_raw_data WHERE organization_id = ANY(org_ids);
  DELETE FROM open_finance_sync_logs WHERE organization_id = ANY(org_ids);
  DELETE FROM open_finance_accounts WHERE organization_id = ANY(org_ids);
  DELETE FROM open_finance_items WHERE organization_id = ANY(org_ids);
  DELETE FROM integration_logs WHERE organization_id = ANY(org_ids);
  DELETE FROM bank_connections WHERE organization_id = ANY(org_ids);
  DELETE FROM ai_strategic_insights WHERE organization_id = ANY(org_ids);
  DELETE FROM financial_simulations WHERE organization_id = ANY(org_ids);
  DELETE FROM cashflow_forecasts WHERE organization_id = ANY(org_ids);
  DELETE FROM materialized_metrics WHERE organization_id = ANY(org_ids);
  DELETE FROM api_usage_logs WHERE organization_id = ANY(org_ids);
  DELETE FROM audit_log WHERE organization_id = ANY(org_ids);
  DELETE FROM data_export_requests WHERE organization_id = ANY(org_ids);
  DELETE FROM data_deletion_requests WHERE user_id = ANY(user_ids);
  DELETE FROM consent_logs WHERE user_id = ANY(user_ids);
  DELETE FROM family_members WHERE organization_id = ANY(org_ids);
  DELETE FROM organization_subscriptions WHERE organization_id = ANY(org_ids);
  DELETE FROM organization_members WHERE organization_id = ANY(org_ids);
  DELETE FROM push_subscriptions WHERE user_id = ANY(user_ids);
  DELETE FROM profiles WHERE user_id = ANY(user_ids);
  DELETE FROM user_roles WHERE user_id = ANY(user_ids);
  DELETE FROM organizations WHERE id = ANY(org_ids);
  DELETE FROM auth.users WHERE id = ANY(user_ids);
  
  -- Re-enable audit trigger
  ALTER TABLE organizations ENABLE TRIGGER audit_organizations;
END $$;
