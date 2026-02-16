
-- Add new columns to profiles for IBBRA client registration
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS cpf text,
ADD COLUMN IF NOT EXISTS birth_date date,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS is_ibbra_client boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS external_client_validated boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS validated_at timestamptz;

-- Create index on CPF for fast lookups
CREATE INDEX IF NOT EXISTS idx_profiles_cpf ON public.profiles(cpf);
