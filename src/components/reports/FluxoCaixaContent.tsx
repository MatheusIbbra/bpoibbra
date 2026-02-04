import { useState, forwardRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { useCashFlowReport, Granularity } from "@/hooks/useCashFlowReport";
import { PeriodSelector } from "@/components/reports/PeriodSelector";
import { BaseRequiredAlert } from "@/components/common/BaseRequiredAlert";
import {
  createProfessionalPDF,
  formatCurrencyForPDF,
  addSummarySection,
  addTableWithStyle,
  addFooter,
} from "@/lib/pdf-generator";
import {
  Download,
  Loader2,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  Wallet,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  TooltipProps,
} from "recharts";
import { startOfMonth, endOfMonth, format } from "date-fns";

const GRANULARITY_OPTIONS = [
  { value: "daily", label: "Diário" },
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensal" },
];

const CustomTooltipContent = forwardRef<
  HTMLDivElement,
  TooltipProps<number, string>
>(({ active, payload, label }, ref) => {
  if (!active || !payload?.length) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div ref={ref} className="rounded-lg border bg-background p-3 shadow-lg">
      <p className="font-medium text-sm">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} className="text-xs" style={{ color: entry.color }}>
          {entry.name}: {formatCurrency(entry.value as number)}
        </p>
      ))}
    </div>
  );
});
CustomTooltipContent.displayName = "CustomTooltipContent";

export function FluxoCaixaContent() {
  const { requiresBaseSelection } = useBaseFilter();
  const [dateRange, setDateRange] = useState({
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date()),
  });
  const [granularity, setGranularity] = useState<Granularity>("daily");

  const { data, isLoading } = useCashFlowReport(dateRange.start, dateRange.end, "cash", granularity);

  const displayPeriods = (() => {
    if (!data) return [];
    return [
      {
        period: "Saldo Inicial",
        inflows: 0,
        outflows: 0,
        investments: 0,
        redemptions: 0,
        netFlow: 0,
        cumulativeBalance: data.openingBalance,
      },
      ...data.periods,
    ];
  })();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const exportToPDF = async () => {
    if (!data) return;

    const basisLabel = "Regime de Caixa";

    const doc = await createProfessionalPDF({
      title: "Fluxo de Caixa",
      subtitle: basisLabel,
      period: dateRange,
    });

    let yPos = addSummarySection(doc, [
      { label: "Saldo Inicial", value: formatCurrencyForPDF(data.openingBalance) },
      { label: "Total Entradas", value: formatCurrencyForPDF(data.totalInflows), highlight: "positive" },
      { label: "Total Saídas", value: formatCurrencyForPDF(data.totalOutflows), highlight: "negative" },
      { label: "Investimentos", value: formatCurrencyForPDF(data.totalInvestments) },
      { label: "Resgates", value: formatCurrencyForPDF(data.totalRedemptions) },
      { label: "Saldo Final", value: formatCurrencyForPDF(data.closingBalance), highlight: data.closingBalance >= 0 ? "positive" : "negative" },
    ], 75);

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(26, 35, 64);
    doc.text("Detalhamento por Período", 14, yPos + 10);

    addTableWithStyle(
      doc,
      ["Período", "Entradas", "Saídas", "Invest.", "Resgates", "Fluxo Líq.", "Saldo Acum."],
      data.periods.map((p) => [
        p.period,
        formatCurrencyForPDF(p.inflows),
        formatCurrencyForPDF(p.outflows),
        formatCurrencyForPDF(p.investments),
        formatCurrencyForPDF(p.redemptions),
        formatCurrencyForPDF(p.netFlow),
        formatCurrencyForPDF(p.cumulativeBalance),
      ]),
      yPos + 15,
      {
        columnStyles: {
          0: { cellWidth: 30 },
          1: { halign: "right", cellWidth: 25 },
          2: { halign: "right", cellWidth: 25 },
          3: { halign: "right", cellWidth: 22 },
          4: { halign: "right", cellWidth: 22 },
          5: { halign: "right", cellWidth: 25 },
          6: { halign: "right", cellWidth: 28 },
        },
      }
    );

    addFooter(doc);
    doc.save(`fluxo-caixa-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  if (requiresBaseSelection) {
    return (
      <div className="space-y-4">
        <BaseRequiredAlert action="gerar relatórios" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4 flex-wrap">
          <PeriodSelector dateRange={dateRange} onDateRangeChange={setDateRange} />

          <Select value={granularity} onValueChange={(v) => setGranularity(v as Granularity)}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GRANULARITY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button size="sm" onClick={exportToPDF} disabled={!data || isLoading} className="gap-2">
          <Download className="h-4 w-4" />
          Exportar PDF
        </Button>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between py-2 px-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Saldo Inicial
                </CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="py-2 px-3">
                <p className="text-lg font-bold">
                  {formatCurrency(data?.openingBalance || 0)}
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between py-2 px-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Total Entradas
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent className="py-2 px-3">
                <p className="text-lg font-bold text-success">
                  {formatCurrency(data?.totalInflows || 0)}
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between py-2 px-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Total Saídas
                </CardTitle>
                <TrendingDown className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent className="py-2 px-3">
                <p className="text-lg font-bold text-destructive">
                  {formatCurrency(data?.totalOutflows || 0)}
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between py-2 px-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Saldo Final
                </CardTitle>
                <ArrowRightLeft className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent className="py-2 px-3">
                <p className={`text-lg font-bold ${(data?.closingBalance || 0) >= 0 ? "text-success" : "text-destructive"}`}>
                  {formatCurrency(data?.closingBalance || 0)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-sm">
            <CardHeader className="py-3 px-4">
              <CardTitle className="flex items-center gap-2 text-sm">
                Evolução do Saldo
                <Badge variant="secondary" className="text-xs">Regime de Caixa</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={displayPeriods}>
                    <defs>
                      <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="period" className="text-xs" tick={{ fontSize: 10 }} />
                    <YAxis className="text-xs" tick={{ fontSize: 10 }} tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="cumulativeBalance"
                      name="Saldo Acumulado"
                      stroke="hsl(var(--primary))"
                      fillOpacity={1}
                      fill="url(#colorBalance)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">Detalhamento por Período</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead>Período</TableHead>
                      <TableHead className="text-right">Entradas</TableHead>
                      <TableHead className="text-right">Saídas</TableHead>
                      <TableHead className="text-right">Invest.</TableHead>
                      <TableHead className="text-right">Resgates</TableHead>
                      <TableHead className="text-right">Fluxo Líq.</TableHead>
                      <TableHead className="text-right">Saldo Acum.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayPeriods.map((period, index) => (
                      <TableRow key={index} className="text-sm">
                        <TableCell className="font-medium">{period.period}</TableCell>
                        <TableCell className="text-right text-success">
                          {formatCurrency(period.inflows)}
                        </TableCell>
                        <TableCell className="text-right text-destructive">
                          {formatCurrency(period.outflows)}
                        </TableCell>
                        <TableCell className="text-right text-orange-500">
                          {formatCurrency(period.investments)}
                        </TableCell>
                        <TableCell className="text-right text-blue-500">
                          {formatCurrency(period.redemptions)}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${period.netFlow >= 0 ? "text-success" : "text-destructive"}`}>
                          {formatCurrency(period.netFlow)}
                        </TableCell>
                        <TableCell className={`text-right font-bold ${period.cumulativeBalance >= 0 ? "text-success" : "text-destructive"}`}>
                          {formatCurrency(period.cumulativeBalance)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
