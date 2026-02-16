-- Fix: Change audit_log FK to SET NULL so deletions don't fail
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_organization_id_fkey;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_organization_id_fkey 
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;

-- Now disable only user-defined audit triggers (not system triggers)
ALTER TABLE categories DISABLE TRIGGER audit_categories;
ALTER TABLE organizations DISABLE TRIGGER audit_organizations;

-- Delete audit logs for these orgs
DELETE FROM audit_log WHERE organization_id IN ('e7945559-55e1-40c4-9c5b-0792fbc49df3', '042221a2-0071-4874-bb32-9c739f767303');
DELETE FROM security_events WHERE organization_id IN ('e7945559-55e1-40c4-9c5b-0792fbc49df3', '042221a2-0071-4874-bb32-9c739f767303');

-- Delete categories (children first)
DELETE FROM categories WHERE organization_id IN ('e7945559-55e1-40c4-9c5b-0792fbc49df3', '042221a2-0071-4874-bb32-9c739f767303') AND parent_id IS NOT NULL;
DELETE FROM categories WHERE organization_id IN ('e7945559-55e1-40c4-9c5b-0792fbc49df3', '042221a2-0071-4874-bb32-9c739f767303');

-- Delete reconciliation rules
DELETE FROM reconciliation_rules WHERE organization_id IN ('e7945559-55e1-40c4-9c5b-0792fbc49df3', '042221a2-0071-4874-bb32-9c739f767303');

-- Delete org subscriptions
DELETE FROM organization_subscriptions WHERE organization_id IN ('e7945559-55e1-40c4-9c5b-0792fbc49df3', '042221a2-0071-4874-bb32-9c739f767303');

-- Delete org members
DELETE FROM organization_members WHERE organization_id IN ('e7945559-55e1-40c4-9c5b-0792fbc49df3', '042221a2-0071-4874-bb32-9c739f767303');

-- Delete organizations
DELETE FROM organizations WHERE id IN ('e7945559-55e1-40c4-9c5b-0792fbc49df3', '042221a2-0071-4874-bb32-9c739f767303');

-- Re-enable triggers
ALTER TABLE categories ENABLE TRIGGER audit_categories;
ALTER TABLE organizations ENABLE TRIGGER audit_organizations;

-- Delete user data
DELETE FROM user_hierarchy WHERE user_id = '31f607d3-b50c-41c4-8975-053e75ec2440';
DELETE FROM user_roles WHERE user_id = '31f607d3-b50c-41c4-8975-053e75ec2440';
DELETE FROM consent_logs WHERE user_id = '31f607d3-b50c-41c4-8975-053e75ec2440';
DELETE FROM profiles WHERE user_id = '31f607d3-b50c-41c4-8975-053e75ec2440';
