import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { useDREReport, ReportBasis } from "@/hooks/useDREReport";
import { PeriodSelector } from "@/components/reports/PeriodSelector";
import { BaseRequiredAlert } from "@/components/common/BaseRequiredAlert";
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
import { startOfMonth, endOfMonth, format } from "date-fns";

export default function RelatorioDRE() {
  const { user, loading: authLoading } = useAuth();
  const { requiresBaseSelection } = useBaseFilter();
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState({
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date()),
  });
  const [basis, setBasis] = useState<ReportBasis>("cash");

  if (!authLoading && !user) {
    navigate("/auth");
    return null;
  }

  const { data, isLoading } = useDREReport(dateRange.start, dateRange.end, basis);

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

    // Summary section
    let yPos = addSummarySection(doc, [
      { label: "Receita Bruta", value: formatCurrencyForPDF(data.grossRevenue), highlight: "positive" },
      { label: "Despesas Operacionais", value: formatCurrencyForPDF(data.totalOperatingExpenses), highlight: "negative" },
      { label: "Resultado Operacional", value: formatCurrencyForPDF(data.operatingIncome), highlight: data.operatingIncome >= 0 ? "positive" : "negative" },
      { label: "Resultado Líquido", value: formatCurrencyForPDF(data.netIncome), highlight: data.netIncome >= 0 ? "positive" : "negative" },
    ], 75);

    // DRE detailed table
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

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AppLayout title="DRE - Demonstrativo de Resultado">
      <div className="space-y-3">
        {/* Base Selection Alert */}
        {requiresBaseSelection && <BaseRequiredAlert action="gerar relatórios" />}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4 flex-wrap">
            <PeriodSelector dateRange={dateRange} onDateRangeChange={setDateRange} />

            <Tabs value={basis} onValueChange={(v) => setBasis(v as ReportBasis)}>
              <TabsList>
                <TabsTrigger value="cash" className="gap-2">
                  <Banknote className="h-4 w-4" />
                  Caixa
                </TabsTrigger>
                <TabsTrigger value="accrual" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Competência
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <Button onClick={exportToPDF} disabled={!data || isLoading} className="gap-2">
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
            {/* Summary Cards */}
            <div className="grid gap-2 md:grid-cols-4">
              <Card>
                <CardContent className="py-2.5 px-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Receita Bruta</p>
                    <TrendingUp className="h-3.5 w-3.5 text-success" />
                  </div>
                  <p className="text-lg font-bold text-success mt-0.5">
                    {formatCurrency(data?.grossRevenue || 0)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="py-2.5 px-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Desp. Operacionais</p>
                    <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                  </div>
                  <p className="text-lg font-bold text-destructive mt-0.5">
                    {formatCurrency(data?.totalOperatingExpenses || 0)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="py-2.5 px-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Result. Operacional</p>
                    <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <p className={`text-lg font-bold mt-0.5 ${(data?.operatingIncome || 0) >= 0 ? "text-success" : "text-destructive"}`}>
                    {formatCurrency(data?.operatingIncome || 0)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="py-2.5 px-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Result. Líquido</p>
                    <DollarSign className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <p className={`text-lg font-bold mt-0.5 ${(data?.netIncome || 0) >= 0 ? "text-success" : "text-destructive"}`}>
                    {formatCurrency(data?.netIncome || 0)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* DRE Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5" />
                  Demonstrativo de Resultado
                  <Badge variant="secondary" className="ml-2">
                    {basis === "cash" ? "Regime de Caixa" : "Regime de Competência"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {/* Receitas */}
                  <div className="flex justify-between py-2 font-semibold border-b">
                    <span>RECEITA BRUTA</span>
                    <span className="text-success">{formatCurrency(data?.grossRevenue || 0)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-sm text-muted-foreground">
                    <span className="pl-4">(-) Deduções</span>
                    <span>{formatCurrency(data?.deductions || 0)}</span>
                  </div>
                  <div className="flex justify-between py-2 font-semibold border-b bg-muted/50 px-2 rounded">
                    <span>RECEITA LÍQUIDA</span>
                    <span>{formatCurrency(data?.netRevenue || 0)}</span>
                  </div>

                  {/* Despesas */}
                  <div className="flex justify-between py-2 font-semibold mt-4">
                    <span>DESPESAS OPERACIONAIS</span>
                    <span></span>
                  </div>
                  {data?.operatingExpenses.map((exp) => (
                    <div key={exp.category_id} className="flex justify-between py-1 text-sm">
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

                  {/* Resultado Operacional */}
                  <div className="flex justify-between py-2 font-semibold mt-4 bg-muted/50 px-2 rounded">
                    <span>RESULTADO OPERACIONAL</span>
                    <span className={(data?.operatingIncome || 0) >= 0 ? "text-success" : "text-destructive"}>
                      {formatCurrency(data?.operatingIncome || 0)}
                    </span>
                  </div>

                  {/* Resultado Financeiro */}
                  <div className="flex justify-between py-2 font-semibold mt-4">
                    <span>RESULTADO FINANCEIRO</span>
                    <span></span>
                  </div>
                  <div className="flex justify-between py-1 text-sm">
                    <span className="pl-4">(+) Resgates</span>
                    <span className="text-success">{formatCurrency(data?.redemptions || 0)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-sm">
                    <span className="pl-4">(-) Investimentos</span>
                    <span className="text-destructive">{formatCurrency(data?.investments || 0)}</span>
                  </div>
                  <div className="flex justify-between py-2 font-semibold border-t">
                    <span className="pl-4">RESULTADO FINANCEIRO LÍQUIDO</span>
                    <span className={(data?.financialResult || 0) >= 0 ? "text-success" : "text-destructive"}>
                      {formatCurrency(data?.financialResult || 0)}
                    </span>
                  </div>

                  {/* Resultado Líquido */}
                  <div className="flex justify-between py-3 font-bold text-lg mt-4 bg-primary/10 px-2 rounded">
                    <span>RESULTADO LÍQUIDO DO PERÍODO</span>
                    <span className={(data?.netIncome || 0) >= 0 ? "text-success" : "text-destructive"}>
                      {formatCurrency(data?.netIncome || 0)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
