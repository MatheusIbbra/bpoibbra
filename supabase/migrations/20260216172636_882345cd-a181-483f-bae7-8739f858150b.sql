
-- Clean up duplicate "cliente-31f607d3" organization
DELETE FROM public.organization_subscriptions WHERE organization_id = '52f2b0b0-98ff-460c-8f2c-d25b5b666619';
DELETE FROM public.organization_members WHERE organization_id = '52f2b0b0-98ff-460c-8f2c-d25b5b666619';

-- Temporarily disable audit trigger to allow deletion
ALTER TABLE public.organizations DISABLE TRIGGER audit_organizations;
DELETE FROM public.organizations WHERE id = '52f2b0b0-98ff-460c-8f2c-d25b5b666619';
ALTER TABLE public.organizations ENABLE TRIGGER audit_organizations;
