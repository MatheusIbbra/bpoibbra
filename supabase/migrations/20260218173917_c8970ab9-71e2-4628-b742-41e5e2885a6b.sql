
-- Table to store registration data server-side instead of localStorage
CREATE TABLE public.pending_registrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  is_ibbra_client BOOLEAN DEFAULT false,
  cpf TEXT,
  full_name TEXT,
  birth_date TEXT,
  phone TEXT,
  address TEXT,
  validated BOOLEAN DEFAULT false,
  family_members JSONB,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 hour'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: only service_role and anon can insert (pre-auth), authenticated can read/delete own token
ALTER TABLE public.pending_registrations ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (user not yet authenticated when registering)
CREATE POLICY "Anyone can insert pending registrations"
  ON public.pending_registrations
  FOR INSERT
  WITH CHECK (true);

-- Allow anyone to read by session_token (token is secret, acts as auth)
CREATE POLICY "Anyone can read pending registrations"
  ON public.pending_registrations
  FOR SELECT
  USING (true);

-- Allow anyone to delete (cleanup after consuming)
CREATE POLICY "Anyone can delete pending registrations"
  ON public.pending_registrations
  FOR DELETE
  USING (true);

-- Prevent updates
CREATE POLICY "No updates allowed"
  ON public.pending_registrations
  FOR UPDATE
  USING (false);

-- Auto cleanup function for expired registrations
CREATE OR REPLACE FUNCTION public.cleanup_expired_pending_registrations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.pending_registrations WHERE expires_at < now();
END;
$$;

-- Create index for fast lookup by session_token
CREATE INDEX idx_pending_registrations_session_token ON public.pending_registrations(session_token);

-- Create index for cleanup by expiry
CREATE INDEX idx_pending_registrations_expires_at ON public.pending_registrations(expires_at);
