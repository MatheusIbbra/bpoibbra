-- Clean up orphan bank_connections (no external_account_id) where a real connection exists for same org+provider
DELETE FROM bank_connections 
WHERE provider = 'pluggy' 
  AND external_account_id IS NULL 
  AND organization_id IN (
    SELECT DISTINCT organization_id 
    FROM bank_connections 
    WHERE provider = 'pluggy' AND external_account_id IS NOT NULL
  );

-- Also deduplicate: if same org+provider has multiple connections with same provider_name, keep only the one with external_account_id
DELETE FROM bank_connections b1
WHERE b1.provider = 'pluggy'
  AND b1.external_account_id IS NULL
  AND EXISTS (
    SELECT 1 FROM bank_connections b2 
    WHERE b2.organization_id = b1.organization_id 
      AND b2.provider = 'pluggy' 
      AND b2.external_account_id IS NOT NULL
      AND b2.id != b1.id
  );