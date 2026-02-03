import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useReportsData, ReportBasis } from "@/hooks/useReportsData";
import { PeriodSelector } from "@/components/reports/PeriodSelector";
import {
  createProfessionalPDF,
  formatCurrencyForPDF,
  addSummarySection,
  addTableWithStyle,
  addFooter,
} from "@/lib/pdf-generator";
import {
  Download,
  TrendingUp,
  TrendingDown,
  Loader2,
  PieChart,
  FileText,
  Banknote,
} from "lucide-react";
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { startOfMonth, endOfMonth, format } from "date-fns";

export default function Relatorios() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState({
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date()),
  });
  const [basis, setBasis] = useState<ReportBasis>("cash");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  const { data, isLoading } = useReportsData(dateRange.start, dateRange.end, basis);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const exportToPDF = async () => {
    if (!data) return;

    const doc = await createProfessionalPDF({
      title: "Relatório Financeiro",
      subtitle: "Resumo de Receitas e Despesas por Categoria",
      period: dateRange,
    });

    // Summary section
    let yPos = addSummarySection(doc, [
      { label: "Total de Receitas", value: formatCurrencyForPDF(data.totalIncome), highlight: "positive" },
      { label: "Total de Despesas", value: formatCurrencyForPDF(data.totalExpense), highlight: "negative" },
      { label: "Saldo do Período", value: formatCurrencyForPDF(data.balance), highlight: data.balance >= 0 ? "positive" : "negative" },
    ], 75);

    // Income by Category
    if (data.incomeByCategory.length > 0) {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(26, 35, 64);
      doc.text("Receitas por Categoria", 14, yPos + 10);

      yPos = addTableWithStyle(
        doc,
        ["Categoria", "Total", "Percentual"],
        data.incomeByCategory.map((c) => [
          c.category_name,
          formatCurrencyForPDF(c.total),
          `${c.percentage.toFixed(1)}%`,
        ]),
        yPos + 15,
        {
          headStyles: { fillColor: [22, 163, 74], textColor: [255, 255, 255] },
          columnStyles: { 0: { cellWidth: 80 }, 1: { halign: "right" }, 2: { halign: "right" } },
        }
      );
    }

    // Expense by Category
    if (data.expenseByCategory.length > 0) {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(26, 35, 64);
      doc.text("Despesas por Categoria", 14, yPos + 10);

      yPos = addTableWithStyle(
        doc,
        ["Categoria", "Total", "Percentual"],
        data.expenseByCategory.map((c) => [
          c.category_name,
          formatCurrencyForPDF(c.total),
          `${c.percentage.toFixed(1)}%`,
        ]),
        yPos + 15,
        {
          headStyles: { fillColor: [220, 38, 38], textColor: [255, 255, 255] },
          columnStyles: { 0: { cellWidth: 80 }, 1: { halign: "right" }, 2: { halign: "right" } },
        }
      );
    }

    // Transactions (new page if needed)
    if (data.transactions.length > 0 && yPos > 200) {
      doc.addPage();
      yPos = 20;
    }

    if (data.transactions.length > 0) {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(26, 35, 64);
      doc.text("Transações do Período", 14, yPos + 10);

      addTableWithStyle(
        doc,
        ["Data", "Descrição", "Categoria", "Tipo", "Valor"],
        data.transactions.slice(0, 50).map((tx) => [
          format(new Date(tx.date), "dd/MM/yyyy"),
          tx.description?.substring(0, 30) || "-",
          tx.category_name || "Sem categoria",
          tx.type === "income" ? "Receita" : "Despesa",
          formatCurrencyForPDF(tx.amount),
        ]),
        yPos + 15,
        {
          columnStyles: {
            0: { cellWidth: 25 },
            1: { cellWidth: 50 },
            2: { cellWidth: 40 },
            3: { cellWidth: 25 },
            4: { halign: "right", cellWidth: 30 },
          },
        }
      );
    }

    addFooter(doc);
    doc.save(`relatorio-financeiro-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <AppLayout title="Relatórios">
      <div className="space-y-6">
        {/* Header */}
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
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total de Receitas
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-success" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-success">
                    {formatCurrency(data?.totalIncome || 0)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total de Despesas
                  </CardTitle>
                  <TrendingDown className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-destructive">
                    {formatCurrency(data?.totalExpense || 0)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Saldo do Período
                  </CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p
                    className={`text-2xl font-bold ${
                      (data?.balance || 0) >= 0 ? "text-success" : "text-destructive"
                    }`}
                  >
                    {formatCurrency(data?.balance || 0)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Income Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <PieChart className="h-5 w-5 text-success" />
                    Receitas por Categoria
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data?.incomeByCategory && data.incomeByCategory.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <RechartsPieChart>
                        <Pie
                          data={data.incomeByCategory}
                          dataKey="total"
                          nameKey="category_name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={({ name, percent }) =>
                            `${name} (${(percent * 100).toFixed(0)}%)`
                          }
                          labelLine={false}
                        >
                          {data.incomeByCategory.map((entry, index) => (
                            <Cell key={index} fill={entry.category_color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => formatCurrency(value)}
                        />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-[250px] items-center justify-center text-muted-foreground">
                      Nenhuma receita no período
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Expense Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <PieChart className="h-5 w-5 text-destructive" />
                    Despesas por Categoria
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data?.expenseByCategory && data.expenseByCategory.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <RechartsPieChart>
                        <Pie
                          data={data.expenseByCategory}
                          dataKey="total"
                          nameKey="category_name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={({ name, percent }) =>
                            `${name} (${(percent * 100).toFixed(0)}%)`
                          }
                          labelLine={false}
                        >
                          {data.expenseByCategory.map((entry, index) => (
                            <Cell key={index} fill={entry.category_color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => formatCurrency(value)}
                        />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-[250px] items-center justify-center text-muted-foreground">
                      Nenhuma despesa no período
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Category Details */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Income Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Detalhamento de Receitas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {data?.incomeByCategory && data.incomeByCategory.length > 0 ? (
                    data.incomeByCategory.map((category) => (
                      <div key={category.category_id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: category.category_color }}
                            />
                            <span className="text-sm font-medium">
                              {category.category_name}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-semibold">
                              {formatCurrency(category.total)}
                            </span>
                            <Badge variant="secondary" className="ml-2 text-xs">
                              {category.percentage.toFixed(1)}%
                            </Badge>
                          </div>
                        </div>
                        <Progress value={category.percentage} className="h-2" />
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground">
                      Nenhuma receita no período
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Expense Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Detalhamento de Despesas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {data?.expenseByCategory && data.expenseByCategory.length > 0 ? (
                    data.expenseByCategory.map((category) => (
                      <div key={category.category_id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: category.category_color }}
                            />
                            <span className="text-sm font-medium">
                              {category.category_name}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-semibold">
                              {formatCurrency(category.total)}
                            </span>
                            <Badge variant="secondary" className="ml-2 text-xs">
                              {category.percentage.toFixed(1)}%
                            </Badge>
                          </div>
                        </div>
                        <Progress
                          value={category.percentage}
                          className="h-2 [&>div]:bg-destructive"
                        />
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground">
                      Nenhuma despesa no período
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
