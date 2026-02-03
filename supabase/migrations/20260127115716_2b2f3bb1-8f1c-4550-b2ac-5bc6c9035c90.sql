-- Função para criar organização automaticamente quando um usuário cliente é criado
CREATE OR REPLACE FUNCTION public.handle_new_client_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id uuid;
  user_name text;
  org_slug text;
BEGIN
  -- Só cria organização se o role for 'cliente'
  IF NEW.role = 'cliente' THEN
    -- Buscar nome do usuário
    SELECT full_name INTO user_name 
    FROM public.profiles 
    WHERE user_id = NEW.user_id;
    
    -- Gerar slug único baseado no user_id
    org_slug := 'cliente-' || substring(NEW.user_id::text from 1 for 8);
    
    -- Criar organização para o cliente
    INSERT INTO public.organizations (name, slug)
    VALUES (
      COALESCE(user_name, 'Cliente ' || substring(NEW.user_id::text from 1 for 8)),
      org_slug
    )
    RETURNING id INTO new_org_id;
    
    -- Adicionar o cliente como membro da própria organização
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (new_org_id, NEW.user_id, 'cliente');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para executar após inserção de role
DROP TRIGGER IF EXISTS on_client_role_created ON public.user_roles;
CREATE TRIGGER on_client_role_created
  AFTER INSERT ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_client_organization();

-- Também criar trigger para quando role é alterado para cliente
CREATE OR REPLACE FUNCTION public.handle_role_change_to_client()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id uuid;
  user_name text;
  org_slug text;
  existing_org_count integer;
BEGIN
  -- Só processa se mudou para 'cliente' (e não era cliente antes)
  IF NEW.role = 'cliente' AND (OLD.role IS NULL OR OLD.role != 'cliente') THEN
    -- Verificar se já tem organização
    SELECT COUNT(*) INTO existing_org_count
    FROM public.organization_members
    WHERE user_id = NEW.user_id;
    
    -- Só cria se não tiver organização
    IF existing_org_count = 0 THEN
      -- Buscar nome do usuário
      SELECT full_name INTO user_name 
      FROM public.profiles 
      WHERE user_id = NEW.user_id;
      
      -- Gerar slug único
      org_slug := 'cliente-' || substring(NEW.user_id::text from 1 for 8);
      
      -- Criar organização
      INSERT INTO public.organizations (name, slug)
      VALUES (
        COALESCE(user_name, 'Cliente ' || substring(NEW.user_id::text from 1 for 8)),
        org_slug
      )
      RETURNING id INTO new_org_id;
      
      -- Adicionar como membro
      INSERT INTO public.organization_members (organization_id, user_id, role)
      VALUES (new_org_id, NEW.user_id, 'cliente');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para update de role
DROP TRIGGER IF EXISTS on_role_updated_to_client ON public.user_roles;
CREATE TRIGGER on_role_updated_to_client
  AFTER UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_role_change_to_client();