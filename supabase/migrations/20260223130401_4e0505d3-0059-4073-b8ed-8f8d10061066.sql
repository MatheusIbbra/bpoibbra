
-- 1. Add gender, rg, and structured address columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS rg text,
  ADD COLUMN IF NOT EXISTS street text,
  ADD COLUMN IF NOT EXISTS street_number text,
  ADD COLUMN IF NOT EXISTS complement text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS zip_code text;

-- 2. Fix handle_new_user trigger to ONLY create profile + role (no org, no subscription, no templates)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INTEGER;
  user_full_name TEXT;
BEGIN
  user_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  
  -- Only create profile (registration_completed = false)
  INSERT INTO public.profiles (user_id, full_name, registration_completed)
  VALUES (NEW.id, user_full_name, false)
  ON CONFLICT (user_id) DO NOTHING;

  -- Assign role
  SELECT COUNT(*) INTO user_count FROM public.user_roles;

  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'cliente')
    ON CONFLICT DO NOTHING;
  END IF;

  -- NO organization, subscription, or template creation here.
  -- That only happens in complete_onboarding after email is confirmed.

  RETURN NEW;
END;
$$;

-- 3. Update complete_onboarding to accept new fields
CREATE OR REPLACE FUNCTION public.complete_onboarding(
  p_full_name TEXT,
  p_cpf TEXT DEFAULT NULL,
  p_birth_date TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_is_ibbra_client BOOLEAN DEFAULT false,
  p_external_client_validated BOOLEAN DEFAULT false,
  p_family_members JSONB DEFAULT NULL,
  p_gender TEXT DEFAULT NULL,
  p_rg TEXT DEFAULT NULL,
  p_street TEXT DEFAULT NULL,
  p_street_number TEXT DEFAULT NULL,
  p_complement TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_zip_code TEXT DEFAULT NULL
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
  new_org_id UUID;
  member JSONB;
  user_role_value app_role;
  free_plan_id UUID;
  existing_profile_cpf TEXT;
  existing_user_email TEXT;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Ensure profile and role exist (does NOT create org)
  PERFORM public.ensure_user_provisioned();

  -- CPF duplicate check: if another user already has this CPF, block registration
  IF p_cpf IS NOT NULL AND p_cpf != '' THEN
    SELECT p.cpf, u.email INTO existing_profile_cpf, existing_user_email
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE p.cpf = p_cpf AND p.user_id != current_user_id AND p.registration_completed = true
    LIMIT 1;

    IF existing_profile_cpf IS NOT NULL THEN
      -- Return masked email for the user
      RAISE EXCEPTION 'CPF_ALREADY_REGISTERED:%', 
        CONCAT(
          LEFT(split_part(existing_user_email, '@', 1), 1),
          '****@',
          split_part(existing_user_email, '@', 2)
        );
    END IF;
  END IF;

  -- Step 1: Update profile with all data
  UPDATE public.profiles SET
    full_name = p_full_name,
    cpf = NULLIF(p_cpf, ''),
    birth_date = CASE WHEN p_birth_date IS NOT NULL AND p_birth_date != '' THEN p_birth_date::date ELSE NULL END,
    phone = NULLIF(p_phone, ''),
    address = NULLIF(p_address, ''),
    gender = NULLIF(p_gender, ''),
    rg = NULLIF(p_rg, ''),
    street = NULLIF(p_street, ''),
    street_number = NULLIF(p_street_number, ''),
    complement = NULLIF(p_complement, ''),
    city = NULLIF(p_city, ''),
    state = NULLIF(p_state, ''),
    zip_code = NULLIF(p_zip_code, ''),
    is_ibbra_client = p_is_ibbra_client,
    external_client_validated = p_external_client_validated,
    validated_at = CASE WHEN p_external_client_validated THEN now() ELSE NULL END,
    registration_completed = true,
    updated_at = now()
  WHERE user_id = current_user_id;

  -- Step 2: Get user role to decide if org should be created
  SELECT role INTO user_role_value FROM public.user_roles WHERE user_id = current_user_id LIMIT 1;

  -- Staff roles should NOT auto-create an organization
  IF user_role_value IN ('admin', 'supervisor', 'kam', 'fa', 'projetista') THEN
    INSERT INTO public.consent_logs (user_id, consent_type, consent_given)
    VALUES (current_user_id, 'terms', true), (current_user_id, 'privacy', true)
    ON CONFLICT DO NOTHING;
    RETURN jsonb_build_object('success', true, 'organization_id', null);
  END IF;

  -- Step 3: Create org ONLY NOW (after email confirmed + registration completing)
  org_slug := 'cliente-' || substring(current_user_id::text from 1 for 8);
  
  SELECT id INTO org_id FROM public.organizations WHERE slug = org_slug;
  
  -- Fallback: check for legacy base- slug
  IF org_id IS NULL THEN
    SELECT id INTO org_id FROM public.organizations 
    WHERE slug = 'base-' || substring(current_user_id::text from 1 for 8);
  END IF;

  IF org_id IS NULL THEN
    -- Create new organization
    INSERT INTO public.organizations (name, slug) VALUES (p_full_name, org_slug)
    RETURNING id INTO new_org_id;
    org_id := new_org_id;

    -- Create subscription for new org
    SELECT id INTO free_plan_id FROM public.plans WHERE slug = 'free' AND is_active = true LIMIT 1;
    IF free_plan_id IS NOT NULL THEN
      INSERT INTO public.organization_subscriptions (organization_id, plan_id, status)
      VALUES (org_id, free_plan_id, 'active')
      ON CONFLICT DO NOTHING;
    END IF;
  ELSE
    -- Update existing org name
    UPDATE public.organizations SET name = p_full_name, updated_at = now() WHERE id = org_id;
  END IF;

  -- Add user as member
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE organization_id = org_id AND user_id = current_user_id
  ) THEN
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (org_id, current_user_id, 'cliente');
  END IF;

  -- Provision templates
  BEGIN
    PERFORM public.provision_organization_from_template(org_id, current_user_id);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Step 4: Family members
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

  -- Step 5: Consent logs
  INSERT INTO public.consent_logs (user_id, consent_type, consent_given)
  VALUES (current_user_id, 'terms', true), (current_user_id, 'privacy', true)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('success', true, 'organization_id', org_id);
END;
$$;
