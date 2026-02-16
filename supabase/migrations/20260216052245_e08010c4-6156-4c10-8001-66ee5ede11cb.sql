
-- Prevent duplicate bank connections for same org + provider + external_account_id
-- First, clean up existing duplicate: delete the newer duplicate PicPay connection and its transactions
DELETE FROM transactions WHERE bank_connection_id = 'c4c81f23-72b6-4835-92d5-89b4b4b92066';
DELETE FROM sync_audit_logs WHERE bank_connection_id = 'c4c81f23-72b6-4835-92d5-89b4b4b92066';
DELETE FROM integration_logs WHERE bank_connection_id = 'c4c81f23-72b6-4835-92d5-89b4b4b92066';
DELETE FROM bank_connections WHERE id = 'c4c81f23-72b6-4835-92d5-89b4b4b92066';

-- Add unique constraint to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_connections_unique_item 
ON bank_connections (organization_id, provider, external_account_id) 
WHERE external_account_id IS NOT NULL AND status != 'disconnected';
