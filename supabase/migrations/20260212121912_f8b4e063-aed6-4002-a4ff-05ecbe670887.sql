-- Add financial_type column to transactions
-- Values: 'fixa', 'variavel_recorrente', 'variavel_programada'
ALTER TABLE public.transactions
ADD COLUMN financial_type text NULL;

-- Add index for filtering/reporting
CREATE INDEX idx_transactions_financial_type ON public.transactions (financial_type);

-- Comment for documentation
COMMENT ON COLUMN public.transactions.financial_type IS 'Classificação financeira: fixa, variavel_recorrente, variavel_programada';