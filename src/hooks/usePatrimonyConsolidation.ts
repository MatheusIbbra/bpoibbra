import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { FinancialEntity } from "./useFinancialEntities";
import { PatrimonyAsset } from "./usePatrimonyAssets";
import { PatrimonyLiability } from "./usePatrimonyLiabilities";

export interface EntityConsolidation {
  entity: FinancialEntity;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  assetsByType: Record<string, number>;
  assetsByLiquidity: Record<string, number>;
}

export interface ConsolidatedPatrimony {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  byEntity: EntityConsolidation[];
  assetsByType: Record<string, number>;
  assetsByLiquidity: Record<string, number>;
  highLiquidityAssets: number;
}

export interface PatrimonyHistory {
  period: string;
  total_assets: number;
  total_liabilities: number;
  net_worth: number;
}

export function usePatrimonyConsolidation() {
  const { user } = useAuth();
  const { selectedOrganizationId: selectedBaseId } = useBaseFilter();

  const { data: consolidation, isLoading } = useQuery({
    queryKey: ["patrimony-consolidation", selectedBaseId],
    queryFn: async (): Promise<ConsolidatedPatrimony> => {
      if (!selectedBaseId) return { totalAssets: 0, totalLiabilities: 0, netWorth: 0, byEntity: [], assetsByType: {}, assetsByLiquidity: {}, highLiquidityAssets: 0 };

      const [entitiesRes, assetsRes, liabilitiesRes] = await Promise.all([
        supabase.from("financial_entities").select("*").eq("organization_id", selectedBaseId).eq("is_active", true),
        supabase.from("patrimony_assets").select("*").eq("organization_id", selectedBaseId),
        supabase.from("patrimony_liabilities").select("*").eq("organization_id", selectedBaseId),
      ]);

      const entities = (entitiesRes.data || []) as FinancialEntity[];
      const assets = (assetsRes.data || []) as PatrimonyAsset[];
      const liabilities = (liabilitiesRes.data || []) as PatrimonyLiability[];

      const globalAssetsByType: Record<string, number> = {};
      const globalAssetsByLiquidity: Record<string, number> = {};
      let highLiquidityAssets = 0;

      const byEntity: EntityConsolidation[] = entities.map(entity => {
        const entityAssets = assets.filter(a => a.entity_id === entity.id);
        const entityLiabilities = liabilities.filter(l => l.entity_id === entity.id);
        const totalAssets = entityAssets.reduce((s, a) => s + Number(a.current_value), 0);
        const totalLiabilities = entityLiabilities.reduce((s, l) => s + Number(l.current_value), 0);

        const assetsByType: Record<string, number> = {};
        const assetsByLiquidity: Record<string, number> = {};

        entityAssets.forEach(a => {
          const v = Number(a.current_value);
          assetsByType[a.asset_type] = (assetsByType[a.asset_type] || 0) + v;
          assetsByLiquidity[a.liquidity] = (assetsByLiquidity[a.liquidity] || 0) + v;
          globalAssetsByType[a.asset_type] = (globalAssetsByType[a.asset_type] || 0) + v;
          globalAssetsByLiquidity[a.liquidity] = (globalAssetsByLiquidity[a.liquidity] || 0) + v;
          if (a.liquidity === "alta") highLiquidityAssets += v;
        });

        return { entity, totalAssets, totalLiabilities, netWorth: totalAssets - totalLiabilities, assetsByType, assetsByLiquidity };
      });

      const totalAssets = byEntity.reduce((s, e) => s + e.totalAssets, 0);
      const totalLiabilities = byEntity.reduce((s, e) => s + e.totalLiabilities, 0);

      return {
        totalAssets,
        totalLiabilities,
        netWorth: totalAssets - totalLiabilities,
        byEntity,
        assetsByType: globalAssetsByType,
        assetsByLiquidity: globalAssetsByLiquidity,
        highLiquidityAssets,
      };
    },
    enabled: !!user && !!selectedBaseId,
  });

  const { data: history = [] } = useQuery({
    queryKey: ["patrimony-history", selectedBaseId],
    queryFn: async () => {
      if (!selectedBaseId) return [];
      const { data, error } = await supabase
        .from("patrimony_history")
        .select("period, total_assets, total_liabilities, net_worth")
        .eq("organization_id", selectedBaseId)
        .eq("snapshot_type", "consolidated")
        .order("period", { ascending: true });
      if (error) throw error;
      return (data || []) as PatrimonyHistory[];
    },
    enabled: !!user && !!selectedBaseId,
  });

  return { consolidation, history, isLoading };
}
