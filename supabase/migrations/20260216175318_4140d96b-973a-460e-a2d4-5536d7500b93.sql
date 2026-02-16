
-- Disable audit triggers that reference org
ALTER TABLE public.categories DISABLE TRIGGER audit_categories;
ALTER TABLE public.organizations DISABLE TRIGGER audit_organizations;

DELETE FROM categories WHERE organization_id = 'ee7c523f-06f6-4f09-b484-c50c9cdddcf6';
DELETE FROM cost_centers WHERE organization_id = 'ee7c523f-06f6-4f09-b484-c50c9cdddcf6';
DELETE FROM organization_members WHERE organization_id = 'ee7c523f-06f6-4f09-b484-c50c9cdddcf6';
DELETE FROM organization_subscriptions WHERE organization_id = 'ee7c523f-06f6-4f09-b484-c50c9cdddcf6';
DELETE FROM organizations WHERE id = 'ee7c523f-06f6-4f09-b484-c50c9cdddcf6';

-- Re-enable audit triggers
ALTER TABLE public.categories ENABLE TRIGGER audit_categories;
ALTER TABLE public.organizations ENABLE TRIGGER audit_organizations;
