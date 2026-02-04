import { forwardRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMonthlyEvolution } from "@/hooks/useMonthlyEvolution";
import { useDailyEvolution } from "@/hooks/useDailyEvolution";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Loader2, Calendar, CalendarDays } from "lucide-react";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
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
        <div ref={ref} className="rounded-lg border bg-card p-2 shadow-lg text-sm">
          <p className="font-medium text-card-foreground mb-1">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }} className="text-xs">
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
  const { data: monthlyData, isLoading: isLoadingMonthly } = useMonthlyEvolution(6);
  const { data: dailyData, isLoading: isLoadingDaily } = useDailyEvolution();

  const isLoading = viewMode === "monthly" ? isLoadingMonthly : isLoadingDaily;
  const rawData = viewMode === "monthly" ? monthlyData : dailyData;
  const labelKey = viewMode === "monthly" ? "monthLabel" : "dayLabel";

  // Transform data to only show income and expense
  const data = rawData?.map((item) => ({
    ...item,
    entradas: item.income,
    saidas: item.expense,
  })) || [];

  if (isLoading) {
    return (
      <Card className="shadow-sm">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-semibold">Evolução Financeira</CardTitle>
        </CardHeader>
        <CardContent className="flex h-[200px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
          <CardTitle className="text-sm font-semibold">Evolução Financeira</CardTitle>
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <TabsList className="h-7">
              <TabsTrigger value="monthly" className="text-xs gap-1 px-2 h-6">
                <Calendar className="h-3 w-3" />
                Mensal
              </TabsTrigger>
              <TabsTrigger value="daily" className="text-xs gap-1 px-2 h-6">
                <CalendarDays className="h-3 w-3" />
                Diário
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="flex h-[200px] items-center justify-center">
          <p className="text-muted-foreground text-sm">Nenhuma transação encontrada</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
        <CardTitle className="text-sm font-semibold">Evolução Financeira</CardTitle>
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
          <TabsList className="h-7">
            <TabsTrigger value="monthly" className="text-xs gap-1 px-2 h-6">
              <Calendar className="h-3 w-3" />
              Mensal
            </TabsTrigger>
            <TabsTrigger value="daily" className="text-xs gap-1 px-2 h-6">
              <CalendarDays className="h-3 w-3" />
              Diário
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis 
              dataKey={labelKey} 
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              interval={viewMode === "daily" ? 3 : 0}
            />
            <YAxis
              tickFormatter={(value) => formatCurrency(value)}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              width={65}
            />
            <Tooltip content={<CustomTooltipContent />} />
            <Legend 
              wrapperStyle={{ paddingTop: "10px", fontSize: "12px" }}
              formatter={(value) => <span className="text-foreground text-xs">{value}</span>}
            />
            <Bar
              dataKey="entradas"
              name="Entradas"
              fill="hsl(var(--success))"
              radius={[2, 2, 0, 0]}
            />
            <Bar
              dataKey="saidas"
              name="Saídas"
              fill="hsl(var(--destructive))"
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
