-- Move org creation to the trigger (runs as supabase_auth_admin, bypasses RLS)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INTEGER;
  user_full_name TEXT;
  new_org_id UUID;
  org_slug TEXT;
  free_plan_id UUID;
BEGIN
  user_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  
  -- Create profile for the new user (registration_completed = false by default)
  INSERT INTO public.profiles (user_id, full_name, registration_completed)
  VALUES (NEW.id, user_full_name, false);

  -- Count existing user roles
  SELECT COUNT(*) INTO user_count FROM public.user_roles;

  -- If this is the first user, make them admin
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'cliente');
  END IF;

  -- Create personal organization (base)
  org_slug := 'base-' || substring(NEW.id::text from 1 for 8);
  
  INSERT INTO public.organizations (name, slug)
  VALUES (user_full_name, org_slug)
  RETURNING id INTO new_org_id;

  -- Link user as member
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (new_org_id, NEW.id, 'cliente');

  -- Assign free plan if available
  SELECT id INTO free_plan_id FROM public.plans WHERE slug = 'free' AND is_active = true LIMIT 1;
  IF free_plan_id IS NOT NULL THEN
    INSERT INTO public.organization_subscriptions (organization_id, plan_id, status)
    VALUES (new_org_id, free_plan_id, 'active');
  END IF;

  -- Provision categories from templates
  BEGIN
    PERFORM public.provision_organization_from_template(new_org_id, NEW.id);
  EXCEPTION WHEN OTHERS THEN
    -- Non-blocking: categories can be seeded later
    NULL;
  END;

  RETURN NEW;
END;
$$;
