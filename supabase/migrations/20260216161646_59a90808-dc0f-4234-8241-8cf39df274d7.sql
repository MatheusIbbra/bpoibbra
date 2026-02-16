
-- Create a complete_onboarding RPC that handles everything atomically server-side
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

  -- 1. Ensure provisioning first
  PERFORM public.ensure_user_provisioned();

  -- 2. Update profile with all data + mark as completed
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

  -- 3. Update organization name
  org_slug := 'base-' || substring(current_user_id::text from 1 for 8);
  
  UPDATE public.organizations
  SET name = p_full_name, updated_at = now()
  WHERE slug = org_slug;

  -- Get org id
  SELECT id INTO org_id FROM public.organizations WHERE slug = org_slug;

  -- 4. Save family members
  IF p_family_members IS NOT NULL AND jsonb_array_length(p_family_members) > 0 THEN
    FOR member IN SELECT * FROM jsonb_array_elements(p_family_members) LOOP
      INSERT INTO public.family_members (
        user_id, organization_id, relationship, full_name, age, phone, email
      ) VALUES (
        current_user_id,
        org_id,
        member->>'relationship',
        member->>'full_name',
        CASE WHEN member->>'age' IS NOT NULL AND member->>'age' != '' THEN (member->>'age')::int ELSE NULL END,
        NULLIF(member->>'phone', ''),
        NULLIF(member->>'email', '')
      );
    END LOOP;
  END IF;

  -- 5. Consent logs
  INSERT INTO public.consent_logs (user_id, consent_type, consent_given)
  VALUES 
    (current_user_id, 'terms', true),
    (current_user_id, 'privacy', true)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('success', true, 'organization_id', org_id);
END;
$$;
