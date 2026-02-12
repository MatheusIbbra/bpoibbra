import { useMemo } from "react";
import { usePatrimonyConsolidation, PatrimonyHistory } from "./usePatrimonyConsolidation";

export interface PatrimonyIndicators {
  monthlyGrowth: number;
  yearlyGrowth: number;
  liquidityIndex: number;       // high liquidity assets / monthly expenses
  sustainabilityIndex: number;  // passive income / total expenses
  concentrationIndex: number;   // largest asset % of total
  netWorth: number;
}

export function usePatrimonyIndicators(monthlyExpenses: number = 0, passiveIncome: number = 0) {
  const { consolidation, history } = usePatrimonyConsolidation();

  const indicators = useMemo((): PatrimonyIndicators => {
    if (!consolidation) {
      return { monthlyGrowth: 0, yearlyGrowth: 0, liquidityIndex: 0, sustainabilityIndex: 0, concentrationIndex: 0, netWorth: 0 };
    }

    const currentNW = consolidation.netWorth;
    const sorted = [...history].sort((a, b) => a.period.localeCompare(b.period));

    // Monthly growth
    let monthlyGrowth = 0;
    if (sorted.length >= 2) {
      const prev = sorted[sorted.length - 2].net_worth;
      if (prev !== 0) monthlyGrowth = ((currentNW - prev) / Math.abs(prev)) * 100;
    }

    // Yearly growth
    let yearlyGrowth = 0;
    if (sorted.length >= 12) {
      const prev12 = sorted[sorted.length - 12].net_worth;
      if (prev12 !== 0) yearlyGrowth = ((currentNW - prev12) / Math.abs(prev12)) * 100;
    }

    // Liquidity index
    const liquidityIndex = monthlyExpenses > 0 ? consolidation.highLiquidityAssets / monthlyExpenses : 0;

    // Sustainability index
    const sustainabilityIndex = monthlyExpenses > 0 ? (passiveIncome / monthlyExpenses) * 100 : 0;

    // Concentration index
    let concentrationIndex = 0;
    if (consolidation.totalAssets > 0) {
      const maxByType = Math.max(...Object.values(consolidation.assetsByType), 0);
      concentrationIndex = (maxByType / consolidation.totalAssets) * 100;
    }

    return { monthlyGrowth, yearlyGrowth, liquidityIndex, sustainabilityIndex, concentrationIndex, netWorth: currentNW };
  }, [consolidation, history, monthlyExpenses, passiveIncome]);

  return indicators;
}
