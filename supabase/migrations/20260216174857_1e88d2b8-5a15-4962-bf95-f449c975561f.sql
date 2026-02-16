
CREATE OR REPLACE FUNCTION public.ensure_user_provisioned()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
  user_email TEXT;
  user_full_name TEXT;
  new_org_id UUID;
  org_slug TEXT;
  free_plan_id UUID;
  existing_profile_id UUID;
  existing_org_id UUID;
  user_role_value app_role;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email, COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', split_part(email, '@', 1))
  INTO user_email, user_full_name
  FROM auth.users
  WHERE id = current_user_id;

  -- Ensure profile exists
  SELECT id INTO existing_profile_id FROM public.profiles WHERE user_id = current_user_id;
  IF existing_profile_id IS NULL THEN
    INSERT INTO public.profiles (user_id, full_name, registration_completed) VALUES (current_user_id, user_full_name, false);
  END IF;

  -- Ensure role exists (default to cliente if none)
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = current_user_id) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (current_user_id, 'cliente');
  END IF;

  -- Get the user's role
  SELECT role INTO user_role_value FROM public.user_roles WHERE user_id = current_user_id LIMIT 1;

  -- Staff roles (admin, supervisor, kam, fa, projetista) should NOT auto-create an organization
  IF user_role_value IN ('admin', 'supervisor', 'kam', 'fa', 'projetista') THEN
    RETURN;
  END IF;

  -- Only 'cliente' and 'user' roles auto-create an organization
  org_slug := 'cliente-' || substring(current_user_id::text from 1 for 8);
  
  SELECT id INTO existing_org_id FROM public.organizations WHERE slug = org_slug;
  
  -- Fallback: check for legacy base- slug
  IF existing_org_id IS NULL THEN
    SELECT id INTO existing_org_id FROM public.organizations 
    WHERE slug = 'base-' || substring(current_user_id::text from 1 for 8);
  END IF;

  IF existing_org_id IS NULL THEN
    INSERT INTO public.organizations (name, slug) VALUES (user_full_name, org_slug)
    RETURNING id INTO new_org_id;
  ELSE
    new_org_id := existing_org_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE organization_id = new_org_id AND user_id = current_user_id
  ) THEN
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (new_org_id, current_user_id, 'cliente');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.organization_subscriptions WHERE organization_id = new_org_id) THEN
    SELECT id INTO free_plan_id FROM public.plans WHERE slug = 'free' AND is_active = true LIMIT 1;
    IF free_plan_id IS NOT NULL THEN
      INSERT INTO public.organization_subscriptions (organization_id, plan_id, status)
      VALUES (new_org_id, free_plan_id, 'active');
    END IF;
  END IF;

  BEGIN
    PERFORM public.provision_organization_from_template(new_org_id, current_user_id);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END;
$$;
