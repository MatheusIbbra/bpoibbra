
-- Fix security_events INSERT to not use WITH CHECK (true)
DROP POLICY IF EXISTS "security_events_insert_authenticated" ON public.security_events;
CREATE POLICY "security_events_insert_authenticated"
  ON public.security_events
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Fix pending_registrations INSERT 
DROP POLICY IF EXISTS "Anyone can insert pending registrations" ON public.pending_registrations;
CREATE POLICY "anon_can_insert_pending_registrations"
  ON public.pending_registrations
  FOR INSERT
  WITH CHECK (session_token IS NOT NULL);
