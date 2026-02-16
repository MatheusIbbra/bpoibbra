
-- 1. Tabela de documentos legais versionados
CREATE TABLE public.legal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type text NOT NULL CHECK (document_type IN ('terms', 'privacy', 'lgpd')),
  version text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índice para busca rápida de documentos ativos
CREATE UNIQUE INDEX idx_legal_documents_active ON public.legal_documents (document_type) WHERE active = true;

ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;

-- Todos autenticados podem ler documentos legais
CREATE POLICY "Anyone can view active legal documents"
  ON public.legal_documents FOR SELECT
  USING (true);

-- Apenas admins gerenciam documentos
CREATE POLICY "Admins can manage legal documents"
  ON public.legal_documents FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 2. Tabela de consentimentos do usuário
CREATE TABLE public.user_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  terms_version text NOT NULL,
  privacy_version text NOT NULL,
  lgpd_version text NOT NULL,
  terms_document_id uuid REFERENCES public.legal_documents(id),
  privacy_document_id uuid REFERENCES public.legal_documents(id),
  lgpd_document_id uuid REFERENCES public.legal_documents(id),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_consents_user ON public.user_consents (user_id);

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver seus próprios consentimentos
CREATE POLICY "Users can view own consents"
  ON public.user_consents FOR SELECT
  USING (auth.uid() = user_id);

-- Admins podem ver todos
CREATE POLICY "Admins can view all consents"
  ON public.user_consents FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Usuários podem inserir seus próprios consentimentos
CREATE POLICY "Users can insert own consents"
  ON public.user_consents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Ninguém pode atualizar ou deletar consentimentos (imutáveis)
CREATE POLICY "No one can update consents"
  ON public.user_consents FOR UPDATE
  USING (false);

CREATE POLICY "No one can delete consents"
  ON public.user_consents FOR DELETE
  USING (false);

-- 3. Adicionar campo legal_accepted em profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS legal_accepted boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS legal_accepted_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS legal_accepted_version text;

-- 4. Seed dos documentos legais iniciais (v1.0)
INSERT INTO public.legal_documents (document_type, version, title, content, active) VALUES
(
  'terms',
  '1.0',
  'Termos de Uso',
  E'# Termos de Uso - IBBRA\n\n**Versão 1.0** — Vigente a partir de 16/02/2026\n\n## 1. Objeto\nEstes Termos de Uso regulam o acesso e utilização da plataforma IBBRA ("Plataforma"), um sistema de gestão financeira pessoal e patrimonial.\n\n## 2. Cadastro e Acesso\nO acesso à Plataforma requer cadastro prévio com dados verdadeiros e atualizados. O usuário é responsável pela confidencialidade de suas credenciais.\n\n## 3. Uso Adequado\nO usuário compromete-se a utilizar a Plataforma exclusivamente para fins lícitos e de acordo com estas condições.\n\n## 4. Propriedade Intelectual\nTodo o conteúdo da Plataforma, incluindo software, design e marca, é de propriedade exclusiva da IBBRA.\n\n## 5. Limitação de Responsabilidade\nA IBBRA não se responsabiliza por decisões financeiras tomadas com base nas informações disponibilizadas na Plataforma.\n\n## 6. Modificações\nEstes termos podem ser alterados a qualquer momento, sendo o usuário notificado previamente.\n\n## 7. Foro\nFica eleito o foro da comarca de São Paulo/SP para dirimir quaisquer controvérsias.',
  true
),
(
  'privacy',
  '1.0',
  'Política de Privacidade',
  E'# Política de Privacidade - IBBRA\n\n**Versão 1.0** — Vigente a partir de 16/02/2026\n\n## 1. Dados Coletados\nColetamos dados pessoais como nome, CPF, e-mail, dados financeiros e de navegação para prestação dos serviços.\n\n## 2. Finalidade\nSeus dados são utilizados exclusivamente para:\n- Prestação dos serviços contratados\n- Melhoria da experiência do usuário\n- Cumprimento de obrigações legais\n- Comunicações relevantes sobre o serviço\n\n## 3. Compartilhamento\nNão compartilhamos dados pessoais com terceiros, exceto quando necessário para prestação dos serviços ou por exigência legal.\n\n## 4. Armazenamento e Segurança\nSeus dados são armazenados em servidores seguros com criptografia e controles de acesso rigorosos.\n\n## 5. Seus Direitos\nVocê pode solicitar acesso, correção, portabilidade ou exclusão dos seus dados a qualquer momento.\n\n## 6. Cookies\nUtilizamos cookies essenciais para funcionamento da plataforma.\n\n## 7. Contato\nPara questões sobre privacidade: privacidade@ibbra.com.br',
  true
),
(
  'lgpd',
  '1.0',
  'Consentimento LGPD',
  E'# Consentimento para Tratamento de Dados - LGPD\n\n**Versão 1.0** — Vigente a partir de 16/02/2026\n\nDe acordo com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018), o titular dos dados autoriza a IBBRA a:\n\n## 1. Base Legal\nO tratamento dos dados pessoais é realizado com fundamento no consentimento do titular (Art. 7º, I) e na execução de contrato (Art. 7º, V).\n\n## 2. Dados Tratados\n- Dados de identificação (nome, CPF, data de nascimento)\n- Dados de contato (e-mail, telefone, endereço)\n- Dados financeiros (contas bancárias, transações, patrimônio)\n- Dados de navegação e uso da plataforma\n\n## 3. Finalidade do Tratamento\n- Gestão financeira pessoal e patrimonial\n- Classificação e análise de transações\n- Geração de relatórios e insights financeiros\n- Comunicações sobre o serviço\n\n## 4. Direitos do Titular\nO titular pode, a qualquer momento:\n- Acessar seus dados pessoais\n- Solicitar correção de dados incompletos ou desatualizados\n- Solicitar a portabilidade dos dados\n- Solicitar a exclusão dos dados pessoais\n- Revogar o consentimento\n\n## 5. Encarregado (DPO)\nPara exercer seus direitos: dpo@ibbra.com.br',
  true
);

-- 5. Função para verificar se usuário tem consentimento válido
CREATE OR REPLACE FUNCTION public.check_user_consent_valid(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_latest_consent record;
  v_current_terms_version text;
  v_current_privacy_version text;
  v_current_lgpd_version text;
BEGIN
  -- Buscar versões ativas
  SELECT version INTO v_current_terms_version FROM legal_documents WHERE document_type = 'terms' AND active = true LIMIT 1;
  SELECT version INTO v_current_privacy_version FROM legal_documents WHERE document_type = 'privacy' AND active = true LIMIT 1;
  SELECT version INTO v_current_lgpd_version FROM legal_documents WHERE document_type = 'lgpd' AND active = true LIMIT 1;

  -- Buscar último consentimento do usuário
  SELECT * INTO v_latest_consent FROM user_consents WHERE user_id = p_user_id ORDER BY accepted_at DESC LIMIT 1;

  IF v_latest_consent IS NULL THEN
    RETURN false;
  END IF;

  -- Verificar se todas as versões batem
  RETURN (
    v_latest_consent.terms_version = COALESCE(v_current_terms_version, '1.0') AND
    v_latest_consent.privacy_version = COALESCE(v_current_privacy_version, '1.0') AND
    v_latest_consent.lgpd_version = COALESCE(v_current_lgpd_version, '1.0')
  );
END;
$$;

-- 6. Tabela para solicitações de exclusão de dados
CREATE TABLE public.data_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  reason text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.data_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own deletion requests"
  ON public.data_deletion_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own deletion requests"
  ON public.data_deletion_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage deletion requests"
  ON public.data_deletion_requests FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
