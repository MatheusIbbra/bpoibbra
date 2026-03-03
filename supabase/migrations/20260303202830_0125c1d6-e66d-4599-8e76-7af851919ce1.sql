
-- ============================================================
-- Faturas de Cartão de Crédito
-- Separação contábil: competência (compra) vs caixa (pagamento)
-- ============================================================

-- Tabela principal de faturas
CREATE TABLE IF NOT EXISTS public.credit_card_invoices (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id       uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Ciclo de referência
  reference_month  integer NOT NULL CHECK (reference_month BETWEEN 1 AND 12),
  reference_year   integer NOT NULL CHECK (reference_year >= 2000),
  -- Datas
  closing_date     date,
  due_date         date,
  -- Valores
  total_purchases  numeric NOT NULL DEFAULT 0,   -- soma das compras (competência)
  total_paid       numeric NOT NULL DEFAULT 0,   -- soma dos pagamentos (caixa)
  -- Status
  status           text NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open', 'partial', 'paid', 'overdue')),
  -- Audit
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, reference_month, reference_year)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_cci_account_period
  ON public.credit_card_invoices (account_id, reference_year, reference_month);
CREATE INDEX IF NOT EXISTS idx_cci_org
  ON public.credit_card_invoices (organization_id);
CREATE INDEX IF NOT EXISTS idx_cci_status
  ON public.credit_card_invoices (status);

-- RLS
ALTER TABLE public.credit_card_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org invoices"
  ON public.credit_card_invoices FOR SELECT
  USING (organization_id IN (SELECT get_viewable_organizations(auth.uid())));

CREATE POLICY "Users can insert invoices for their org"
  ON public.credit_card_invoices FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_viewable_organizations(auth.uid())));

CREATE POLICY "Users can update their org invoices"
  ON public.credit_card_invoices FOR UPDATE
  USING (organization_id IN (SELECT get_viewable_organizations(auth.uid())));

CREATE POLICY "Users can delete their org invoices"
  ON public.credit_card_invoices FOR DELETE
  USING (organization_id IN (SELECT get_viewable_organizations(auth.uid())));

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.update_credit_card_invoice_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_cci_updated_at
  BEFORE UPDATE ON public.credit_card_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_credit_card_invoice_timestamp();

-- ============================================================
-- Coluna na tabela transactions para vincular à fatura
-- ============================================================
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS credit_card_invoice_id uuid
    REFERENCES public.credit_card_invoices(id) ON DELETE SET NULL;

-- Coluna para marcar se a transação é pagamento de fatura
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS is_invoice_payment boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_tx_invoice
  ON public.transactions (credit_card_invoice_id)
  WHERE credit_card_invoice_id IS NOT NULL;

-- ============================================================
-- Função: recalcular totais de uma fatura
-- ============================================================
CREATE OR REPLACE FUNCTION public.recalc_invoice_totals(p_invoice_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_purchases numeric;
  v_paid      numeric;
  v_status    text;
BEGIN
  SELECT
    COALESCE(SUM(CASE WHEN type = 'expense' AND NOT is_invoice_payment THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN is_invoice_payment = true THEN amount ELSE 0 END), 0)
  INTO v_purchases, v_paid
  FROM transactions
  WHERE credit_card_invoice_id = p_invoice_id
    AND is_ignored = false;

  IF v_paid <= 0 THEN
    v_status := 'open';
  ELSIF v_paid >= v_purchases THEN
    v_status := 'paid';
  ELSE
    v_status := 'partial';
  END IF;

  UPDATE credit_card_invoices
  SET total_purchases = v_purchases,
      total_paid      = v_paid,
      status          = v_status,
      updated_at      = now()
  WHERE id = p_invoice_id;
END; $$;
