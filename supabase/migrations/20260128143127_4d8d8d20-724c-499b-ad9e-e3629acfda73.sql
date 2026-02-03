-- Add user-level blocking fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_blocked boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS blocked_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS blocked_reason text;

-- Create index for faster lookups on blocked users
CREATE INDEX IF NOT EXISTS idx_profiles_is_blocked ON public.profiles(is_blocked) WHERE is_blocked = true;