
-- Update handle_new_user to also create an organization and link user to it
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INTEGER;
  new_org_id UUID;
  user_full_name TEXT;
  org_slug TEXT;
BEGIN
  user_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  
  -- Create profile for the new user
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, user_full_name);

  -- Count existing user roles
  SELECT COUNT(*) INTO user_count FROM public.user_roles;

  -- If this is the first user, make them admin
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
  ELSE
    -- Otherwise, assign default role (cliente)
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'cliente');
  END IF;

  -- Create a personal organization (base) for the new user
  org_slug := 'base-' || substr(NEW.id::text, 1, 8);
  
  INSERT INTO public.organizations (name, slug)
  VALUES (user_full_name, org_slug)
  RETURNING id INTO new_org_id;

  -- Link user to the new organization as 'cliente'
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (new_org_id, NEW.id, 'cliente');

  -- Create a default subscription (free plan) if a free plan exists
  INSERT INTO public.organization_subscriptions (organization_id, plan_id, status)
  SELECT new_org_id, p.id, 'active'
  FROM public.plans p
  WHERE p.slug = 'free' AND p.is_active = true
  LIMIT 1;

  RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
