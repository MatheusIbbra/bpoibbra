
-- Auto-assign the Starter plan to newly created organizations via a trigger

CREATE OR REPLACE FUNCTION public.auto_assign_starter_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_starter_plan_id uuid;
BEGIN
  SELECT id INTO v_starter_plan_id
  FROM public.plans
  WHERE slug ILIKE 'Starter' OR name ILIKE 'Starter'
  LIMIT 1;

  IF v_starter_plan_id IS NOT NULL THEN
    INSERT INTO public.organization_subscriptions (organization_id, plan_id, status)
    VALUES (NEW.id, v_starter_plan_id, 'active')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_assign_starter_plan ON public.organizations;

CREATE TRIGGER trg_auto_assign_starter_plan
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_starter_plan();

-- Fix existing user Rogério Damásio Batista who has no subscription
DO $$
DECLARE
  v_starter_plan_id uuid;
BEGIN
  SELECT id INTO v_starter_plan_id
  FROM public.plans
  WHERE slug ILIKE 'Starter' OR name ILIKE 'Starter'
  LIMIT 1;

  IF v_starter_plan_id IS NOT NULL THEN
    INSERT INTO public.organization_subscriptions (organization_id, plan_id, status)
    VALUES ('c90ac780-e190-4a09-93d7-5423e3cb5007', v_starter_plan_id, 'active')
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;
