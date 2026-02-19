import { forwardRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useMonthlyEvolution } from "@/hooks/useMonthlyEvolution";
import { useDailyEvolution } from "@/hooks/useDailyEvolution";
import { useTransactions } from "@/hooks/useTransactions";
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
import { formatCurrency, parseLocalDate } from "@/lib/formatters";
import { TransactionDialog } from "@/components/transactions/TransactionDialog";

const formatChartCurrency = (value: number) => {
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
        <div ref={ref} className="rounded-lg border bg-card p-3 shadow-executive text-sm">
          <p className="font-semibold text-foreground mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }} className="text-xs font-medium">
              {entry.name}: {formatChartCurrency(entry.value)}
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
  const [selectedMonth, setSelectedMonth] = useState<{ start: string; end: string; label: string } | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  
  const { data: monthlyData, isLoading: isLoadingMonthly } = useMonthlyEvolution(6);
  const { data: dailyData, isLoading: isLoadingDaily } = useDailyEvolution();

  // Fetch transactions for selected month
  const { data: monthTransactions } = useTransactions({
    startDate: selectedMonth?.start,
    endDate: selectedMonth?.end,
  });

  const isLoading = viewMode === "monthly" ? isLoadingMonthly : isLoadingDaily;
  const rawData = viewMode === "monthly" ? monthlyData : dailyData;
  const labelKey = viewMode === "monthly" ? "monthLabel" : "dayLabel";

  const data = rawData?.map((item) => ({
    ...item,
    entradas: item.income,
    saidas: item.expense,
  })) || [];

  const handleBarClick = (state: any) => {
    if (!state?.activePayload?.length) return;
    const clicked = state.activePayload[0].payload;
    if (clicked.month) {
      const monthDate = parse(clicked.month, "yyyy-MM", new Date());
      const start = format(startOfMonth(monthDate), "yyyy-MM-dd");
      const end = format(endOfMonth(monthDate), "yyyy-MM-dd");
      const label = format(monthDate, "MMMM yyyy", { locale: ptBR });
      setSelectedMonth({ start, end, label });
    }
  };

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
    <>
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
              onClick={viewMode === "monthly" ? handleBarClick : undefined}
              style={{ cursor: viewMode === "monthly" ? "pointer" : "default" }}
            >
              <defs>
                <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(152 55% 42%)" stopOpacity={0.95}/>
                  <stop offset="100%" stopColor="hsl(152 55% 42%)" stopOpacity={0.6}/>
                </linearGradient>
                <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(0 65% 50%)" stopOpacity={0.95}/>
                  <stop offset="100%" stopColor="hsl(0 65% 50%)" stopOpacity={0.6}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" vertical={false} />
              <XAxis 
                dataKey={labelKey} 
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                axisLine={{ stroke: "hsl(var(--border))" }}
                tickLine={false}
                interval={viewMode === "daily" ? 3 : 0}
              />
              <YAxis
                tickFormatter={(value) => formatChartCurrency(value)}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                width={90}
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
                radius={[6, 6, 0, 0]}
                maxBarSize={36}
              />
              <Bar
                dataKey="saidas"
                name="Saídas"
                fill="url(#colorExpense)"
                radius={[6, 6, 0, 0]}
                maxBarSize={36}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Month Detail Modal */}
      <Dialog open={!!selectedMonth} onOpenChange={(open) => !open && setSelectedMonth(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto w-[calc(100vw-2rem)] sm:w-full p-4">
          <DialogHeader className="pb-2">
            <DialogTitle className="capitalize text-base">{selectedMonth?.label}</DialogTitle>
          </DialogHeader>
          <div className="divide-y divide-border/50">
            {monthTransactions && monthTransactions.length > 0 ? (
              monthTransactions.slice(0, 50).map((tx) => (
                <div 
                  key={tx.id} 
                  className="flex items-center justify-between py-2.5 gap-3 cursor-pointer hover:bg-muted/30 -mx-1 px-1 rounded transition-colors"
                  onClick={() => setEditingTransaction(tx)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{tx.description || tx.raw_description}</p>
                    <span className="text-[11px] text-muted-foreground">
                      {format(parseLocalDate(tx.date), "dd/MM", { locale: ptBR })}
                    </span>
                  </div>
                  <span className={`text-sm font-semibold tabular-nums shrink-0 ${tx.type === "income" ? "text-primary" : "text-destructive"}`}>
                    {tx.type === "income" ? "+" : "−"}{formatCurrency(Math.abs(Number(tx.amount))).replace("R$\u00a0", "")}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma movimentação</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Transaction Dialog */}
      <TransactionDialog
        open={!!editingTransaction}
        onOpenChange={(open) => !open && setEditingTransaction(null)}
        transaction={editingTransaction}
        defaultType={editingTransaction?.type === "income" ? "income" : "expense"}
      />
    </>
  );
}
