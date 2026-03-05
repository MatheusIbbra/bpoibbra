-- Add missing performance indexes for common dashboard queries
-- ROLLBACK: DROP INDEX IF EXISTS idx_transactions_org_date; DROP INDEX IF EXISTS idx_transactions_org_status; DROP INDEX IF EXISTS idx_ai_suggestions_org; DROP INDEX IF EXISTS idx_api_usage_logs_org_endpoint;

CREATE INDEX IF NOT EXISTS idx_transactions_org_date 
  ON transactions(organization_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_org_status 
  ON transactions(organization_id, status);

CREATE INDEX IF NOT EXISTS idx_ai_suggestions_org 
  ON ai_suggestions(transaction_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_usage_logs_org_endpoint 
  ON api_usage_logs(organization_id, endpoint, created_at DESC);