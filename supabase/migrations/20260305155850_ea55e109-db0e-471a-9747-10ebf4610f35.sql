
-- Remove a linha duplicada 'cliente' do usuário admin (d4fbe6fd)
DELETE FROM public.user_roles 
WHERE id = 'c134e052-695c-4659-a38d-36f426bb2c88'
  AND user_id = 'd4fbe6fd-64e7-41f9-8388-3ac83b3bd173'
  AND role = 'cliente';

-- Garantir UNIQUE por user_id para evitar duplicatas futuras
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_roles_user_id_key' 
    AND conrelid = 'public.user_roles'::regclass
  ) THEN
    ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);
  END IF;
END $$;
