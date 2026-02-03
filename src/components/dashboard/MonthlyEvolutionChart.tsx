import { forwardRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useMonthlyEvolution } from "@/hooks/useMonthlyEvolution";
import { useDailyEvolution } from "@/hooks/useDailyEvolution";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Line,
  ComposedChart,
} from "recharts";
import { Loader2, Calendar, CalendarDays } from "lucide-react";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

interface TooltipPayloadItem {
  color: string;
  name: string;
  value: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

const CustomTooltipContent = forwardRef<HTMLDivElement, CustomTooltipProps>(
  ({ active, payload, label }, ref) => {
    if (active && payload && payload.length) {
      return (
        <div ref={ref} className="rounded-lg border bg-card p-3 shadow-lg">
          <p className="font-medium text-card-foreground">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  }
);

CustomTooltipContent.displayName = "CustomTooltipContent";

type ViewMode = "monthly" | "daily";

export function MonthlyEvolutionChart() {
  const [viewMode, setViewMode] = useState<ViewMode>("monthly");
  const [showBalance, setShowBalance] = useState(false);
  const { data: monthlyData, isLoading: isLoadingMonthly } = useMonthlyEvolution(6);
  const { data: dailyData, isLoading: isLoadingDaily } = useDailyEvolution();

  const isLoading = viewMode === "monthly" ? isLoadingMonthly : isLoadingDaily;
  const rawData = viewMode === "monthly" ? monthlyData : dailyData;
  const labelKey = viewMode === "monthly" ? "monthLabel" : "dayLabel";

  // Use cumulative balance from hooks (already includes initial balances)
  // but prepend an explicit "Saldo Inicial" point so users can see the starting balance.
  const data = (() => {
    if (!rawData || rawData.length === 0) return rawData;

    const mapped = rawData.map((item) => ({
      ...item,
      accumulatedBalance: item.cumulativeBalance,
    }));

    const first = mapped[0] as any;
    const openingBalance = Number(first.accumulatedBalance) - Number(first.balance || 0);

    const initialPoint =
      viewMode === "monthly"
        ? {
            month: "initial",
            monthLabel: "Inicial",
            income: 0,
            expense: 0,
            balance: 0,
            cumulativeBalance: openingBalance,
            accumulatedBalance: openingBalance,
          }
        : {
            day: "initial",
            dayLabel: "Inicial",
            income: 0,
            expense: 0,
            balance: 0,
            cumulativeBalance: openingBalance,
            accumulatedBalance: openingBalance,
          };

    return [initialPoint as any, ...mapped];
  })();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Evolução Financeira</CardTitle>
        </CardHeader>
        <CardContent className="flex h-[300px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold">Evolução Financeira</CardTitle>
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <TabsList className="h-8">
              <TabsTrigger value="monthly" className="text-xs gap-1 px-2">
                <Calendar className="h-3 w-3" />
                Mensal
              </TabsTrigger>
              <TabsTrigger value="daily" className="text-xs gap-1 px-2">
                <CalendarDays className="h-3 w-3" />
                Diário
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="flex h-[300px] items-center justify-center">
          <p className="text-muted-foreground">Nenhuma transação encontrada</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold">Evolução Financeira</CardTitle>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="show-balance"
              checked={showBalance}
              onCheckedChange={setShowBalance}
            />
            <Label htmlFor="show-balance" className="text-xs text-muted-foreground cursor-pointer">
              Saldo Acumulado
            </Label>
          </div>
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <TabsList className="h-8">
              <TabsTrigger value="monthly" className="text-xs gap-1 px-2">
                <Calendar className="h-3 w-3" />
                Mensal
              </TabsTrigger>
              <TabsTrigger value="daily" className="text-xs gap-1 px-2">
                <CalendarDays className="h-3 w-3" />
                Diário
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-4">
          {viewMode === "monthly" 
            ? "Últimos 6 meses (exclui transferências, aplicações e resgates)"
            : "Mês atual dia a dia (exclui transferências, aplicações e resgates)"}
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis 
              dataKey={labelKey} 
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: viewMode === "daily" ? 10 : 12 }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              interval={viewMode === "daily" ? 2 : 0}
            />
            <YAxis
              tickFormatter={(value) => formatCurrency(value)}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              width={80}
            />
            <Tooltip content={<CustomTooltipContent />} />
            <Legend 
              wrapperStyle={{ paddingTop: "20px" }}
              formatter={(value) => <span className="text-foreground">{value}</span>}
            />
            <Area
              type="monotone"
              dataKey="income"
              name="Receitas"
              stroke="hsl(var(--success))"
              fillOpacity={1}
              fill="url(#colorIncome)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="expense"
              name="Despesas"
              stroke="hsl(var(--destructive))"
              fillOpacity={1}
              fill="url(#colorExpense)"
              strokeWidth={2}
            />
            {showBalance && (
              <Line
                type="monotone"
                dataKey="accumulatedBalance"
                name="Saldo Acumulado"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 3 }}
                activeDot={{ r: 5 }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
