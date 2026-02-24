-- Clean up orphan XP accounts (no transactions, no open_finance_accounts linked)
DELETE FROM public.account_balance_snapshots WHERE account_id IN ('afbdac0c-facd-4880-9614-83269a9b2d6a', 'fd097142-b104-4aa5-9c4a-bbbe2b380c33');
DELETE FROM public.accounts WHERE id IN ('afbdac0c-facd-4880-9614-83269a9b2d6a', 'fd097142-b104-4aa5-9c4a-bbbe2b380c33');