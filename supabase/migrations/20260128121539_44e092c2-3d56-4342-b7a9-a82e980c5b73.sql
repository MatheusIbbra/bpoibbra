-- Atualizar a função get_viewable_organizations para considerar:
-- 1. FA pode ver organizações de todos os KAMs que ele supervisiona (via user_hierarchy)
-- 2. KAM pode ver organizações onde ele é o kam_id

CREATE OR REPLACE FUNCTION public.get_viewable_organizations(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT DISTINCT org_id FROM (
        -- Organizações onde o usuário é membro direto
        SELECT organization_id as org_id
        FROM public.organization_members 
        WHERE user_id = _user_id
        
        UNION
        
        -- Organizações de subordinados (hierarquia existente)
        SELECT om.organization_id as org_id
        FROM public.organization_members om
        WHERE om.user_id IN (SELECT public.get_subordinates(_user_id))
        
        UNION
        
        -- Organizações onde o usuário é o KAM responsável
        SELECT o.id as org_id
        FROM public.organizations o
        WHERE o.kam_id = _user_id
        
        UNION
        
        -- Para FA: organizações de TODOS os KAMs que ele supervisiona
        SELECT o.id as org_id
        FROM public.organizations o
        WHERE o.kam_id IN (
            SELECT uh.user_id 
            FROM public.user_hierarchy uh
            WHERE uh.supervisor_id = _user_id
        )
        
        UNION
        
        -- Admin vê todas as organizações
        SELECT o.id as org_id
        FROM public.organizations o
        WHERE public.has_role(_user_id, 'admin')
    ) all_orgs
$$;