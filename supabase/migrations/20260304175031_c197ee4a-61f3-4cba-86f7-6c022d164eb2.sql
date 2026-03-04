
-- Fix existing clients who have trialing/active in profiles but no org subscription
-- Upsert organization_subscriptions based on profiles data
INSERT INTO public.organization_subscriptions (organization_id, plan_id, status, started_at, expires_at)
SELECT 
  om.organization_id,
  pl.id as plan_id,
  p.subscription_status as status,
  NOW() as started_at,
  p.current_period_end as expires_at
FROM profiles p
JOIN organization_members om ON om.user_id = p.user_id
JOIN plans pl ON LOWER(pl.slug) = LOWER(p.plan)
WHERE p.subscription_status IN ('active', 'trialing', 'past_due')
  AND p.subscription_id IS NOT NULL
ON CONFLICT (organization_id) DO UPDATE SET
  plan_id = EXCLUDED.plan_id,
  status = EXCLUDED.status,
  expires_at = EXCLUDED.expires_at;
