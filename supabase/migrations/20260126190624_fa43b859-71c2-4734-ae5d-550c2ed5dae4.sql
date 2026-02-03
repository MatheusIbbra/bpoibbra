-- Fix function search paths
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create transfers table
CREATE TABLE public.transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  origin_account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  destination_account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  transfer_date DATE NOT NULL,
  description TEXT,
  status transaction_status DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for transfers
CREATE POLICY "Users can view own transfers" ON public.transfers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transfers" ON public.transfers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own transfers" ON public.transfers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own transfers" ON public.transfers FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_transfers_updated_at BEFORE UPDATE ON public.transfers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_transfers_user_id ON public.transfers(user_id);