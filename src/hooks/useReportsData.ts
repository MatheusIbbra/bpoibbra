import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { format } from "date-fns";

export type ReportBasis = "cash" | "accrual";

interface CategorySummary {
  category_id: string | null;
  category_name: string;
  category_color: string;
  total: number;
  count: number;
  percentage: number;
}

interface ReportData {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  incomeByCategory: CategorySummary[];
  expenseByCategory: CategorySummary[];
  transactions: Array<{
    id: string;
    description: string;
    amount: number;
    type: string;
    date: string;
    category_name: string | null;
  }>;
}

export function useReportsData(startDate: Date, endDate: Date, basis: ReportBasis = "cash") {
  const { user } = useAuth();
  const { getOrganizationFilter } = useBaseFilter();
  const orgFilter = getOrganizationFilter();
  const dateField = basis === "cash" ? "date" : "accrual_date";

  return useQuery({
    queryKey: ["reports-data", user?.id, orgFilter.type, orgFilter.ids, format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd"), basis],
    queryFn: async (): Promise<ReportData> => {
      let query = supabase
        .from("transactions")
        .select(`
          id,
          description,
          amount,
          type,
          date,
          accrual_date,
          category_id,
          categories (
            name,
            color
          )
        `)
        .gte(dateField, format(startDate, "yyyy-MM-dd"))
        .lte(dateField, format(endDate, "yyyy-MM-dd"))
        .neq("is_ignored", true)
        .order("date", { ascending: false });

      // Aplicar filtro de organização
      if (orgFilter.type === 'single') {
        query = query.eq("organization_id", orgFilter.ids[0]);
      } else if (orgFilter.type === 'multiple' && orgFilter.ids.length > 0) {
        query = query.in("organization_id", orgFilter.ids);
      }

      const { data: transactions, error } = await query;

      if (error) throw error;

      let totalIncome = 0;
      let totalExpense = 0;
      const incomeMap = new Map<string | null, CategorySummary>();
      const expenseMap = new Map<string | null, CategorySummary>();

      transactions?.forEach((tx) => {
        const categoryName = (tx.categories as any)?.name || "Sem categoria";
        const categoryColor = (tx.categories as any)?.color || "#6366f1";
        const amount = Number(tx.amount);

        if (tx.type === "income" || tx.type === "redemption") {
          totalIncome += amount;
          const existing = incomeMap.get(tx.category_id);
          if (existing) {
            existing.total += amount;
            existing.count += 1;
          } else {
            incomeMap.set(tx.category_id, {
              category_id: tx.category_id,
              category_name: categoryName,
              category_color: categoryColor,
              total: amount,
              count: 1,
              percentage: 0,
            });
          }
        } else if (tx.type === "expense" || tx.type === "investment") {
          totalExpense += amount;
          const existing = expenseMap.get(tx.category_id);
          if (existing) {
            existing.total += amount;
            existing.count += 1;
          } else {
            expenseMap.set(tx.category_id, {
              category_id: tx.category_id,
              category_name: categoryName,
              category_color: categoryColor,
              total: amount,
              count: 1,
              percentage: 0,
            });
          }
        }
      });

      // Calculate percentages
      const incomeByCategory = Array.from(incomeMap.values())
        .map((c) => ({ ...c, percentage: totalIncome > 0 ? (c.total / totalIncome) * 100 : 0 }))
        .sort((a, b) => b.total - a.total);

      const expenseByCategory = Array.from(expenseMap.values())
        .map((c) => ({ ...c, percentage: totalExpense > 0 ? (c.total / totalExpense) * 100 : 0 }))
        .sort((a, b) => b.total - a.total);

      const formattedTransactions = transactions?.map((tx) => ({
        id: tx.id,
        description: tx.description,
        amount: Number(tx.amount),
        type: tx.type,
        date: tx.date,
        category_name: (tx.categories as any)?.name || null,
      })) || [];

      return {
        totalIncome,
        totalExpense,
        balance: totalIncome - totalExpense,
        incomeByCategory,
        expenseByCategory,
        transactions: formattedTransactions,
      };
    },
    enabled: !!user,
  });
}
