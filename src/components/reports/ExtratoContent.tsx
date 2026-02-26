import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TransactionDialog } from "@/components/transactions/TransactionDialog";
import { useTransactions, useDeleteTransaction, Transaction } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { useCostCenters } from "@/hooks/useCostCenters";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { BaseRequiredAlert } from "@/components/common/BaseRequiredAlert";
import { cn } from "@/lib/utils";
import { formatCurrency, parseLocalDate } from "@/lib/formatters";

type SortField = "date" | "amount" | "category";
type SortDirection = "asc" | "desc";

export function ExtratoContent() {
  const { requiresBaseSelection } = useBaseFilter();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [costCenterFilter, setCostCenterFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: allTransactions, isLoading } = useTransactions({ search: search || undefined });
  const { data: categories } = useCategories();
  const { data: costCenters } = useCostCenters();

  const transactions = (allTransactions || [])
    .filter(t =>
      (typeFilter === "all" || t.type === typeFilter) &&
      (categoryFilter === "all" || t.category_id === categoryFilter) &&
      (costCenterFilter === "all" || t.cost_center_id === costCenterFilter) &&
      !t.is_ignored
    )
    .sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "date":
          cmp = parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime();
          break;
        case "amount":
          cmp = Number(a.amount) - Number(b.amount);
          break;
        case "category":
          cmp = (a.categories?.name || "").localeCompare(b.categories?.name || "");
          break;
      }
      return sortDirection === "desc" ? -cmp : cmp;
    });

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
    if (!open) setEditingTransaction(null);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return sortDirection === "asc"
      ? <ArrowUp className="h-3 w-3 ml-1 text-primary" />
      : <ArrowDown className="h-3 w-3 ml-1 text-primary" />;
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "income": return "Receita";
      case "expense": return "Despesa";
      case "transfer": return "Transf.";
      case "investment": return "Aporte";
      case "redemption": return "Resgate";
      default: return type;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "income":
      case "redemption":
        return "text-success";
      case "expense":
      case "investment":
        return "text-destructive";
      default:
        return "text-muted-foreground";
    }
  };

  const formatAmount = (type: string, amount: number) => {
    const prefix = ["income", "redemption"].includes(type) ? "+ " : ["expense", "investment"].includes(type) ? "- " : "";
    return prefix + formatCurrency(amount);
  };

  if (requiresBaseSelection) {
    return (
      <div className="space-y-3">
        <BaseRequiredAlert action="visualizar extrato" />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-6 text-center">
            <RefreshCw className="h-8 w-8 text-muted-foreground mb-2" />
            <h3 className="text-sm font-semibold">Selecione uma base</h3>
            <p className="text-xs text-muted-foreground">Selecione uma base no menu superior.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filters - Compact */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-1.5 flex-wrap">
          <div className="relative flex-1 max-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[100px] h-8 text-xs">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="income">Receita</SelectItem>
              <SelectItem value="expense">Despesa</SelectItem>
              <SelectItem value="transfer">Transferência</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Cat.</SelectItem>
              {categories?.filter(c => !c.parent_id).map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={costCenterFilter} onValueChange={setCostCenterFilter}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue placeholder="Centro Custo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos CC</SelectItem>
              {costCenters?.map((cc) => (
                <SelectItem key={cc.id} value={cc.id}>{cc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" className="h-8 text-xs" onClick={() => { setEditingTransaction(null); setDialogOpen(true); }}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Nova
        </Button>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-xs text-muted-foreground">
            {isLoading ? "Carregando..." : `${transactions.length} transações`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center px-4">
              <AlertCircle className="h-6 w-6 text-muted-foreground mb-1" />
              <p className="text-xs text-muted-foreground">Nenhuma transação encontrada</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-[11px]">
                    <TableHead className="w-20 cursor-pointer" onClick={() => toggleSort("date")}>
                      <span className="flex items-center">Data <SortIcon field="date" /></span>
                    </TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="w-24 cursor-pointer" onClick={() => toggleSort("category")}>
                      <span className="flex items-center">Categoria <SortIcon field="category" /></span>
                    </TableHead>
                    <TableHead className="w-24">Conta</TableHead>
                    <TableHead className="w-16 text-center">Tipo</TableHead>
                    <TableHead className="w-28 text-right cursor-pointer" onClick={() => toggleSort("amount")}>
                      <span className="flex items-center justify-end">Valor <SortIcon field="amount" /></span>
                    </TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction) => (
                    <TableRow key={transaction.id} className="text-xs">
                      <TableCell className="font-medium py-1.5">
                        {format(parseLocalDate(transaction.date), "dd/MM/yy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate py-1.5">
                        {transaction.description || "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground truncate max-w-[90px] py-1.5">
                        {transaction.categories?.name || "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground truncate max-w-[90px] py-1.5">
                        {transaction.accounts?.name || "-"}
                      </TableCell>
                      <TableCell className="text-center py-1.5">
                        <Badge variant="outline" className="text-[9px] px-1 py-0">
                          {getTypeLabel(transaction.type)}
                        </Badge>
                      </TableCell>
                      <TableCell className={cn("text-right font-medium py-1.5", getTypeColor(transaction.type))}>
                        {formatAmount(transaction.type, Number(transaction.amount))}
                      </TableCell>
                      <TableCell className="py-1.5">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(transaction)}>
                              <Pencil className="h-3.5 w-3.5 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeleteId(transaction.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

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
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
