import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { format } from "date-fns";

export type ReportBasis = "cash" | "accrual";

export interface DREItem {
  category_id: string | null;
  category_name: string;
  category_color: string;
  total: number;
  transactions: Array<{
    id: string;
    description: string | null;
    amount: number;
    date: string;
    category_id: string | null;
    [key: string]: any;
  }>;
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

function buildBaseQuery(
  supabaseClient: typeof supabase,
  startStr: string,
  endStr: string,
  basis: ReportBasis,
  orgFilter: { type: string; ids: string[] },
  costCenterId?: string
) {
  let query = supabaseClient
    .from("transactions")
    .select(`
      id,
      description,
      amount,
      type,
      date,
      accrual_date,
      category_id,
      account_id,
      cost_center_id,
      status,
      is_ignored,
      validation_status,
      categories (
        name,
        color
      ),
      accounts (id, name)
    `)
    .neq("is_ignored", true)
    .in("validation_status", ["validated", "pending_validation"])
    .in("type", ["income", "expense", "investment", "redemption"]);

  if (basis === "cash") {
    query = query.gte("date", startStr).lte("date", endStr);
  } else {
    query = query.or(
      `and(accrual_date.gte.${startStr},accrual_date.lte.${endStr}),and(accrual_date.is.null,date.gte.${startStr},date.lte.${endStr})`
    );
  }

  if (orgFilter.type === "single") {
    query = query.eq("organization_id", orgFilter.ids[0]);
  } else if (orgFilter.type === "multiple" && orgFilter.ids.length > 0) {
    query = query.in("organization_id", orgFilter.ids);
  }

  if (costCenterId) {
    query = query.eq("cost_center_id", costCenterId);
  }

  return query;
}

export function useDREReport(startDate: Date, endDate: Date, basis: ReportBasis, costCenterId?: string) {
  const { user } = useAuth();
  const { getOrganizationFilter } = useBaseFilter();
  const orgFilter = getOrganizationFilter();
  const startStr = format(startDate, "yyyy-MM-dd");
  const endStr = format(endDate, "yyyy-MM-dd");

  return useQuery({
    queryKey: ["dre-report", user?.id, orgFilter.type, orgFilter.ids, startStr, endStr, basis, costCenterId],
    queryFn: async (): Promise<DREData> => {
      const query = buildBaseQuery(supabase, startStr, endStr, basis, orgFilter, costCenterId);
      const { data: transactions, error } = await query;
      if (error) throw error;

      let grossRevenue = 0;
      let deductions = 0;
      let investments = 0;
      let redemptions = 0;
      const expenseMap = new Map<string, DREItem>();

      transactions?.forEach((tx) => {
        const amount = Number(tx.amount);
        const categoryName = (tx.categories as any)?.name || "Sem categoria";
        const categoryColor = (tx.categories as any)?.color || "#6b7280";
        const mapKey = tx.category_id ?? "__sem_categoria__";

        switch (tx.type) {
          case "income":
            grossRevenue += amount;
            break;
          case "expense": {
            const existing = expenseMap.get(mapKey);
            if (existing) {
              existing.total += amount;
              existing.transactions.push({ ...tx, amount });
            } else {
              expenseMap.set(mapKey, {
                category_id: tx.category_id,
                category_name: categoryName,
                category_color: categoryColor,
                total: amount,
                transactions: [{ ...tx, amount }],
              });
            }
            break;
          }
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
