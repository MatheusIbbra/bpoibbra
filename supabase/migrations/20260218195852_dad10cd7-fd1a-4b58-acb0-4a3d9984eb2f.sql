UPDATE open_finance_items 
SET status = 'disconnected', 
    updated_at = now(),
    error_message = 'Desconectado manualmente - PERSONAL_BANK não está mais conectado'
WHERE id = '33414158-636a-4766-bab1-c2e42d6ee3c8';