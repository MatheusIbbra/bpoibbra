import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Percent,
  ArrowUp,
  ArrowDown,
  Minus
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DRELine {
  label: string;
  value: number;
  percentage?: number;
  isTotal?: boolean;
  isSubtotal?: boolean;
  indent?: number;
  highlight?: "positive" | "negative" | "neutral";
}

interface DREData {
  period: string;
  lines: DRELine[];
  receitaLiquida: number;
}

const DRE_GROUPS = {
  receita_operacional: "Receita Operacional",
  deducoes_receita: "(-) Deduções da Receita",
  custo_produtos_vendidos: "(-) Custo dos Produtos Vendidos",
  despesas_operacionais: "(-) Despesas Operacionais",
  despesas_administrativas: "(-) Despesas Administrativas",
  despesas_financeiras: "(-) Despesas Financeiras",
  outras_receitas: "(+) Outras Receitas",
  outras_despesas: "(-) Outras Despesas",
  impostos: "(-) Impostos",
};

export function useDREData(month?: number, year?: number) {
  const { user } = useAuth();
  const { selectedOrganizationId } = useBaseFilter();
  
  const now = new Date();
  const targetMonth = month ?? now.getMonth() + 1;
  const targetYear = year ?? now.getFullYear();
  
  return useQuery({
    queryKey: ["dre-report", user?.id, selectedOrganizationId, targetMonth, targetYear],
    queryFn: async (): Promise<DREData> => {
      const startDate = format(new Date(targetYear, targetMonth - 1, 1), "yyyy-MM-dd");
      const endDate = format(endOfMonth(new Date(targetYear, targetMonth - 1, 1)), "yyyy-MM-dd");
      
      // Get transactions with category DRE groups
      let query = supabase
        .from("transactions")
        .select(`
          amount,
          type,
          categories (
            id,
            name,
            type,
            dre_group
          )
        `)
        .gte("date", startDate)
        .lte("date", endDate)
        .eq("status", "completed");
      
      if (selectedOrganizationId) {
        query = query.eq("organization_id", selectedOrganizationId);
      }
      
      const { data: transactions, error } = await query;
      
      if (error) throw error;
      
      // Aggregate by DRE group
      const groupTotals: Record<string, number> = {};
      
      transactions?.forEach((tx: any) => {
        const dreGroup = tx.categories?.dre_group || 
          (tx.type === "income" ? "receita_operacional" : "despesas_operacionais");
        
        const amount = Number(tx.amount);
        groupTotals[dreGroup] = (groupTotals[dreGroup] || 0) + amount;
      });
      
      // Calculate DRE
      const receitaBruta = groupTotals["receita_operacional"] || 0;
      const deducoes = groupTotals["deducoes_receita"] || 0;
      const receitaLiquida = receitaBruta - deducoes;
      
      const cpv = groupTotals["custo_produtos_vendidos"] || 0;
      const lucroBruto = receitaLiquida - cpv;
      
      const despesasOperacionais = groupTotals["despesas_operacionais"] || 0;
      const despesasAdmin = groupTotals["despesas_administrativas"] || 0;
      const despesasFinanceiras = groupTotals["despesas_financeiras"] || 0;
      const totalDespesas = despesasOperacionais + despesasAdmin + despesasFinanceiras;
      
      const outrasReceitas = groupTotals["outras_receitas"] || 0;
      const outrasDespesas = groupTotals["outras_despesas"] || 0;
      
      const lucroOperacional = lucroBruto - totalDespesas + outrasReceitas - outrasDespesas;
      
      const impostos = groupTotals["impostos"] || 0;
      const lucroLiquido = lucroOperacional - impostos;
      
      const calcPercentage = (value: number) => 
        receitaLiquida > 0 ? (value / receitaLiquida) * 100 : 0;
      
      const lines: DRELine[] = [
        { label: "Receita Bruta", value: receitaBruta, percentage: calcPercentage(receitaBruta) },
        { label: "(-) Deduções da Receita", value: -deducoes, percentage: -calcPercentage(deducoes), indent: 1 },
        { label: "= Receita Líquida", value: receitaLiquida, percentage: 100, isSubtotal: true },
        { label: "", value: 0 }, // Spacer
        { label: "(-) Custo dos Produtos Vendidos", value: -cpv, percentage: -calcPercentage(cpv), indent: 1 },
        { label: "= Lucro Bruto", value: lucroBruto, percentage: calcPercentage(lucroBruto), isSubtotal: true, highlight: lucroBruto >= 0 ? "positive" : "negative" },
        { label: "", value: 0 }, // Spacer
        { label: "(-) Despesas Operacionais", value: -despesasOperacionais, percentage: -calcPercentage(despesasOperacionais), indent: 1 },
        { label: "(-) Despesas Administrativas", value: -despesasAdmin, percentage: -calcPercentage(despesasAdmin), indent: 1 },
        { label: "(-) Despesas Financeiras", value: -despesasFinanceiras, percentage: -calcPercentage(despesasFinanceiras), indent: 1 },
        { label: "(+) Outras Receitas", value: outrasReceitas, percentage: calcPercentage(outrasReceitas), indent: 1 },
        { label: "(-) Outras Despesas", value: -outrasDespesas, percentage: -calcPercentage(outrasDespesas), indent: 1 },
        { label: "= Lucro Operacional", value: lucroOperacional, percentage: calcPercentage(lucroOperacional), isSubtotal: true, highlight: lucroOperacional >= 0 ? "positive" : "negative" },
        { label: "", value: 0 }, // Spacer
        { label: "(-) Impostos", value: -impostos, percentage: -calcPercentage(impostos), indent: 1 },
        { label: "= Lucro Líquido", value: lucroLiquido, percentage: calcPercentage(lucroLiquido), isTotal: true, highlight: lucroLiquido >= 0 ? "positive" : "negative" },
      ];
      
      return {
        period: format(new Date(targetYear, targetMonth - 1, 1), "MMMM 'de' yyyy", { locale: ptBR }),
        lines,
        receitaLiquida,
      };
    },
    enabled: !!user,
  });
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

interface FinancialStatementReportProps {
  month?: number;
  year?: number;
}

export function FinancialStatementReport({ month, year }: FinancialStatementReportProps) {
  const { data, isLoading, error } = useDREData(month, year);
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Demonstrativo de Resultado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-pulse text-muted-foreground">
              Carregando demonstrativo...
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Demonstrativo de Resultado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-destructive">
            Erro ao carregar dados
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Demonstrativo de Resultado do Exercício (DRE)
        </CardTitle>
        <CardDescription>
          Período: {data?.period}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {/* Header */}
          <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-muted rounded-t-lg font-medium text-sm">
            <div className="col-span-6">Descrição</div>
            <div className="col-span-3 text-right">Valor (R$)</div>
            <div className="col-span-3 text-right">% Receita Líq.</div>
          </div>
          
          {/* Lines */}
          {data?.lines.map((line, idx) => {
            if (line.label === "") {
              return <div key={idx} className="h-2" />;
            }
            
            return (
              <div
                key={idx}
                className={cn(
                  "grid grid-cols-12 gap-4 px-4 py-2 rounded transition-colors",
                  line.isTotal && "bg-primary/10 font-bold text-lg",
                  line.isSubtotal && "bg-muted/50 font-semibold",
                  !line.isTotal && !line.isSubtotal && "hover:bg-muted/30"
                )}
              >
                <div 
                  className={cn("col-span-6 flex items-center gap-2")}
                  style={{ paddingLeft: line.indent ? `${line.indent * 16}px` : 0 }}
                >
                  {line.highlight === "positive" && <TrendingUp className="h-4 w-4 text-green-500" />}
                  {line.highlight === "negative" && <TrendingDown className="h-4 w-4 text-red-500" />}
                  {line.label}
                </div>
                <div className={cn(
                  "col-span-3 text-right tabular-nums",
                  line.value > 0 && "text-green-600",
                  line.value < 0 && "text-red-600"
                )}>
                  {formatCurrency(Math.abs(line.value))}
                  {line.value < 0 && <span className="text-muted-foreground ml-1">(-)</span>}
                </div>
                <div className={cn(
                  "col-span-3 text-right tabular-nums text-muted-foreground",
                  line.percentage && line.percentage > 0 && "text-green-600",
                  line.percentage && line.percentage < 0 && "text-red-600"
                )}>
                  {line.percentage !== undefined ? formatPercentage(Math.abs(line.percentage)) : "-"}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <Card className="bg-green-500/10 border-green-200">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-700">Receita Líquida</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(data?.receitaLiquida || 0)}
                  </p>
                </div>
                <ArrowUp className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className={cn(
            "border",
            (data?.lines.find(l => l.label.includes("Lucro Bruto"))?.value || 0) >= 0
              ? "bg-blue-500/10 border-blue-200"
              : "bg-red-500/10 border-red-200"
          )}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Lucro Bruto</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(data?.lines.find(l => l.label.includes("Lucro Bruto"))?.value || 0)}
                  </p>
                </div>
                <Percent className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          
          <Card className={cn(
            "border",
            (data?.lines.find(l => l.label.includes("Lucro Líquido"))?.value || 0) >= 0
              ? "bg-green-500/10 border-green-200"
              : "bg-red-500/10 border-red-200"
          )}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Lucro Líquido</p>
                  <p className={cn(
                    "text-2xl font-bold",
                    (data?.lines.find(l => l.label.includes("Lucro Líquido"))?.value || 0) >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  )}>
                    {formatCurrency(data?.lines.find(l => l.label.includes("Lucro Líquido"))?.value || 0)}
                  </p>
                </div>
                {(data?.lines.find(l => l.label.includes("Lucro Líquido"))?.value || 0) >= 0 
                  ? <TrendingUp className="h-8 w-8 text-green-500" />
                  : <TrendingDown className="h-8 w-8 text-red-500" />
                }
              </div>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}

export { DRE_GROUPS };
