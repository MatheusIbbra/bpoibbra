
-- Add IBBRA-specific columns to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS comunidade text,
  ADD COLUMN IF NOT EXISTS operacional text,
  ADD COLUMN IF NOT EXISTS perfil_comportamental text,
  ADD COLUMN IF NOT EXISTS origem text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS ibbra_locked boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS ibbra_email text,
  ADD COLUMN IF NOT EXISTS ibbra_telefone text;

COMMENT ON COLUMN public.profiles.comunidade IS 'Comunidade IBBRA importada da base matriz';
COMMENT ON COLUMN public.profiles.operacional IS 'Área operacional IBBRA importada da base matriz';
COMMENT ON COLUMN public.profiles.perfil_comportamental IS 'Perfil comportamental IBBRA importada da base matriz';
COMMENT ON COLUMN public.profiles.origem IS 'Origem do cadastro: manual, ibbra, google';
COMMENT ON COLUMN public.profiles.ibbra_locked IS 'Se true, campos importados da matriz não podem ser editados pelo usuário';
COMMENT ON COLUMN public.profiles.ibbra_email IS 'Email registrado na base matriz IBBRA';
COMMENT ON COLUMN public.profiles.ibbra_telefone IS 'Telefone registrado na base matriz IBBRA';
