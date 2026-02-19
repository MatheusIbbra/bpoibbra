
-- Fix: ensure_user_provisioned should ONLY create profile + role, NOT the organization.
-- Organization creation moves into complete_onboarding after registration_completed = true.

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
  existing_profile_id UUID;
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

  -- NOTE: Organization creation is now handled ONLY in complete_onboarding
  -- after registration_completed = true, to prevent premature provisioning.
END;
$$;


-- Fix: complete_onboarding now handles org creation + provisioning AFTER setting registration_completed = true
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
  new_org_id UUID;
  member JSONB;
  user_role_value app_role;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Ensure profile and role exist (does NOT create org)
  PERFORM public.ensure_user_provisioned();

  -- Step 1: Set registration_completed = true FIRST
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

  -- Step 2: Get user role to decide if org should be created
  SELECT role INTO user_role_value FROM public.user_roles WHERE user_id = current_user_id LIMIT 1;

  -- Staff roles should NOT auto-create an organization
  IF user_role_value IN ('admin', 'supervisor', 'kam', 'fa', 'projetista') THEN
    INSERT INTO public.consent_logs (user_id, consent_type, consent_given)
    VALUES (current_user_id, 'terms', true), (current_user_id, 'privacy', true)
    ON CONFLICT DO NOTHING;
    RETURN jsonb_build_object('success', true, 'organization_id', null);
  END IF;

  -- Step 3: Create org ONLY AFTER registration_completed = true
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

  -- Provision templates (categories, reconciliation rules)
  BEGIN
    PERFORM public.provision_organization_from_template(org_id, current_user_id);
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Don't fail onboarding if template provisioning fails
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
