
DO $$
DECLARE
  v_user_id uuid := '26ec57ae-91c6-44a9-8a89-5fc00cc2110f';
BEGIN
  DELETE FROM public.family_members WHERE user_id = v_user_id;
  DELETE FROM public.consent_logs WHERE user_id = v_user_id;
  DELETE FROM public.data_export_requests WHERE user_id = v_user_id;
  DELETE FROM public.data_deletion_requests WHERE user_id = v_user_id;
  DELETE FROM public.user_hierarchy WHERE user_id = v_user_id;
  DELETE FROM public.user_roles WHERE user_id = v_user_id;
  DELETE FROM public.profiles WHERE user_id = v_user_id;
  DELETE FROM auth.users WHERE id = v_user_id;
  RAISE NOTICE 'Orphan user % (Matheus Lúcio) deleted', v_user_id;
END $$;
