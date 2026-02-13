-- Drop the too-aggressive unique index on accounts
DROP INDEX IF EXISTS idx_of_accounts_item_name_type;

-- Use pluggy_account_id within item as the unique key instead
CREATE UNIQUE INDEX IF NOT EXISTS idx_of_accounts_item_pluggy_id 
ON open_finance_accounts (item_id, pluggy_account_id);