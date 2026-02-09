import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { format } from "date-fns";

export type ReportBasis = "cash" | "accrual";

interface DREItem {
  category_id: string | null;
  category_name: string;
  category_color: string;
  total: number;
}

interface DREData {
  grossRevenue: number;
  deductions: number;
  netRevenue: number;
  operatingExpenses: DREItem[];
  totalOperatingExpenses: number;
  operatingIncome: number;
  investments: number;
  redemptions: number;
  financialResult: number;
  netIncome: number;
}

export function useDREReport(startDate: Date, endDate: Date, basis: ReportBasis) {
  const { user } = useAuth();
  const { getOrganizationFilter } = useBaseFilter();
  const orgFilter = getOrganizationFilter();
  const dateField = basis === "cash" ? "date" : "accrual_date";

  return useQuery({
    queryKey: ["dre-report", user?.id, orgFilter.type, orgFilter.ids, format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd"), basis],
    queryFn: async (): Promise<DREData> => {
      // Get all transactions for the period
      let query = supabase
        .from("transactions")
        .select(`
          id,
          description,
          amount,
          type,
          date,
          category_id,
          categories (
            name,
            color
          )
        `)
        .gte(dateField, format(startDate, "yyyy-MM-dd"))
        .lte(dateField, format(endDate, "yyyy-MM-dd"))
        .neq("is_ignored", true);

      // Aplicar filtro de organização
      if (orgFilter.type === 'single') {
        query = query.eq("organization_id", orgFilter.ids[0]);
      } else if (orgFilter.type === 'multiple' && orgFilter.ids.length > 0) {
        query = query.in("organization_id", orgFilter.ids);
      }

      const { data: transactions, error } = await query;

      if (error) throw error;

      let grossRevenue = 0;
      let deductions = 0;
      let investments = 0;
      let redemptions = 0;
      const expenseMap = new Map<string | null, DREItem>();

      transactions?.forEach((tx) => {
        const amount = Number(tx.amount);
        const categoryName = (tx.categories as any)?.name || "Sem categoria";
        const categoryColor = (tx.categories as any)?.color || "#6366f1";

        switch (tx.type) {
          case "income":
            grossRevenue += amount;
            break;
          case "expense":
            const existing = expenseMap.get(tx.category_id);
            if (existing) {
              existing.total += amount;
            } else {
              expenseMap.set(tx.category_id, {
                category_id: tx.category_id,
                category_name: categoryName,
                category_color: categoryColor,
                total: amount,
              });
            }
            break;
          case "investment":
            investments += amount;
            break;
          case "redemption":
            redemptions += amount;
            break;
        }
      });

      const operatingExpenses = Array.from(expenseMap.values()).sort((a, b) => b.total - a.total);
      const totalOperatingExpenses = operatingExpenses.reduce((sum, exp) => sum + exp.total, 0);
      const netRevenue = grossRevenue - deductions;
      const operatingIncome = netRevenue - totalOperatingExpenses;
      const financialResult = redemptions - investments;
      const netIncome = operatingIncome + financialResult;

      return {
        grossRevenue,
        deductions,
        netRevenue,
        operatingExpenses,
        totalOperatingExpenses,
        operatingIncome,
        investments,
        redemptions,
        financialResult,
        netIncome,
      };
    },
    enabled: !!user,
  });
}
