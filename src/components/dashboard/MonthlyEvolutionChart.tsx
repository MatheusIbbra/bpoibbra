import { forwardRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { startOfMonth, endOfMonth, parse, format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
        <div ref={ref} className="rounded-lg border bg-card p-3 shadow-executive text-sm">
          <p className="font-semibold text-foreground mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }} className="text-xs font-medium">
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
  const navigate = useNavigate();
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
      <Card className="shadow-executive">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-semibold">Evolução Financeira</CardTitle>
        </CardHeader>
        <CardContent className="flex h-[220px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="shadow-executive">
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
        <CardContent className="flex h-[220px] items-center justify-center">
          <p className="text-muted-foreground text-sm">Nenhuma transação encontrada</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-executive">
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          Evolução Financeira
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        </CardTitle>
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
          <TabsList className="h-7 bg-muted/50">
            <TabsTrigger value="monthly" className="text-xs gap-1 px-2.5 h-6 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Calendar className="h-3 w-3" />
              Mensal
            </TabsTrigger>
            <TabsTrigger value="daily" className="text-xs gap-1 px-2.5 h-6 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <CalendarDays className="h-3 w-3" />
              Diário
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            onClick={(state) => {
              if (!state?.activePayload?.length) return;
              const clicked = state.activePayload[0].payload;
              // month field is "yyyy-MM"
              if (clicked.month) {
                const monthDate = parse(clicked.month, "yyyy-MM", new Date());
                const start = format(startOfMonth(monthDate), "yyyy-MM-dd");
                const end = format(endOfMonth(monthDate), "yyyy-MM-dd");
                navigate(`/movimentacoes?startDate=${start}&endDate=${end}`);
              }
            }}
            style={{ cursor: "pointer" }}
          >
            <defs>
              <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(152 55% 42%)" stopOpacity={1}/>
                <stop offset="100%" stopColor="hsl(152 55% 42%)" stopOpacity={0.7}/>
              </linearGradient>
              <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(0 65% 50%)" stopOpacity={1}/>
                <stop offset="100%" stopColor="hsl(0 65% 50%)" stopOpacity={0.7}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" vertical={false} />
            <XAxis 
              dataKey={labelKey} 
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={false}
              interval={viewMode === "daily" ? 3 : 0}
            />
            <YAxis
              tickFormatter={(value) => formatCurrency(value)}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={80}
            />
            <Tooltip content={<CustomTooltipContent />} cursor={{ fill: 'hsl(var(--muted) / 0.3)' }} />
            <Legend 
              wrapperStyle={{ paddingTop: "12px", fontSize: "11px" }}
              formatter={(value) => <span className="text-foreground text-xs font-medium">{value}</span>}
            />
            <Bar
              dataKey="entradas"
              name="Entradas"
              fill="url(#colorIncome)"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
            <Bar
              dataKey="saidas"
              name="Saídas"
              fill="url(#colorExpense)"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
