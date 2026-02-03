import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownLeft, Loader2, ChevronLeft, ChevronRight, Filter, Check } from "lucide-react";
import { useTransactions, useUpdateTransaction } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { Link } from "react-router-dom";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const ITEMS_PER_PAGE = 6;

export function RecentTransactions() {
  const [currentPage, setCurrentPage] = useState(1);
  const [periodFilter, setPeriodFilter] = useState("current");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [classifyingId, setClassifyingId] = useState<string | null>(null);
  
  const { data: categories } = useCategories();
  const updateTransaction = useUpdateTransaction();
  
  // Calculate date range based on period filter
  const getDateRange = () => {
    const now = new Date();
    switch (periodFilter) {
      case "current":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "last":
        const lastMonth = subMonths(now, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      case "last3":
        return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) };
      case "last6":
        return { start: startOfMonth(subMonths(now, 5)), end: endOfMonth(now) };
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  };
  
  const dateRange = getDateRange();
  
  const { data: transactions, isLoading } = useTransactions({
    startDate: format(dateRange.start, "yyyy-MM-dd"),
    endDate: format(dateRange.end, "yyyy-MM-dd"),
    categoryId: categoryFilter !== "all" ? categoryFilter : undefined,
  });

  // Pagination
  const totalItems = transactions?.length || 0;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedTransactions = transactions?.slice(startIndex, startIndex + ITEMS_PER_PAGE) || [];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd MMM", { locale: ptBR });
  };

  const handleQuickClassify = async (transactionId: string, categoryId: string) => {
    setClassifyingId(transactionId);
    try {
      await updateTransaction.mutateAsync({
        id: transactionId,
        category_id: categoryId,
      });
      toast.success("Categoria atualizada!");
    } catch (error) {
      toast.error("Erro ao atualizar categoria");
    } finally {
      setClassifyingId(null);
    }
  };

  // Reset page when filters change
  const handlePeriodChange = (value: string) => {
    setPeriodFilter(value);
    setCurrentPage(1);
  };

  const handleCategoryChange = (value: string) => {
    setCategoryFilter(value);
    setCurrentPage(1);
  };

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-lg font-semibold">Transações Recentes</CardTitle>
          <Link to="/transacoes">
            <Badge variant="outline" className="cursor-pointer hover:bg-secondary">
              Ver todas
            </Badge>
          </Link>
        </div>
        
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={periodFilter} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current">Mês Atual</SelectItem>
              <SelectItem value="last">Mês Anterior</SelectItem>
              <SelectItem value="last3">Últimos 3 meses</SelectItem>
              <SelectItem value="last6">Últimos 6 meses</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={categoryFilter} onValueChange={handleCategoryChange}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {categories?.filter(c => !c.parent_id).map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-1">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : paginatedTransactions.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground">
            Nenhuma transação encontrada
          </div>
        ) : (
          <>
            {paginatedTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-muted/50 group"
              >
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full shrink-0",
                    transaction.type === "income"
                      ? "bg-success/10 text-success"
                      : "bg-destructive/10 text-destructive"
                  )}
                >
                  {transaction.type === "income" ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : (
                    <ArrowDownLeft className="h-4 w-4" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-none truncate">
                    {transaction.description}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {transaction.categories ? (
                      <Badge variant="secondary" className="text-xs">
                        {transaction.categories.name}
                      </Badge>
                    ) : (
                      <QuickCategorySelect
                        transactionId={transaction.id}
                        transactionType={transaction.type}
                        categories={categories || []}
                        isLoading={classifyingId === transaction.id}
                        onSelect={handleQuickClassify}
                      />
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      transaction.type === "income"
                        ? "text-success"
                        : "text-foreground"
                    )}
                  >
                    {transaction.type === "income" ? "+" : "-"}
                    {formatCurrency(transaction.amount)}
                  </span>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(transaction.date)}
                  </p>
                </div>
              </div>
            ))}
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-3 border-t">
                <p className="text-xs text-muted-foreground">
                  {startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, totalItems)} de {totalItems}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs px-2">
                    {currentPage}/{totalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface QuickCategorySelectProps {
  transactionId: string;
  transactionType: string;
  categories: any[];
  isLoading: boolean;
  onSelect: (transactionId: string, categoryId: string) => void;
}

function QuickCategorySelect({ transactionId, transactionType, categories, isLoading, onSelect }: QuickCategorySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const filteredCategories = categories?.filter(
    c => !c.parent_id && (c.type === transactionType || c.type === (transactionType === "income" ? "income" : "expense"))
  ) || [];
  
  if (isLoading) {
    return <Loader2 className="h-3 w-3 animate-spin" />;
  }
  
  return (
    <Select 
      open={isOpen} 
      onOpenChange={setIsOpen}
      onValueChange={(value) => {
        onSelect(transactionId, value);
        setIsOpen(false);
      }}
    >
      <SelectTrigger className="h-6 text-xs w-auto border-dashed">
        <SelectValue placeholder="+ Categoria" />
      </SelectTrigger>
      <SelectContent>
        {filteredCategories.map((cat) => (
          <SelectItem key={cat.id} value={cat.id} className="text-xs">
            {cat.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
