import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";

export interface PlanData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  max_transactions: number;
  max_ai_requests: number;
  max_bank_connections: number;
  allow_forecast: boolean;
  allow_anomaly_detection: boolean;
  allow_simulator: boolean;
  allow_benchmarking: boolean;
}

export interface SubscriptionData {
  id: string;
  organization_id: string;
  plan_id: string;
  status: string;
  started_at: string;
  expires_at: string | null;
  plan?: PlanData;
}

export function useSubscription() {
  const { user } = useAuth();
  const { getOrganizationFilter } = useBaseFilter();
  const orgFilter = getOrganizationFilter();

  const subscriptionQuery = useQuery({
    queryKey: ["subscription", user?.id, orgFilter.type, orgFilter.ids],
    queryFn: async (): Promise<SubscriptionData | null> => {
      if (orgFilter.type !== "single" || !orgFilter.ids[0]) return null;

      const { data, error } = await supabase
        .from("organization_subscriptions")
        .select("*, plans(*)")
        .eq("organization_id", orgFilter.ids[0])
        .eq("status", "active")
        .maybeSingle();

      if (error) {
        console.error("Error fetching subscription:", error);
        return null;
      }

      if (!data) return null;

      return {
        ...data,
        plan: (data as any).plans as PlanData,
      } as SubscriptionData;
    },
    enabled: !!user && orgFilter.type === "single" && !!orgFilter.ids[0],
  });

  const plansQuery = useQuery({
    queryKey: ["plans"],
    queryFn: async (): Promise<PlanData[]> => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");

      if (error) throw error;
      return (data || []) as unknown as PlanData[];
    },
    enabled: !!user,
  });

  return {
    subscription: subscriptionQuery.data,
    plans: plansQuery.data || [],
    isLoading: subscriptionQuery.isLoading || plansQuery.isLoading,
    currentPlan: subscriptionQuery.data?.plan || null,
  };
}
