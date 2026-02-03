-- ========================================
-- CONCILIAÇÃO AUTOMÁTICA COM AUTO-APRENDIZADO
-- ========================================

-- 1. Adicionar coluna normalized_description em transactions (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'transactions' 
    AND column_name = 'normalized_description'
  ) THEN
    ALTER TABLE public.transactions ADD COLUMN normalized_description TEXT;
  END IF;
END $$;

-- 2. Adicionar coluna classification_source para rastrear origem da classificação
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'transactions' 
    AND column_name = 'classification_source'
  ) THEN
    ALTER TABLE public.transactions ADD COLUMN classification_source TEXT;
  END IF;
END $$;

-- 3. Criar tabela transaction_patterns para auto-aprendizado
CREATE TABLE IF NOT EXISTS public.transaction_patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  normalized_description TEXT NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  transaction_type TEXT NOT NULL DEFAULT 'expense',
  avg_amount NUMERIC(15,2) DEFAULT 0,
  confidence NUMERIC(5,4) DEFAULT 0.5,
  occurrences INTEGER DEFAULT 1,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Criar índice único para evitar duplicatas (org + normalized_description + category)
CREATE UNIQUE INDEX IF NOT EXISTS idx_transaction_patterns_unique 
ON public.transaction_patterns(organization_id, normalized_description, category_id, transaction_type);

-- 5. Índices para performance
CREATE INDEX IF NOT EXISTS idx_transaction_patterns_org 
ON public.transaction_patterns(organization_id);

CREATE INDEX IF NOT EXISTS idx_transaction_patterns_confidence 
ON public.transaction_patterns(confidence DESC, occurrences DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_normalized_desc 
ON public.transactions(normalized_description);

-- 6. Trigger para updated_at
CREATE TRIGGER update_transaction_patterns_updated_at
  BEFORE UPDATE ON public.transaction_patterns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Habilitar RLS
ALTER TABLE public.transaction_patterns ENABLE ROW LEVEL SECURITY;

-- 8. Policy para SELECT baseado em get_viewable_organizations
CREATE POLICY "Users can view patterns from viewable organizations"
ON public.transaction_patterns FOR SELECT
USING (organization_id IN (SELECT public.get_viewable_organizations(auth.uid())));

-- 9. Policy para INSERT - apenas em organizações que o usuário pertence
CREATE POLICY "Users can create patterns in their organizations"
ON public.transaction_patterns FOR INSERT
WITH CHECK (organization_id IN (SELECT public.get_user_organizations(auth.uid())));

-- 10. Policy para UPDATE
CREATE POLICY "Users can update patterns in their organizations"
ON public.transaction_patterns FOR UPDATE
USING (organization_id IN (SELECT public.get_viewable_organizations(auth.uid())));

-- 11. Policy para DELETE
CREATE POLICY "Users can delete patterns in their organizations"
ON public.transaction_patterns FOR DELETE
USING (organization_id IN (SELECT public.get_viewable_organizations(auth.uid())));

-- 12. Função para normalizar texto
CREATE OR REPLACE FUNCTION public.normalize_transaction_description(description TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  result TEXT;
BEGIN
  -- Lowercase
  result := lower(description);
  
  -- Remove acentos
  result := translate(result, 
    'àáâãäåèéêëìíîïòóôõöùúûüýÿñç',
    'aaaaaaeeeeiiiiooooouuuuyync'
  );
  
  -- Remove números (exceto os que fazem parte de padrões como CNPJ)
  result := regexp_replace(result, '\b\d{1,4}\b', '', 'g');
  
  -- Remove stopwords bancárias comuns
  result := regexp_replace(result, '\b(pix|ted|doc|tev|transf|deb|cred|pag|rec|ref|nr|num|nf|cp|dp)\b', '', 'gi');
  
  -- Remove caracteres especiais mantendo espaços
  result := regexp_replace(result, '[^a-z0-9\s]', '', 'g');
  
  -- Normaliza múltiplos espaços
  result := regexp_replace(result, '\s+', ' ', 'g');
  
  -- Trim
  result := trim(result);
  
  RETURN result;
END;
$$;

-- 13. Função para calcular similaridade entre strings
CREATE OR REPLACE FUNCTION public.text_similarity(text1 TEXT, text2 TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  words1 TEXT[];
  words2 TEXT[];
  common_words INTEGER := 0;
  total_words INTEGER;
BEGIN
  IF text1 IS NULL OR text2 IS NULL THEN
    RETURN 0;
  END IF;
  
  words1 := string_to_array(text1, ' ');
  words2 := string_to_array(text2, ' ');
  
  -- Contar palavras em comum
  SELECT COUNT(*) INTO common_words
  FROM unnest(words1) w1
  WHERE w1 = ANY(words2);
  
  total_words := GREATEST(array_length(words1, 1), array_length(words2, 1));
  
  IF total_words = 0 THEN
    RETURN 0;
  END IF;
  
  RETURN (common_words::NUMERIC / total_words::NUMERIC);
END;
$$;

-- 14. Função para atualizar/criar pattern após validação
CREATE OR REPLACE FUNCTION public.upsert_transaction_pattern(
  p_organization_id UUID,
  p_normalized_description TEXT,
  p_category_id UUID,
  p_cost_center_id UUID,
  p_transaction_type TEXT,
  p_amount NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pattern_id UUID;
  current_occurrences INTEGER;
  current_avg_amount NUMERIC;
  new_confidence NUMERIC;
  new_avg_amount NUMERIC;
BEGIN
  -- Verificar se já existe um pattern similar
  SELECT id, occurrences, avg_amount INTO pattern_id, current_occurrences, current_avg_amount
  FROM public.transaction_patterns
  WHERE organization_id = p_organization_id
    AND normalized_description = p_normalized_description
    AND category_id = p_category_id
    AND transaction_type = p_transaction_type
  LIMIT 1;
  
  IF pattern_id IS NOT NULL THEN
    -- Atualizar pattern existente
    new_confidence := LEAST(0.99, 0.5 + (current_occurrences * 0.05)); -- Aumenta confiança progressivamente
    new_avg_amount := ((current_avg_amount * current_occurrences) + p_amount) / (current_occurrences + 1);
    
    UPDATE public.transaction_patterns
    SET 
      occurrences = occurrences + 1,
      avg_amount = new_avg_amount,
      confidence = new_confidence,
      cost_center_id = COALESCE(p_cost_center_id, cost_center_id),
      last_used_at = now(),
      updated_at = now()
    WHERE id = pattern_id;
  ELSE
    -- Criar novo pattern
    INSERT INTO public.transaction_patterns (
      organization_id,
      normalized_description,
      category_id,
      cost_center_id,
      transaction_type,
      avg_amount,
      confidence,
      occurrences
    ) VALUES (
      p_organization_id,
      p_normalized_description,
      p_category_id,
      p_cost_center_id,
      p_transaction_type,
      p_amount,
      0.6, -- Confiança inicial
      1
    )
    RETURNING id INTO pattern_id;
  END IF;
  
  RETURN pattern_id;
END;
$$;