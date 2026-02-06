import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfMonth, endOfMonth, subMonths, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface CreditCardInvoice {
  month: number;
  year: number;
  label: string;
  totalPurchases: number;
  totalPayments: number;
  balance: number;
  status: "paid" | "partial" | "open";
  transactions: CreditCardTransaction[];
}

export interface CreditCardTransaction {
  id: string;
  description: string | null;
  amount: number;
  date: string;
  type: string;
  category_name: string | null;
  category_icon: string | null;
  category_color: string | null;
  status: string | null;
}

export interface CreditCardAccountInfo {
  id: string;
  name: string;
  bankName: string | null;
  currentBalance: number;
  bankLogo: string | null;
  availableCredit: number | null;
  totalLimit: number | null;
}

export function useCreditCardDetails(accountId: string | undefined) {
  const { user } = useAuth();

  const accountQuery = useQuery({
    queryKey: ["credit-card-account", accountId],
    queryFn: async (): Promise<CreditCardAccountInfo | null> => {
      if (!accountId) return null;

      const { data: account, error } = await supabase
        .from("accounts")
        .select("id, name, bank_name, current_balance")
        .eq("id", accountId)
        .eq("account_type", "credit_card")
        .single();

      if (error || !account) return null;

      // Try to get bank logo from bank_connections metadata
      let bankLogo: string | null = null;
      let availableCredit: number | null = null;
      let totalLimit: number | null = null;

      if (account.bank_name) {
        const { data: connections } = await supabase
          .from("bank_connections")
          .select("metadata")
          .eq("status", "active");

        connections?.forEach((conn) => {
          const meta = conn.metadata as any;
          if (meta?.bank_name === account.bank_name && meta?.bank_logo_url) {
            bankLogo = meta.bank_logo_url;
          }
          // Check pluggy_accounts for available credit info
          const pluggyAccounts = meta?.pluggy_accounts || [];
          pluggyAccounts.forEach((pa: any) => {
            if (pa.name === account.name || pa.type?.toUpperCase() === "CREDIT") {
              if (pa.available_balance != null) {
                availableCredit = pa.available_balance;
              }
            }
          });
        });
      }

      // CREDIT CARD RULE: current_balance is always treated as debt (absolute negative)
      const debt = Math.abs(Number(account.current_balance) || 0);
      if (availableCredit != null) {
        totalLimit = debt + availableCredit;
      }

      return {
        id: account.id,
        name: account.name,
        bankName: account.bank_name,
        currentBalance: -debt, // Always negative (liability)
        bankLogo,
        availableCredit,
        totalLimit,
      };
    },
    enabled: !!user && !!accountId,
  });

  const invoicesQuery = useQuery({
    queryKey: ["credit-card-invoices", accountId],
    queryFn: async (): Promise<CreditCardInvoice[]> => {
      if (!accountId) return [];

      // Get last 12 months of transactions for this card
      const now = new Date();
      const twelveMonthsAgo = subMonths(startOfMonth(now), 11);

      const { data: transactions, error } = await supabase
        .from("transactions")
        .select(`
          id, description, amount, date, type, status,
          categories (name, icon, color)
        `)
        .eq("account_id", accountId)
        .gte("date", format(twelveMonthsAgo, "yyyy-MM-dd"))
        .order("date", { ascending: false });

      if (error) throw error;
      if (!transactions) return [];

      // Group by month/year
      const monthMap = new Map<string, CreditCardTransaction[]>();

      transactions.forEach((tx) => {
        const txDate = parseISO(tx.date);
        const key = format(txDate, "yyyy-MM");
        const existing = monthMap.get(key) || [];
        existing.push({
          id: tx.id,
          description: tx.description,
          amount: Number(tx.amount),
          date: tx.date,
          type: tx.type,
          category_name: (tx.categories as any)?.name || null,
          category_icon: (tx.categories as any)?.icon || null,
          category_color: (tx.categories as any)?.color || null,
          status: tx.status,
        });
        monthMap.set(key, existing);
      });

      // Build invoices sorted by most recent first
      const invoices: CreditCardInvoice[] = [];
      const sortedKeys = Array.from(monthMap.keys()).sort((a, b) => b.localeCompare(a));

      sortedKeys.forEach((key) => {
        const [yearStr, monthStr] = key.split("-");
        const year = parseInt(yearStr);
        const month = parseInt(monthStr);
        const txs = monthMap.get(key) || [];

        const refDate = new Date(year, month - 1, 1);
        const label = format(refDate, "MMMM yyyy", { locale: ptBR });

        let totalPurchases = 0;
        let totalPayments = 0;

        txs.forEach((tx) => {
          if (tx.type === "expense") {
            totalPurchases += tx.amount;
          } else if (tx.type === "income" || tx.type === "transfer") {
            totalPayments += tx.amount;
          }
        });

        const balance = totalPurchases - totalPayments;
        let status: "paid" | "partial" | "open" = "open";
        if (balance <= 0) {
          status = "paid";
        } else if (totalPayments > 0) {
          status = "partial";
        }

        invoices.push({
          month,
          year,
          label: label.charAt(0).toUpperCase() + label.slice(1),
          totalPurchases,
          totalPayments,
          balance: Math.max(0, balance),
          status,
          transactions: txs,
        });
      });

      return invoices;
    },
    enabled: !!user && !!accountId,
  });

  return {
    account: accountQuery.data,
    isLoadingAccount: accountQuery.isLoading,
    invoices: invoicesQuery.data || [],
    isLoadingInvoices: invoicesQuery.isLoading,
  };
}
