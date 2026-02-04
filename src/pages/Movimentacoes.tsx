import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus,
  Search,
  ArrowLeftRight,
  ArrowUpRight,
  ArrowDownLeft,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TransactionDialog } from "@/components/transactions/TransactionDialog";
import { useTransactions, useDeleteTransaction, Transaction } from "@/hooks/useTransactions";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { BaseRequiredAlert } from "@/components/common/BaseRequiredAlert";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";

export default function Movimentacoes() {
  const { requiresBaseSelection } = useBaseFilter();
  const [activeTab, setActiveTab] = useState("transacoes");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [defaultType, setDefaultType] = useState<"transfer" | "income" | "expense">("transfer");

  // Fetch all transactions
  const { data: allTransactions, isLoading } = useTransactions({
    search: search || undefined,
  });

  const deleteTransaction = useDeleteTransaction();

  // Filter transactions by type based on active tab
  const getFilteredTransactions = () => {
    if (!allTransactions) return [];
    
    switch (activeTab) {
      case "transacoes":
        return allTransactions.filter(t => 
          ["transfer", "investment", "redemption"].includes(t.type)
        );
      case "receitas":
        return allTransactions.filter(t => t.type === "income" && t.category_id !== null);
      case "despesas":
        return allTransactions.filter(t => t.type === "expense" && t.category_id !== null);
      default:
        return [];
    }
  };

  const filteredTransactions = getFilteredTransactions();

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteTransaction.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingTransaction(null);
    }
  };

  const handleNewTransaction = () => {
    setEditingTransaction(null);
    switch (activeTab) {
      case "receitas":
        setDefaultType("income");
        break;
      case "despesas":
        setDefaultType("expense");
        break;
      default:
        setDefaultType("transfer");
    }
    setDialogOpen(true);
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "transfer":
        return <ArrowLeftRight className="h-4 w-4" />;
      case "investment":
        return <TrendingDownIcon className="h-4 w-4" />;
      case "redemption":
        return <TrendingUpIcon className="h-4 w-4" />;
      case "income":
        return <ArrowUpRight className="h-4 w-4" />;
      case "expense":
        return <ArrowDownLeft className="h-4 w-4" />;
      default:
        return <ArrowLeftRight className="h-4 w-4" />;
    }
  };

  const getTransactionLabel = (type: string) => {
    switch (type) {
      case "transfer":
        return "Transferência";
      case "investment":
        return "Aplicação";
      case "redemption":
        return "Resgate";
      case "income":
        return "Receita";
      case "expense":
        return "Despesa";
      default:
        return type;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case "transfer":
        return "bg-blue-500/10 text-blue-500";
      case "investment":
        return "bg-orange-500/10 text-orange-500";
      case "redemption":
        return "bg-emerald-500/10 text-emerald-500";
      case "income":
        return "bg-success/10 text-success";
      case "expense":
        return "bg-destructive/10 text-destructive";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getNewButtonLabel = () => {
    switch (activeTab) {
      case "receitas":
        return "Nova Receita";
      case "despesas":
        return "Nova Despesa";
      default:
        return "Nova Transação";
    }
  };

  // Show base selection required state
  if (requiresBaseSelection) {
    return (
      <AppLayout title="Movimentações">
        <div className="space-y-4">
          <BaseRequiredAlert action="visualizar movimentações" />
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <RefreshCw className="h-10 w-10 text-muted-foreground mb-3" />
              <h3 className="font-semibold">Selecione uma base</h3>
              <p className="text-sm text-muted-foreground">
                Selecione uma base específica no menu superior para visualizar as movimentações.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Movimentações">
      <div className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <TabsList className="grid w-full sm:w-auto grid-cols-3">
              <TabsTrigger value="transacoes" className="text-xs sm:text-sm">Transações</TabsTrigger>
              <TabsTrigger value="receitas" className="text-xs sm:text-sm">Receitas</TabsTrigger>
              <TabsTrigger value="despesas" className="text-xs sm:text-sm">Despesas</TabsTrigger>
            </TabsList>
            
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
              <Button onClick={handleNewTransaction} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">{getNewButtonLabel()}</span>
                <span className="sm:hidden">Novo</span>
              </Button>
            </div>
          </div>

          <TabsContent value={activeTab} className="mt-4">
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-medium">
                  {isLoading ? "Carregando..." : `${filteredTransactions.length} registros`}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredTransactions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                    <AlertCircle className="h-10 w-10 text-muted-foreground mb-3" />
                    <h3 className="font-semibold">Nenhum registro encontrado</h3>
                    <p className="text-sm text-muted-foreground">
                      {activeTab === "transacoes" 
                        ? "Aqui aparecem transferências, aplicações e resgates."
                        : activeTab === "receitas"
                        ? "As receitas classificadas aparecerão aqui."
                        : "As despesas classificadas aparecerão aqui."}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredTransactions.map((transaction) => (
                      <div
                        key={transaction.id}
                        className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors"
                      >
                        <div
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-full shrink-0",
                            getTransactionColor(transaction.type)
                          )}
                        >
                          {getTransactionIcon(transaction.type)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{transaction.description}</p>
                            {activeTab === "transacoes" && (
                              <Badge variant="outline" className="shrink-0 text-xs h-5">
                                {getTransactionLabel(transaction.type)}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span>{transaction.categories?.name || transaction.accounts?.name || "—"}</span>
                            <span>•</span>
                            <span>{format(new Date(transaction.date), "dd/MM/yy", { locale: ptBR })}</span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <p className={cn(
                            "text-sm font-semibold",
                            transaction.type === "income" && "text-success",
                            transaction.type === "expense" && "text-destructive"
                          )}>
                            {transaction.type === "income" ? "+" : transaction.type === "expense" ? "-" : ""}
                            {formatCurrency(Number(transaction.amount))}
                          </p>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(transaction)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeleteId(transaction.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <TransactionDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        transaction={editingTransaction}
        defaultType={defaultType}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir movimentação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
