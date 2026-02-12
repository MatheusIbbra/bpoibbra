import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { format, eachMonthOfInterval } from "date-fns";

export interface FinancialTypeSummary {
  financial_type: string;
  label: string;
  totalIncome: number;
  totalExpense: number;
  total: number;
  percentage: number;
  count: number;
}

export interface FinancialTypeMonthly {
  month: string;
  fixa_income: number;
  fixa_expense: number;
  variavel_recorrente_income: number;
  variavel_recorrente_expense: number;
  variavel_programada_income: number;
  variavel_programada_expense: number;
}

interface FinancialTypeReportData {
  summaries: FinancialTypeSummary[];
  incomeSummaries: FinancialTypeSummary[];
  expenseSummaries: FinancialTypeSummary[];
  monthlyData: FinancialTypeMonthly[];
  totalIncome: number;
  totalExpense: number;
}

const LABELS: Record<string, string> = {
  fixa: "Fixa",
  variavel_recorrente: "Variável Recorrente",
  variavel_programada: "Variável Programada",
};

export function useFinancialTypeReport(startDate: Date, endDate: Date) {
  const { user } = useAuth();
  const { getOrganizationFilter } = useBaseFilter();
  const orgFilter = getOrganizationFilter();
  const startStr = format(startDate, "yyyy-MM-dd");
  const endStr = format(endDate, "yyyy-MM-dd");

  return useQuery({
    queryKey: ["financial-type-report", user?.id, orgFilter.type, orgFilter.ids, startStr, endStr],
    queryFn: async (): Promise<FinancialTypeReportData> => {
      let query = supabase
        .from("transactions")
        .select("id, amount, type, date, financial_type")
        .neq("is_ignored", true)
        .gte("date", startStr)
        .lte("date", endStr)
        .not("financial_type", "is", null);

      if (orgFilter.type === 'single') {
        query = query.eq("organization_id", orgFilter.ids[0]);
      } else if (orgFilter.type === 'multiple' && orgFilter.ids.length > 0) {
        query = query.in("organization_id", orgFilter.ids);
      }

      const { data: transactions, error } = await query;
      if (error) throw error;

      let totalIncome = 0;
      let totalExpense = 0;
      const incomeMap = new Map<string, { total: number; count: number }>();
      const expenseMap = new Map<string, { total: number; count: number }>();

      // Monthly data
      const months = eachMonthOfInterval({ start: startDate, end: endDate });
      const monthlyMap = new Map<string, FinancialTypeMonthly>();
      months.forEach(m => {
        const key = format(m, "yyyy-MM");
        monthlyMap.set(key, {
          month: format(m, "MMM/yy"),
          fixa_income: 0, fixa_expense: 0,
          variavel_recorrente_income: 0, variavel_recorrente_expense: 0,
          variavel_programada_income: 0, variavel_programada_expense: 0,
        });
      });

      transactions?.forEach(tx => {
        const ft = tx.financial_type as string;
        const amount = Number(tx.amount);
        const monthKey = tx.date.substring(0, 7);
        const monthData = monthlyMap.get(monthKey);

        if (tx.type === "income" || tx.type === "redemption") {
          totalIncome += amount;
          const existing = incomeMap.get(ft) || { total: 0, count: 0 };
          existing.total += amount;
          existing.count += 1;
          incomeMap.set(ft, existing);
          if (monthData) {
            const key = `${ft}_income` as keyof FinancialTypeMonthly;
            (monthData[key] as number) += amount;
          }
        } else if (tx.type === "expense" || tx.type === "investment") {
          totalExpense += amount;
          const existing = expenseMap.get(ft) || { total: 0, count: 0 };
          existing.total += amount;
          existing.count += 1;
          expenseMap.set(ft, existing);
          if (monthData) {
            const key = `${ft}_expense` as keyof FinancialTypeMonthly;
            (monthData[key] as number) += amount;
          }
        }
      });

      const buildSummaries = (map: Map<string, { total: number; count: number }>, grandTotal: number): FinancialTypeSummary[] => {
        return ["fixa", "variavel_recorrente", "variavel_programada"].map(ft => {
          const data = map.get(ft) || { total: 0, count: 0 };
          return {
            financial_type: ft,
            label: LABELS[ft] || ft,
            totalIncome: 0,
            totalExpense: 0,
            total: data.total,
            percentage: grandTotal > 0 ? (data.total / grandTotal) * 100 : 0,
            count: data.count,
          };
        });
      };

      return {
        summaries: [],
        incomeSummaries: buildSummaries(incomeMap, totalIncome),
        expenseSummaries: buildSummaries(expenseMap, totalExpense),
        monthlyData: Array.from(monthlyMap.values()),
        totalIncome,
        totalExpense,
      };
    },
    enabled: !!user,
  });
}
