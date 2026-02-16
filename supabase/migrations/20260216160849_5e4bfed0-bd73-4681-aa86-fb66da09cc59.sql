
-- Disable audit trigger on organizations
ALTER TABLE public.organizations DISABLE TRIGGER audit_organizations;

-- Clean up incorrectly created base org for admin
DELETE FROM public.organization_subscriptions 
WHERE organization_id = '4a60669e-72d8-47b6-99d2-f841164b3822';

DELETE FROM public.organization_members 
WHERE organization_id = '4a60669e-72d8-47b6-99d2-f841164b3822';

DELETE FROM public.categories
WHERE organization_id = '4a60669e-72d8-47b6-99d2-f841164b3822';

DELETE FROM public.organizations 
WHERE id = '4a60669e-72d8-47b6-99d2-f841164b3822';

-- Re-enable audit trigger
ALTER TABLE public.organizations ENABLE TRIGGER audit_organizations;
