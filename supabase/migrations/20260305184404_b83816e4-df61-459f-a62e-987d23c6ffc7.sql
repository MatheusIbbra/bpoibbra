
-- ============================================================
-- FINANCIAL EVENTS TABLE
-- Single source of truth for all financial impacts.
-- ============================================================

CREATE TYPE public.financial_event_type AS ENUM (
  'income',
  'expense',
  'internal_transfer',
  'investment_contribution',
  'investment_withdraw',
  'loan_payment',
  'credit_card_payment'
);

CREATE TABLE public.financial_events (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id         UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  organization_id        UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type             public.financial_event_type NOT NULL,
  amount                 NUMERIC(15, 2) NOT NULL DEFAULT 0,
  source_account_id      UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  destination_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  impact_cashflow        BOOLEAN NOT NULL DEFAULT true,
  impact_investments     BOOLEAN NOT NULL DEFAULT false,
  event_date             DATE NOT NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_financial_events_transaction_id ON public.financial_events(transaction_id);
CREATE INDEX idx_financial_events_org_date       ON public.financial_events(organization_id, event_date DESC);
CREATE INDEX idx_financial_events_org_type       ON public.financial_events(organization_id, event_type);
CREATE INDEX idx_financial_events_org_cashflow   ON public.financial_events(organization_id, event_date DESC) WHERE impact_cashflow = true;
CREATE INDEX idx_financial_events_org_investment ON public.financial_events(organization_id, event_date DESC) WHERE impact_investments = true;

ALTER TABLE public.financial_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view financial events of their organizations"
  ON public.financial_events FOR SELECT
  USING (public.can_view_organization(organization_id, auth.uid()));

CREATE POLICY "Service role can manage financial events"
  ON public.financial_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_financial_events_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_financial_events_updated_at
  BEFORE UPDATE ON public.financial_events
  FOR EACH ROW EXECUTE FUNCTION public.update_financial_events_updated_at();

-- ============================================================
-- FUNCTION: classify_and_upsert_financial_event
-- ============================================================
CREATE OR REPLACE FUNCTION public.classify_and_upsert_financial_event(p_tx_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  tx       RECORD;
  ev_type  public.financial_event_type;
  imp_cf   BOOLEAN := true;
  imp_inv  BOOLEAN := false;
  src_acct UUID;
  dst_acct UUID;
BEGIN
  SELECT t.* INTO tx FROM transactions t WHERE t.id = p_tx_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Skip hidden balance-correction legs
  IF tx.is_ignored = true AND tx.validation_status = 'rejected' THEN
    DELETE FROM financial_events WHERE transaction_id = p_tx_id;
    RETURN;
  END IF;

  IF tx.status IN ('cancelled') THEN
    DELETE FROM financial_events WHERE transaction_id = p_tx_id;
    RETURN;
  END IF;

  src_acct := tx.account_id;
  IF tx.linked_transaction_id IS NOT NULL THEN
    SELECT account_id INTO dst_acct FROM transactions WHERE id = tx.linked_transaction_id;
  END IF;

  CASE tx.type
    WHEN 'income'     THEN ev_type := 'income';                 imp_cf := true;  imp_inv := false;
    WHEN 'expense'    THEN ev_type := 'expense';                imp_cf := true;  imp_inv := false;
    WHEN 'transfer'   THEN ev_type := 'internal_transfer';      imp_cf := false; imp_inv := false;
    WHEN 'investment' THEN ev_type := 'investment_contribution'; imp_cf := false; imp_inv := true;
    WHEN 'redemption' THEN ev_type := 'investment_withdraw';    imp_cf := false; imp_inv := true;
    ELSE                   ev_type := 'expense';                imp_cf := true;  imp_inv := false;
  END CASE;

  INSERT INTO financial_events (
    transaction_id, organization_id, event_type, amount,
    source_account_id, destination_account_id,
    impact_cashflow, impact_investments, event_date
  ) VALUES (
    p_tx_id, tx.organization_id, ev_type, tx.amount,
    src_acct, dst_acct, imp_cf, imp_inv, tx.date::DATE
  )
  ON CONFLICT (transaction_id) DO UPDATE SET
    event_type             = EXCLUDED.event_type,
    amount                 = EXCLUDED.amount,
    source_account_id      = EXCLUDED.source_account_id,
    destination_account_id = EXCLUDED.destination_account_id,
    impact_cashflow        = EXCLUDED.impact_cashflow,
    impact_investments     = EXCLUDED.impact_investments,
    event_date             = EXCLUDED.event_date,
    updated_at             = now();
END;
$$;

-- ============================================================
-- TRIGGER: auto-sync on transaction changes
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_sync_financial_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM financial_events WHERE transaction_id = OLD.id;
    RETURN OLD;
  ELSE
    PERFORM public.classify_and_upsert_financial_event(NEW.id);
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER trg_transactions_sync_financial_event
  AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_financial_event();

-- ============================================================
-- BACKFILL existing transactions
-- ============================================================
DO $$
DECLARE tx_id UUID;
BEGIN
  FOR tx_id IN
    SELECT id FROM transactions
    WHERE status != 'cancelled'
      AND NOT (is_ignored = true AND validation_status = 'rejected')
    ORDER BY date DESC
  LOOP
    PERFORM public.classify_and_upsert_financial_event(tx_id);
  END LOOP;
END;
$$;
