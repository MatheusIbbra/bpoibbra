import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus,
  Search,
  ArrowUpRight,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  TrendingUp,
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
import { StatCard } from "@/components/dashboard/StatCard";
import { useTransactions, useDeleteTransaction, Transaction } from "@/hooks/useTransactions";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { BaseRequiredAlert } from "@/components/common/BaseRequiredAlert";
import { useNavigate } from "react-router-dom";
import { formatCurrency } from "@/lib/formatters";

export default function Receitas() {
  const { requiresBaseSelection } = useBaseFilter();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Only show classified income transactions (those with category_id)
  const { data: transactions, isLoading } = useTransactions({
    type: "income",
    search: search || undefined,
  });

  // Filter to only show classified transactions (with category)
  const classifiedTransactions = transactions?.filter(t => t.category_id !== null) || [];

  const deleteTransaction = useDeleteTransaction();

  const totalIncome = classifiedTransactions.reduce((acc, t) => acc + Number(t.amount), 0);

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
      // Check if the edited transaction changed type
      setEditingTransaction(null);
    }
  };

  const handleTransactionSaved = (newType?: string) => {
    // If the transaction type was changed, redirect appropriately
    if (newType && newType !== "income") {
      if (newType === "expense") {
        navigate("/despesas");
      } else if (["transfer", "investment", "redemption"].includes(newType)) {
        navigate("/transacoes");
      }
    }
  };

  // Show base selection required state
  if (requiresBaseSelection) {
    return (
      <AppLayout title="Receitas">
        <div className="space-y-6">
          <BaseRequiredAlert action="visualizar receitas" />
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">Selecione uma base</h3>
              <p className="text-muted-foreground">
                Selecione uma base específica no menu superior para visualizar as receitas.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Receitas">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Total de Receitas"
            value={formatCurrency(totalIncome)}
            icon={<TrendingUp className="h-6 w-6" />}
            variant="success"
          />
        </div>

        {/* Header Actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar receitas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={() => { setEditingTransaction(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Receita
          </Button>
        </div>

        {/* Income List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {isLoading ? "Carregando..." : `${classifiedTransactions.length} receitas classificadas`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : classifiedTransactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">Nenhuma receita classificada</h3>
                <p className="text-muted-foreground">
                  As receitas aparecerão aqui após serem classificadas.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {classifiedTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center gap-4 rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10 text-success shrink-0">
                      <ArrowUpRight className="h-5 w-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{transaction.description}</p>
                        {transaction.status === "pending" && (
                          <Badge variant="outline" className="shrink-0">
                            Pendente
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{transaction.categories?.name || "Sem categoria"}</span>
                        <span>•</span>
                        <span>
                          {format(new Date(transaction.date), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="font-semibold text-success">
                        +{formatCurrency(Number(transaction.amount))}
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
        defaultType="income"
        onSaved={handleTransactionSaved}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir receita?</AlertDialogTitle>
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
