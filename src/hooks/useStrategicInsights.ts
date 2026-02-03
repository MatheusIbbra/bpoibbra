import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useBaseFilter } from "@/contexts/BaseFilterContext";

interface Insight {
  title: string;
  description: string;
  severity: "info" | "warning";
}

interface FinancialMetrics {
  savings_rate: number;
  revenue_growth: number;
  expense_growth: number;
  budget_deviation: number;
  cashflow_risk: boolean;
  top_expense_category: string;
  top_expense_percentage: number;
  period_start: string;
  period_end: string;
  total_revenue: number;
  total_expenses: number;
}

interface InsightsResponse {
  insights: Insight[];
  metrics: FinancialMetrics;
  model?: string;
  token_usage?: number;
  created_at: string;
  cached: boolean;
  message?: string;
}

export function useStrategicInsights() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedOrganizationId } = useBaseFilter();
  const [period] = useState("current_month");
  
  // Alias para facilitar leitura
  const selectedBaseId = selectedOrganizationId;

  // Query para buscar insights existentes (cache)
  const {
    data: cachedInsights,
    isLoading: isLoadingCache,
    error: cacheError,
  } = useQuery({
    queryKey: ["strategic-insights", selectedBaseId, period],
    queryFn: async () => {
      if (!selectedBaseId || selectedBaseId === "all") {
        return null;
      }

      const { data, error } = await supabase
        .from("ai_strategic_insights")
        .select("*")
        .eq("organization_id", selectedBaseId)
        .eq("period", period)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error fetching cached insights:", error);
        return null;
      }

      if (data) {
        return {
          insights: data.insights_json as unknown as Insight[],
          metrics: data.metrics_json as unknown as FinancialMetrics,
          model: data.model,
          created_at: data.created_at,
          cached: true,
        } as InsightsResponse;
      }

      return null;
    },
    enabled: !!selectedBaseId && selectedBaseId !== "all",
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  // Mutation para gerar novos insights
  const generateMutation = useMutation({
    mutationFn: async (forceRefresh: boolean = false): Promise<InsightsResponse> => {
      if (!selectedBaseId || selectedBaseId === "all") {
        throw new Error("Selecione uma base específica para gerar insights");
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        throw new Error("Usuário não autenticado");
      }

      const response = await fetch(
        `https://umqehhhpedwqdfjmdjqv.supabase.co/functions/v1/generate-ai-insights`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            organization_id: selectedBaseId,
            period,
            force_refresh: forceRefresh,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        if (response.status === 429) {
          throw new Error("Limite de requisições excedido. Tente novamente em alguns minutos.");
        }
        if (response.status === 402) {
          throw new Error("Créditos de IA esgotados. Adicione fundos para continuar.");
        }
        
        throw new Error(errorData.error || "Erro ao gerar insights");
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["strategic-insights", selectedBaseId, period], data);
      
      if (!data.cached && data.insights.length > 0) {
        toast({
          title: "Insights gerados",
          description: `${data.insights.length} insights estratégicos identificados.`,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao gerar insights",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const generateInsights = (forceRefresh: boolean = false) => {
    generateMutation.mutate(forceRefresh);
  };

  return {
    insights: generateMutation.data || cachedInsights,
    isLoading: isLoadingCache,
    isGenerating: generateMutation.isPending,
    error: cacheError || generateMutation.error,
    generateInsights,
    hasValidBase: !!selectedBaseId && selectedBaseId !== "all",
  };
}
