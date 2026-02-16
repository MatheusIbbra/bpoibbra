import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBaseFilter } from "@/contexts/BaseFilterContext";

interface TransactionOutlier {
  transaction_id: string;
  description: string;
  amount: number;
  date: string;
  type: string;
  category: string;
  avg_amount: number;
  z_score: number;
  severity: "critical" | "high" | "moderate";
}

interface DailySpike {
  date: string;
  total: number;
  avg_daily: number;
  z_score: number;
  severity: "critical" | "high" | "moderate";
}

interface AnomalyData {
  transaction_outliers: TransactionOutlier[];
  daily_spikes: DailySpike[];
  generated_at: string;
}

export function useAnomalyDetection() {
  const { selectedOrganizationId } = useBaseFilter();

  return useQuery({
    queryKey: ["anomaly-detection", selectedOrganizationId],
    queryFn: async () => {
      if (!selectedOrganizationId || selectedOrganizationId === "all") return null;

      const { data, error } = await supabase.rpc("detect_transaction_anomalies", {
        p_organization_id: selectedOrganizationId,
        p_lookback_days: 90,
      });

      if (error) {
        console.error("Anomaly detection error:", error);
        return null;
      }

      return data as unknown as AnomalyData;
    },
    enabled: !!selectedOrganizationId && selectedOrganizationId !== "all",
    staleTime: 10 * 60 * 1000,
  });
}
