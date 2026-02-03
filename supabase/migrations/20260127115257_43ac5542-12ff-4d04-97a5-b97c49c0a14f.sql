-- Corrigir políticas RLS permissivas em ai_suggestions
DROP POLICY IF EXISTS "System can create AI suggestions" ON public.ai_suggestions;
CREATE POLICY "Service role can create AI suggestions"
ON public.ai_suggestions
FOR INSERT
WITH CHECK (auth.role() = 'service_role');

-- Corrigir políticas RLS permissivas em audit_log  
DROP POLICY IF EXISTS "System can create audit entries" ON public.audit_log;
CREATE POLICY "Service role can create audit entries"
ON public.audit_log
FOR INSERT
WITH CHECK (auth.role() = 'service_role');

-- Adicionar coluna para vincular organizações ao KAM responsável (se não existir)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'organizations' AND column_name = 'kam_id') THEN
    ALTER TABLE public.organizations ADD COLUMN kam_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_organizations_kam_id ON public.organizations(kam_id);
CREATE INDEX IF NOT EXISTS idx_user_hierarchy_supervisor_id ON public.user_hierarchy(supervisor_id);