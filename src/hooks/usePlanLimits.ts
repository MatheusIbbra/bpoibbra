import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { useSubscription } from "./useSubscription";
import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";

export interface PlanUsage {
  transactionsUsed: number;
  transactionsLimit: number;
  transactionsPercent: number;
  aiRequestsUsed: number;
  aiRequestsLimit: number;
  aiRequestsPercent: number;
  bankConnectionsUsed: number;
  bankConnectionsLimit: number;
  bankConnectionsPercent: number;
  isOverTransactions: boolean;
  isOverAI: boolean;
  isOverConnections: boolean;
  allowForecast: boolean;
  allowSimulator: boolean;
  allowAnomalyDetection: boolean;
  planName: string;
}

const DEFAULT_FREE_LIMITS = {
  max_transactions: 1000,
  max_ai_requests: 0,
  max_bank_connections: 20,
  allow_forecast: false,
  allow_simulator: false,
  allow_anomaly_detection: false,
};

export function usePlanLimits() {
  const { user } = useAuth();
  const { selectedOrganizationId } = useBaseFilter();
  const { currentPlan } = useSubscription();

  const usageQuery = useQuery({
    queryKey: ["plan-usage", user?.id, selectedOrganizationId],
    queryFn: async (): Promise<PlanUsage> => {
      const plan = currentPlan || DEFAULT_FREE_LIMITS;
      const planName = currentPlan?.name || "Starter";

      const now = new Date();
      const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

      // Count transactions this month
      let txQuery = supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .gte("created_at", startOfMonth);

      if (selectedOrganizationId && selectedOrganizationId !== "all") {
        txQuery = txQuery.eq("organization_id", selectedOrganizationId);
      }

      // Count AI requests this month
      let aiQuery = supabase
        .from("api_usage_logs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", startOfMonth)
        .eq("endpoint", "ai");

      if (selectedOrganizationId && selectedOrganizationId !== "all") {
        aiQuery = aiQuery.eq("organization_id", selectedOrganizationId);
      }

      // Count active bank connections
      let connQuery = supabase
        .from("bank_connections")
        .select("id", { count: "exact", head: true })
        .eq("status", "active");

      if (selectedOrganizationId && selectedOrganizationId !== "all") {
        connQuery = connQuery.eq("organization_id", selectedOrganizationId);
      }

      // Parallel execution — up to 3x faster
      const [
        { count: txCount },
        { count: aiCount },
        { count: connCount },
      ] = await Promise.all([txQuery, aiQuery, connQuery]);

      const transactionsUsed = txCount || 0;
      const aiRequestsUsed = aiCount || 0;
      const bankConnectionsUsed = connCount || 0;

      const maxTx = plan.max_transactions;
      const maxAI = plan.max_ai_requests;
      const maxConn = plan.max_bank_connections;

      return {
        transactionsUsed,
        transactionsLimit: maxTx,
        transactionsPercent: maxTx > 0 ? (transactionsUsed / maxTx) * 100 : 0,
        aiRequestsUsed,
        aiRequestsLimit: maxAI,
        aiRequestsPercent: maxAI > 0 ? (aiRequestsUsed / maxAI) * 100 : 0,
        bankConnectionsUsed,
        bankConnectionsLimit: maxConn,
        bankConnectionsPercent: maxConn > 0 ? (bankConnectionsUsed / maxConn) * 100 : 0,
        isOverTransactions: transactionsUsed >= maxTx,
        isOverAI: aiRequestsUsed >= maxAI,
        isOverConnections: bankConnectionsUsed >= maxConn,
        allowForecast: (plan as Record<string, unknown>).allow_forecast as boolean ?? false,
        allowSimulator: (plan as Record<string, unknown>).allow_simulator as boolean ?? false,
        allowAnomalyDetection: (plan as Record<string, unknown>).allow_anomaly_detection as boolean ?? false,
        planName,
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  // Proactive warning at 80% of transaction limit
  const warnedRef = useRef(false);
  useEffect(() => {
    if (!usageQuery.data || warnedRef.current) return;
    const { transactionsPercent, planName } = usageQuery.data;
    if (transactionsPercent >= 80 && transactionsPercent < 100) {
      warnedRef.current = true;
      trackEvent("plan_limit_warning", { percent: transactionsPercent, plan: planName });
      toast.warning(`Atenção: ${Math.round(transactionsPercent)}% das transações usadas`, {
        description: `Você está próximo do limite do plano ${planName}. Considere fazer upgrade.`,
        duration: 8000,
      });
    }
  }, [usageQuery.data]);
  /**
   * UX-only hint: indicates if the user is likely over the limit.
   * NOT a security gate — backend triggers and edge functions enforce actual limits.
   * Use this to disable buttons / show warnings in the UI.
   * When over limit, opens the upgrade modal automatically.
   */
  const canPerformAction = (action: "transaction" | "ai" | "connection") => {
    if (!usageQuery.data) return true; // Allow by default while loading
    switch (action) {
      case "transaction":
        return !usageQuery.data.isOverTransactions;
      case "ai":
        return !usageQuery.data.isOverAI;
      case "connection":
        return !usageQuery.data.isOverConnections;
    }
  };

  /**
   * Same check as canPerformAction but opens the upgrade modal when blocked.
   * Use this on button clicks that should trigger the modal.
   */
  const canPerformOrUpgrade = (action: "transaction" | "ai" | "connection", openModal?: (trigger: string) => void) => {
    const can = canPerformAction(action);
    if (!can && openModal) {
      const triggerMap = { transaction: "transactions", ai: "ai", connection: "connections" } as const;
      openModal(triggerMap[action]);
    }
    return can;
  };

  return {
    usage: usageQuery.data,
    isLoading: usageQuery.isLoading,
    /** UX hint only — backend is the source of truth for enforcement */
    canPerformAction,
    /** Same as canPerformAction but opens upgrade modal when blocked */
    canPerformOrUpgrade,
  };
}
