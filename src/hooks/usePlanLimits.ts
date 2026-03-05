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
  max_transactions: 5000,
  max_ai_requests: 0,
  max_bank_connections: 10,
  allow_forecast: false,
  allow_simulator: false,
  allow_anomaly_detection: false,
};

const STAFF_ROLES = ["admin", "supervisor", "fa", "kam", "projetista"];

const UNLIMITED_PLAN: PlanUsage = {
  transactionsUsed: 0,
  transactionsLimit: 999999,
  transactionsPercent: 0,
  aiRequestsUsed: 0,
  aiRequestsLimit: 999999,
  aiRequestsPercent: 0,
  bankConnectionsUsed: 0,
  bankConnectionsLimit: 999999,
  bankConnectionsPercent: 0,
  isOverTransactions: false,
  isOverAI: false,
  isOverConnections: false,
  allowForecast: true,
  allowSimulator: true,
  allowAnomalyDetection: true,
  planName: "Staff",
};

export function usePlanLimits() {
  const { user } = useAuth();
  const { selectedOrganizationId, userRole } = useBaseFilter();
  const { currentPlan } = useSubscription();

  const isStaff = userRole !== null && STAFF_ROLES.includes(userRole);

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
    enabled: !!user && !isStaff,
    staleTime: 5 * 60 * 1000,
  });

  // Staff: skip limit warnings entirely
  // Proactive warning at 80% of transaction limit
  const warnedRef = useRef(false);
  useEffect(() => {
    if (isStaff || !usageQuery.data || warnedRef.current) return;
    const { transactionsPercent, planName } = usageQuery.data;
    if (transactionsPercent >= 80 && transactionsPercent < 100) {
      warnedRef.current = true;
      trackEvent("plan_limit_warning", { percent: transactionsPercent, plan: planName });
      toast.warning(`Atenção: ${Math.round(transactionsPercent)}% das transações usadas`, {
        description: `Você está próximo do limite do plano ${planName}. Considere fazer upgrade.`,
        duration: 8000,
      });
    }
  }, [usageQuery.data, isStaff]);

  // Reset warned flag when usage drops back below 80% (e.g. after deleting transactions)
  useEffect(() => {
    if (!usageQuery.data) return;
    if (usageQuery.data.transactionsPercent < 80) {
      warnedRef.current = false;
    }
  }, [usageQuery.data?.transactionsPercent]);

  const canPerformAction = (action: "transaction" | "ai" | "connection") => {
    if (isStaff) return true; // Staff has no limits
    if (!usageQuery.data) return true;
    switch (action) {
      case "transaction": return !usageQuery.data.isOverTransactions;
      case "ai": return !usageQuery.data.isOverAI;
      case "connection": return !usageQuery.data.isOverConnections;
    }
  };

  const canPerformOrUpgrade = (action: "transaction" | "ai" | "connection", openModal?: (trigger: string) => void) => {
    const can = canPerformAction(action);
    if (!can && openModal && !isStaff) {
      const triggerMap = { transaction: "transactions", ai: "ai", connection: "connections" } as const;
      openModal(triggerMap[action]);
    }
    return can;
  };

  // Staff get unlimited plan data immediately
  if (isStaff) {
    return {
      usage: UNLIMITED_PLAN,
      isLoading: false,
      canPerformAction,
      canPerformOrUpgrade,
    };
  }

  return {
    usage: usageQuery.data,
    isLoading: usageQuery.isLoading,
    canPerformAction,
    canPerformOrUpgrade,
  };
}
