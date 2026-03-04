import { forwardRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMonthlyEvolution } from "@/hooks/useMonthlyEvolution";
import { useDailyEvolution } from "@/hooks/useDailyEvolution";
import { useTransactions } from "@/hooks/useTransactions";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Loader2, Calendar, CalendarDays } from "lucide-react";
import { startOfMonth, endOfMonth, parse, parseISO, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency, parseLocalDate } from "@/lib/formatters";
import { TransactionDialog } from "@/components/transactions/TransactionDialog";

// Compact currency: R$ 6.000 (no cents unless < 1000)
const fmtCompact = (value: number) => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`;
  }
  if (abs >= 1_000) {
    return `R$ ${(value / 1_000).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 1 })}k`;
  }
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const fmtFull = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

// Colors
const COLOR_INCOME  = "#22c55e";
const COLOR_EXPENSE = "#ef4444";
const COLOR_NET     = "#6366f1"; // indigo for the line

interface TooltipPayloadItem {
  color: string;
  name: string;
  value: number;
  dataKey: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

const CustomTooltipContent = forwardRef<HTMLDivElement, CustomTooltipProps>(
  ({ active, payload, label }, ref) => {
    if (!active || !payload?.length) return null;

    const income  = payload.find((p) => p.dataKey === "entradas")?.value ?? 0;
    const expense = payload.find((p) => p.dataKey === "saidas")?.value ?? 0;
    const net     = income - expense;

    return (
      <div
        ref={ref}
        className="rounded-xl border bg-card/95 backdrop-blur-sm p-3 shadow-executive text-sm min-w-[160px]"
      >
        <p className="font-semibold text-foreground mb-2 text-xs uppercase tracking-wider">{label}</p>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ background: COLOR_INCOME }} />
              Entradas
            </span>
            <span className="text-xs font-semibold text-[#22c55e]">{fmtFull(income)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ background: COLOR_EXPENSE }} />
              Saídas
            </span>
            <span className="text-xs font-semibold text-[#ef4444]">{fmtFull(expense)}</span>
          </div>
          <div className="border-t border-border/50 pt-1 mt-1 flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ background: COLOR_NET }} />
              Saldo líquido
            </span>
            <span className={`text-xs font-bold ${net >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
              {net >= 0 ? "+" : ""}{fmtFull(net)}
            </span>
          </div>
        </div>
      </div>
    );
  }
);

CustomTooltipContent.displayName = "CustomTooltipContent";

type ViewMode = "monthly" | "daily";

export function MonthlyEvolutionChart({ selectedMonthFilter }: { selectedMonthFilter?: Date } = {}) {
  const [viewMode, setViewMode] = useState<ViewMode>("monthly");
  const [selectedMonth, setSelectedMonth] = useState<{ start: string; end: string; label: string } | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);

  const { data: monthlyData, isLoading: isLoadingMonthly } = useMonthlyEvolution(6);
  const { data: dailyData, isLoading: isLoadingDaily } = useDailyEvolution(selectedMonthFilter);

  const { data: monthTransactions } = useTransactions({
    startDate: selectedMonth?.start,
    endDate: selectedMonth?.end,
  });

  const isLoading = viewMode === "monthly" ? isLoadingMonthly : isLoadingDaily;
  const rawData = viewMode === "monthly" ? monthlyData : dailyData;
  const labelKey = viewMode === "monthly" ? "monthLabel" : "dayLabel";

  // Build chart data — filter out months/days with zero income AND zero expense
  const data = (rawData || [])
    .map((item) => ({
      ...item,
      entradas: item.income,
      saidas: item.expense,
      liquido: item.income - item.expense,
    }))
    .filter((item) => item.entradas > 0 || item.saidas > 0);

  const handleBarClick = (state: any) => {
    if (!state?.activePayload?.length) return;
    const clicked = state.activePayload[0].payload;
    if (viewMode === "daily" && clicked.day) {
      setSelectedMonth({
        start: clicked.day,
        end: clicked.day,
        label: format(parseISO(clicked.day), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }),
      });
    } else if (clicked.month) {
      const monthDate = parse(clicked.month, "yyyy-MM", new Date());
      const start = format(startOfMonth(monthDate), "yyyy-MM-dd");
      const end = format(endOfMonth(monthDate), "yyyy-MM-dd");
      const label = format(monthDate, "MMMM yyyy", { locale: ptBR });
      setSelectedMonth({ start, end, label });
    }
  };

  const tabsBlock = (
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
  );

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
          {tabsBlock}
        </CardHeader>
        <CardContent className="flex h-[220px] items-center justify-center">
          <p className="text-muted-foreground text-sm">Nenhuma transação encontrada</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="shadow-executive h-full flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            Evolução Financeira
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          </CardTitle>
          {tabsBlock}
        </CardHeader>
        <CardContent className="px-2 pb-4 flex-1 flex flex-col justify-center">
          <ResponsiveContainer width="100%" height={230}>
            <ComposedChart
              data={data}
              margin={{ top: 16, right: 8, left: 0, bottom: 0 }}
              barCategoryGap="30%"
              barGap={4}
              onClick={handleBarClick}
              style={{ cursor: "pointer" }}
            >
              <defs>
                <linearGradient id="gradIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLOR_INCOME} stopOpacity={0.9} />
                  <stop offset="100%" stopColor={COLOR_INCOME} stopOpacity={0.55} />
                </linearGradient>
                <linearGradient id="gradExpense" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLOR_EXPENSE} stopOpacity={0.9} />
                  <stop offset="100%" stopColor={COLOR_EXPENSE} stopOpacity={0.55} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="4 4"
                stroke="hsl(var(--border))"
                strokeOpacity={0.15}
                vertical={false}
              />

              <XAxis
                dataKey={labelKey}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval={viewMode === "daily" ? 4 : 0}
              />
              <YAxis
                tickFormatter={fmtCompact}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                width={54}
              />

              <Tooltip
                content={<CustomTooltipContent />}
                cursor={{ fill: "hsl(var(--muted) / 0.15)", radius: 6 } as any}
              />

              <Legend
                wrapperStyle={{ paddingTop: "10px", fontSize: "11px" }}
                formatter={(value) => (
                  <span className="text-foreground text-[11px] font-medium">{value}</span>
                )}
              />

              <Bar
                dataKey="entradas"
                name="Entradas"
                fill="url(#gradIncome)"
                radius={[6, 6, 2, 2]}
                maxBarSize={32}
              />
              <Bar
                dataKey="saidas"
                name="Saídas"
                fill="url(#gradExpense)"
                radius={[6, 6, 2, 2]}
                maxBarSize={32}
              />

              {/* Net balance line */}
              <Line
                type="monotone"
                dataKey="liquido"
                name="Saldo Líquido"
                stroke={COLOR_NET}
                strokeWidth={2}
                dot={{ fill: COLOR_NET, strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5, fill: COLOR_NET, strokeWidth: 2, stroke: "hsl(var(--background))" }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Month Detail Modal */}
      <Dialog open={!!selectedMonth} onOpenChange={(open) => !open && setSelectedMonth(null)}>
        <DialogContent className="max-w-md max-h-[85vh] w-[calc(100vw-1rem)] sm:w-full p-3 sm:p-6">
          <DialogHeader className="pb-1">
            <DialogTitle className="capitalize text-base">{selectedMonth?.label}</DialogTitle>
            <p className="text-xs text-muted-foreground">{monthTransactions?.length || 0} movimentações</p>
          </DialogHeader>
          <div className="space-y-0.5 overflow-y-auto max-h-[calc(85vh-6rem)]">
            {monthTransactions && monthTransactions.length > 0 ? (
              monthTransactions.slice(0, 50).map((tx) => (
                <button
                  key={tx.id}
                  className="w-full flex items-center justify-between py-2 px-2 sm:px-3 rounded-lg hover:bg-muted/50 transition-colors text-left gap-2"
                  onClick={() => setEditingTransaction(tx)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium truncate">{tx.description || tx.raw_description}</p>
                    <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 truncate">
                      {format(parseLocalDate(tx.date), "dd/MM", { locale: ptBR })}
                      {tx.categories?.name ? ` · ${tx.categories.name}` : ""}
                    </p>
                  </div>
                  <span
                    className={`text-xs sm:text-sm font-semibold tabular-nums shrink-0 ${
                      tx.type === "income" ? "text-[#22c55e]" : "text-[#ef4444]"
                    }`}
                  >
                    {tx.type === "income" ? "+" : "-"}{formatCurrency(Math.abs(Number(tx.amount)))}
                  </span>
                </button>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma movimentação</p>
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
