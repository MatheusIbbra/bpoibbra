-- Add linked_transaction_id for paired transactions (transfers, investments, redemptions)
ALTER TABLE public.transactions 
ADD COLUMN linked_transaction_id uuid REFERENCES public.transactions(id) ON DELETE CASCADE;

-- Add ignored flag for transactions that should not be recorded
ALTER TABLE public.transactions 
ADD COLUMN is_ignored boolean DEFAULT false;

-- Create index for linked transactions lookup
CREATE INDEX idx_transactions_linked ON public.transactions(linked_transaction_id) WHERE linked_transaction_id IS NOT NULL;

-- Comment explaining the columns
COMMENT ON COLUMN public.transactions.linked_transaction_id IS 'ID of the paired transaction for transfers/investments/redemptions. When one is deleted, the linked one is also deleted via ON DELETE CASCADE.';
COMMENT ON COLUMN public.transactions.is_ignored IS 'If true, this transaction is ignored and not counted in reports/balances.';