
-- Disable only the audit trigger on organizations
ALTER TABLE public.organizations DISABLE TRIGGER audit_organizations;

DO $$
DECLARE
  dup_org_id UUID;
  keep_org_id UUID;
BEGIN
  SELECT id INTO dup_org_id FROM public.organizations WHERE slug = 'base-31f607d3';
  SELECT id INTO keep_org_id FROM public.organizations WHERE slug = 'cliente-31f607d3';
  
  IF dup_org_id IS NOT NULL AND keep_org_id IS NOT NULL THEN
    UPDATE public.accounts SET organization_id = keep_org_id WHERE organization_id = dup_org_id;
    UPDATE public.categories SET organization_id = keep_org_id WHERE organization_id = dup_org_id;
    UPDATE public.cost_centers SET organization_id = keep_org_id WHERE organization_id = dup_org_id;
    UPDATE public.family_members SET organization_id = keep_org_id WHERE organization_id = dup_org_id;
    UPDATE public.budgets SET organization_id = keep_org_id WHERE organization_id = dup_org_id;
    UPDATE public.audit_log SET organization_id = keep_org_id WHERE organization_id = dup_org_id;
    UPDATE public.api_usage_logs SET organization_id = NULL WHERE organization_id = dup_org_id;
    UPDATE public.integration_logs SET organization_id = NULL WHERE organization_id = dup_org_id;
    
    DELETE FROM public.reconciliation_rules WHERE organization_id = dup_org_id;
    DELETE FROM public.cashflow_forecasts WHERE organization_id = dup_org_id;
    DELETE FROM public.financial_simulations WHERE organization_id = dup_org_id;
    DELETE FROM public.ai_strategic_insights WHERE organization_id = dup_org_id;
    DELETE FROM public.materialized_metrics WHERE organization_id = dup_org_id;
    DELETE FROM public.data_export_requests WHERE organization_id = dup_org_id;
    DELETE FROM public.organization_subscriptions WHERE organization_id = dup_org_id;
    DELETE FROM public.organization_members WHERE organization_id = dup_org_id;
    DELETE FROM public.organizations WHERE id = dup_org_id;
  END IF;
END;
$$;

-- Re-enable trigger
ALTER TABLE public.organizations ENABLE TRIGGER audit_organizations;
