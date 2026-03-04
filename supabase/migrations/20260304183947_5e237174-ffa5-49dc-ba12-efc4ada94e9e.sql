-- Sync Google avatar on profile creation/update via ensure_user_provisioned
-- Update ensure_user_provisioned to also sync avatar_url from Google OAuth metadata
CREATE OR REPLACE FUNCTION public.ensure_user_provisioned()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
  v_full_name TEXT;
  v_avatar_url TEXT;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Get name and avatar from auth metadata (covers Google OAuth)
  SELECT 
    COALESCE(
      raw_user_meta_data->>'full_name',
      raw_user_meta_data->>'name',
      email
    ),
    COALESCE(
      raw_user_meta_data->>'avatar_url',
      raw_user_meta_data->>'picture'
    )
  INTO v_full_name, v_avatar_url
  FROM auth.users
  WHERE id = current_user_id;

  -- Create profile if it doesn't exist, or update avatar_url if it's from OAuth and not yet set
  INSERT INTO public.profiles (user_id, full_name, avatar_url)
  VALUES (current_user_id, v_full_name, v_avatar_url)
  ON CONFLICT (user_id) DO UPDATE
    SET 
      full_name = CASE 
        WHEN profiles.full_name IS NULL OR profiles.full_name = '' 
        THEN EXCLUDED.full_name 
        ELSE profiles.full_name 
      END,
      avatar_url = CASE
        WHEN profiles.avatar_url IS NULL OR profiles.avatar_url = ''
        THEN EXCLUDED.avatar_url
        ELSE profiles.avatar_url
      END,
      updated_at = now();

  -- Ensure user has a role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (current_user_id, 'cliente')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;