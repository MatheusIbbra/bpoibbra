import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";

export interface RecurringExpense {
  description: string;
  category_id: string | null;
  occurrences: number;
  avg_amount: number;
  avg_interval_days: number;
  is_monthly: boolean;
  confidence: number;
  next_due_date: string;
  variation_pct: number;
}

export function useRecurringExpenses() {
  const { user } = useAuth();
  const { getOrganizationFilter } = useBaseFilter();
  const orgFilter = getOrganizationFilter();

  return useQuery({
    queryKey: ["recurring-expenses", user?.id, orgFilter.type, orgFilter.ids],
    queryFn: async (): Promise<RecurringExpense[]> => {
      if (orgFilter.type !== "single" || !orgFilter.ids[0]) return [];
      const orgId = orgFilter.ids[0];

      // Try materialized cache first
      const { data: cached } = await supabase
        .from("materialized_metrics")
        .select("data, expires_at")
        .eq("organization_id", orgId)
        .eq("metric_type", "recurring_expenses")
        .maybeSingle();

      if (cached && new Date(cached.expires_at) > new Date()) {
        return (cached.data as unknown as RecurringExpense[]) || [];
      }

      // Fallback to live RPC
      const { data, error } = await supabase.rpc("detect_recurring_expenses", {
        p_organization_id: orgId,
      });

      if (error) {
        console.error("Error detecting recurring expenses:", error);
        return [];
      }

      return (data as unknown as RecurringExpense[]) || [];
    },
    enabled: !!user && orgFilter.type === "single" && !!orgFilter.ids[0],
    staleTime: 15 * 60 * 1000,
  });
}
