
-- Clean up base-31f607d3 dependencies
DELETE FROM public.reconciliation_rules WHERE organization_id = '0db4760f-1b8e-4b41-aef6-71749c3ae714';
DELETE FROM public.categories WHERE organization_id = '0db4760f-1b8e-4b41-aef6-71749c3ae714';
DELETE FROM public.organization_members WHERE organization_id = '0db4760f-1b8e-4b41-aef6-71749c3ae714';
DELETE FROM public.organization_subscriptions WHERE organization_id = '0db4760f-1b8e-4b41-aef6-71749c3ae714';

ALTER TABLE public.organizations DISABLE TRIGGER audit_organizations;
DELETE FROM public.organizations WHERE id = '0db4760f-1b8e-4b41-aef6-71749c3ae714';
ALTER TABLE public.organizations ENABLE TRIGGER audit_organizations;
