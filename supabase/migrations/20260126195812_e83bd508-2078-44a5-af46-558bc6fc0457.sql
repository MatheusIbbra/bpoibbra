-- =====================================================
-- RLS POLICIES FOR IMPORT BATCHES
-- =====================================================

-- Import batches
CREATE POLICY "Users can view their org import batches" ON public.import_batches
  FOR SELECT USING (organization_id IN (SELECT get_user_organizations(auth.uid())));

CREATE POLICY "Users can create import batches in their org" ON public.import_batches
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT get_user_organizations(auth.uid())) AND
    user_id = auth.uid()
  );

CREATE POLICY "FA+ can update import batches" ON public.import_batches
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor', 'fa')
    )
  );

CREATE POLICY "FA+ can delete import batches" ON public.import_batches
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor', 'fa')
    )
  );

-- =====================================================
-- AI SUGGESTIONS TABLE
-- =====================================================

CREATE TABLE public.ai_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  suggested_category_id UUID REFERENCES public.categories(id),
  suggested_cost_center_id UUID REFERENCES public.cost_centers(id),
  suggested_type TEXT,
  suggested_competence_date DATE,
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  reasoning TEXT,
  model_version TEXT,
  was_accepted BOOLEAN,
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_suggestions ENABLE ROW LEVEL SECURITY;

-- AI Suggestions RLS
CREATE POLICY "Users can view AI suggestions for their org transactions" ON public.ai_suggestions
  FOR SELECT USING (
    transaction_id IN (
      SELECT id FROM transactions WHERE organization_id IN (SELECT get_user_organizations(auth.uid()))
    )
  );

CREATE POLICY "System can create AI suggestions" ON public.ai_suggestions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "FA+ can update AI suggestions" ON public.ai_suggestions
  FOR UPDATE USING (
    transaction_id IN (
      SELECT t.id FROM transactions t
      JOIN organization_members om ON t.organization_id = om.organization_id
      WHERE om.user_id = auth.uid() AND om.role IN ('admin', 'supervisor', 'fa')
    )
  );

-- =====================================================
-- AUDIT LOG
-- =====================================================

CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Audit log RLS
CREATE POLICY "Admins can view audit log" ON public.audit_log
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor')
    )
  );

CREATE POLICY "System can create audit entries" ON public.audit_log
  FOR INSERT WITH CHECK (true);

-- =====================================================
-- STORAGE BUCKET FOR EXTRACTS
-- =====================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'extratos',
  'extratos',
  false,
  20971520,
  ARRAY['application/x-ofx', 'text/csv', 'application/pdf', 'text/plain', 'application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload to their org folder" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'extratos' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM organizations 
      WHERE id IN (SELECT get_user_organizations(auth.uid()))
    )
  );

CREATE POLICY "Users can view files in their org folder" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'extratos' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM organizations 
      WHERE id IN (SELECT get_user_organizations(auth.uid()))
    )
  );

CREATE POLICY "FA+ can delete files in their org folder" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'extratos' AND
    (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor', 'fa')
    )
  );

-- =====================================================
-- UPDATE EXISTING RLS POLICIES TO USE ORGANIZATION
-- =====================================================

-- Update accounts RLS to include organization check
DROP POLICY IF EXISTS "Users can view own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can insert own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can update own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can delete own accounts" ON public.accounts;

CREATE POLICY "Users can view org accounts" ON public.accounts
  FOR SELECT USING (
    organization_id IN (SELECT get_user_organizations(auth.uid()))
    OR (organization_id IS NULL AND user_id = auth.uid())
  );

CREATE POLICY "Users can insert org accounts" ON public.accounts
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT get_user_organizations(auth.uid()))
    OR (organization_id IS NULL AND user_id = auth.uid())
  );

CREATE POLICY "Users can update org accounts" ON public.accounts
  FOR UPDATE USING (
    organization_id IN (SELECT get_user_organizations(auth.uid()))
    OR (organization_id IS NULL AND user_id = auth.uid())
  );

CREATE POLICY "Users can delete org accounts" ON public.accounts
  FOR DELETE USING (
    organization_id IN (SELECT get_user_organizations(auth.uid()))
    OR (organization_id IS NULL AND user_id = auth.uid())
  );

-- Update transactions RLS
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON public.transactions;

CREATE POLICY "Users can view org transactions" ON public.transactions
  FOR SELECT USING (
    organization_id IN (SELECT get_user_organizations(auth.uid()))
    OR (organization_id IS NULL AND user_id = auth.uid())
  );

CREATE POLICY "Users can insert org transactions" ON public.transactions
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT get_user_organizations(auth.uid()))
    OR (organization_id IS NULL AND user_id = auth.uid())
  );

CREATE POLICY "FA+ can update org transactions" ON public.transactions
  FOR UPDATE USING (
    (organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor', 'fa')
    ))
    OR (organization_id IS NULL AND user_id = auth.uid())
  );

CREATE POLICY "FA+ can delete org transactions" ON public.transactions
  FOR DELETE USING (
    (organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor', 'fa')
    ))
    OR (organization_id IS NULL AND user_id = auth.uid())
  );