-- First, add the new enum values to app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'supervisor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'fa';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'kam';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'cliente';