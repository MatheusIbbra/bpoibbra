
-- Dropar e recriar função can_view_user_data com ordem de parâmetros correta
DROP FUNCTION IF EXISTS public.can_view_user_data(uuid, uuid);

CREATE FUNCTION public.can_view_user_data(_target_user_id uuid, _viewer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    _viewer_id IS NOT NULL
    AND (
      -- Admin pode ver tudo
      public.has_role(_viewer_id, 'admin')
      -- Ou é o próprio usuário
      OR _viewer_id = _target_user_id
      -- Ou o target é subordinado do viewer
      OR _target_user_id IN (SELECT public.get_subordinates(_viewer_id))
    )
$$;

-- Atualizar can_view_profile para bloquear NULL
CREATE OR REPLACE FUNCTION public.can_view_profile(_profile_user_id uuid, _viewer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    _viewer_id IS NOT NULL
    AND (
      _profile_user_id = _viewer_id
      OR public.has_role(_viewer_id, 'admin')
      OR _profile_user_id IN (SELECT public.get_subordinates(_viewer_id))
    )
$$;

-- Atualizar can_view_organization para bloquear NULL
CREATE OR REPLACE FUNCTION public.can_view_organization(_org_id uuid, _viewer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    _viewer_id IS NOT NULL
    AND _org_id IN (SELECT public.get_viewable_organizations(_viewer_id))
$$;

-- Atualizar can_view_transaction para bloquear NULL
CREATE OR REPLACE FUNCTION public.can_view_transaction(_transaction_org_id uuid, _viewer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    _viewer_id IS NOT NULL
    AND (
      _transaction_org_id IS NULL 
      OR _transaction_org_id IN (SELECT public.get_viewable_organizations(_viewer_id))
    )
$$;
