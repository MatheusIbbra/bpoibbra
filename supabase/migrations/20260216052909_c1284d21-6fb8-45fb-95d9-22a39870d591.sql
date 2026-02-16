
-- Insert the missing expense transaction for the R$136 PIX
INSERT INTO transactions (
  organization_id, account_id, external_transaction_id, date, description, amount, type, status, notes, user_id
) VALUES (
  'ef201128-45d8-45b2-a78a-46d1e3c0caf7',
  '4b5788b3-d360-4d86-b092-a4e4c89c347d',
  '74c09be2-ea4d-44b1-b7d4-c105b209ae58',
  '2026-02-13',
  'PIX TRANSF Matheus13/02',
  136.00,
  'expense',
  'completed',
  'Importado via Open Finance (correção manual - dedup falso positivo)',
  '8907cf00-59bf-4080-8f40-7b2a0f723ded'
);
