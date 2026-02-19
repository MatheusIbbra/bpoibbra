
-- Temporarily disable audit triggers
ALTER TABLE categories DISABLE TRIGGER audit_categories;
ALTER TABLE organizations DISABLE TRIGGER audit_organizations;

-- Delete categories
DELETE FROM categories WHERE organization_id = 'afef2a09-de80-4e08-b723-3205ab2b28af';

-- Delete organization member
DELETE FROM organization_members WHERE organization_id = 'afef2a09-de80-4e08-b723-3205ab2b28af';

-- Delete organization subscription if exists  
DELETE FROM organization_subscriptions WHERE organization_id = 'afef2a09-de80-4e08-b723-3205ab2b28af';

-- Delete consent logs for user
DELETE FROM consent_logs WHERE user_id = '45121df1-e4c0-4c7a-82ac-1d29cee1c108';

-- Clean audit log references
UPDATE audit_log SET user_id = NULL WHERE user_id = '45121df1-e4c0-4c7a-82ac-1d29cee1c108';
UPDATE audit_log SET organization_id = NULL WHERE organization_id = 'afef2a09-de80-4e08-b723-3205ab2b28af';

-- Delete organization
DELETE FROM organizations WHERE id = 'afef2a09-de80-4e08-b723-3205ab2b28af';

-- Delete user from auth
DELETE FROM auth.users WHERE id = '45121df1-e4c0-4c7a-82ac-1d29cee1c108';

-- Re-enable audit triggers
ALTER TABLE categories ENABLE TRIGGER audit_categories;
ALTER TABLE organizations ENABLE TRIGGER audit_organizations;
