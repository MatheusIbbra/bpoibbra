import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { useDREReport, ReportBasis } from "@/hooks/useDREReport";
import { useCostCenters } from "@/hooks/useCostCenters";
import { PeriodSelector } from "@/components/reports/PeriodSelector";
import { BaseRequiredAlert } from "@/components/common/BaseRequiredAlert";
import { ComparisonIndicator } from "@/components/reports/ComparisonIndicator";
import {
  createProfessionalPDF,
  formatCurrencyForPDF,
  addSummarySection,
  addDRETable,
  addFooter,
} from "@/lib/pdf-generator";
import {
  Download,
  Loader2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  FileText,
  Banknote,
} from "lucide-react";
import { startOfMonth, endOfMonth, subMonths, subYears, format } from "date-fns";

export function DREContent() {
  const { requiresBaseSelection } = useBaseFilter();
  const [dateRange, setDateRange] = useState({
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date()),
  });
  const [basis, setBasis] = useState<ReportBasis>(() => {
    return (localStorage.getItem("report-basis-dre") as ReportBasis) || "accrual";
  });

  useEffect(() => {
    localStorage.setItem("report-basis-dre", basis);
  }, [basis]);
  const [costCenterId, setCostCenterId] = useState<string | undefined>(undefined);

  const { data: costCenters } = useCostCenters();
  const { data, isLoading } = useDREReport(dateRange.start, dateRange.end, basis, costCenterId);

  // Previous period for comparison (same duration, shifted back)
  const prevPeriod = useMemo(() => {
    const durationMs = dateRange.end.getTime() - dateRange.start.getTime();
    const prevEnd = new Date(dateRange.start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - durationMs);
    return { start: prevStart, end: prevEnd };
  }, [dateRange]);

  const { data: prevData } = useDREReport(prevPeriod.start, prevPeriod.end, basis, costCenterId);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const exportToPDF = async () => {
    if (!data) return;

    const basisLabel = basis === "cash" ? "Regime de Caixa" : "Regime de Competência";

    const doc = await createProfessionalPDF({
      title: "Demonstrativo de Resultado (DRE)",
      subtitle: basisLabel,
      period: dateRange,
    });

    let yPos = addSummarySection(doc, [
      { label: "Receita Bruta", value: formatCurrencyForPDF(data.grossRevenue), highlight: "positive" },
      { label: "Despesas Operacionais", value: formatCurrencyForPDF(data.totalOperatingExpenses), highlight: "negative" },
      { label: "Resultado Operacional", value: formatCurrencyForPDF(data.operatingIncome), highlight: data.operatingIncome >= 0 ? "positive" : "negative" },
      { label: "Resultado Líquido", value: formatCurrencyForPDF(data.netIncome), highlight: data.netIncome >= 0 ? "positive" : "negative" },
    ], 75);

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(26, 35, 64);
    doc.text("Demonstrativo Detalhado", 14, yPos + 10);

    const dreLines = [
      { label: "RECEITA BRUTA", value: data.grossRevenue, percentage: 100 },
      { label: "(-) Deduções", value: -data.deductions, indent: 1 },
      { label: "RECEITA LÍQUIDA", value: data.netRevenue, isSubtotal: true },
      { label: "", value: 0 },
      { label: "DESPESAS OPERACIONAIS", value: 0 },
      ...data.operatingExpenses.map((exp) => ({
        label: exp.category_name,
        value: -exp.total,
        indent: 1,
      })),
      { label: "TOTAL DESPESAS OPERACIONAIS", value: -data.totalOperatingExpenses, isSubtotal: true },
      { label: "", value: 0 },
      { label: "RESULTADO OPERACIONAL", value: data.operatingIncome, isSubtotal: true },
      { label: "", value: 0 },
      { label: "(+) Resgates", value: data.redemptions, indent: 1 },
      { label: "(-) Investimentos", value: -data.investments, indent: 1 },
      { label: "RESULTADO FINANCEIRO LÍQUIDO", value: data.financialResult, isSubtotal: true },
      { label: "", value: 0 },
      { label: "RESULTADO LÍQUIDO DO PERÍODO", value: data.netIncome, isTotal: true },
    ];

    addDRETable(doc, dreLines, yPos + 15);
    addFooter(doc);
    
    doc.save(`dre-${basis}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
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

          <Tabs value={basis} onValueChange={(v) => setBasis(v as ReportBasis)}>
            <TabsList className="h-8">
              <TabsTrigger value="cash" className="gap-2 text-xs h-7">
                <Banknote className="h-3 w-3" />
                Caixa
              </TabsTrigger>
              <TabsTrigger value="accrual" className="gap-2 text-xs h-7">
                <FileText className="h-3 w-3" />
                Competência
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Select value={costCenterId || "all"} onValueChange={(v) => setCostCenterId(v === "all" ? undefined : v)}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Centro de Custo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos C.Custo</SelectItem>
              {costCenters?.filter(c => c.is_active).map((cc) => (
                <SelectItem key={cc.id} value={cc.id}>{cc.name}</SelectItem>
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
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between py-2 px-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Receita Bruta
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent className="py-2 px-3">
                <p className="text-lg font-bold text-success">
                  {formatCurrency(data?.grossRevenue || 0)}
                </p>
                {prevData && (
                  <ComparisonIndicator
                    current={data?.grossRevenue || 0}
                    previous={prevData.grossRevenue}
                    label="período anterior"
                  />
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between py-2 px-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Despesas Operacionais
                </CardTitle>
                <TrendingDown className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent className="py-2 px-3">
                <p className="text-lg font-bold text-destructive">
                  {formatCurrency(data?.totalOperatingExpenses || 0)}
                </p>
                {prevData && (
                  <ComparisonIndicator
                    current={data?.totalOperatingExpenses || 0}
                    previous={prevData.totalOperatingExpenses}
                    label="período anterior"
                    invertColors
                  />
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between py-2 px-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Resultado Operacional
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="py-2 px-3">
                <p className={`text-lg font-bold ${(data?.operatingIncome || 0) >= 0 ? "text-success" : "text-destructive"}`}>
                  {formatCurrency(data?.operatingIncome || 0)}
                </p>
                {prevData && (
                  <ComparisonIndicator
                    current={data?.operatingIncome || 0}
                    previous={prevData.operatingIncome}
                    label="período anterior"
                  />
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between py-2 px-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Resultado Líquido
                </CardTitle>
                <DollarSign className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent className="py-2 px-3">
                <p className={`text-lg font-bold ${(data?.netIncome || 0) >= 0 ? "text-success" : "text-destructive"}`}>
                  {formatCurrency(data?.netIncome || 0)}
                </p>
                {prevData && (
                  <ComparisonIndicator
                    current={data?.netIncome || 0}
                    previous={prevData.netIncome}
                    label="período anterior"
                  />
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-sm">
            <CardHeader className="py-3 px-4">
              <CardTitle className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4" />
                Demonstrativo de Resultado
                <Badge variant="secondary" className="ml-2 text-xs">
                  {basis === "cash" ? "Regime de Caixa" : "Regime de Competência"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-1 text-sm">
                <div className="flex justify-between py-2 font-semibold border-b">
                  <span>RECEITA BRUTA</span>
                  <span className="text-success">{formatCurrency(data?.grossRevenue || 0)}</span>
                </div>
                <div className="flex justify-between py-1 text-muted-foreground">
                  <span className="pl-4">(-) Deduções</span>
                  <span>{formatCurrency(data?.deductions || 0)}</span>
                </div>
                <div className="flex justify-between py-2 font-semibold border-b bg-muted/50 px-2 rounded">
                  <span>RECEITA LÍQUIDA</span>
                  <span>{formatCurrency(data?.netRevenue || 0)}</span>
                </div>

                <div className="flex justify-between py-2 font-semibold mt-3">
                  <span>DESPESAS OPERACIONAIS</span>
                  <span></span>
                </div>
                {data?.operatingExpenses.map((exp) => (
                  <div key={exp.category_id} className="flex justify-between py-1">
                    <span className="pl-4 flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: exp.category_color }} />
                      {exp.category_name}
                    </span>
                    <span className="text-destructive">{formatCurrency(exp.total)}</span>
                  </div>
                ))}
                <div className="flex justify-between py-2 font-semibold border-t border-b">
                  <span className="pl-4">TOTAL DESPESAS OPERACIONAIS</span>
                  <span className="text-destructive">{formatCurrency(data?.totalOperatingExpenses || 0)}</span>
                </div>

                <div className="flex justify-between py-2 font-semibold mt-3 bg-muted/50 px-2 rounded">
                  <span>RESULTADO OPERACIONAL</span>
                  <span className={(data?.operatingIncome || 0) >= 0 ? "text-success" : "text-destructive"}>
                    {formatCurrency(data?.operatingIncome || 0)}
                  </span>
                </div>

                <div className="flex justify-between py-2 font-semibold mt-3">
                  <span>RESULTADO FINANCEIRO</span>
                  <span></span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="pl-4">(+) Resgates</span>
                  <span className="text-success">{formatCurrency(data?.redemptions || 0)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="pl-4">(-) Investimentos</span>
                  <span className="text-destructive">{formatCurrency(data?.investments || 0)}</span>
                </div>
                <div className="flex justify-between py-2 font-semibold border-t">
                  <span className="pl-4">RESULTADO FINANCEIRO LÍQUIDO</span>
                  <span className={(data?.financialResult || 0) >= 0 ? "text-success" : "text-destructive"}>
                    {formatCurrency(data?.financialResult || 0)}
                  </span>
                </div>

                <div className="flex justify-between py-3 font-bold mt-3 bg-primary/10 px-2 rounded">
                  <span>RESULTADO LÍQUIDO DO PERÍODO</span>
                  <span className={(data?.netIncome || 0) >= 0 ? "text-success" : "text-destructive"}>
                    {formatCurrency(data?.netIncome || 0)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Regime info banner */}
          <div className="px-3 py-2 rounded-lg bg-muted/50 border border-border/50">
            <p className="text-[11px] text-muted-foreground text-center">
              📊 Este relatório está sendo exibido no <strong>{basis === "cash" ? "Regime de Caixa" : "Regime de Competência"}</strong>.
              {basis === "accrual" 
                ? " Os valores refletem as datas de competência (fato gerador)."
                : " Os valores refletem as datas de movimentação financeira efetiva."
              }
            </p>
          </div>
        </>
      )}
    </div>
  );
}