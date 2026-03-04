
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS operation_type text;

UPDATE public.transactions SET operation_type = type::text WHERE operation_type IS NULL;

UPDATE public.transactions AS secondary
SET operation_type = primary_tx.type::text
FROM public.transactions AS primary_tx
WHERE secondary.linked_transaction_id = primary_tx.id
  AND secondary.validation_status = 'rejected'
  AND secondary.is_ignored = true;

CREATE INDEX IF NOT EXISTS idx_transactions_operation_type ON public.transactions(operation_type);
