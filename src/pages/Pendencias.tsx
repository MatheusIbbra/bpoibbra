import { useState, useMemo } from "react";
import { parseLocalDate } from "@/lib/formatters";
import { AlertCircle, Check, X, ChevronLeft, ChevronRight, Filter, Sparkles, Loader2, ArrowLeftRight, TrendingUp, TrendingDown, Wallet, PiggyBank, ArrowRight, Building2, BookOpen, Brain, Zap, Search, Calendar, RefreshCw } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { supabase } from "@/integrations/supabase/client";
import { format, isWithinInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

const ITEMS_PER_PAGE = 10;

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
  const [searchTerm, setSearchTerm] = useState("");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [classifyingId, setClassifyingId] = useState<string | null>(null);
  
  const { data: allTransactions, isLoading, refetch } = useTransactions();
  const { data: categories } = useCategories();
  const { data: costCenters } = useCostCenters();
  const { data: accounts } = useAccounts();
  const updateTransaction = useUpdateTransaction();
  const { availableOrganizations } = useBaseFilter();
  const aiClassification = useAIClassification();
  
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
  const totalPages = Math.ceil(pendingTransactions.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedTransactions = pendingTransactions.slice(startIndex, startIndex + ITEMS_PER_PAGE);

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

  // AI Classification handler
  const handleClassifyWithAI = async (transaction: any) => {
    setClassifyingId(transaction.id);
    
    try {
      const result = await aiClassification.mutateAsync({
        transaction_id: transaction.id,
        description: transaction.description || transaction.raw_description || "",
        amount: Number(transaction.amount),
        type: transaction.type as "income" | "expense",
      });
      
      if (result.category_id) {
        toast.success("Transação classificada pela IA!");
        refetch();
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
      
      // Atualizar validation status
      await supabase
        .from("transactions")
        .update({ 
          validation_status: "validated",
          validated_at: new Date().toISOString()
        })
        .eq("id", transactionId);
        
      toast.success("Transação validada com sucesso!");
      
      // Retornar dados para o feedback loop
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
      refetch();
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
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 h-7 text-xs">
              <X className="h-3 w-3" />
              Limpar filtros
            </Button>
          )}
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
                onClassifyWithAI={handleClassifyWithAI}
                isClassifying={classifyingId === transaction.id}
              />
            ))}
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-3 border-t border-border/50">
                <p className="text-[11px] text-muted-foreground">
                  {startIndex + 1}–{Math.min(startIndex + ITEMS_PER_PAGE, pendingTransactions.length)} de {pendingTransactions.length}
                </p>
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
                    {currentPage}/{totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
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
    <div className="border rounded-lg px-3 py-3 space-y-2.5 hover:bg-muted/20 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium">{transaction.description || transaction.raw_description}</p>
            
            {/* Classification Source Badge */}
            {classificationSource && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    {classificationSource === "rule" && (
                      <Badge variant="default" className="gap-1 bg-emerald-500 hover:bg-emerald-600">
                        <BookOpen className="h-3 w-3" />
                        Regra
                      </Badge>
                    )}
                    {classificationSource === "pattern" && (
                      <Badge variant="default" className="gap-1 bg-blue-500 hover:bg-blue-600">
                        <Brain className="h-3 w-3" />
                        Aprendido
                      </Badge>
                    )}
                    {classificationSource === "ai" && (
                      <Badge variant="secondary" className="gap-1">
                        <Sparkles className="h-3 w-3" />
                        IA
                      </Badge>
                    )}
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    {classificationSource === "rule" && (
                      <p className="text-sm">Classificado automaticamente por uma regra de conciliação</p>
                    )}
                    {classificationSource === "pattern" && (
                      <p className="text-sm">Classificado com base no histórico de validações similares</p>
                    )}
                    {classificationSource === "ai" && (
                      <p className="text-sm">Sugestão gerada pela inteligência artificial</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
            {/* AI Suggestion with confidence */}
            {aiSuggestion && !classificationSource && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge variant="secondary" className="gap-1">
                      <Sparkles className="h-3 w-3" />
                      IA
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="font-medium mb-1">Sugestão da IA ({Math.round((aiSuggestion.confidence_score || 0) * 100)}% confiança)</p>
                    <p className="text-sm">{aiSuggestion.reasoning}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
            {/* Confidence indicator */}
            {(aiSuggestion?.confidence_score || transaction.ai_confidence) && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge 
                      variant="outline" 
                      className={`gap-1 text-xs ${
                        (aiSuggestion?.confidence_score || transaction.ai_confidence || 0) >= 0.85 
                          ? "border-emerald-500 text-emerald-600" 
                          : (aiSuggestion?.confidence_score || transaction.ai_confidence || 0) >= 0.6 
                            ? "border-amber-500 text-amber-600" 
                            : "border-red-500 text-red-600"
                      }`}
                    >
                      <Zap className="h-3 w-3" />
                      {Math.round((aiSuggestion?.confidence_score || transaction.ai_confidence || 0) * 100)}%
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-sm">Nível de confiança da classificação</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
            {/* Organization Badge */}
            {organizationName && (
              <Badge variant="outline" className="gap-1 text-xs bg-primary/5 border-primary/20">
                <Building2 className="h-3 w-3" />
                {organizationName}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
            <span>{format(parseLocalDate(transaction.date), "dd/MM/yyyy", { locale: ptBR })}</span>
            <TransactionTypeBadge type={transaction.type} />
            {currentAccount && (
              <Badge variant="outline" className="text-xs">
                {currentAccount.name}
              </Badge>
            )}
            <span className="font-semibold text-foreground">
              {formatCurrency(Number(transaction.amount))}
            </span>
          </div>
        </div>
      </div>
      
      {/* Account flow indicator for transfers/investments/redemptions */}
      {requiresDestinationAccount && currentAccount && (
        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg text-sm">
          <Badge variant="secondary" className="gap-1">
            {currentAccount.name}
          </Badge>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedDestinationAccount} onValueChange={setSelectedDestinationAccount}>
            <SelectTrigger className="h-8 w-[200px]">
              <SelectValue placeholder="Selecione conta destino..." />
            </SelectTrigger>
            <SelectContent>
              {availableDestinationAccounts.map((acc) => (
                <SelectItem key={acc.id} value={acc.id}>
                  {acc.name} {acc.bank_name && `(${acc.bank_name})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground ml-2">
            {selectedType === "transfer" && "Transferência entre contas"}
            {selectedType === "investment" && "Aplicação em investimento"}
            {selectedType === "redemption" && "Resgate de investimento"}
          </span>
        </div>
      )}
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Tipo</label>
          <Select value={selectedType} onValueChange={(v) => setSelectedType(v as TransactionType)}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="income">
                <span className="flex items-center gap-2">
                  <TrendingUp className="h-3 w-3" /> Receita
                </span>
              </SelectItem>
              <SelectItem value="expense">
                <span className="flex items-center gap-2">
                  <TrendingDown className="h-3 w-3" /> Despesa
                </span>
              </SelectItem>
              <SelectItem value="transfer">
                <span className="flex items-center gap-2">
                  <ArrowLeftRight className="h-3 w-3" /> Transferência
                </span>
              </SelectItem>
              <SelectItem value="investment">
                <span className="flex items-center gap-2">
                  <PiggyBank className="h-3 w-3" /> Aplicação
                </span>
              </SelectItem>
              <SelectItem value="redemption">
                <span className="flex items-center gap-2">
                  <Wallet className="h-3 w-3" /> Resgate
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Categoria</label>
          <Select 
            value={selectedCategory} 
            onValueChange={setSelectedCategory}
            disabled={requiresDestinationAccount}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder={requiresDestinationAccount ? "N/A" : "Selecione..."} />
            </SelectTrigger>
            <SelectContent>
              {filteredCategories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Centro de Custo</label>
          <Select 
            value={selectedCostCenter} 
            onValueChange={setSelectedCostCenter}
            disabled={requiresDestinationAccount}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder={requiresDestinationAccount ? "N/A" : "Selecione..."} />
            </SelectTrigger>
            <SelectContent>
              {costCenters?.map((cc) => (
                <SelectItem key={cc.id} value={cc.id}>
                  {cc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-end gap-2 lg:col-span-2">
          {/* AI Classify Button */}
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => onClassifyWithAI(transaction)}
            disabled={isClassifying || !!classificationSource}
          >
            {isClassifying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Classificar IA
          </Button>
          
          {aiSuggestion && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={handleAcceptSuggestion}
            >
              <Sparkles className="h-4 w-4" />
              Usar
            </Button>
          )}
          
          <Button
            variant="default"
            size="sm"
            className="gap-1"
            onClick={handleValidate}
            disabled={isLoading || (requiresDestinationAccount && !selectedDestinationAccount)}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Validar
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-destructive hover:text-destructive"
            onClick={() => onReject(transaction.id)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
