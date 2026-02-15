import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { useFinancialHealthScore } from "@/hooks/useFinancialHealthScore";
import { toast } from "sonner";

export interface SimulationResult {
  month: number;
  date: string;
  projected_revenue: number;
  projected_expenses: number;
  projected_balance: number;
}

export interface FinancialSimulation {
  id: string;
  organization_id: string;
  name: string;
  months_ahead: number;
  revenue_growth_rate: number;
  expense_increase_rate: number;
  initial_balance: number;
  results: SimulationResult[];
  created_at: string;
}

export function useFinancialSimulator() {
  const { user } = useAuth();
  const { getOrganizationFilter, getRequiredOrganizationId } = useBaseFilter();
  const orgFilter = getOrganizationFilter();
  const queryClient = useQueryClient();
  const { data: health } = useFinancialHealthScore();

  const simulationsQuery = useQuery({
    queryKey: ["financial-simulations", user?.id, orgFilter.type, orgFilter.ids],
    queryFn: async () => {
      if (orgFilter.type !== "single" || !orgFilter.ids[0]) return [];

      const { data, error } = await supabase
        .from("financial_simulations")
        .select("*")
        .eq("organization_id", orgFilter.ids[0])
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return (data || []) as unknown as FinancialSimulation[];
    },
    enabled: !!user && orgFilter.type === "single" && !!orgFilter.ids[0],
  });

  const runSimulation = useMutation({
    mutationFn: async (params: {
      name: string;
      months_ahead: number;
      revenue_growth_rate: number;
      expense_increase_rate: number;
    }) => {
      const organizationId = getRequiredOrganizationId();
      if (!organizationId) throw new Error("Selecione uma base");

      const baseRevenue = health?.total_revenue || 0;
      const baseExpenses = health?.total_expenses || 0;
      const initialBalance = health?.total_balance || 0;

      const results: SimulationResult[] = [];
      let balance = initialBalance;

      for (let m = 1; m <= params.months_ahead; m++) {
        const revenue = baseRevenue * Math.pow(1 + params.revenue_growth_rate / 100, m);
        const expenses = baseExpenses * Math.pow(1 + params.expense_increase_rate / 100, m);
        balance = balance + revenue - expenses;

        const futureDate = new Date();
        futureDate.setMonth(futureDate.getMonth() + m);

        results.push({
          month: m,
          date: futureDate.toISOString().split("T")[0],
          projected_revenue: Math.round(revenue * 100) / 100,
          projected_expenses: Math.round(expenses * 100) / 100,
          projected_balance: Math.round(balance * 100) / 100,
        });
      }

      const insertData = {
        organization_id: organizationId,
        name: params.name,
        months_ahead: params.months_ahead,
        revenue_growth_rate: params.revenue_growth_rate,
        expense_increase_rate: params.expense_increase_rate,
        initial_balance: initialBalance,
        results: JSON.parse(JSON.stringify(results)),
      };

      const { data, error } = await supabase
        .from("financial_simulations")
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return { ...data, results } as unknown as FinancialSimulation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-simulations"] });
      toast.success("Simulação gerada com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao gerar simulação: " + error.message);
    },
  });

  return {
    simulations: simulationsQuery.data || [],
    isLoading: simulationsQuery.isLoading,
    runSimulation,
  };
}
