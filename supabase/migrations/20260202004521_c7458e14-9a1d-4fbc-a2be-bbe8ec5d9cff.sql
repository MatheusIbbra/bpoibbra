-- Add new fields to transactions table for complete financial tracking
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS paid_amount numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS payment_method text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS due_date date DEFAULT NULL,
ADD COLUMN IF NOT EXISTS payment_date date DEFAULT NULL;

-- Add comments to document the fields
COMMENT ON COLUMN public.transactions.paid_amount IS 'Amount actually paid (may differ from amount due to discounts/interest)';
COMMENT ON COLUMN public.transactions.payment_method IS 'Payment method: pix, transfer, boleto, credit_card, debit_card, cash, etc.';
COMMENT ON COLUMN public.transactions.due_date IS 'Due date for the transaction';
COMMENT ON COLUMN public.transactions.payment_date IS 'Actual payment date';
COMMENT ON COLUMN public.transactions.accrual_date IS 'Accrual/competence date for the transaction';