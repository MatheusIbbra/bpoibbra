
-- 1. Add official_balance (from API) to accounts table
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS official_balance numeric DEFAULT NULL;

-- 2. Add last_official_balance_at to track when the official balance was last updated
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS last_official_balance_at timestamptz DEFAULT NULL;

-- 3. Add transaction_hash column for better deduplication  
-- This will store a hash of (date + amount + description) for composite dedup
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS sync_dedup_key text DEFAULT NULL;

-- 4. Create unique index on sync_dedup_key per bank_connection for deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_sync_dedup 
ON public.transactions (bank_connection_id, sync_dedup_key) 
WHERE sync_dedup_key IS NOT NULL AND bank_connection_id IS NOT NULL;

-- 5. Create sync_audit_logs table for detailed sync tracking
CREATE TABLE IF NOT EXISTS public.sync_audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  bank_connection_id uuid REFERENCES public.bank_connections(id),
  sync_date timestamptz NOT NULL DEFAULT now(),
  api_balance numeric,
  system_balance numeric,
  balance_difference numeric,
  transactions_imported integer DEFAULT 0,
  transactions_skipped integer DEFAULT 0,
  transactions_total integer DEFAULT 0,
  duplicates_detected integer DEFAULT 0,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on sync_audit_logs
ALTER TABLE public.sync_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: users can view sync logs for their viewable organizations
CREATE POLICY "Users can view sync logs for their organizations"
ON public.sync_audit_logs
FOR SELECT
USING (organization_id IN (SELECT public.get_viewable_organizations(auth.uid())));

-- Policy: service role can insert (edge functions)
CREATE POLICY "Service role can manage sync logs"
ON public.sync_audit_logs
FOR ALL
USING (true)
WITH CHECK (true);
