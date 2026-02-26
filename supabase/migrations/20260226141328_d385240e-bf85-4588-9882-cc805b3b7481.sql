DO $$
DECLARE
  v_user_id uuid := 'defd3f6d-1d70-419b-a133-a2bef6265c0a';
BEGIN
  DELETE FROM profiles WHERE user_id = v_user_id;
  DELETE FROM auth.users WHERE id = v_user_id;
END $$;