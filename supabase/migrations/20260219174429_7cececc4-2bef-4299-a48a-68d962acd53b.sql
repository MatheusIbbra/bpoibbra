
-- Fix: audit_log.user_id FK blocks user deletion
-- Change from RESTRICT to SET NULL so deleting a user nullifies the audit reference instead of failing
ALTER TABLE public.audit_log
  DROP CONSTRAINT audit_log_user_id_fkey;

ALTER TABLE public.audit_log
  ADD CONSTRAINT audit_log_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
