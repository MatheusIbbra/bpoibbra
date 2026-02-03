-- Add start_date to accounts table for tracking when the account was opened
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS start_date DATE;

-- Set default start_date to created_at for existing accounts
UPDATE public.accounts 
SET start_date = DATE(created_at) 
WHERE start_date IS NULL;