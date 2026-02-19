
-- Clean all child references for org a6dcbb88
DELETE FROM audit_log WHERE organization_id = 'a6dcbb88-492e-4ac5-b65f-decb2f8cda6e';
DELETE FROM reconciliation_rules WHERE organization_id = 'a6dcbb88-492e-4ac5-b65f-decb2f8cda6e';
DELETE FROM categories WHERE organization_id = 'a6dcbb88-492e-4ac5-b65f-decb2f8cda6e';
DELETE FROM organization_members WHERE organization_id = 'a6dcbb88-492e-4ac5-b65f-decb2f8cda6e';

-- Disable audit trigger to prevent FK issue during org delete
ALTER TABLE organizations DISABLE TRIGGER USER;
DELETE FROM organizations WHERE id = 'a6dcbb88-492e-4ac5-b65f-decb2f8cda6e';
ALTER TABLE organizations ENABLE TRIGGER USER;

-- Delete user data
DELETE FROM user_roles WHERE user_id = 'd3686308-4445-40cb-8513-5cb4287e04ff';
DELETE FROM profiles WHERE user_id = 'd3686308-4445-40cb-8513-5cb4287e04ff';

-- Auto-assign Starter plan trigger
CREATE OR REPLACE FUNCTION public.auto_assign_starter_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  starter_plan_id UUID;
BEGIN
  SELECT id INTO starter_plan_id FROM plans WHERE slug = 'starter' AND is_active = true LIMIT 1;
  IF starter_plan_id IS NOT NULL THEN
    INSERT INTO organization_subscriptions (organization_id, plan_id, status, started_at)
    VALUES (NEW.id, starter_plan_id, 'active', now())
    ON CONFLICT (organization_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_assign_starter_plan ON organizations;
CREATE TRIGGER trg_auto_assign_starter_plan
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_starter_plan();

-- Backfill existing orgs without subscription
INSERT INTO organization_subscriptions (organization_id, plan_id, status, started_at)
SELECT o.id, p.id, 'active', now()
FROM organizations o
CROSS JOIN plans p
WHERE p.slug = 'starter' AND p.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM organization_subscriptions os WHERE os.organization_id = o.id
  );
