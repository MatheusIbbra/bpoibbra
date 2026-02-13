-- Clean up duplicate open_finance_items: keep only the latest per (organization_id, institution_name)
DELETE FROM open_finance_accounts
WHERE item_id IN (
  SELECT id FROM open_finance_items
  WHERE id NOT IN (
    SELECT DISTINCT ON (organization_id, institution_name) id
    FROM open_finance_items
    ORDER BY organization_id, institution_name, updated_at DESC
  )
);

DELETE FROM open_finance_sync_logs
WHERE item_id IN (
  SELECT id FROM open_finance_items
  WHERE id NOT IN (
    SELECT DISTINCT ON (organization_id, institution_name) id
    FROM open_finance_items
    ORDER BY organization_id, institution_name, updated_at DESC
  )
);

DELETE FROM open_finance_items
WHERE id NOT IN (
  SELECT DISTINCT ON (organization_id, institution_name) id
  FROM open_finance_items
  ORDER BY organization_id, institution_name, updated_at DESC
);

-- Clean up duplicate open_finance_accounts within same item: keep latest per (item_id, name, account_type)
DELETE FROM open_finance_accounts
WHERE id NOT IN (
  SELECT DISTINCT ON (item_id, name, account_type) id
  FROM open_finance_accounts
  ORDER BY item_id, name, account_type, updated_at DESC
);

-- Add unique constraint to prevent future duplicates on open_finance_items by institution
CREATE UNIQUE INDEX IF NOT EXISTS idx_of_items_org_institution 
ON open_finance_items (organization_id, institution_name);

-- Add unique constraint on open_finance_accounts by item + name + type
CREATE UNIQUE INDEX IF NOT EXISTS idx_of_accounts_item_name_type 
ON open_finance_accounts (item_id, name, account_type);