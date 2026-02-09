
CREATE OR REPLACE FUNCTION public.get_viewable_organizations(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT DISTINCT org_id FROM (
        -- 1. ADMIN: Vê todas as organizações
        SELECT o.id as org_id
        FROM public.organizations o
        WHERE public.has_role(_user_id, 'admin')
        
        UNION
        
        -- 2. SUPERVISOR: Vê organizações de todos os FAs que supervisiona (e seus subordinados)
        SELECT o.id as org_id
        FROM public.organizations o
        WHERE o.kam_id IN (
            SELECT uh_kam.user_id 
            FROM public.user_hierarchy uh_kam
            WHERE uh_kam.supervisor_id IN (
                SELECT uh_fa.user_id
                FROM public.user_hierarchy uh_fa
                WHERE uh_fa.supervisor_id = _user_id
            )
        )
        
        UNION
        
        -- 3. FA: Vê organizações de todos os KAMs que supervisiona diretamente
        SELECT o.id as org_id
        FROM public.organizations o
        WHERE o.kam_id IN (
            SELECT uh.user_id 
            FROM public.user_hierarchy uh
            WHERE uh.supervisor_id = _user_id
        )
        
        UNION
        
        -- 4. KAM: Vê organizações onde é o KAM responsável
        SELECT o.id as org_id
        FROM public.organizations o
        WHERE o.kam_id = _user_id
        
        UNION
        
        -- 5. Qualquer usuário: Vê organizações onde é membro (via organization_members)
        SELECT om.organization_id as org_id
        FROM public.organization_members om
        WHERE om.user_id = _user_id
        
    ) all_orgs
$$;
