import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { format } from "date-fns";

interface CategoryDetail {
  category_id: string | null;
  category_name: string;
  category_color: string;
  total: number;
  count: number;
  percentage: number;
  transactions: Array<{
    id: string;
    description: string | null;
    amount: number;
    date: string;
    account_name: string | null;
    [key: string]: any;
  }>;
}

export interface CategoryAnalysisData {
  totalIncome: number;
  totalExpense: number;
  incomeCategories: CategoryDetail[];
  expenseCategories: CategoryDetail[];
}

export function useCategoryAnalysisReport(
  startDate: Date,
  endDate: Date,
  costCenterId?: string
) {
  const { user } = useAuth();
  const { getOrganizationFilter } = useBaseFilter();
  const orgFilter = getOrganizationFilter();
  const startStr = format(startDate, "yyyy-MM-dd");
  const endStr = format(endDate, "yyyy-MM-dd");

  return useQuery({
    queryKey: ["category-analysis", user?.id, orgFilter.type, orgFilter.ids, startStr, endStr, costCenterId],
    queryFn: async (): Promise<CategoryAnalysisData> => {
      let query = supabase
        .from("transactions")
        .select(`
          id, description, amount, type, date, status, notes,
          category_id, account_id, cost_center_id,
          bank_connection_id, is_ignored, validation_status,
          accrual_date, due_date, payment_date, payment_method,
          paid_amount, raw_description, linked_transaction_id,
          category_id,
          categories (name, color),
          accounts (id, name, bank_name)
        `)
        .gte("date", startStr)
        .lte("date", endStr)
        .neq("is_ignored", true)
        .eq("status", "completed")
        .in("type", ["income", "expense"])
        .order("date", { ascending: false });

      if (orgFilter.type === "single") {
        query = query.eq("organization_id", orgFilter.ids[0]);
      } else if (orgFilter.type === "multiple" && orgFilter.ids.length > 0) {
        query = query.in("organization_id", orgFilter.ids);
      }

      if (costCenterId) {
        query = query.eq("cost_center_id", costCenterId);
      }

      const { data: transactions, error } = await query;
      if (error) throw error;

      let totalIncome = 0;
      let totalExpense = 0;
      const incomeMap = new Map<string | null, CategoryDetail>();
      const expenseMap = new Map<string | null, CategoryDetail>();

      (transactions || []).forEach((tx: any) => {
        const catName = tx.categories?.name || "Sem categoria";
        const catColor = tx.categories?.color || "#6366f1";
        const amount = Number(tx.amount);
        const map = tx.type === "income" ? incomeMap : expenseMap;

        if (tx.type === "income") totalIncome += amount;
        else totalExpense += amount;

        const existing = map.get(tx.category_id);
        const txDetail = {
          ...tx,
          amount,
          account_name: tx.accounts?.name || null,
        };

        if (existing) {
          existing.total += amount;
          existing.count += 1;
          existing.transactions.push(txDetail);
        } else {
          map.set(tx.category_id, {
            category_id: tx.category_id,
            category_name: catName,
            category_color: catColor,
            total: amount,
            count: 1,
            percentage: 0,
            transactions: [txDetail],
          });
        }
      });

      const incomeCategories = Array.from(incomeMap.values())
        .map(c => ({ ...c, percentage: totalIncome > 0 ? (c.total / totalIncome) * 100 : 0 }))
        .sort((a, b) => b.total - a.total);

      const expenseCategories = Array.from(expenseMap.values())
        .map(c => ({ ...c, percentage: totalExpense > 0 ? (c.total / totalExpense) * 100 : 0 }))
        .sort((a, b) => b.total - a.total);

      return { totalIncome, totalExpense, incomeCategories, expenseCategories };
    },
    enabled: !!user,
  });
}
