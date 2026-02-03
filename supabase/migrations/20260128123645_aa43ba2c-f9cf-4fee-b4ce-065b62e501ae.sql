-- Atualizar a função get_viewable_organizations para seguir a hierarquia completa:
-- Admin → Supervisor → FA → KAM → Cliente
-- Cada nível herda automaticamente o acesso dos níveis abaixo

CREATE OR REPLACE FUNCTION public.get_viewable_organizations(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
            -- KAMs supervisionados por FAs que o Supervisor gerencia
            SELECT uh_kam.user_id 
            FROM public.user_hierarchy uh_kam
            WHERE uh_kam.supervisor_id IN (
                -- FAs supervisionados por este Supervisor
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
        
        -- 5. CLIENTE: Vê apenas sua própria organização (via membership)
        SELECT om.organization_id as org_id
        FROM public.organization_members om
        WHERE om.user_id = _user_id
        
    ) all_orgs
$function$;

-- Função auxiliar para validar hierarquia obrigatória
CREATE OR REPLACE FUNCTION public.validate_hierarchy_chain(_user_id uuid, _role text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    result jsonb;
    supervisor_role text;
    supervisor_id uuid;
BEGIN
    result := jsonb_build_object('valid', true, 'message', '');
    
    -- Buscar supervisor atual
    SELECT uh.supervisor_id INTO supervisor_id
    FROM public.user_hierarchy uh
    WHERE uh.user_id = _user_id;
    
    -- Validar conforme o role
    CASE _role
        WHEN 'fa' THEN
            -- FA deve ter um Supervisor
            IF supervisor_id IS NULL THEN
                result := jsonb_build_object('valid', false, 'message', 'FA deve ter um Supervisor atribuído');
            ELSE
                SELECT ur.role INTO supervisor_role
                FROM public.user_roles ur
                WHERE ur.user_id = supervisor_id;
                
                IF supervisor_role NOT IN ('admin', 'supervisor') THEN
                    result := jsonb_build_object('valid', false, 'message', 'FA só pode ser supervisionado por Admin ou Supervisor');
                END IF;
            END IF;
            
        WHEN 'kam' THEN
            -- KAM deve ter um FA
            IF supervisor_id IS NULL THEN
                result := jsonb_build_object('valid', false, 'message', 'KAM deve ter um FA atribuído');
            ELSE
                SELECT ur.role INTO supervisor_role
                FROM public.user_roles ur
                WHERE ur.user_id = supervisor_id;
                
                IF supervisor_role NOT IN ('admin', 'supervisor', 'fa') THEN
                    result := jsonb_build_object('valid', false, 'message', 'KAM só pode ser supervisionado por Admin, Supervisor ou FA');
                END IF;
            END IF;
            
        ELSE
            -- Outros roles não têm validação obrigatória
            NULL;
    END CASE;
    
    RETURN result;
END;
$function$;