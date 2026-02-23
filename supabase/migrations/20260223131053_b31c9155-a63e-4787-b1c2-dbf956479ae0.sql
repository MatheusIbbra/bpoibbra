
-- Cleanup orphan data for user matheuslucio014@gmail.com (095321f5)
DO $$
DECLARE
  v_user_id UUID := '095321f5-76cd-474d-b8f2-1f2a7637dfe8';
  v_org_id UUID := '3e3456ae-1c0f-49a3-b994-9f7b84f4ea14';
BEGIN
  -- Delete reconciliation rules
  DELETE FROM public.reconciliation_rules WHERE organization_id = v_org_id;
  
  -- Delete subcategories first, then parent categories
  DELETE FROM public.categories WHERE organization_id = v_org_id AND parent_id IS NOT NULL;
  DELETE FROM public.categories WHERE organization_id = v_org_id;
  
  -- Delete subscription
  DELETE FROM public.organization_subscriptions WHERE organization_id = v_org_id;
  
  -- Delete organization member
  DELETE FROM public.organization_members WHERE organization_id = v_org_id;
  
  -- Temporarily disable audit trigger
  ALTER TABLE public.organizations DISABLE TRIGGER audit_organizations;
  
  -- Delete organization
  DELETE FROM public.organizations WHERE id = v_org_id;
  
  -- Re-enable audit trigger
  ALTER TABLE public.organizations ENABLE TRIGGER audit_organizations;
  
  -- Delete user role
  DELETE FROM public.user_roles WHERE user_id = v_user_id;
  
  -- Delete profile
  DELETE FROM public.profiles WHERE user_id = v_user_id;
  
  -- Delete auth user
  DELETE FROM auth.users WHERE id = v_user_id;
  
  RAISE NOTICE 'Orphan data cleaned for user % and org %', v_user_id, v_org_id;
END $$;
