import { supabase } from "@/integrations/supabase/client";

type OrgFilter =
  | { type: "single"; ids: string[] }
  | { type: "multiple"; ids: string[] }
  | { type: "all"; ids: string[] };

/**
 * Some older accounts may have `initial_balance` filled but no corresponding
 * transaction created ("Saldo inicial - ...").
 *
 * This helper sums those missing initial balances to keep opening/cumulative
 * balances correct, without double-counting accounts that already have the
 * system-generated initial balance transaction.
 */
export async function getLegacyInitialBalanceAdjustment(params: {
  orgFilter: OrgFilter;
  beforeDate: string; // yyyy-MM-dd
  allowedAccountIds?: string[]; // optional filter to restrict to specific accounts
}): Promise<number> {
  const { orgFilter, beforeDate, allowedAccountIds } = params;

  let accountsQuery = supabase
    .from("accounts")
    .select("id, initial_balance, start_date")
    .not("initial_balance", "is", null);

  // If allowedAccountIds provided, restrict to those accounts only
  if (allowedAccountIds && allowedAccountIds.length > 0) {
    accountsQuery = accountsQuery.in("id", allowedAccountIds);
  }

  if (orgFilter.type === "single") {
    accountsQuery = accountsQuery.eq("organization_id", orgFilter.ids[0]);
  } else if (orgFilter.type === "multiple" && orgFilter.ids.length > 0) {
    accountsQuery = accountsQuery.in("organization_id", orgFilter.ids);
  }

  const { data: accounts, error: accountsError } = await accountsQuery;
  if (accountsError) throw accountsError;

  const eligibleAccounts = (accounts || []).filter((a) => {
    const bal = Number(a.initial_balance) || 0;
    if (bal === 0) return false;
    const start = a.start_date ? String(a.start_date) : "0000-01-01";
    // Include balances from accounts that started on or before the report start.
    // Using <= ensures accounts starting on the first day of the report have their
    // initial balance counted in the opening balance.
    return start <= beforeDate;
  });

  if (eligibleAccounts.length === 0) return 0;

  const accountIds = eligibleAccounts.map((a) => a.id);

  // Find which accounts already have the system initial balance transaction.
  let txQuery = supabase
    .from("transactions")
    .select("account_id")
    .in("account_id", accountIds)
    .ilike("description", "Saldo inicial -%")
    .limit(accountIds.length);

  if (orgFilter.type === "single") {
    txQuery = txQuery.eq("organization_id", orgFilter.ids[0]);
  } else if (orgFilter.type === "multiple" && orgFilter.ids.length > 0) {
    txQuery = txQuery.in("organization_id", orgFilter.ids);
  }

  const { data: initialTxs, error: txError } = await txQuery;
  if (txError) throw txError;

  const accountsWithTx = new Set((initialTxs || []).map((t) => t.account_id));

  // Sum initial_balance for accounts missing the initial transaction.
  return eligibleAccounts
    .filter((a) => !accountsWithTx.has(a.id))
    .reduce((sum, a) => sum + (Number(a.initial_balance) || 0), 0);
}
