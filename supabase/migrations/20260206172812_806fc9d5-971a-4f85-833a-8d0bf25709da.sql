-- Fix: add 'disconnected' to valid statuses for bank_connections
ALTER TABLE public.bank_connections DROP CONSTRAINT IF EXISTS bank_connections_status_check;
ALTER TABLE public.bank_connections ADD CONSTRAINT bank_connections_status_check 
  CHECK (status = ANY (ARRAY['pending', 'active', 'expired', 'revoked', 'error', 'disconnected']));
