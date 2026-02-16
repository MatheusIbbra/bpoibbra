
-- Update handle_new_user to use 'cliente-' prefix
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
  
  INSERT INTO public.profiles (user_id, full_name, registration_completed)
  VALUES (NEW.id, user_full_name, false);

  SELECT COUNT(*) INTO user_count FROM public.user_roles;

  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'cliente');
  END IF;

  org_slug := 'cliente-' || substring(NEW.id::text from 1 for 8);
  
  INSERT INTO public.organizations (name, slug)
  VALUES (user_full_name, org_slug)
  RETURNING id INTO new_org_id;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (new_org_id, NEW.id, 'cliente');

  SELECT id INTO free_plan_id FROM public.plans WHERE slug = 'free' AND is_active = true LIMIT 1;
  IF free_plan_id IS NOT NULL THEN
    INSERT INTO public.organization_subscriptions (organization_id, plan_id, status)
    VALUES (new_org_id, free_plan_id, 'active');
  END IF;

  BEGIN
    PERFORM public.provision_organization_from_template(new_org_id, NEW.id);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$;

-- Update ensure_user_provisioned to use 'cliente-' prefix
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
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email, COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', split_part(email, '@', 1))
  INTO user_email, user_full_name
  FROM auth.users
  WHERE id = current_user_id;

  SELECT id INTO existing_profile_id FROM public.profiles WHERE user_id = current_user_id;
  IF existing_profile_id IS NULL THEN
    INSERT INTO public.profiles (user_id, full_name, registration_completed) VALUES (current_user_id, user_full_name, false);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = current_user_id) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (current_user_id, 'cliente');
  END IF;

  -- Try cliente- prefix first, then fallback to legacy base- prefix
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

-- Update complete_onboarding to use 'cliente-' prefix (with base- fallback)
CREATE OR REPLACE FUNCTION public.complete_onboarding(
  p_full_name TEXT,
  p_cpf TEXT DEFAULT NULL,
  p_birth_date TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_is_ibbra_client BOOLEAN DEFAULT false,
  p_external_client_validated BOOLEAN DEFAULT false,
  p_family_members JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
  org_slug TEXT;
  org_id UUID;
  member JSONB;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM public.ensure_user_provisioned();

  UPDATE public.profiles SET
    full_name = p_full_name,
    cpf = NULLIF(p_cpf, ''),
    birth_date = CASE WHEN p_birth_date IS NOT NULL AND p_birth_date != '' THEN p_birth_date::date ELSE NULL END,
    phone = NULLIF(p_phone, ''),
    address = NULLIF(p_address, ''),
    is_ibbra_client = p_is_ibbra_client,
    external_client_validated = p_external_client_validated,
    validated_at = CASE WHEN p_external_client_validated THEN now() ELSE NULL END,
    registration_completed = true,
    updated_at = now()
  WHERE user_id = current_user_id;

  -- Try cliente- prefix first, then fallback to base-
  org_slug := 'cliente-' || substring(current_user_id::text from 1 for 8);
  SELECT id INTO org_id FROM public.organizations WHERE slug = org_slug;
  
  IF org_id IS NULL THEN
    SELECT id INTO org_id FROM public.organizations 
    WHERE slug = 'base-' || substring(current_user_id::text from 1 for 8);
  END IF;

  IF org_id IS NOT NULL THEN
    UPDATE public.organizations SET name = p_full_name, updated_at = now() WHERE id = org_id;
  END IF;

  IF p_family_members IS NOT NULL AND jsonb_array_length(p_family_members) > 0 THEN
    FOR member IN SELECT * FROM jsonb_array_elements(p_family_members) LOOP
      INSERT INTO public.family_members (
        user_id, organization_id, relationship, full_name, age, phone, email
      ) VALUES (
        current_user_id, org_id, member->>'relationship', member->>'full_name',
        CASE WHEN member->>'age' IS NOT NULL AND member->>'age' != '' THEN (member->>'age')::int ELSE NULL END,
        NULLIF(member->>'phone', ''), NULLIF(member->>'email', '')
      );
    END LOOP;
  END IF;

  INSERT INTO public.consent_logs (user_id, consent_type, consent_given)
  VALUES (current_user_id, 'terms', true), (current_user_id, 'privacy', true)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('success', true, 'organization_id', org_id);
END;
$$;

-- Rename any remaining legacy base- slugs to cliente-
UPDATE public.organizations 
SET slug = 'cliente-' || substring(slug from 6)
WHERE slug LIKE 'base-%';
