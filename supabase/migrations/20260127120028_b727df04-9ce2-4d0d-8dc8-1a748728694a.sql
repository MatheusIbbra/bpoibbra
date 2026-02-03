-- Criar organizações para clientes existentes que não têm
DO $$
DECLARE
  client_record RECORD;
  new_org_id uuid;
  user_name text;
  org_slug text;
BEGIN
  FOR client_record IN 
    SELECT ur.user_id 
    FROM user_roles ur
    WHERE ur.role = 'cliente'
    AND NOT EXISTS (
      SELECT 1 FROM organization_members om WHERE om.user_id = ur.user_id
    )
  LOOP
    -- Buscar nome do usuário
    SELECT full_name INTO user_name 
    FROM profiles 
    WHERE user_id = client_record.user_id;
    
    -- Gerar slug único
    org_slug := 'cliente-' || substring(client_record.user_id::text from 1 for 8);
    
    -- Criar organização
    INSERT INTO organizations (name, slug)
    VALUES (
      COALESCE(user_name, 'Cliente ' || substring(client_record.user_id::text from 1 for 8)),
      org_slug
    )
    RETURNING id INTO new_org_id;
    
    -- Adicionar como membro
    INSERT INTO organization_members (organization_id, user_id, role)
    VALUES (new_org_id, client_record.user_id, 'cliente');
    
    RAISE NOTICE 'Criada organização % para usuário %', new_org_id, client_record.user_id;
  END LOOP;
END;
$$;