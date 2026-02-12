import { useMemo } from "react";

export interface ProjectionInputs {
  currentNetWorth: number;
  annualGrowthRate: number;       // %
  monthlyContribution: number;
  inflationRate: number;          // % annual
  expenseGrowthRate: number;      // % annual
  currentMonthlyExpenses: number;
}

export interface ProjectionPoint {
  month: number;
  nominalNetWorth: number;
  realNetWorth: number;
  monthlyExpenses: number;
  sustainabilityIndex: number;
}

export function usePatrimonyProjection(inputs: ProjectionInputs) {
  const projections = useMemo(() => {
    const { currentNetWorth, annualGrowthRate, monthlyContribution, inflationRate, expenseGrowthRate, currentMonthlyExpenses } = inputs;

    const monthlyGrowth = Math.pow(1 + annualGrowthRate / 100, 1 / 12) - 1;
    const monthlyInflation = Math.pow(1 + inflationRate / 100, 1 / 12) - 1;
    const monthlyExpenseGrowth = Math.pow(1 + expenseGrowthRate / 100, 1 / 12) - 1;

    const points: ProjectionPoint[] = [];
    let nominal = currentNetWorth;
    let expenses = currentMonthlyExpenses;
    let cumulativeInflation = 1;

    for (let m = 0; m <= 60; m++) {
      const real = nominal / cumulativeInflation;
      const sustainability = expenses > 0 ? ((nominal * monthlyGrowth) / expenses) * 100 : 0;

      points.push({
        month: m,
        nominalNetWorth: Math.round(nominal * 100) / 100,
        realNetWorth: Math.round(real * 100) / 100,
        monthlyExpenses: Math.round(expenses * 100) / 100,
        sustainabilityIndex: Math.round(sustainability * 10) / 10,
      });

      if (m < 60) {
        nominal = nominal * (1 + monthlyGrowth) + monthlyContribution;
        expenses = expenses * (1 + monthlyExpenseGrowth);
        cumulativeInflation *= (1 + monthlyInflation);
      }
    }

    return {
      all: points,
      at12: points[12],
      at24: points[24],
      at60: points[60],
    };
  }, [inputs]);

  return projections;
}
