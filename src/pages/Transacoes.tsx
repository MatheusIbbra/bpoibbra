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
import { useNavigate } from "react-router-dom";
import { formatCurrency, parseLocalDate } from "@/lib/formatters";

export default function Transacoes() {
  const { requiresBaseSelection } = useBaseFilter();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Only fetch transfers, investments, and redemptions
  const { data: allTransactions, isLoading } = useTransactions({
    search: search || undefined,
  });

  // Filter to only show transfer, investment, and redemption types
  const transactions = allTransactions?.filter(t => 
    ["transfer", "investment", "redemption"].includes(t.type) &&
    (typeFilter === "all" || t.type === typeFilter)
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

  const handleTransactionSaved = (newType?: string) => {
    // If the transaction type was changed, redirect appropriately
    if (newType && !["transfer", "investment", "redemption"].includes(newType)) {
      if (newType === "income") {
        navigate("/receitas");
      } else if (newType === "expense") {
        navigate("/despesas");
      }
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
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

  // Show base selection required state
  if (requiresBaseSelection) {
    return (
      <AppLayout title="Transações">
        <div className="space-y-6">
          <BaseRequiredAlert action="visualizar transações" />
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <RefreshCw className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">Selecione uma base</h3>
              <p className="text-muted-foreground">
                Selecione uma base específica no menu superior para visualizar as transações.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Transações">
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar transações..."
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
                  Aqui aparecem transferências entre contas, aplicações e resgates.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center gap-3 md:gap-4 rounded-lg border p-3 md:p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div
                      className={cn(
                        "hidden sm:flex h-10 w-10 items-center justify-center rounded-full shrink-0",
                        getTransactionColor(transaction.type)
                      )}
                    >
                      {getTransactionIcon(transaction.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 md:gap-2">
                        <p className="font-medium text-sm md:text-base truncate">{transaction.description}</p>
                        <Badge variant="outline" className="shrink-0 text-[10px] md:text-xs">
                          {getTransactionLabel(transaction.type)}
                        </Badge>
                        {transaction.status === "pending" && (
                          <Badge variant="outline" className="shrink-0 text-[10px] md:text-xs">
                            Pendente
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
                        <span className="truncate">{transaction.accounts?.name || "Conta"}</span>
                        <span>•</span>
                        <span className="shrink-0">
                          {format(parseLocalDate(transaction.date), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="font-semibold text-sm md:text-base">
                        {formatCurrency(Number(transaction.amount))}
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
        defaultType="transfer"
        onSaved={handleTransactionSaved}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir transação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A transação será removida permanentemente.
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
