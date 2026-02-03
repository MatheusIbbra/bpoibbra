import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { format } from "date-fns";

export interface BudgetAnalysisItem {
  category_id: string;
  category_name: string;
  category_color: string;
  category_icon: string;
  cost_center_id: string | null;
  cost_center_name: string | null;
  budget_amount: number;
  actual_amount: number;
  variance: number;
  variance_percentage: number;
  status: "under" | "on_track" | "warning" | "over";
}

export interface BudgetAnalysisData {
  items: BudgetAnalysisItem[];
  totalBudget: number;
  totalActual: number;
  totalVariance: number;
  overBudgetCount: number;
  warningCount: number;
}

export function useBudgetAnalysis(month?: number, year?: number) {
  const { user } = useAuth();
  const { getOrganizationFilter } = useBaseFilter();
  const orgFilter = getOrganizationFilter();
  const currentDate = new Date();
  const targetMonth = month ?? currentDate.getMonth() + 1;
  const targetYear = year ?? currentDate.getFullYear();

  const startDate = `${targetYear}-${String(targetMonth).padStart(2, "0")}-01`;
  const lastDay = new Date(targetYear, targetMonth, 0).getDate();
  const endDate = `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  return useQuery({
    queryKey: ["budget-analysis", user?.id, orgFilter.type, orgFilter.ids, targetMonth, targetYear],
    queryFn: async (): Promise<BudgetAnalysisData> => {
      // Fetch budgets with categories and cost centers
      let budgetsQuery = supabase
        .from("budgets")
        .select(`
          id,
          category_id,
          cost_center_id,
          amount,
          categories (
            id,
            name,
            color,
            icon
          ),
          cost_centers (
            id,
            name
          )
        `)
        .eq("month", targetMonth)
        .eq("year", targetYear);

      // Aplicar filtro de organização
      if (orgFilter.type === 'single') {
        budgetsQuery = budgetsQuery.eq("organization_id", orgFilter.ids[0]);
      } else if (orgFilter.type === 'multiple' && orgFilter.ids.length > 0) {
        budgetsQuery = budgetsQuery.in("organization_id", orgFilter.ids);
      }

      const { data: budgets, error: budgetsError } = await budgetsQuery;

      if (budgetsError) throw budgetsError;

      // Fetch actual expenses for the period
      let transactionsQuery = supabase
        .from("transactions")
        .select("category_id, cost_center_id, amount")
        .eq("type", "expense")
        .gte("date", startDate)
        .lte("date", endDate);

      // Aplicar filtro de organização
      if (orgFilter.type === 'single') {
        transactionsQuery = transactionsQuery.eq("organization_id", orgFilter.ids[0]);
      } else if (orgFilter.type === 'multiple' && orgFilter.ids.length > 0) {
        transactionsQuery = transactionsQuery.in("organization_id", orgFilter.ids);
      }

      const { data: transactions, error: transactionsError } = await transactionsQuery;

      if (transactionsError) throw transactionsError;

      // Calculate actuals per category
      const actualsByCategory = new Map<string, number>();
      transactions?.forEach((tx) => {
        const key = tx.category_id || "uncategorized";
        actualsByCategory.set(key, (actualsByCategory.get(key) || 0) + Number(tx.amount));
      });

      // Build analysis items
      const items: BudgetAnalysisItem[] = (budgets || []).map((budget) => {
        const category = budget.categories as any;
        const costCenter = budget.cost_centers as any;
        const budgetAmount = Number(budget.amount);
        const actualAmount = actualsByCategory.get(budget.category_id) || 0;
        const variance = budgetAmount - actualAmount;
        const variancePercentage = budgetAmount > 0 ? (actualAmount / budgetAmount) * 100 : 0;

        let status: BudgetAnalysisItem["status"];
        if (variancePercentage >= 100) {
          status = "over";
        } else if (variancePercentage >= 80) {
          status = "warning";
        } else if (variancePercentage >= 50) {
          status = "on_track";
        } else {
          status = "under";
        }

        return {
          category_id: budget.category_id,
          category_name: category?.name || "Sem categoria",
          category_color: category?.color || "#6366f1",
          category_icon: category?.icon || "circle",
          cost_center_id: budget.cost_center_id,
          cost_center_name: costCenter?.name || null,
          budget_amount: budgetAmount,
          actual_amount: actualAmount,
          variance,
          variance_percentage: variancePercentage,
          status,
        };
      });

      const totalBudget = items.reduce((acc, item) => acc + item.budget_amount, 0);
      const totalActual = items.reduce((acc, item) => acc + item.actual_amount, 0);
      const totalVariance = totalBudget - totalActual;
      const overBudgetCount = items.filter((item) => item.status === "over").length;
      const warningCount = items.filter((item) => item.status === "warning").length;

      return {
        items: items.sort((a, b) => b.variance_percentage - a.variance_percentage),
        totalBudget,
        totalActual,
        totalVariance,
        overBudgetCount,
        warningCount,
      };
    },
    enabled: !!user,
  });
}
