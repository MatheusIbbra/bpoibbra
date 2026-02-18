import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

export type OpenFinanceOverallStatus = "ok" | "warning" | "error" | "none";

interface OpenFinanceStatusItem {
  id: string;
  institution_name: string;
  status: string;
  last_sync_at: string | null;
  error_message: string | null;
  consecutive_failures: number | null;
  updated_at: string;
}

function getTimeSinceSync(lastSyncAt: string | null): number | null {
  if (!lastSyncAt) return null;
  return Date.now() - new Date(lastSyncAt).getTime();
}

const HOURS_24 = 24 * 60 * 60 * 1000;
const HOURS_48 = 48 * 60 * 60 * 1000;

export function useOpenFinanceStatus() {
  const { user } = useAuth();

  const { data: items } = useQuery({
    queryKey: ["of-status-items", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("open_finance_items")
        .select("id, institution_name, status, last_sync_at, error_message, consecutive_failures, updated_at")
        .order("created_at", { ascending: false });
      return (data || []) as OpenFinanceStatusItem[];
    },
    enabled: !!user,
    staleTime: 60000,
    refetchInterval: 60000,
  });

  const hasItems = (items?.length || 0) > 0;
  const errorItems = items?.filter(i => i.status === "error") || [];
  const staleItems = items?.filter(i => {
    const elapsed = getTimeSinceSync(i.last_sync_at);
    return elapsed !== null && elapsed > HOURS_24 && i.status !== "error";
  }) || [];

  let overallStatus: OpenFinanceOverallStatus = "none";
  if (hasItems) {
    if (errorItems.length > 0) {
      overallStatus = "error";
    } else if (staleItems.length > 0) {
      overallStatus = "warning";
    } else {
      overallStatus = "ok";
    }
  }

  // Items with errors for 48h+ (for login toast)
  const criticalItems = items?.filter(i => {
    if (i.status !== "error") return false;
    const updatedMs = Date.now() - new Date(i.updated_at).getTime();
    return updatedMs > HOURS_48;
  }) || [];

  return {
    items,
    overallStatus,
    hasItems,
    errorCount: errorItems.length,
    staleCount: staleItems.length,
    criticalItems,
    staleItems,
    errorItems,
  };
}

/** Call this once at app root to show toast on login for stale connections */
export function useOpenFinanceLoginToast() {
  const { criticalItems } = useOpenFinanceStatus();
  const shownRef = useRef(false);

  useEffect(() => {
    if (shownRef.current || criticalItems.length === 0) return;
    shownRef.current = true;

    const names = criticalItems.map(i => i.institution_name).join(", ");
    toast.warning(
      `Sua conexão com ${names} precisa ser renovada.`,
      {
        description: "A sincronização está com erro há mais de 48h. Acesse o Open Finance Monitor.",
        duration: 10000,
        action: {
          label: "Ver",
          onClick: () => { window.location.href = "/open-finance-monitor"; },
        },
      }
    );
  }, [criticalItems]);
}
