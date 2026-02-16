import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type ConsentType = "terms" | "privacy" | "data_processing" | "marketing";

export function useConsentLogs() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const consentsQuery = useQuery({
    queryKey: ["consent-logs", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consent_logs")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const recordConsent = useMutation({
    mutationFn: async ({
      consentType,
      consentGiven,
    }: {
      consentType: ConsentType;
      consentGiven: boolean;
    }) => {
      const { error } = await supabase.from("consent_logs").insert({
        user_id: user!.id,
        consent_type: consentType,
        consent_given: consentGiven,
        user_agent: navigator.userAgent,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consent-logs"] });
    },
    onError: (error) => {
      toast.error("Erro ao registrar consentimento: " + error.message);
    },
  });

  const hasConsent = (type: ConsentType): boolean => {
    if (!consentsQuery.data) return false;
    const latest = consentsQuery.data.find((c) => c.consent_type === type);
    return latest?.consent_given === true;
  };

  return {
    consents: consentsQuery.data || [],
    isLoading: consentsQuery.isLoading,
    recordConsent,
    hasConsent,
  };
}
