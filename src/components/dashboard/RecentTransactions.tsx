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

const ITEMS_PER_PAGE = 8;

export function RecentTransactions() {
  const [currentPage, setCurrentPage] = useState(1);
  const [periodFilter, setPeriodFilter] = useState("current");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [classifyingId, setClassifyingId] = useState<string | null>(null);
  
  const { data: categories } = useCategories();
  const updateTransaction = useUpdateTransaction();
  
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

  const totalItems = transactions?.length || 0;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedTransactions = transactions?.slice(startIndex, startIndex + ITEMS_PER_PAGE) || [];

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const formatDate = (dateString: string) =>
    format(new Date(dateString), "dd MMM", { locale: ptBR });

  const handleQuickClassify = async (transactionId: string, categoryId: string) => {
    setClassifyingId(transactionId);
    try {
      await updateTransaction.mutateAsync({ id: transactionId, category_id: categoryId });
      toast.success("Categoria atualizada!");
    } catch (error) {
      toast.error("Erro ao atualizar categoria");
    } finally {
      setClassifyingId(null);
    }
  };

  const handlePeriodChange = (value: string) => { setPeriodFilter(value); setCurrentPage(1); };
  const handleCategoryChange = (value: string) => { setCategoryFilter(value); setCurrentPage(1); };

  return (
    <Card>
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Transações Recentes</CardTitle>
          <Link to="/transacoes">
            <Badge variant="outline" className="cursor-pointer hover:bg-secondary text-[10px]">
              Ver todas
            </Badge>
          </Link>
        </div>
        
        {/* Compact Filters */}
        <div className="flex items-center gap-1.5 mt-2">
          <Select value={periodFilter} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-[120px] h-7 text-[11px]">
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
            <SelectTrigger className="w-[120px] h-7 text-[11px]">
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
      
      <CardContent className="px-4 pb-3 pt-1">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : paginatedTransactions.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-muted-foreground text-sm">
            Nenhuma transação encontrada
          </div>
        ) : (
          <>
            <div className="divide-y divide-border/50">
              {paginatedTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center gap-2.5 py-2 first:pt-0"
                >
                  <div className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full shrink-0",
                    transaction.type === "income"
                      ? "bg-success/10 text-success"
                      : "bg-destructive/10 text-destructive"
                  )}>
                    {transaction.type === "income" ? (
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    ) : (
                      <ArrowDownLeft className="h-3.5 w-3.5" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium leading-none truncate">
                      {transaction.description}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {transaction.categories ? (
                        <span className="text-[10px] text-muted-foreground">
                          {transaction.categories.name}
                        </span>
                      ) : (
                        <QuickCategorySelect
                          transactionId={transaction.id}
                          transactionType={transaction.type}
                          categories={categories || []}
                          isLoading={classifyingId === transaction.id}
                          onSelect={handleQuickClassify}
                        />
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        · {formatDate(transaction.date)}
                      </span>
                    </div>
                  </div>

                  <span className={cn(
                    "text-xs font-semibold shrink-0",
                    transaction.type === "income" ? "text-success" : "text-foreground"
                  )}>
                    {transaction.type === "income" ? "+" : "-"}
                    {formatCurrency(transaction.amount)}
                  </span>
                </div>
              ))}
            </div>
            
            {/* Compact Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2 mt-1 border-t">
                <p className="text-[10px] text-muted-foreground">
                  {startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, totalItems)} de {totalItems}
                </p>
                <div className="flex items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="text-[10px] px-1.5">{currentPage}/{totalPages}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
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
      <SelectTrigger className="h-5 text-[10px] w-auto border-dashed px-1.5">
        <SelectValue placeholder="+ Cat." />
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
