import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, PieChart as PieChartIcon } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { useMemo } from "react";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { cn } from "@/lib/utils";

const COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#ec4899", "#f43f5e",
  "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e",
  "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6",
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
            color: cat?.color || COLORS[i % COLORS.length],
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
    <Card>
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <PieChartIcon className="h-4 w-4 text-muted-foreground" />
          Distribuição por Categoria
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {/* Income donut */}
            <DonutSection title="Receitas" data={incomeData} type="income" />
            {/* Expense donut */}
            <DonutSection title="Despesas" data={expenseData} type="expense" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DonutSection({ title, data, type }: { title: string; data: DonutData[]; type: "income" | "expense" }) {
  if (data.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className="text-[11px] text-muted-foreground mt-1">Sem dados</p>
      </div>
    );
  }

  return (
    <div>
      <p className={cn(
        "text-xs font-medium text-center mb-1",
        type === "income" ? "text-success" : "text-destructive"
      )}>
        {title}
      </p>
      <div className="h-[100px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={25}
              outerRadius={42}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.color} stroke="none" />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              contentStyle={{
                fontSize: "11px",
                borderRadius: "8px",
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--background))",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-0.5 mt-1">
        {data.slice(0, 4).map((item, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[10px]">
            <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
            <span className="truncate flex-1">{item.name}</span>
            <span className="text-muted-foreground shrink-0">{item.percentage.toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
