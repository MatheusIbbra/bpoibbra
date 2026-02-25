import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  RefreshCw,
  EyeOff,
  Eye,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  TrendingUp,
  TrendingDown,
  CalendarIcon,
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
import { TransactionDialog } from "@/components/transactions/TransactionDialog";
import { useTransactions, useDeleteTransaction, Transaction } from "@/hooks/useTransactions";
import { useToggleIgnoreTransaction } from "@/hooks/useToggleIgnore";
import { useCategories } from "@/hooks/useCategories";
import { useCostCenters } from "@/hooks/useCostCenters";
import { useAccounts } from "@/hooks/useAccounts";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { BaseRequiredAlert } from "@/components/common/BaseRequiredAlert";
import { cn } from "@/lib/utils";
import { formatCurrency, parseLocalDate } from "@/lib/formatters";
import { getAutoIcon } from "@/lib/category-icons";
import { MaskedValue } from "@/contexts/ValuesVisibilityContext";
import * as LucideIcons from "lucide-react";

function getTransactionIcon(type: string, categoryIcon?: string | null) {
  if (categoryIcon) {
    const iconName = getAutoIcon(categoryIcon);
    const PascalName = iconName.charAt(0).toUpperCase() + iconName.slice(1).replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    const IconComp = (LucideIcons as any)[PascalName];
    if (IconComp) return <IconComp className="h-4 w-4" />;
  }
  switch (type) {
    case "income": return <ArrowUpRight className="h-4 w-4" />;
    case "expense": return <ArrowDownLeft className="h-4 w-4" />;
    case "transfer": return <ArrowLeftRight className="h-4 w-4" />;
    case "investment": return <TrendingDown className="h-4 w-4" />;
    case "redemption": return <TrendingUp className="h-4 w-4" />;
    default: return <ArrowLeftRight className="h-4 w-4" />;
  }
}

function getIconBg(type: string) {
  switch (type) {
    case "income": return "bg-success/10 text-success";
    case "expense": return "bg-destructive/10 text-destructive";
    case "transfer": return "bg-info/10 text-info";
    default: return "bg-muted text-muted-foreground";
  }
}

const getTypeLabel = (type: string) => {
  switch (type) {
    case "income": return "Receita";
    case "expense": return "Despesa";
    case "transfer": return "Transf.";
    case "investment": return "Aplicação";
    case "redemption": return "Resgate";
    default: return type;
  }
};

const getTypeColor = (type: string) => {
  switch (type) {
    case "income": case "redemption": return "text-success";
    case "expense": case "investment": return "text-destructive";
    default: return "text-muted-foreground";
  }
};

type PeriodPreset = "this_month" | "last_month" | "last_3" | "this_year" | "all";

function getPeriodRange(preset: PeriodPreset): { start: Date; end: Date } | null {
  const now = new Date();
  switch (preset) {
    case "this_month": return { start: startOfMonth(now), end: endOfMonth(now) };
    case "last_month": { const lm = subMonths(now, 1); return { start: startOfMonth(lm), end: endOfMonth(lm) }; }
    case "last_3": return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) };
    case "this_year": return { start: startOfYear(now), end: endOfYear(now) };
    case "all": return null;
  }
}

export function MovimentacoesReportContent() {
  const { requiresBaseSelection } = useBaseFilter();

  // Check URL params for pre-set filters
  const urlParams = new URLSearchParams(window.location.search);
  const urlFilter = urlParams.get("filter");

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [costCenterFilter, setCostCenterFilter] = useState<string>("all");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [classificationFilter, setClassificationFilter] = useState<string>(urlFilter === "sem-categoria" ? "unclassified" : "all");
  const [periodFilter, setPeriodFilter] = useState<PeriodPreset>("this_month");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: allTransactions, isLoading } = useTransactions({ search: search || undefined });
  const { data: categories } = useCategories();
  const { data: costCenters } = useCostCenters();
  const { data: accounts } = useAccounts();
  const deleteTransaction = useDeleteTransaction();
  const toggleIgnore = useToggleIgnoreTransaction();

  const periodRange = useMemo(() => getPeriodRange(periodFilter), [periodFilter]);

  const transactions = useMemo(() => {
    return (allTransactions || [])
      .filter(t => {
        if (typeFilter !== "all" && t.type !== typeFilter) return false;
        if (categoryFilter !== "all" && t.category_id !== categoryFilter) return false;
        if (costCenterFilter !== "all" && t.cost_center_id !== costCenterFilter) return false;
        if (accountFilter !== "all" && t.account_id !== accountFilter) return false;
        if (classificationFilter === "classified" && !t.category_id) return false;
        if (classificationFilter === "unclassified" && t.category_id) return false;
        if (periodRange) {
          const txDate = parseLocalDate(t.date);
          if (!isWithinInterval(txDate, { start: periodRange.start, end: periodRange.end })) return false;
        }
        return true;
      })
      .sort((a, b) => {
        return parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime();
      });
  }, [allTransactions, typeFilter, categoryFilter, costCenterFilter, accountFilter, classificationFilter, periodRange]);

  // Group by date label
  const grouped = useMemo(() => {
    const groups: { label: string; transactions: Transaction[] }[] = [];
    const map = new Map<string, Transaction[]>();
    const order: string[] = [];
    for (const tx of transactions) {
      const txDate = parseLocalDate(tx.date);
      const label = format(txDate, "dd 'de' MMMM, yyyy", { locale: ptBR });
      if (!map.has(label)) {
        map.set(label, []);
        order.push(label);
      }
      map.get(label)!.push(tx);
    }
    for (const label of order) {
      groups.push({ label, transactions: map.get(label)! });
    }
    return groups;
  }, [transactions]);

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

  if (requiresBaseSelection) {
    return (
      <div className="space-y-3">
        <BaseRequiredAlert action="visualizar movimentações" />
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
      {/* Filters */}
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
          <Select value={periodFilter} onValueChange={(v) => setPeriodFilter(v as PeriodPreset)}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <CalendarIcon className="h-3 w-3 mr-1 shrink-0" />
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this_month">Mês atual</SelectItem>
              <SelectItem value="last_month">Mês anterior</SelectItem>
              <SelectItem value="last_3">Últimos 3 meses</SelectItem>
              <SelectItem value="this_year">Ano atual</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[100px] h-8 text-xs">
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
          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue placeholder="Conta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Contas</SelectItem>
              {accounts?.map((acc) => (
                <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={classificationFilter} onValueChange={setClassificationFilter}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue placeholder="Classificação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="classified">Classificadas</SelectItem>
              <SelectItem value="unclassified">Não Classificadas</SelectItem>
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
            {isLoading ? "Carregando..." : `${transactions.length} movimentações`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center px-4">
              <AlertCircle className="h-6 w-6 text-muted-foreground mb-1" />
              <p className="text-xs text-muted-foreground">Nenhuma movimentação encontrada</p>
            </div>
          ) : (
            <div className="space-y-0">
              {grouped.map((group) => (
                <div key={group.label}>
                  <div className="pt-2 pb-1 px-1">
                    <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest">
                      {group.label}
                    </p>
                  </div>
                  <div className="space-y-px">
                    {group.transactions.map((tx) => (
                      <div
                        key={tx.id}
                        className={cn(
                          "flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-muted/40 transition-colors cursor-pointer group",
                          tx.is_ignored && "opacity-40"
                        )}
                        onClick={() => handleEdit(tx)}
                      >
                        {/* Icon */}
                        <div className={cn("flex h-7 w-7 items-center justify-center rounded-full shrink-0", getIconBg(tx.type))}>
                          {getTransactionIcon(tx.type, tx.categories?.icon)}
                        </div>

                        {/* Main info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-medium truncate leading-tight">
                              {tx.description || "Movimentação"}
                            </p>
                            <Badge variant="outline" className="text-[8px] px-1 py-0 shrink-0 hidden sm:inline-flex">
                              {getTypeLabel(tx.type)}
                            </Badge>
                            {!tx.category_id && (
                              <Badge variant="outline" className="text-[8px] px-1 py-0 shrink-0 bg-warning/10 text-warning border-warning/20">
                                Pendente
                              </Badge>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {format(parseLocalDate(tx.date), "dd/MM", { locale: ptBR })}
                            {tx.categories?.name && ` · ${tx.categories.name}`}
                            {tx.accounts?.name && ` · ${tx.accounts.name}`}
                            {tx.cost_centers?.name && ` · ${tx.cost_centers.name}`}
                          </p>
                        </div>

                        {/* Amount */}
                        <p className={cn("text-xs font-semibold tabular-nums shrink-0", getTypeColor(tx.type))}>
                          <MaskedValue>
                            {["income", "redemption"].includes(tx.type) ? "+" : ["expense", "investment"].includes(tx.type) ? "−" : ""}
                            {formatCurrency(tx.amount)}
                          </MaskedValue>
                        </p>

                        {/* Actions */}
                        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(tx)}>
                                <Pencil className="h-3.5 w-3.5 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => toggleIgnore.mutate({ id: tx.id, is_ignored: !tx.is_ignored })}
                              >
                                {tx.is_ignored ? (
                                  <><Eye className="h-3.5 w-3.5 mr-2" />Não Ignorar</>
                                ) : (
                                  <><EyeOff className="h-3.5 w-3.5 mr-2" />Ignorar</>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setDeleteId(tx.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
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
