import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart as PieChartIcon, ChevronDown, ChevronUp } from "lucide-react";
import { SkeletonCard } from "@/components/common/SkeletonCard";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Sector } from "recharts";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { useMemo } from "react";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
  transactions: { description: string; amount: number; date: string }[];
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

    const incomeMap = new Map<string, { total: number; txs: { description: string; amount: number; date: string }[] }>();
    const expenseMap = new Map<string, { total: number; txs: { description: string; amount: number; date: string }[] }>();

    transactions.forEach((tx) => {
      if (!tx.category_id) return;
      const map = tx.type === "income" ? incomeMap : expenseMap;
      const existing = map.get(tx.category_id) || { total: 0, txs: [] };
      existing.total += Number(tx.amount);
      existing.txs.push({ description: tx.description || "—", amount: Number(tx.amount), date: tx.date });
      map.set(tx.category_id, existing);
    });

    const buildData = (map: Map<string, { total: number; txs: { description: string; amount: number; date: string }[] }>): DonutData[] => {
      const total = Array.from(map.values()).reduce((s, v) => s + v.total, 0);
      return Array.from(map.entries())
        .map(([catId, data], i) => {
          const cat = categories.find((c) => c.id === catId);
          return {
            name: cat?.name || "Sem categoria",
            value: data.total,
            color: DISTINCT_COLORS[i % DISTINCT_COLORS.length],
            percentage: total > 0 ? (data.total / total) * 100 : 0,
            transactions: data.txs.sort((a, b) => b.amount - a.amount).slice(0, 5),
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
          <DonutSkeletonInline />
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

function DonutSkeletonInline() {
  return (
    <div className="space-y-4">
      {["Receitas", "Despesas"].map((label) => (
        <div key={label}>
          <div className="flex items-center justify-between mb-2">
            <div className="h-3 w-16 rounded-md bg-gradient-to-r from-muted/60 via-muted/30 to-muted/60 bg-[length:200%_100%] animate-[shimmer_1.8s_ease-in-out_infinite]" />
            <div className="h-3 w-24 rounded-md bg-gradient-to-r from-muted/60 via-muted/30 to-muted/60 bg-[length:200%_100%] animate-[shimmer_1.8s_ease-in-out_infinite]" />
          </div>
          <div className="flex items-start gap-4">
            <div className="h-[100px] w-[100px] rounded-full shrink-0 bg-gradient-to-r from-muted/60 via-muted/30 to-muted/60 bg-[length:200%_100%] animate-[shimmer_1.8s_ease-in-out_infinite]" />
            <div className="space-y-1.5 flex-1 pt-1">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full shrink-0 bg-gradient-to-r from-muted/60 via-muted/30 to-muted/60 bg-[length:200%_100%] animate-[shimmer_1.8s_ease-in-out_infinite]" />
                  <div className="h-2.5 flex-1 rounded-md bg-gradient-to-r from-muted/60 via-muted/30 to-muted/60 bg-[length:200%_100%] animate-[shimmer_1.8s_ease-in-out_infinite]" />
                  <div className="h-2.5 w-16 shrink-0 rounded-md bg-gradient-to-r from-muted/60 via-muted/30 to-muted/60 bg-[length:200%_100%] animate-[shimmer_1.8s_ease-in-out_infinite]" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DonutSection({ title, data, type }: { title: string; data: DonutData[]; type: "income" | "expense" }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

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

  const selectedData = data.find(d => d.name === selectedCategory);

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
                onClick={(_, index) => {
                  const clicked = data[index]?.name;
                  setSelectedCategory(prev => prev === clicked ? null : clicked);
                }}
                style={{ cursor: "pointer" }}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={entry.color}
                    opacity={selectedCategory && selectedCategory !== entry.name ? 0.3 : 1}
                    stroke={selectedCategory === entry.name ? "hsl(var(--foreground))" : "none"}
                    strokeWidth={selectedCategory === entry.name ? 2 : 0}
                  />
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
        <div className="space-y-1 flex-1 min-w-0 pt-0.5">
          {data.slice(0, 6).map((item, i) => (
            <div
              key={i}
              className={cn(
                "flex items-center gap-2 text-[11px] rounded-md px-1.5 py-0.5 cursor-pointer transition-all",
                selectedCategory === item.name
                  ? "bg-accent ring-1 ring-accent"
                  : "hover:bg-muted/50"
              )}
              onClick={() => setSelectedCategory(prev => prev === item.name ? null : item.name)}
            >
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

      {/* Expanded details */}
      {selectedData && (
        <div className="mt-2 p-2.5 rounded-lg bg-muted/40 border border-border/50 animate-in fade-in-0 slide-in-from-top-1 duration-200">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[11px] font-semibold">{selectedData.name}</p>
            <button
              onClick={() => setSelectedCategory(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              <ChevronUp className="h-3 w-3" />
            </button>
          </div>
          <div className="space-y-1">
            {selectedData.transactions.map((tx, i) => (
              <div key={i} className="flex items-center justify-between text-[10px]">
                <span className="truncate flex-1 text-muted-foreground">{tx.description}</span>
                <span className="font-medium tabular-nums ml-2">{formatCurrency(tx.amount)}</span>
              </div>
            ))}
            {selectedData.transactions.length === 5 && (
              <p className="text-[9px] text-muted-foreground text-center pt-0.5">
                Mostrando as 5 maiores
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
