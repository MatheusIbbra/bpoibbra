import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus,
  Search,
  Filter,
  ArrowLeftRight,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  RefreshCw,
  EyeOff,
  Link2,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export default function Extrato() {
  const { requiresBaseSelection } = useBaseFilter();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Fetch all transactions
  const { data: allTransactions, isLoading } = useTransactions({
    search: search || undefined,
  });

  // Filter by type if selected
  const transactions = allTransactions?.filter(t => 
    (typeFilter === "all" || t.type === typeFilter) &&
    !t.is_ignored
  ) || [];

  const deleteTransaction = useDeleteTransaction();

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

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "income":
        return <TrendingUpIcon className="h-5 w-5" />;
      case "expense":
        return <TrendingDownIcon className="h-5 w-5" />;
      case "transfer":
        return <ArrowLeftRight className="h-5 w-5" />;
      case "investment":
        return <TrendingDownIcon className="h-5 w-5" />;
      case "redemption":
        return <TrendingUpIcon className="h-5 w-5" />;
      default:
        return <ArrowLeftRight className="h-5 w-5" />;
    }
  };

  const getTransactionLabel = (type: string) => {
    switch (type) {
      case "income":
        return "Receita";
      case "expense":
        return "Despesa";
      case "transfer":
        return "Transferência";
      case "investment":
        return "Aplicação";
      case "redemption":
        return "Resgate";
      default:
        return type;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case "income":
        return "bg-emerald-500/10 text-emerald-500";
      case "expense":
        return "bg-rose-500/10 text-rose-500";
      case "transfer":
        return "bg-blue-500/10 text-blue-500";
      case "investment":
        return "bg-orange-500/10 text-orange-500";
      case "redemption":
        return "bg-emerald-500/10 text-emerald-500";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getAmountColor = (type: string) => {
    switch (type) {
      case "income":
      case "redemption":
        return "text-emerald-600";
      case "expense":
      case "investment":
        return "text-rose-600";
      default:
        return "";
    }
  };

  const formatAmount = (type: string, amount: number) => {
    const prefix = ["income", "redemption"].includes(type) ? "+ " : ["expense", "investment"].includes(type) ? "- " : "";
    return prefix + formatCurrency(amount);
  };

  // Show base selection required state
  if (requiresBaseSelection) {
    return (
      <AppLayout title="Extrato">
        <div className="space-y-6">
          <BaseRequiredAlert action="visualizar extrato" />
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <RefreshCw className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">Selecione uma base</h3>
              <p className="text-muted-foreground">
                Selecione uma base específica no menu superior para visualizar o extrato.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Extrato">
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar movimentações..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-44">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="income">Receita</SelectItem>
                <SelectItem value="expense">Despesa</SelectItem>
                <SelectItem value="transfer">Transferência</SelectItem>
                <SelectItem value="investment">Aplicação</SelectItem>
                <SelectItem value="redemption">Resgate</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => { setEditingTransaction(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Transação
          </Button>
        </div>

        {/* Transactions List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {isLoading ? "Carregando..." : `${transactions.length} transações`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">Nenhuma transação encontrada</h3>
                <p className="text-muted-foreground">
                  Todas as transações da base selecionada aparecerão aqui.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className={cn(
                      "flex items-center gap-4 rounded-lg border p-4 hover:bg-muted/50 transition-colors",
                      transaction.is_ignored && "opacity-50"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full shrink-0",
                        getTransactionColor(transaction.type)
                      )}
                    >
                      {getTransactionIcon(transaction.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium truncate">{transaction.description}</p>
                        <Badge variant="outline" className="shrink-0">
                          {getTransactionLabel(transaction.type)}
                        </Badge>
                        {transaction.status === "pending" && (
                          <Badge variant="secondary" className="shrink-0">
                            Pendente
                          </Badge>
                        )}
                        {transaction.linked_transaction_id && (
                          <span title="Transação vinculada">
                            <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                          </span>
                        )}
                        {transaction.is_ignored && (
                          <Badge variant="outline" className="shrink-0 text-muted-foreground">
                            <EyeOff className="h-3 w-3 mr-1" />
                            Ignorada
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{transaction.accounts?.name || "Conta"}</span>
                        {transaction.categories && (
                          <>
                            <span>•</span>
                            <span>{transaction.categories.name}</span>
                          </>
                        )}
                        <span>•</span>
                        <span>
                          {format(new Date(transaction.date), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className={cn("font-semibold", getAmountColor(transaction.type))}>
                        {formatAmount(transaction.type, Number(transaction.amount))}
                      </p>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="shrink-0">
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
      </div>

      <TransactionDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        transaction={editingTransaction}
        defaultType="expense"
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir movimentação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A movimentação será removida permanentemente.
              {transactions.find(t => t.id === deleteId)?.linked_transaction_id && (
                <span className="block mt-2 font-medium text-warning">
                  A transação vinculada também será excluída.
                </span>
              )}
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
