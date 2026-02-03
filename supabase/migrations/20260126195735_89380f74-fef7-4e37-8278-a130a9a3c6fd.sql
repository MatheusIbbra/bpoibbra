-- =====================================================
-- IMPORT BATCH SYSTEM
-- =====================================================

-- Import batch status enum
CREATE TYPE public.import_status AS ENUM (
  'pending',
  'processing',
  'awaiting_validation',
  'completed',
  'failed',
  'cancelled'
);

-- Create import_batches table
CREATE TABLE public.import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  period_start DATE,
  period_end DATE,
  status import_status NOT NULL DEFAULT 'pending',
  total_transactions INTEGER DEFAULT 0,
  imported_count INTEGER DEFAULT 0,
  duplicate_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

-- Validation status enum
CREATE TYPE public.validation_status AS ENUM (
  'pending_validation',
  'validated',
  'rejected',
  'needs_review'
);

-- Add new columns to transactions for import tracking
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES public.import_batches(id) ON DELETE CASCADE;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS transaction_hash TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS raw_description TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS validation_status validation_status DEFAULT 'pending_validation';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS validated_by UUID REFERENCES auth.users(id);
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_transactions_hash ON public.transactions(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_transactions_org ON public.transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_transactions_import ON public.transactions(import_batch_id);

-- Trigger for updated_at
CREATE TRIGGER update_import_batches_updated_at
  BEFORE UPDATE ON public.import_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();