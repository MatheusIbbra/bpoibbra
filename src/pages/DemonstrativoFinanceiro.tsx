import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
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

export default function DemonstrativoFinanceiro() {
  const { user, loading: authLoading } = useAuth();
  const { selectedOrganizationId, requiresBaseSelection } = useBaseFilter();
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState({
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date()),
  });
  const [basis, setBasis] = useState<ReportBasis>("cash");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  if (!authLoading && !user) {
    navigate("/auth");
    return null;
  }

  const dateField = basis === "cash" ? "date" : "accrual_date";

  const { data, isLoading } = useQuery({
    queryKey: ["demonstrativo-financeiro-hierarquia", user?.id, selectedOrganizationId, format(dateRange.start, "yyyy-MM-dd"), format(dateRange.end, "yyyy-MM-dd"), basis],
    queryFn: async (): Promise<ReportData> => {
      // First, get all categories with their hierarchy
      let categoriesQuery = supabase
        .from("categories")
        .select("id, name, color, type, parent_id")
        .in("type", ["income", "expense"]);
      
      if (selectedOrganizationId) {
        categoriesQuery = categoriesQuery.eq("organization_id", selectedOrganizationId);
      }

      const { data: allCategories, error: catError } = await categoriesQuery;
      if (catError) throw catError;

      // Get transactions for the period
      let txQuery = supabase
        .from("transactions")
        .select(`
          id,
          amount,
          type,
          category_id
        `)
        .in("type", ["income", "expense"])
        .gte(dateField, format(dateRange.start, "yyyy-MM-dd"))
        .lte(dateField, format(dateRange.end, "yyyy-MM-dd"));

      if (selectedOrganizationId) {
        txQuery = txQuery.eq("organization_id", selectedOrganizationId);
      }

      const { data: transactions, error: txError } = await txQuery;
      if (txError) throw txError;

      // Calculate totals by category
      const categoryTotals = new Map<string, number>();
      transactions?.forEach((tx) => {
        if (tx.category_id) {
          const current = categoryTotals.get(tx.category_id) || 0;
          categoryTotals.set(tx.category_id, current + Number(tx.amount));
        }
      });

      // Organize categories into parent-child structure
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

          // Parent total is either direct transactions or sum of children
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

    // Add detailed breakdown using the new hierarchical table
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

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AppLayout title="Demonstrativo Financeiro">
      <div className="space-y-3">
        {/* Base Selection Alert */}
        {requiresBaseSelection && <BaseRequiredAlert action="gerar relatórios" />}
        
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

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={expandAll}>
              Expandir
            </Button>
            <Button variant="outline" size="sm" onClick={collapseAll}>
              Recolher
            </Button>
            <Button onClick={exportToPDF} disabled={!data || isLoading} className="gap-2">
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
            {/* Summary Cards - Compact */}
            <div className="grid gap-2 md:grid-cols-3">
              <Card className="border-l-2 border-l-green-500">
                <CardContent className="py-2 px-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-muted-foreground">Receitas</p>
                    <TrendingUp className="h-3 w-3 text-success" />
                  </div>
                  <p className="text-base font-bold text-success">
                    {formatCurrency(data?.incomeGroup.total || 0)}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-l-2 border-l-red-500">
                <CardContent className="py-2 px-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-muted-foreground">Despesas</p>
                    <TrendingDown className="h-3 w-3 text-destructive" />
                  </div>
                  <p className="text-base font-bold text-destructive">
                    {formatCurrency(data?.expenseGroup.total || 0)}
                  </p>
                </CardContent>
              </Card>

              <Card className={cn(
                "border-l-2",
                (data?.balance || 0) >= 0 ? "border-l-blue-500" : "border-l-orange-500"
              )}>
                <CardContent className="py-2 px-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-muted-foreground">Resultado</p>
                    <DollarSign className="h-3 w-3 text-primary" />
                  </div>
                  <p className={cn(
                    "text-base font-bold",
                    (data?.balance || 0) >= 0 ? "text-success" : "text-destructive"
                  )}>
                    {formatCurrency(data?.balance || 0)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Detailed Report - Clean table style */}
            <Card>
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Demonstrativo por Categoria
                  </CardTitle>
                  <Badge variant="secondary" className="text-[10px]">
                    {basis === "cash" ? "Caixa" : "Competência"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                <div className="space-y-4">
                  {/* RECEITAS */}
                  <div>
                    <div className="flex items-center justify-between py-2 px-3 bg-success/5 rounded border border-success/20">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-success" />
                        <span className="text-sm font-semibold text-success">RECEITAS</span>
                      </div>
                      <span className="text-sm font-bold text-success">
                        {formatCurrency(data?.incomeGroup.total || 0)}
                      </span>
                    </div>
                    
                    <div className="mt-1 space-y-0.5 pl-3">
                      {data?.incomeGroup.categories.map((category) => (
                        <CategoryRow
                          key={category.id}
                          category={category}
                          isExpanded={expandedCategories.has(category.id)}
                          onToggle={() => toggleCategory(category.id)}
                          formatCurrency={formatCurrency}
                          type="income"
                        />
                      ))}
                      {data?.incomeGroup.categories.length === 0 && (
                        <p className="text-xs text-muted-foreground py-2 italic">
                          Nenhuma receita no período
                        </p>
                      )}
                    </div>
                  </div>

                  {/* DESPESAS */}
                  <div>
                    <div className="flex items-center justify-between py-2 px-3 bg-destructive/5 rounded border border-destructive/20">
                      <div className="flex items-center gap-2">
                        <TrendingDown className="h-4 w-4 text-destructive" />
                        <span className="text-sm font-semibold text-destructive">DESPESAS</span>
                      </div>
                      <span className="text-sm font-bold text-destructive">
                        {formatCurrency(data?.expenseGroup.total || 0)}
                      </span>
                    </div>
                    
                    <div className="mt-1 space-y-0.5 pl-3">
                      {data?.expenseGroup.categories.map((category) => (
                        <CategoryRow
                          key={category.id}
                          category={category}
                          isExpanded={expandedCategories.has(category.id)}
                          onToggle={() => toggleCategory(category.id)}
                          formatCurrency={formatCurrency}
                          type="expense"
                        />
                      ))}
                      {data?.expenseGroup.categories.length === 0 && (
                        <p className="text-xs text-muted-foreground py-2 italic">
                          Nenhuma despesa no período
                        </p>
                      )}
                    </div>
                  </div>

                  {/* RESULTADO */}
                  <div className={cn(
                    "flex items-center justify-between py-2.5 px-3 rounded border-2",
                    (data?.balance || 0) >= 0 
                      ? "bg-primary/5 border-primary/30" 
                      : "bg-destructive/5 border-destructive/30"
                  )}>
                    <div className="flex items-center gap-2">
                      <DollarSign className={cn(
                        "h-4 w-4",
                        (data?.balance || 0) >= 0 ? "text-primary" : "text-destructive"
                      )} />
                      <span className={cn(
                        "text-sm font-bold",
                        (data?.balance || 0) >= 0 ? "text-primary" : "text-destructive"
                      )}>
                        RESULTADO DO PERÍODO
                      </span>
                    </div>
                    <span className={cn(
                      "font-bold text-base",
                      (data?.balance || 0) >= 0 ? "text-primary" : "text-destructive"
                    )}>
                      {formatCurrency(data?.balance || 0)}
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

interface CategoryRowProps {
  category: CategoryWithChildren;
  isExpanded: boolean;
  onToggle: () => void;
  formatCurrency: (value: number) => string;
  type: "income" | "expense";
}

function CategoryRow({ category, isExpanded, onToggle, formatCurrency, type }: CategoryRowProps) {
  const hasChildren = category.children.length > 0;
  const colorClass = type === "income" ? "text-success" : "text-destructive";

  return (
    <div>
      <div
        className={cn(
          "flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 transition-colors text-sm",
          hasChildren && "cursor-pointer"
        )}
        onClick={hasChildren ? onToggle : undefined}
      >
        <div className="flex items-center gap-1.5">
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )
          ) : (
            <div className="w-3.5" />
          )}
          <div
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: category.color }}
          />
          <span className="font-medium text-sm">{category.name}</span>
          {hasChildren && (
            <span className="text-[10px] text-muted-foreground">({category.children.length})</span>
          )}
        </div>
        <span className={cn("font-semibold tabular-nums text-sm", colorClass)}>
          {formatCurrency(category.total)}
        </span>
      </div>

      {hasChildren && isExpanded && (
        <div className="ml-5 border-l border-muted pl-2 space-y-0.5">
          {category.children.map((child) => (
            <div
              key={child.id}
              className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <div
                  className="h-1 w-1 rounded-full"
                  style={{ backgroundColor: child.color }}
                />
                <span className="text-xs text-muted-foreground">{child.name}</span>
              </div>
              <span className={cn("text-xs tabular-nums", colorClass)}>
                {formatCurrency(child.total)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
