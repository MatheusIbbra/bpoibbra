
-- Create enum types
CREATE TYPE account_type AS ENUM ('corrente', 'poupanca', 'investimento', 'cartao');
CREATE TYPE account_status AS ENUM ('ativa', 'inativa');
CREATE TYPE payment_method AS ENUM ('pix', 'debito', 'credito', 'boleto', 'transferencia', 'dinheiro', 'outros');
CREATE TYPE file_import_type AS ENUM ('extrato_bancario', 'fatura_cartao', 'documento_fiscal', 'outros');

-- Create accounts table
CREATE TABLE public.accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_type account_type NOT NULL DEFAULT 'corrente',
  initial_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  status account_status NOT NULL DEFAULT 'ativa',
  color TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create cost_centers table
CREATE TABLE public.cost_centers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create file_imports table for tracking imports
CREATE TABLE public.file_imports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type file_import_type NOT NULL,
  bank_name TEXT NOT NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  records_count INTEGER NOT NULL DEFAULT 0,
  imported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create transfers table
CREATE TABLE public.transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  origin_account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  destination_account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL,
  transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT different_accounts CHECK (origin_account_id != destination_account_id)
);

-- Add new columns to transactions table
ALTER TABLE public.transactions 
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_method payment_method,
  ADD COLUMN IF NOT EXISTS file_import_id UUID REFERENCES public.file_imports(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS ai_classified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_confidence DECIMAL(3,2);

-- Add cost_center_id to budgets table
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL;

-- Enable RLS on new tables
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

-- RLS policies for accounts
CREATE POLICY "Users can view their own accounts" ON public.accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own accounts" ON public.accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own accounts" ON public.accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own accounts" ON public.accounts FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for cost_centers
CREATE POLICY "Users can view their own cost_centers" ON public.cost_centers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own cost_centers" ON public.cost_centers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own cost_centers" ON public.cost_centers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own cost_centers" ON public.cost_centers FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for file_imports
CREATE POLICY "Users can view their own file_imports" ON public.file_imports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own file_imports" ON public.file_imports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own file_imports" ON public.file_imports FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own file_imports" ON public.file_imports FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for transfers
CREATE POLICY "Users can view their own transfers" ON public.transfers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own transfers" ON public.transfers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own transfers" ON public.transfers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own transfers" ON public.transfers FOR DELETE USING (auth.uid() = user_id);

-- Function to calculate account balance
CREATE OR REPLACE FUNCTION public.calculate_account_balance(account_uuid UUID)
RETURNS DECIMAL(15,2)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  initial_bal DECIMAL(15,2);
  income_total DECIMAL(15,2);
  expense_total DECIMAL(15,2);
  transfers_in DECIMAL(15,2);
  transfers_out DECIMAL(15,2);
BEGIN
  -- Get initial balance
  SELECT initial_balance INTO initial_bal FROM accounts WHERE id = account_uuid;
  
  -- Get income total
  SELECT COALESCE(SUM(amount), 0) INTO income_total 
  FROM transactions 
  WHERE account_id = account_uuid AND type = 'income' AND is_pending = false;
  
  -- Get expense total
  SELECT COALESCE(SUM(amount), 0) INTO expense_total 
  FROM transactions 
  WHERE account_id = account_uuid AND type = 'expense' AND is_pending = false;
  
  -- Get transfers in
  SELECT COALESCE(SUM(amount), 0) INTO transfers_in 
  FROM transfers 
  WHERE destination_account_id = account_uuid;
  
  -- Get transfers out
  SELECT COALESCE(SUM(amount), 0) INTO transfers_out 
  FROM transfers 
  WHERE origin_account_id = account_uuid;
  
  RETURN initial_bal + income_total - expense_total + transfers_in - transfers_out;
END;
$$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON public.accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_cost_centers_user_id ON public.cost_centers(user_id);
CREATE INDEX IF NOT EXISTS idx_file_imports_user_id ON public.file_imports(user_id);
CREATE INDEX IF NOT EXISTS idx_transfers_user_id ON public.transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_transfers_origin ON public.transfers(origin_account_id);
CREATE INDEX IF NOT EXISTS idx_transfers_destination ON public.transfers(destination_account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON public.transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_cost_center_id ON public.transactions(cost_center_id);
CREATE INDEX IF NOT EXISTS idx_transactions_file_import_id ON public.transactions(file_import_id);

-- Triggers for updated_at
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_cost_centers_updated_at BEFORE UPDATE ON public.cost_centers FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_transfers_updated_at BEFORE UPDATE ON public.transfers FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
