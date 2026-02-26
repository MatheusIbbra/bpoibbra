
DO $$
DECLARE
  v_org1 uuid := '9e4547e4-5be9-4a4e-bc97-8b50d2ae6e27';
  v_org2 uuid := '415f9d5c-385e-4a00-888e-81f067221c8a';
  v_user2 uuid := 'e9c05614-fb33-4ee8-815b-1039f33fa863';
BEGIN
  -- Disable audit triggers temporarily
  SET session_replication_role = replica;

  DELETE FROM open_finance_sync_logs WHERE organization_id IN (v_org1, v_org2);
  DELETE FROM open_finance_raw_data WHERE organization_id IN (v_org1, v_org2);
  DELETE FROM open_finance_accounts WHERE organization_id IN (v_org1, v_org2);
  DELETE FROM open_finance_items WHERE organization_id IN (v_org1, v_org2);
  DELETE FROM integration_logs WHERE organization_id IN (v_org1, v_org2);
  DELETE FROM bank_connections WHERE organization_id IN (v_org1, v_org2);
  DELETE FROM cashflow_forecasts WHERE organization_id IN (v_org1, v_org2);
  DELETE FROM financial_simulations WHERE organization_id IN (v_org1, v_org2);
  DELETE FROM materialized_metrics WHERE organization_id IN (v_org1, v_org2);
  DELETE FROM ai_strategic_insights WHERE organization_id IN (v_org1, v_org2);
  DELETE FROM api_usage_logs WHERE organization_id IN (v_org1, v_org2);
  DELETE FROM data_export_requests WHERE organization_id IN (v_org1, v_org2);
  DELETE FROM import_batches WHERE organization_id IN (v_org1, v_org2);
  DELETE FROM budgets WHERE organization_id IN (v_org1, v_org2);
  DELETE FROM cost_centers WHERE organization_id IN (v_org1, v_org2);
  DELETE FROM categories WHERE organization_id IN (v_org1, v_org2);
  DELETE FROM transactions WHERE organization_id IN (v_org1, v_org2);
  DELETE FROM accounts WHERE organization_id IN (v_org1, v_org2);
  DELETE FROM organization_subscriptions WHERE organization_id IN (v_org1, v_org2);
  DELETE FROM organization_members WHERE organization_id IN (v_org1, v_org2);
  DELETE FROM organizations WHERE id IN (v_org1, v_org2);
  DELETE FROM consent_logs WHERE user_id = v_user2;
  DELETE FROM data_deletion_requests WHERE user_id = v_user2;
  DELETE FROM family_members WHERE user_id = v_user2;
  DELETE FROM profiles WHERE user_id = v_user2;
  DELETE FROM auth.users WHERE id = v_user2;

  -- Re-enable triggers
  SET session_replication_role = DEFAULT;
END $$;
