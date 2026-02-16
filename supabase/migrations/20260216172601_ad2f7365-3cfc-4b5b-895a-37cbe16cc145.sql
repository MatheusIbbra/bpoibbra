
-- Remove triggers that duplicate organization creation
DROP TRIGGER IF EXISTS on_client_role_created ON public.user_roles;
DROP TRIGGER IF EXISTS on_role_updated_to_client ON public.user_roles;

-- Remove the functions
DROP FUNCTION IF EXISTS public.handle_new_client_organization();
DROP FUNCTION IF EXISTS public.handle_role_change_to_client();
