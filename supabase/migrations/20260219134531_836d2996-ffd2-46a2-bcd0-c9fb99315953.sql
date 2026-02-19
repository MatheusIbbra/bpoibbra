-- Fix: Ensure pending_registrations INSERT works for both anon and authenticated
-- Drop existing conflicting policies and recreate cleaner ones
DROP POLICY IF EXISTS "Anon can insert pending registrations" ON public.pending_registrations;
DROP POLICY IF EXISTS "No updates allowed" ON public.pending_registrations;
DROP POLICY IF EXISTS "Service role manages pending registrations" ON public.pending_registrations;

-- Allow anyone (anon or authenticated) to insert pending registrations
CREATE POLICY "Anyone can insert pending registrations"
  ON public.pending_registrations
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Service role can do everything
CREATE POLICY "Service role full access"
  ON public.pending_registrations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can read their own (by session_token match - handled in app)
CREATE POLICY "Authenticated can read own pending"
  ON public.pending_registrations
  FOR SELECT
  TO authenticated
  USING (true);

-- No updates or deletes for regular users
CREATE POLICY "No updates for regular users"
  ON public.pending_registrations
  FOR UPDATE
  TO anon, authenticated
  USING (false);

CREATE POLICY "No deletes for regular users"
  ON public.pending_registrations
  FOR DELETE
  TO anon, authenticated
  USING (false);

-- Also add separate address fields to pending_registrations
ALTER TABLE public.pending_registrations 
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS zip_code text,
  ADD COLUMN IF NOT EXISTS street_number text,
  ADD COLUMN IF NOT EXISTS complement text;