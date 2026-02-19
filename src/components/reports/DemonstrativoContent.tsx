import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { PeriodSelector } from "@/components/reports/PeriodSelector";
import { BaseRequiredAlert } from "@/components/common/BaseRequiredAlert";
import {
  createProfessionalPDF,
  formatCurrencyForPDF,
  addSummarySection,
  addCategoryHierarchyTable,
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
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { cn } from "@/lib/utils";

type ReportBasis = "cash" | "accrual";

interface CategoryWithChildren {
  id: string;
  name: string;
  color: string;
  total: number;
  children: {
    id: string;
    name: string;
    color: string;
    total: number;
  }[];
}

interface TypeGroup {
  type: "income" | "expense";
  label: string;
  total: number;
  categories: CategoryWithChildren[];
}

interface ReportData {
  incomeGroup: TypeGroup;
  expenseGroup: TypeGroup;
  balance: number;
}

export function DemonstrativoContent() {
  const { user } = useAuth();
  const { selectedOrganizationId, requiresBaseSelection } = useBaseFilter();
  const [dateRange, setDateRange] = useState({
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date()),
  });
  const [basis, setBasis] = useState<ReportBasis>(() => {
    return (localStorage.getItem("report-basis-demonstrativo") as ReportBasis) || "cash";
  });

  useEffect(() => {
    localStorage.setItem("report-basis-demonstrativo", basis);
  }, [basis]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const startStr = format(dateRange.start, "yyyy-MM-dd");
  const endStr = format(dateRange.end, "yyyy-MM-dd");

  const { data, isLoading } = useQuery({
    queryKey: ["demonstrativo-financeiro-inline", user?.id, selectedOrganizationId, startStr, endStr, basis],
    queryFn: async (): Promise<ReportData> => {
      let categoriesQuery = supabase
        .from("categories")
        .select("id, name, color, type, parent_id")
        .in("type", ["income", "expense"]);
      
      if (selectedOrganizationId) {
        categoriesQuery = categoriesQuery.eq("organization_id", selectedOrganizationId);
      }

      const { data: allCategories, error: catError } = await categoriesQuery;
      if (catError) throw catError;

      let txQuery = supabase
        .from("transactions")
        .select(`id, amount, type, category_id, accrual_date, date`)
        .in("type", ["income", "expense"])
        .neq("is_ignored", true);

      if (basis === "cash") {
        txQuery = txQuery.gte("date", startStr).lte("date", endStr);
      } else {
        txQuery = txQuery.or(
          `and(accrual_date.gte.${startStr},accrual_date.lte.${endStr}),and(accrual_date.is.null,date.gte.${startStr},date.lte.${endStr})`
        );
      }

      if (selectedOrganizationId) {
        txQuery = txQuery.eq("organization_id", selectedOrganizationId);
      }

      const { data: transactions, error: txError } = await txQuery;
      if (txError) throw txError;

      const categoryTotals = new Map<string, number>();
      transactions?.forEach((tx) => {
        if (tx.category_id) {
          const current = categoryTotals.get(tx.category_id) || 0;
          categoryTotals.set(tx.category_id, current + Number(tx.amount));
        }
      });

      const parentCategories = allCategories?.filter(c => !c.parent_id) || [];
      const childCategories = allCategories?.filter(c => c.parent_id) || [];

      const buildCategoryTree = (type: "income" | "expense"): CategoryWithChildren[] => {
        const parents = parentCategories
          .filter(c => c.type === type)
          .sort((a, b) => a.name.localeCompare(b.name));
        
        return parents.map(parent => {
          const children = childCategories
            .filter(c => c.parent_id === parent.id)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(child => ({
              id: child.id,
              name: child.name,
              color: child.color || "#6366f1",
              total: categoryTotals.get(child.id) || 0,
            }));

          const directTotal = categoryTotals.get(parent.id) || 0;
          const childrenTotal = children.reduce((sum, c) => sum + c.total, 0);
          
          return {
            id: parent.id,
            name: parent.name,
            color: parent.color || "#6366f1",
            total: directTotal + childrenTotal,
            children,
          };
        }).filter(cat => cat.total > 0 || cat.children.some(c => c.total > 0));
      };

      const incomeCategories = buildCategoryTree("income");
      const expenseCategories = buildCategoryTree("expense");

      const totalIncome = incomeCategories.reduce((sum, cat) => sum + cat.total, 0);
      const totalExpense = expenseCategories.reduce((sum, cat) => sum + cat.total, 0);

      return {
        incomeGroup: {
          type: "income",
          label: "RECEITAS",
          total: totalIncome,
          categories: incomeCategories,
        },
        expenseGroup: {
          type: "expense",
          label: "DESPESAS",
          total: totalExpense,
          categories: expenseCategories,
        },
        balance: totalIncome - totalExpense,
      };
    },
    enabled: !!user,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const expandAll = () => {
    if (!data) return;
    const allIds = [
      ...data.incomeGroup.categories.map(c => c.id),
      ...data.expenseGroup.categories.map(c => c.id),
    ];
    setExpandedCategories(new Set(allIds));
  };

  const collapseAll = () => {
    setExpandedCategories(new Set());
  };

  const exportToPDF = async () => {
    if (!data) return;

    const basisLabel = basis === "cash" ? "Regime de Caixa" : "Regime de Competência";

    const doc = await createProfessionalPDF({
      title: "Demonstrativo Financeiro",
      subtitle: basisLabel,
      period: dateRange,
    });

    let yPos = addSummarySection(doc, [
      { label: "Total Receitas", value: formatCurrencyForPDF(data.incomeGroup.total), highlight: "positive" },
      { label: "Total Despesas", value: formatCurrencyForPDF(data.expenseGroup.total), highlight: "negative" },
      { label: "Resultado", value: formatCurrencyForPDF(data.balance), highlight: data.balance >= 0 ? "positive" : "negative" },
    ], 75);

    yPos = addCategoryHierarchyTable(doc, {
      incomeCategories: data.incomeGroup.categories.map(cat => ({
        name: cat.name,
        total: cat.total,
        children: cat.children.map(child => ({
          name: child.name,
          total: child.total,
        })),
      })),
      expenseCategories: data.expenseGroup.categories.map(cat => ({
        name: cat.name,
        total: cat.total,
        children: cat.children.map(child => ({
          name: child.name,
          total: child.total,
        })),
      })),
      totalIncome: data.incomeGroup.total,
      totalExpense: data.expenseGroup.total,
      balance: data.balance,
    }, yPos + 10);

    addFooter(doc);

    doc.save(`demonstrativo-financeiro-${basis}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  if (requiresBaseSelection) {
    return (
      <div className="space-y-4">
        <BaseRequiredAlert action="gerar relatórios" />
      </div>
    );
  }

  const CategoryRow = ({ category, type }: { category: CategoryWithChildren; type: "income" | "expense" }) => {
    const isExpanded = expandedCategories.has(category.id);
    const hasChildren = category.children.length > 0;

    return (
      <div>
        <Collapsible open={isExpanded} onOpenChange={() => toggleCategory(category.id)}>
          <CollapsibleTrigger asChild>
            <div className={cn(
              "flex items-center justify-between py-1.5 px-2 rounded cursor-pointer hover:bg-muted/50 transition-colors",
              hasChildren && "font-medium"
            )}>
              <div className="flex items-center gap-2">
                {hasChildren ? (
                  isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
                ) : (
                  <div className="w-3" />
                )}
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: category.color }} />
                <span className="text-sm">{category.name}</span>
              </div>
              <span className={cn(
                "text-sm font-medium",
                type === "income" ? "text-success" : "text-destructive"
              )}>
                {formatCurrency(category.total)}
              </span>
            </div>
          </CollapsibleTrigger>
          {hasChildren && (
            <CollapsibleContent>
              <div className="ml-6 border-l-2 border-muted pl-2 space-y-0.5">
                {category.children.map(child => (
                  <div key={child.id} className="flex items-center justify-between py-1 px-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: child.color }} />
                      <span className="text-xs text-muted-foreground">{child.name}</span>
                    </div>
                    <span className={cn(
                      "text-xs",
                      type === "income" ? "text-success" : "text-destructive"
                    )}>
                      {formatCurrency(child.total)}
                    </span>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          )}
        </Collapsible>
      </div>
    );
  };

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
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={expandAll}>
            Expandir
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            Recolher
          </Button>
          <Button size="sm" onClick={exportToPDF} disabled={!data || isLoading} className="gap-2">
            <Download className="h-4 w-4" />
            Exportar PDF
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Card className="border-l-4 border-l-success shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between py-2 px-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Total Receitas
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent className="py-2 px-3">
                <p className="text-lg font-bold text-success">
                  {formatCurrency(data?.incomeGroup.total || 0)}
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-destructive shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between py-2 px-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Total Despesas
                </CardTitle>
                <TrendingDown className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent className="py-2 px-3">
                <p className="text-lg font-bold text-destructive">
                  {formatCurrency(data?.expenseGroup.total || 0)}
                </p>
              </CardContent>
            </Card>

            <Card className={cn(
              "border-l-4 shadow-sm",
              (data?.balance || 0) >= 0 ? "border-l-primary" : "border-l-warning"
            )}>
              <CardHeader className="flex flex-row items-center justify-between py-2 px-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Resultado do Período
                </CardTitle>
                <DollarSign className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent className="py-2 px-3">
                <p className={cn(
                  "text-lg font-bold",
                  (data?.balance || 0) >= 0 ? "text-success" : "text-destructive"
                )}>
                  {formatCurrency(data?.balance || 0)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-sm">
            <CardHeader className="py-3 px-4">
              <CardTitle className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4" />
                Demonstrativo por Categoria
                <Badge variant="secondary" className="ml-2 text-xs">
                  {basis === "cash" ? "Regime de Caixa" : "Regime de Competência"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between py-2 px-3 bg-success/10 rounded-lg border border-success/20 mb-2">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-success" />
                      <span className="font-bold text-success text-sm">RECEITAS</span>
                    </div>
                    <span className="font-bold text-success">
                      {formatCurrency(data?.incomeGroup.total || 0)}
                    </span>
                  </div>
                  
                  <div className="space-y-0.5">
                    {data?.incomeGroup.categories.map((category) => (
                      <CategoryRow key={category.id} category={category} type="income" />
                    ))}
                    {data?.incomeGroup.categories.length === 0 && (
                      <p className="text-xs text-muted-foreground py-2 italic pl-4">
                        Nenhuma receita no período
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between py-2 px-3 bg-destructive/10 rounded-lg border border-destructive/20 mb-2">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-destructive" />
                      <span className="font-bold text-destructive text-sm">DESPESAS</span>
                    </div>
                    <span className="font-bold text-destructive">
                      {formatCurrency(data?.expenseGroup.total || 0)}
                    </span>
                  </div>
                  
                  <div className="space-y-0.5">
                    {data?.expenseGroup.categories.map((category) => (
                      <CategoryRow key={category.id} category={category} type="expense" />
                    ))}
                    {data?.expenseGroup.categories.length === 0 && (
                      <p className="text-xs text-muted-foreground py-2 italic pl-4">
                        Nenhuma despesa no período
                      </p>
                    )}
                  </div>
                </div>

                <div className={cn(
                  "flex items-center justify-between py-2.5 px-4 rounded-xl border",
                  (data?.balance || 0) >= 0 
                    ? "bg-primary/5 border-primary/20" 
                    : "bg-destructive/5 border-destructive/20"
                )}>
                  <div className="flex items-center gap-2">
                    <DollarSign className={cn(
                      "h-4 w-4",
                      (data?.balance || 0) >= 0 ? "text-primary" : "text-destructive"
                    )} />
                    <span className={cn(
                      "text-sm font-semibold tracking-tight",
                      (data?.balance || 0) >= 0 ? "text-primary" : "text-destructive"
                    )}>
                      Resultado do Período
                    </span>
                  </div>
                  <span className={cn(
                    "font-bold text-base tabular-nums",
                    (data?.balance || 0) >= 0 ? "text-success" : "text-destructive"
                  )} style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                    {formatCurrency(data?.balance || 0)}
                  </span>
                </div>

                {/* Regime info banner */}
                <div className="mt-4 px-3 py-2 rounded-lg bg-muted/50 border border-border/50">
                  <p className="text-[11px] text-muted-foreground text-center">
                    📊 Este relatório está sendo exibido no <strong>{basis === "cash" ? "Regime de Caixa" : "Regime de Competência"}</strong>.
                    {basis === "cash" 
                      ? " Os valores refletem as datas de movimentação financeira efetiva."
                      : " Os valores refletem as datas de competência (fato gerador)."
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
