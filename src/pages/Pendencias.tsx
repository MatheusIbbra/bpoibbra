import { useState, useMemo, useCallback } from "react";
import { parseLocalDate } from "@/lib/formatters";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Check, X, ChevronLeft, ChevronRight, Filter, Sparkles, Loader2, ArrowLeftRight, TrendingUp, TrendingDown, Wallet, PiggyBank, ArrowRight, Building2, BookOpen, Brain, Zap, Search, Calendar, RefreshCw, Trash2, Wand2, EyeOff, CheckCheck } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { useTransactions, TransactionType, useUpdateTransaction } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { useCostCenters } from "@/hooks/useCostCenters";
import { useAccounts } from "@/hooks/useAccounts";
import { useAISuggestions } from "@/hooks/useImportBatches";
import { useLearnFromValidation } from "@/hooks/useTransactionPatterns";
import { useAIClassification } from "@/hooks/useAIClassification";
import { useToggleIgnoreTransaction } from "@/hooks/useToggleIgnore";
import { useAutoIgnoreTransfers } from "@/hooks/useAutoIgnoreTransfers";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { supabase } from "@/integrations/supabase/client";
import { format, isWithinInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 500] as const;

// Component for displaying transaction type with appropriate styling
function TransactionTypeBadge({ type }: { type: TransactionType }) {
  const typeConfig: Record<TransactionType, { label: string; variant: "default" | "destructive" | "secondary" | "outline"; icon: React.ReactNode }> = {
    income: { 
      label: "Receita", 
      variant: "default",
      icon: <TrendingUp className="h-3 w-3" />
    },
    expense: { 
      label: "Despesa", 
      variant: "destructive",
      icon: <TrendingDown className="h-3 w-3" />
    },
    transfer: { 
      label: "Transferência", 
      variant: "secondary",
      icon: <ArrowLeftRight className="h-3 w-3" />
    },
    investment: { 
      label: "Aplicação", 
      variant: "outline",
      icon: <PiggyBank className="h-3 w-3" />
    },
    redemption: { 
      label: "Resgate", 
      variant: "outline",
      icon: <Wallet className="h-3 w-3" />
    },
  };
  
  const config = typeConfig[type] || typeConfig.expense;
  
  return (
    <Badge variant={config.variant} className="gap-1">
      {config.icon}
      {config.label}
    </Badge>
  );
}

export default function Pendencias() {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [classifyingId, setClassifyingId] = useState<string | null>(null);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [isBulkClassifying, setIsBulkClassifying] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
  
  const { data: allTransactions, isLoading, refetch } = useTransactions();
  const { data: categories } = useCategories();
  const { data: costCenters } = useCostCenters();
  const { data: accounts } = useAccounts();
  const updateTransaction = useUpdateTransaction();
  const queryClient = useQueryClient();
  const { availableOrganizations, getRequiredOrganizationId } = useBaseFilter();
  const aiClassification = useAIClassification();
  const toggleIgnore = useToggleIgnoreTransaction();
  const autoIgnoreTransfers = useAutoIgnoreTransfers();
  const [ignoreTargetId, setIgnoreTargetId] = useState<string | null>(null);
  
  // Filter transactions pending validation with all filters applied
  const pendingTransactions = useMemo(() => {
    let filtered = allTransactions?.filter(t => t.validation_status === 'pending_validation') || [];
    
    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(t => 
        (t.description || '').toLowerCase().includes(term) ||
        (t.raw_description || '').toLowerCase().includes(term)
      );
    }
    
    // Account filter
    if (accountFilter !== "all") {
      filtered = filtered.filter(t => t.account_id === accountFilter);
    }
    
    // Type filter
    if (typeFilter !== "all") {
      filtered = filtered.filter(t => t.type === typeFilter);
    }
    
    // Date range filter
    if (dateRange?.from) {
      filtered = filtered.filter(t => {
        const txDate = parseISO(t.date);
        if (dateRange.to) {
          return isWithinInterval(txDate, { start: dateRange.from!, end: dateRange.to });
        }
        return txDate >= dateRange.from!;
      });
    }
    
    return filtered;
  }, [allTransactions, searchTerm, accountFilter, typeFilter, dateRange]);
  
  // Pagination
  const totalPages = Math.ceil(pendingTransactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTransactions = pendingTransactions.slice(startIndex, startIndex + itemsPerPage);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { 
      style: "currency", 
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  // Helper to get organization name by ID
  const getOrganizationName = (organizationId: string | null) => {
    if (!organizationId) return null;
    const org = availableOrganizations.find(o => o.id === organizationId);
    return org?.name || null;
  };

  // AI Classification handler - with immediate refetch
  const handleClassifyWithAI = async (transaction: any) => {
    setClassifyingId(transaction.id);
    
    try {
      const result = await aiClassification.mutateAsync({
        transaction_id: transaction.id,
        description: transaction.description || transaction.raw_description || "",
        amount: Number(transaction.amount),
        type: transaction.type as "income" | "expense",
        organization_id: transaction.organization_id,
      });
      
      if (result.category_id) {
        // If auto-validated, the transaction will disappear from pending list
        if (result.auto_validated) {
          toast.success("Transação classificada e validada pela IA!");
        } else {
          toast.success("Sugestão da IA aplicada! Revise e valide.");
        }
        // Immediate refetch - no need to change screens
        await queryClient.invalidateQueries({ queryKey: ["transactions"] });
        await refetch();
      } else {
        toast.info("IA não encontrou classificação para esta transação");
      }
    } catch (error) {
      console.error("Error classifying with AI:", error);
      toast.error("Erro ao classificar com IA");
    } finally {
      setClassifyingId(null);
    }
  };

  // Bulk AI Classification - classify ALL pending transactions at once
  const handleBulkClassifyWithAI = useCallback(async () => {
    const pending = pendingTransactions.filter(t => 
      !t.classification_source && (t.type === 'income' || t.type === 'expense')
    );
    
    if (pending.length === 0) {
      toast.info("Nenhuma transação pendente para classificar");
      return;
    }

    setIsBulkClassifying(true);
    setBulkProgress({ done: 0, total: pending.length });
    
    let classified = 0;
    let autoValidated = 0;
    let failed = 0;
    
    for (let i = 0; i < pending.length; i++) {
      const tx = pending[i];
      try {
        const result = await aiClassification.mutateAsync({
          transaction_id: tx.id,
          description: tx.description || tx.raw_description || "",
          amount: Number(tx.amount),
          type: tx.type as "income" | "expense",
          organization_id: tx.organization_id,
        });
        
        if (result.category_id) {
          classified++;
          if (result.auto_validated) autoValidated++;
        }
      } catch (error) {
        console.error(`Error classifying TX ${tx.id}:`, error);
        failed++;
      }
      
      setBulkProgress({ done: i + 1, total: pending.length });
    }
    
    // Refetch all data immediately
    await queryClient.invalidateQueries({ queryKey: ["transactions"] });
    await queryClient.invalidateQueries({ queryKey: ["pending-transactions-count"] });
    await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    await refetch();
    
    setIsBulkClassifying(false);
    setBulkProgress({ done: 0, total: 0 });
    
    toast.success(
      `IA classificou ${classified} de ${pending.length} transações. ` +
      `${autoValidated} auto-validadas. ${failed > 0 ? `${failed} erros.` : ''}`
    );
  }, [pendingTransactions, aiClassification, queryClient, refetch]);

  const handleValidate = async (
    transactionId: string, 
    categoryId: string | null, 
    costCenterId: string | null, 
    type: TransactionType,
    description: string,
    amount: number,
    organizationId: string | null
  ) => {
    try {
      await updateTransaction.mutateAsync({
        id: transactionId,
        category_id: categoryId,
        cost_center_id: costCenterId,
        type: type,
        status: "completed" as const,
      });
      
      // Update validation status
      await supabase
        .from("transactions")
        .update({ 
          validation_status: "validated",
          validated_at: new Date().toISOString()
        })
        .eq("id", transactionId);
        
      toast.success("Transação validada com sucesso!");
      
      // Immediate refetch - transaction disappears from list without page change
      await queryClient.invalidateQueries({ queryKey: ["transactions"] });
      await queryClient.invalidateQueries({ queryKey: ["pending-transactions-count"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      
      return { categoryId, costCenterId, type, description, amount, organizationId };
    } catch (error) {
      toast.error("Erro ao validar transação");
      return null;
    }
  };

  const handleReject = async (transactionId: string) => {
    try {
      await supabase
        .from("transactions")
        .update({ validation_status: "rejected" })
        .eq("id", transactionId);
        
      toast.info("Transação rejeitada");
      // Immediate refetch
      await queryClient.invalidateQueries({ queryKey: ["transactions"] });
      await queryClient.invalidateQueries({ queryKey: ["pending-transactions-count"] });
    } catch (error) {
      toast.error("Erro ao rejeitar transação");
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setAccountFilter("all");
    setTypeFilter("all");
    setDateRange(undefined);
    setCurrentPage(1);
  };

  const handleClearAllPending = useCallback(async () => {
    if (pendingTransactions.length === 0) return;
    setIsClearingAll(true);
    try {
      const ids = pendingTransactions.map(t => t.id);
      // Batch delete in chunks of 50
      for (let i = 0; i < ids.length; i += 50) {
        const chunk = ids.slice(i, i + 50);
        const { error } = await supabase
          .from("transactions")
          .delete()
          .in("id", chunk);
        if (error) throw error;
      }
      toast.success(`${ids.length} movimentação(ões) excluída(s) com sucesso!`);
      // Invalidate all related queries so dashboard updates
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-evolution"] });
      queryClient.invalidateQueries({ queryKey: ["credit-card-summary"] });
      queryClient.invalidateQueries({ queryKey: ["pending-transactions-count"] });
      queryClient.invalidateQueries({ queryKey: ["budget-analysis"] });
      queryClient.invalidateQueries({ queryKey: ["reconciliation-metrics"] });
      refetch();
    } catch (error) {
      console.error("Error clearing pending:", error);
      toast.error("Erro ao excluir movimentações");
    } finally {
      setIsClearingAll(false);
    }
  }, [pendingTransactions, refetch, queryClient]);

  const hasActiveFilters = searchTerm || accountFilter !== "all" || typeFilter !== "all" || dateRange?.from;

  return (
    <AppLayout title="Pendências">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-warning" />
              Pendentes de Validação
              {pendingTransactions.length > 0 && (
                <Badge variant="secondary" className="text-xs">{pendingTransactions.length}</Badge>
              )}
            </h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 h-7 text-xs">
                <X className="h-3 w-3" />
                Limpar filtros
              </Button>
            )}
            {pendingTransactions.length > 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-7 text-xs"
                  onClick={() => {
                    const orgId = getRequiredOrganizationId();
                    if (orgId) autoIgnoreTransfers.mutate(orgId);
                    else toast.error("Selecione uma base");
                  }}
                  disabled={autoIgnoreTransfers.isPending}
                >
                  {autoIgnoreTransfers.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <EyeOff className="h-3 w-3" />
                  )}
                  Ignorar Transferências
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-1.5 h-7 text-xs"
                  onClick={handleBulkClassifyWithAI}
                  disabled={isBulkClassifying}
                >
                  {isBulkClassifying ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {bulkProgress.done}/{bulkProgress.total}
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-3 w-3" />
                      Classificar Tudo (IA)
                    </>
                  )}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="gap-1.5 h-7 text-xs" disabled={isClearingAll}>
                      {isClearingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      Limpar todas ({pendingTransactions.length})
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir todas as pendências?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Isso irá excluir permanentemente {pendingTransactions.length} movimentação(ões) pendente(s). Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleClearAllPending}>
                        Confirmar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </div>

        {/* Compact Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="pl-8 h-8 text-sm"
            />
          </div>
          <Select value={accountFilter} onValueChange={(v) => { setAccountFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-[150px] h-8 text-xs">
              <SelectValue placeholder="Conta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as contas</SelectItem>
              {accounts?.map((acc) => (
                <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="income">Receita</SelectItem>
              <SelectItem value="expense">Despesa</SelectItem>
              <SelectItem value="transfer">Transferência</SelectItem>
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("h-8 text-xs", !dateRange?.from && "text-muted-foreground")}>
                <Calendar className="mr-1.5 h-3 w-3" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>{format(dateRange.from, "dd/MM", { locale: ptBR })} - {format(dateRange.to, "dd/MM", { locale: ptBR })}</>
                  ) : format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
                ) : "Período"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={(range) => { setDateRange(range); setCurrentPage(1); }}
                numberOfMonths={2}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : pendingTransactions.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <Check className="h-10 w-10 text-success mb-3" />
              <p className="text-sm font-semibold">Tudo validado!</p>
              <p className="text-xs text-muted-foreground mt-1">
                {hasActiveFilters ? "Nenhuma transação com os filtros aplicados." : "Todas as transações foram validadas."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {paginatedTransactions.map((transaction) => (
              <TransactionPendingCard
                key={transaction.id}
                transaction={transaction}
                categories={categories || []}
                costCenters={costCenters || []}
                accounts={accounts || []}
                organizationName={getOrganizationName(transaction.organization_id)}
                onValidate={handleValidate}
                onReject={handleReject}
                onIgnore={(id) => setIgnoreTargetId(id)}
                onClassifyWithAI={handleClassifyWithAI}
                isClassifying={classifyingId === transaction.id}
              />
            ))}
            
            {/* Pagination */}
            <div className="flex items-center justify-between pt-3 border-t border-border/50 flex-wrap gap-2">
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-xs text-muted-foreground">
                  {currentPage}/{totalPages || 1}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setCurrentPage(p => Math.min(totalPages || 1, p + 1))}
                  disabled={currentPage >= totalPages}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
                <p className="text-[11px] text-muted-foreground ml-2">
                  {startIndex + 1}–{Math.min(startIndex + itemsPerPage, pendingTransactions.length)} de {pendingTransactions.length}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground">Exibir:</span>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <Button
                    key={size}
                    variant={itemsPerPage === size ? "default" : "outline"}
                    size="sm"
                    className="h-6 px-2 text-[11px] min-w-[32px]"
                    onClick={() => { setItemsPerPage(size); setCurrentPage(1); }}
                  >
                    {size}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!ignoreTargetId}
        onOpenChange={() => setIgnoreTargetId(null)}
        title="Ignorar transação?"
        description="Esta transação não será mais considerada nos relatórios e dashboards. Deseja continuar?"
        confirmLabel="Ignorar"
        variant="warning"
        onConfirm={() => {
          if (ignoreTargetId) {
            toggleIgnore.mutate({ id: ignoreTargetId, is_ignored: true });
            setIgnoreTargetId(null);
          }
        }}
      />
    </AppLayout>
  );
}

interface TransactionPendingCardProps {
  transaction: any;
  categories: any[];
  costCenters: any[];
  accounts: any[];
  organizationName: string | null;
  onValidate: (
    id: string, 
    categoryId: string | null, 
    costCenterId: string | null, 
    type: TransactionType,
    description: string,
    amount: number,
    organizationId: string | null
  ) => Promise<any>;
  onReject: (id: string) => void;
  onIgnore: (id: string) => void;
  onClassifyWithAI: (transaction: any) => void;
  isClassifying: boolean;
}

function TransactionPendingCard({ 
  transaction, 
  categories, 
  costCenters,
  accounts,
  organizationName,
  onValidate, 
  onReject,
  onIgnore,
  onClassifyWithAI,
  isClassifying,
}: TransactionPendingCardProps) {
  const [selectedType, setSelectedType] = useState<TransactionType>(transaction.type);
  const [selectedCategory, setSelectedCategory] = useState<string>(transaction.category_id || "");
  const [selectedCostCenter, setSelectedCostCenter] = useState<string>(transaction.cost_center_id || "");
  const [selectedDestinationAccount, setSelectedDestinationAccount] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  
  const { data: aiSuggestion } = useAISuggestions(transaction.id);
  const learnFromValidation = useLearnFromValidation();
  
  // Get classification source from transaction
  const classificationSource = transaction.classification_source as "rule" | "pattern" | "ai" | null;
  
  const handleAcceptSuggestion = () => {
    if (aiSuggestion) {
      setSelectedCategory(aiSuggestion.suggested_category_id || "");
      setSelectedCostCenter(aiSuggestion.suggested_cost_center_id || "");
      if (aiSuggestion.suggested_type) {
        setSelectedType(aiSuggestion.suggested_type as TransactionType);
      }
    }
  };
  
  const handleValidate = async () => {
    setIsLoading(true);
    
    const description = transaction.description || transaction.raw_description || "";
    const amount = Number(transaction.amount);
    
    const result = await onValidate(
      transaction.id, 
      selectedCategory || null, 
      selectedCostCenter || null, 
      selectedType,
      description,
      amount,
      transaction.organization_id
    );
    
    // Feedback loop: aprender com a validação
    if (result && result.categoryId && result.organizationId) {
      learnFromValidation.mutate({
        organizationId: result.organizationId,
        description: result.description,
        categoryId: result.categoryId,
        costCenterId: result.costCenterId,
        transactionType: result.type,
        amount: result.amount,
      });
    }
    
    setIsLoading(false);
  };

  // Filter categories based on selected type
  const filteredCategories = categories?.filter(c => {
    // Only show child categories (those with parent_id)
    if (!c.parent_id) return false;
    if (selectedType === "income") return c.type === "income";
    if (selectedType === "expense") return c.type === "expense";
    if (selectedType === "investment") return c.type === "investment";
    if (selectedType === "redemption") return c.type === "redemption";
    return true; // transfer doesn't need category
  }) || [];

  // Check if type requires destination account
  const requiresDestinationAccount = ["transfer", "investment", "redemption"].includes(selectedType);
  
  // Get current account name for display
  const currentAccount = accounts?.find(acc => acc.id === transaction.account_id);
  
  // Filter available destination accounts (exclude current account)
  const availableDestinationAccounts = accounts?.filter(acc => acc.id !== transaction.account_id) || [];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { 
      style: "currency", 
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="border rounded-lg px-3 py-2 space-y-1.5 bg-card hover:bg-accent/30 transition-colors shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-xs font-medium truncate max-w-[280px]">{transaction.description || transaction.raw_description}</p>
            
            {/* Classification Source Badge */}
            {classificationSource && (
              <Badge variant={classificationSource === "rule" ? "default" : classificationSource === "pattern" ? "secondary" : "outline"} className="text-[9px] h-4 px-1.5 gap-0.5">
                {classificationSource === "rule" && <BookOpen className="h-2.5 w-2.5" />}
                {classificationSource === "pattern" && <Brain className="h-2.5 w-2.5" />}
                {classificationSource === "ai" && <Sparkles className="h-2.5 w-2.5" />}
                {classificationSource === "rule" ? "Regra" : classificationSource === "pattern" ? "Aprendido" : "IA"}
              </Badge>
            )}
            
            {aiSuggestion && !classificationSource && (
              <Badge variant="outline" className="text-[9px] h-4 px-1.5 gap-0.5">
                <Sparkles className="h-2.5 w-2.5" /> IA
              </Badge>
            )}
            
            {(aiSuggestion?.confidence_score || transaction.ai_confidence) && (
              <Badge variant="outline" className={`text-[9px] h-4 px-1.5 ${
                (aiSuggestion?.confidence_score || transaction.ai_confidence || 0) >= 0.85 
                  ? "border-success/50 text-success" 
                  : "border-warning/50 text-warning"
              }`}>
                <Zap className="h-2.5 w-2.5" />
                {Math.round((aiSuggestion?.confidence_score || transaction.ai_confidence || 0) * 100)}%
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
            <span>{format(parseLocalDate(transaction.date), "dd/MM/yy", { locale: ptBR })}</span>
            <TransactionTypeBadge type={transaction.type} />
            {currentAccount && <span className="truncate max-w-[80px]">{currentAccount.name}</span>}
            <span className="font-semibold text-foreground">{formatCurrency(Number(transaction.amount))}</span>
          </div>
        </div>
      </div>
      
      {/* Account flow for transfers */}
      {requiresDestinationAccount && currentAccount && (
        <div className="flex items-center gap-2 p-1.5 bg-muted/30 rounded text-xs">
          <Badge variant="secondary" className="text-[9px] h-5">{currentAccount.name}</Badge>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <Select value={selectedDestinationAccount} onValueChange={setSelectedDestinationAccount}>
            <SelectTrigger className="h-6 w-[160px] text-[11px]">
              <SelectValue placeholder="Conta destino..." />
            </SelectTrigger>
            <SelectContent>
              {availableDestinationAccounts.map((acc) => (
                <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5">
        <div>
          <Select value={selectedType} onValueChange={(v) => setSelectedType(v as TransactionType)}>
            <SelectTrigger className="h-7 text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="income"><span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Receita</span></SelectItem>
              <SelectItem value="expense"><span className="flex items-center gap-1"><TrendingDown className="h-3 w-3" /> Despesa</span></SelectItem>
              <SelectItem value="transfer"><span className="flex items-center gap-1"><ArrowLeftRight className="h-3 w-3" /> Transf.</span></SelectItem>
              <SelectItem value="investment"><span className="flex items-center gap-1"><PiggyBank className="h-3 w-3" /> Aplic.</span></SelectItem>
              <SelectItem value="redemption"><span className="flex items-center gap-1"><Wallet className="h-3 w-3" /> Resgate</span></SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory} disabled={requiresDestinationAccount}>
            <SelectTrigger className="h-7 text-[11px]">
              <SelectValue placeholder={requiresDestinationAccount ? "N/A" : "Categoria"} />
            </SelectTrigger>
            <SelectContent>
              {filteredCategories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Select value={selectedCostCenter} onValueChange={setSelectedCostCenter} disabled={requiresDestinationAccount}>
            <SelectTrigger className="h-7 text-[11px]">
              <SelectValue placeholder={requiresDestinationAccount ? "N/A" : "C. Custo"} />
            </SelectTrigger>
            <SelectContent>
              {costCenters?.map((cc) => (
                <SelectItem key={cc.id} value={cc.id}>{cc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-end gap-1 lg:col-span-2">
          <Button variant="outline" size="sm" className="h-7 text-[11px] gap-0.5 px-2" onClick={() => onClassifyWithAI(transaction)} disabled={isClassifying || !!classificationSource}>
            {isClassifying ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            IA
          </Button>
          {aiSuggestion && (
            <Button variant="outline" size="sm" className="h-7 text-[11px] gap-0.5 px-2" onClick={handleAcceptSuggestion}>
              <Sparkles className="h-3 w-3" /> Usar
            </Button>
          )}
          <Button variant="default" size="sm" className="h-7 text-[11px] gap-0.5 px-2" onClick={handleValidate} disabled={isLoading || (requiresDestinationAccount && !selectedDestinationAccount)}>
            {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            OK
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-warning" onClick={() => onIgnore(transaction.id)}>
            <EyeOff className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => onReject(transaction.id)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
