
-- Fix sync_audit_logs FK
ALTER TABLE sync_audit_logs
  DROP CONSTRAINT sync_audit_logs_bank_connection_id_fkey;

ALTER TABLE sync_audit_logs
  ADD CONSTRAINT sync_audit_logs_bank_connection_id_fkey
  FOREIGN KEY (bank_connection_id) REFERENCES bank_connections(id) ON DELETE CASCADE;

-- Fix integration_logs FK
ALTER TABLE integration_logs
  DROP CONSTRAINT integration_logs_bank_connection_id_fkey;

ALTER TABLE integration_logs
  ADD CONSTRAINT integration_logs_bank_connection_id_fkey
  FOREIGN KEY (bank_connection_id) REFERENCES bank_connections(id) ON DELETE CASCADE;
