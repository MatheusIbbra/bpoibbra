import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { toast } from "sonner";

export interface MacroScenario {
  currency_shock_pct: number;
  income_change_pct: number;
  expense_change_pct: number;
  extraordinary_amount: number;
  months_ahead: number;
}

export interface MacroSimulationResult {
  scenario: MacroScenario;
  baseline: {
    balance: number;
    monthly_income: number;
    monthly_expense: number;
    runway: number;
    health_score: number;
    liquidity_immediate: number;
  };
  simulated: {
    initial_balance: number;
    monthly_income: number;
    monthly_expense: number;
    runway_months: number;
    liquidity_immediate: number;
    final_balance: number;
    currency_impact: number;
  };
  monthly_projection: Array<{
    month: number;
    date: string;
    balance: number;
    cumulative_income: number;
    cumulative_expense: number;
  }>;
  generated_at: string;
}

const PRESET_SCENARIOS: Record<string, { label: string; scenario: Partial<MacroScenario> }> = {
  dollar_up: {
    label: "Dólar +20%",
    scenario: { currency_shock_pct: 20 },
  },
  income_drop: {
    label: "Queda de renda -30%",
    scenario: { income_change_pct: -30 },
  },
  expense_surge: {
    label: "Aumento de despesas +25%",
    scenario: { expense_change_pct: 25 },
  },
  emergency: {
    label: "Evento extraordinário -50k",
    scenario: { extraordinary_amount: -50000 },
  },
  crisis: {
    label: "Crise total",
    scenario: { currency_shock_pct: 30, income_change_pct: -40, expense_change_pct: 10 },
  },
};

export function useMacroSimulation() {
  const { user } = useAuth();
  const { getRequiredOrganizationId } = useBaseFilter();
  const [result, setResult] = useState<MacroSimulationResult | null>(null);

  const simulate = useMutation({
    mutationFn: async (scenario: Partial<MacroScenario>): Promise<MacroSimulationResult> => {
      const organizationId = getRequiredOrganizationId();
      if (!organizationId) throw new Error("Selecione uma base");

      const { data, error } = await supabase.rpc("simulate_macro_scenario", {
        p_organization_id: organizationId,
        p_currency_shock_pct: scenario.currency_shock_pct || 0,
        p_income_change_pct: scenario.income_change_pct || 0,
        p_expense_change_pct: scenario.expense_change_pct || 0,
        p_extraordinary_amount: scenario.extraordinary_amount || 0,
        p_months_ahead: scenario.months_ahead || 12,
      });

      if (error) throw error;
      return data as unknown as MacroSimulationResult;
    },
    onSuccess: (data) => {
      setResult(data);
    },
    onError: (error) => {
      toast.error("Erro na simulação: " + error.message);
    },
  });

  return {
    result,
    isSimulating: simulate.isPending,
    simulate: simulate.mutate,
    presets: PRESET_SCENARIOS,
    clearResult: () => setResult(null),
  };
}
