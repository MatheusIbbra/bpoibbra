
-- Migration: Race condition fix + job idempotency
-- Tables affected: transactions, job_executions
-- ROLLBACK:
--   ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_org_hash_unique;
--   DROP POLICY IF EXISTS "service_role_only" ON job_executions;
--   DROP TABLE IF EXISTS job_executions;

-- 1. Unique constraint to prevent duplicate transactions via concurrent requests
ALTER TABLE transactions
  ADD CONSTRAINT transactions_org_hash_unique
  UNIQUE (organization_id, transaction_hash);

-- 2. Job executions table for idempotent background jobs
CREATE TABLE IF NOT EXISTS job_executions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type        TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  run_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(job_type, organization_id, run_date)
);

ALTER TABLE job_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only" ON job_executions USING (false);
