-- Tabela de hierarquia de supervisão
-- Define quem supervisiona quem: Admin > Supervisor > FA > KAM > Cliente(org)
CREATE TABLE public.user_hierarchy (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    supervisor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE(user_id)
);

-- Habilitar RLS
ALTER TABLE public.user_hierarchy ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para user_hierarchy
CREATE POLICY "Admins can manage all hierarchy"
ON public.user_hierarchy
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Supervisors can view their subordinates hierarchy"
ON public.user_hierarchy
FOR SELECT
USING (
    supervisor_id = auth.uid() 
    OR user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
);

-- Função recursiva para obter todos os subordinados de um usuário
CREATE OR REPLACE FUNCTION public.get_subordinates(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH RECURSIVE subordinates AS (
        -- Base: subordinados diretos
        SELECT user_id FROM public.user_hierarchy WHERE supervisor_id = _user_id
        UNION
        -- Recursivo: subordinados dos subordinados
        SELECT h.user_id 
        FROM public.user_hierarchy h
        INNER JOIN subordinates s ON h.supervisor_id = s.user_id
    )
    SELECT user_id FROM subordinates
$$;

-- Função para verificar se um usuário pode ver dados de outro usuário
CREATE OR REPLACE FUNCTION public.can_view_user_data(_viewer_id uuid, _target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        -- Admin pode ver tudo
        public.has_role(_viewer_id, 'admin')
        -- Ou é o próprio usuário
        OR _viewer_id = _target_user_id
        -- Ou o target é subordinado do viewer
        OR _target_user_id IN (SELECT public.get_subordinates(_viewer_id))
$$;

-- Função para obter organizações que um usuário pode ver
CREATE OR REPLACE FUNCTION public.get_viewable_organizations(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT DISTINCT om.organization_id 
    FROM public.organization_members om
    WHERE 
        -- Próprias organizações
        om.user_id = _user_id
        -- Ou organizações de subordinados
        OR om.user_id IN (SELECT public.get_subordinates(_user_id))
        -- Ou admin vê todas
        OR public.has_role(_user_id, 'admin')
$$;

-- Atualizar trigger para updated_at
CREATE TRIGGER update_user_hierarchy_updated_at
BEFORE UPDATE ON public.user_hierarchy
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar coluna para vincular KAM às organizações diretamente
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS kam_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;