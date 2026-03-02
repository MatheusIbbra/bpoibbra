
-- Fix: pending_registrations - restrict to service role + admin only
-- This table has no user_id or email, uses session_token.
-- Regular users should not be able to read other registrations.
CREATE POLICY "pending_registrations_select_own"
  ON public.pending_registrations
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
  );

-- The remaining policies from the failed migration:
CREATE POLICY "materialized_metrics_write_service_only"
  ON public.materialized_metrics
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "open_finance_raw_data_no_update"
  ON public.open_finance_raw_data
  FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY "open_finance_raw_data_no_delete"
  ON public.open_finance_raw_data
  FOR DELETE
  TO authenticated
  USING (false);

CREATE POLICY "audit_log_insert_authenticated"
  ON public.audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "security_events_insert_authenticated"
  ON public.security_events
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
