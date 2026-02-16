import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, PieChart as PieChartIcon } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { useMemo } from "react";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { cn } from "@/lib/utils";

// Distinct, vibrant colors for each category slice
const DISTINCT_COLORS = [
  "#6366f1", "#f43f5e", "#f59e0b", "#22c55e", "#06b6d4",
  "#8b5cf6", "#ec4899", "#f97316", "#10b981", "#3b82f6",
  "#d946ef", "#eab308", "#14b8a6", "#0ea5e9", "#ef4444",
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

interface DonutData {
  name: string;
  value: number;
  color: string;
  percentage: number;
}

export function CategoryDonutChart() {
  const now = new Date();
  const start = format(startOfMonth(now), "yyyy-MM-dd");
  const end = format(endOfMonth(now), "yyyy-MM-dd");

  const { data: transactions, isLoading: loadingTx } = useTransactions({
    startDate: start,
    endDate: end,
  });
  const { data: categories } = useCategories();

  const { incomeData, expenseData } = useMemo(() => {
    if (!transactions || !categories) return { incomeData: [], expenseData: [] };

    const incomeMap = new Map<string, number>();
    const expenseMap = new Map<string, number>();

    transactions.forEach((tx) => {
      if (!tx.category_id) return;
      const map = tx.type === "income" ? incomeMap : expenseMap;
      map.set(tx.category_id, (map.get(tx.category_id) || 0) + Number(tx.amount));
    });

    const buildData = (map: Map<string, number>): DonutData[] => {
      const total = Array.from(map.values()).reduce((s, v) => s + v, 0);
      return Array.from(map.entries())
        .map(([catId, value], i) => {
          const cat = categories.find((c) => c.id === catId);
          return {
            name: cat?.name || "Sem categoria",
            value,
            color: DISTINCT_COLORS[i % DISTINCT_COLORS.length],
            percentage: total > 0 ? (value / total) * 100 : 0,
          };
        })
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);
    };

    return {
      incomeData: buildData(incomeMap),
      expenseData: buildData(expenseMap),
    };
  }, [transactions, categories]);

  const isLoading = loadingTx;

  return (
    <Card className="h-full">
      <CardHeader className="pb-1 pt-3 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <PieChartIcon className="h-4 w-4 text-muted-foreground" />
          Distribuição por Categoria
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-[200px]">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <DonutSection title="Receitas" data={incomeData} type="income" />
            <DonutSection title="Despesas" data={expenseData} type="expense" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DonutSection({ title, data, type }: { title: string; data: DonutData[]; type: "income" | "expense" }) {
  const total = data.reduce((s, d) => s + d.value, 0);

  if (data.length === 0) {
    return (
      <div className="text-center py-3">
        <p className={cn(
          "text-xs font-medium",
          type === "income" ? "text-success" : "text-destructive"
        )}>{title}</p>
        <p className="text-[11px] text-muted-foreground mt-1">Sem dados</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className={cn(
          "text-xs font-semibold",
          type === "income" ? "text-success" : "text-destructive"
        )}>
          {title}
        </p>
        <span className="text-xs font-bold tabular-nums">{formatCurrency(total)}</span>
      </div>
      <div className="flex items-start gap-4">
        <div className="h-[100px] w-[100px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={26}
                outerRadius={45}
                paddingAngle={2}
                dataKey="value"
                strokeWidth={0}
              >
                {data.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{
                  fontSize: "11px",
                  borderRadius: "8px",
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--popover))",
                  color: "hsl(var(--foreground))",
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
                itemStyle={{ color: "hsl(var(--foreground))" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-1.5 flex-1 min-w-0 pt-0.5">
          {data.slice(0, 6).map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px]">
              <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
              <span className="truncate flex-1">{item.name}</span>
              <span className="font-medium tabular-nums shrink-0">{formatCurrency(item.value)}</span>
              <span className="text-muted-foreground tabular-nums shrink-0 w-[32px] text-right">
                {item.percentage.toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
