
-- 1. Add registration_completed to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS registration_completed boolean NOT NULL DEFAULT false;

-- 2. Replace the handle_new_user trigger to STOP creating organizations automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INTEGER;
  user_full_name TEXT;
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
    -- Otherwise, assign default role (cliente)
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'cliente');
  END IF;

  -- NOTE: Organization is NO LONGER created here.
  -- It will be created during the onboarding flow after the user completes registration.

  RETURN NEW;
END;
$$;

-- 3. Mark existing users as registration_completed = true (they already have orgs)
UPDATE public.profiles 
SET registration_completed = true 
WHERE user_id IN (
  SELECT DISTINCT user_id FROM public.organization_members
);
