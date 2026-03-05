
-- =====================================================
-- user_classification_rules: personalized auto-rules
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_classification_rules (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL,
  organization_id  UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  keyword          TEXT NOT NULL,
  category_id      UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  cost_center_id   UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  transaction_type TEXT NOT NULL DEFAULT 'expense' CHECK (transaction_type IN ('income','expense')),
  match_exact      BOOLEAN NOT NULL DEFAULT false,
  priority         INTEGER NOT NULL DEFAULT 50,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_class_rules_org  ON public.user_classification_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_class_rules_user ON public.user_classification_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_user_class_rules_type ON public.user_classification_rules(transaction_type);

ALTER TABLE public.user_classification_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_rules"
  ON public.user_classification_rules FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.can_view_organization(organization_id, auth.uid())
  );

CREATE POLICY "users_insert_own_rules"
  ON public.user_classification_rules FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_rules"
  ON public.user_classification_rules FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "users_delete_own_rules"
  ON public.user_classification_rules FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.trg_user_classification_rules_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_ucr_updated_at ON public.user_classification_rules;
CREATE TRIGGER trg_ucr_updated_at
  BEFORE UPDATE ON public.user_classification_rules
  FOR EACH ROW EXECUTE FUNCTION public.trg_user_classification_rules_updated_at();
