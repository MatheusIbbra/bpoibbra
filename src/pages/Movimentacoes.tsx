import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { format, isToday, isYesterday, startOfWeek } from "date-fns";
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
  EyeOff,
  Eye,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
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
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { TransactionDialog } from "@/components/transactions/TransactionDialog";
import { useTransactions, useDeleteTransaction, Transaction } from "@/hooks/useTransactions";
import { useTransfers, useDeleteTransfer, Transfer } from "@/hooks/useTransfers";
import { useToggleIgnoreTransaction } from "@/hooks/useToggleIgnore";
import { TransferDialog } from "@/components/transfers/TransferDialog";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { BaseRequiredAlert } from "@/components/common/BaseRequiredAlert";
import { MaskedValue } from "@/contexts/ValuesVisibilityContext";
import { cn } from "@/lib/utils";
import { formatCurrency, parseLocalDate } from "@/lib/formatters";
import { getAutoIcon } from "@/lib/category-icons";
import * as LucideIcons from "lucide-react";

interface GroupedTransactions {
  label: string;
  transactions: { id: string; date: string; [key: string]: any }[];
}

function groupTransactionsByDate(transactions: { id: string; date: string; [key: string]: any }[]): GroupedTransactions[] {
  const groups: Record<string, typeof transactions> = {};
  const order: string[] = [];
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });

  for (const tx of transactions) {
    const txDate = parseLocalDate(tx.date);
    let label: string;

    if (isToday(txDate)) {
      label = "Hoje";
    } else if (isYesterday(txDate)) {
      label = "Ontem";
    } else if (txDate >= weekStart) {
      label = "Esta semana";
    } else {
      label = format(txDate, "MMMM yyyy", { locale: ptBR });
      label = label.charAt(0).toUpperCase() + label.slice(1);
    }

    if (!groups[label]) {
      groups[label] = [];
      order.push(label);
    }
    groups[label].push(tx);
  }

  return order.map((label) => ({ label, transactions: groups[label] }));
}

export default function Movimentacoes() {
  const [searchParams] = useSearchParams();
  const startDateParam = searchParams.get("startDate") || undefined;
  const endDateParam = searchParams.get("endDate") || undefined;

  const { requiresBaseSelection } = useBaseFilter();
  const [activeTab, setActiveTab] = useState("transacoes");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [ignoreTarget, setIgnoreTarget] = useState<{ id: string; is_ignored: boolean } | null>(null);
  const [defaultType, setDefaultType] = useState<"transfer" | "income" | "expense">("transfer");
  const [currentPage, setCurrentPage] = useState(0);
  const PAGE_SIZE = 50;

  const { data: allTransactions, isLoading } = useTransactions({
    search: search || undefined,
    startDate: startDateParam,
    endDate: endDateParam,
  });

  const { data: allTransfers, isLoading: isLoadingTransfers } = useTransfers();

  const deleteTransaction = useDeleteTransaction();
  const deleteTransfer = useDeleteTransfer();
  const toggleIgnore = useToggleIgnoreTransaction();

  // Transfer dialog state
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);

  // Combine transfers (from transfers table) with investment/redemption transactions
  // for the "transacoes" tab
  type CombinedRow =
    | (Transaction & { _kind: "transaction" })
    | (Transfer & { _kind: "transfer"; type: "transfer"; is_ignored?: boolean; categories?: null; date: string });

  const getFilteredTransactions = (): CombinedRow[] => {
    if (!allTransactions) return [];
    const search_lower = search.toLowerCase();

    switch (activeTab) {
      case "transacoes": {
        // Investment/redemption — exclude secondary paired legs (is_ignored + rejected)
        // Use operation_type for display (both legs show the user's intended operation)
        const invRed = allTransactions
          .filter(t =>
            ["investment", "redemption"].includes(t.operation_type ?? t.type) &&
            !t.is_ignored
          )
          .filter(t => !search || t.description?.toLowerCase().includes(search_lower))
          .map(t => ({ ...t, _kind: "transaction" as const }));

        // Transfers from the transfers table
        const transfers = (allTransfers || [])
          .filter(t => {
            if (!search) return true;
            const desc = t.description || "";
            return (
              desc.toLowerCase().includes(search_lower) ||
              t.origin_account?.name?.toLowerCase().includes(search_lower) ||
              t.destination_account?.name?.toLowerCase().includes(search_lower)
            );
          })
          .map(t => ({
            ...t,
            _kind: "transfer" as const,
            type: "transfer" as const,
            is_ignored: false,
            categories: null,
            date: t.transfer_date,
            description: t.description || `${t.origin_account?.name ?? ""} → ${t.destination_account?.name ?? ""}`,
          }));

        // Merge and sort by date descending
        return ([...invRed, ...transfers] as CombinedRow[]).sort(
          (a, b) => new Date((b as any).date).getTime() - new Date((a as any).date).getTime()
        );
      }
      case "receitas":
        return allTransactions
          .filter(t => t.type === "income" && t.category_id !== null)
          .map(t => ({ ...t, _kind: "transaction" as const }));
      case "despesas":
        return allTransactions
          .filter(t => t.type === "expense" && t.category_id !== null)
          .map(t => ({ ...t, _kind: "transaction" as const }));
      default:
        return [];
    }
  };

  const filteredTransactions = getFilteredTransactions();
  const isLoadingAny = isLoading || isLoadingTransfers;
  const totalPages = Math.ceil(filteredTransactions.length / PAGE_SIZE);
  const paginatedFiltered = useMemo(() => {
    const start = currentPage * PAGE_SIZE;
    return filteredTransactions.slice(start, start + PAGE_SIZE);
  }, [filteredTransactions, currentPage]);
  const grouped = useMemo(() => groupTransactionsByDate(paginatedFiltered), [paginatedFiltered]);

  // Reset page on tab/search change
  useMemo(() => { setCurrentPage(0); }, [activeTab, search]);

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const [kind, id] = deleteId.split(":");
    if (kind === "transfer") {
      await deleteTransfer.mutateAsync(id);
    } else {
      await deleteTransaction.mutateAsync(id);
    }
    setDeleteId(null);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditingTransaction(null);
  };

  const handleNewTransaction = () => {
    setEditingTransaction(null);
    switch (activeTab) {
      case "receitas":
        setDefaultType("income");
        setDialogOpen(true);
        break;
      case "despesas":
        setDefaultType("expense");
        setDialogOpen(true);
        break;
      default:
        // "transacoes" tab — open the dedicated transfer/investment dialog
        setTransferDialogOpen(true);
    }
  };

  const getTransactionIcon = (type: string, categoryIcon?: string | null) => {
    if (categoryIcon) {
      const iconName = getAutoIcon(categoryIcon);
      const PascalName = iconName.charAt(0).toUpperCase() + iconName.slice(1).replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
      const IconComp = (LucideIcons as any)[PascalName];
      if (IconComp) return <IconComp className="h-4 w-4" />;
    }
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
      case "transfer": return "Transferência";
      case "investment": return "Aporte";
      case "redemption": return "Resgate";
      case "income": return "Receita";
      case "expense": return "Despesa";
      default: return type;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case "transfer": return "bg-info/10 text-info";
      case "investment": return "bg-warning/10 text-warning";
      case "redemption": return "bg-success/10 text-success";
      case "income": return "bg-success/10 text-success";
      case "expense": return "bg-destructive/10 text-destructive";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getNewButtonLabel = () => {
    switch (activeTab) {
      case "receitas": return "Nova Receita";
      case "despesas": return "Nova Despesa";
      default: return "Nova Transferência / Aporte";
    }
  };

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
              <TabsTrigger value="transacoes" className="text-xs sm:text-sm">Movimentações</TabsTrigger>
              <TabsTrigger value="receitas" className="text-xs sm:text-sm">Receitas</TabsTrigger>
              <TabsTrigger value="despesas" className="text-xs sm:text-sm">Despesas</TabsTrigger>
            </TabsList>
            
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar movimentação..."
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
            <Card className="card-executive">
              <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  {isLoadingAny ? "Carregando..." : `${filteredTransactions.length} movimentações${totalPages > 1 ? ` · Pág. ${currentPage + 1}/${totalPages}` : ""}`}
                </CardTitle>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={currentPage === 0} onClick={() => setCurrentPage(p => p - 1)}>
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={currentPage >= totalPages - 1} onClick={() => setCurrentPage(p => p + 1)}>
                      <ChevronRightIcon className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {isLoadingAny ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredTransactions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                    <AlertCircle className="h-10 w-10 text-muted-foreground mb-3" />
                    <h3 className="font-semibold">Nenhuma movimentação encontrada</h3>
                    <p className="text-sm text-muted-foreground">
                      {activeTab === "transacoes"
                        ? "Aqui aparecem transferências, aplicações e resgates."
                        : activeTab === "receitas"
                        ? "As receitas classificadas aparecerão aqui."
                        : "As despesas classificadas aparecerão aqui."}
                    </p>
                  </div>
                ) : (
                  <div>
                    {grouped.map((group) => (
                      <div key={group.label}>
                        <div className="px-4 py-2 bg-muted/30 border-y border-border/40">
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                            {group.label}
                          </p>
                        </div>

                        <div className="divide-y divide-border/30">
                          {group.transactions.map((transaction) => (
                            <div
                              key={transaction.id}
                              className={cn(
                                "flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors",
                                transaction.is_ignored && "opacity-40"
                              )}
                            >
                              <div
                                className={cn(
                                  "flex h-9 w-9 items-center justify-center rounded-full shrink-0",
                                  getTransactionColor(transaction.type)
                                )}
                              >
                                {getTransactionIcon(transaction.type, transaction.categories?.icon)}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium truncate">
                                    {transaction.description || "Movimentação"}
                                  </p>
                                  {activeTab === "transacoes" && (
                                    <Badge variant="outline" className="shrink-0 text-[10px] h-5 px-1.5">
                                      {getTransactionLabel(transaction.type)}
                                    </Badge>
                                  )}
                                  {transaction.is_ignored && (
                                    <Badge variant="secondary" className="shrink-0 text-[10px] h-5 px-1.5">
                                      Ignorada
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                  <span>{transaction.categories?.name || transaction.accounts?.name || "—"}</span>
                                  <span>·</span>
                                  <span>{format(parseLocalDate(transaction.date), "dd/MM/yy", { locale: ptBR })}</span>
                                  {transaction.accounts?.bank_name && (
                                    <>
                                      <span className="hidden sm:inline">·</span>
                                      <span className="hidden sm:inline">{transaction.accounts.bank_name}</span>
                                    </>
                                  )}
                                  {transaction.cost_centers?.name && (
                                    <>
                                      <span className="hidden md:inline">·</span>
                                      <span className="hidden md:inline">{transaction.cost_centers.name}</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <p className={cn(
                                  "text-sm font-semibold tabular-nums",
                                  transaction.type === "income" && "text-success",
                                  transaction.type === "expense" && "text-destructive",
                                  transaction.is_ignored && "line-through text-muted-foreground"
                                )}>
                                  <MaskedValue>
                                    {transaction.type === "income" ? "+" : transaction.type === "expense" ? "-" : ""}
                                    {formatCurrency(Number(transaction.amount))}
                                  </MaskedValue>
                                </p>
                              </div>

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {(transaction as any)._kind === "transfer" ? (
                                    // Transfer rows — edit not implemented; just delete
                                    <DropdownMenuItem
                                      onClick={() => setDeleteId(`transfer:${transaction.id}`)}
                                      className="text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Excluir
                                    </DropdownMenuItem>
                                  ) : (
                                    <>
                                      <DropdownMenuItem onClick={() => handleEdit(transaction as Transaction)}>
                                        <Pencil className="h-4 w-4 mr-2" />
                                        Editar
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => {
                                          if ((transaction as Transaction).is_ignored) {
                                            toggleIgnore.mutate({ id: transaction.id, is_ignored: false });
                                          } else {
                                            setIgnoreTarget({ id: transaction.id, is_ignored: true });
                                          }
                                        }}
                                      >
                                        {(transaction as Transaction).is_ignored ? (
                                          <>
                                            <Eye className="h-4 w-4 mr-2" />
                                            Não Ignorar
                                          </>
                                        ) : (
                                          <>
                                            <EyeOff className="h-4 w-4 mr-2" />
                                            Ignorar
                                          </>
                                        )}
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => setDeleteId(`transaction:${transaction.id}`)}
                                        className="text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Excluir
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {totalPages > 1 && !isLoadingAny && filteredTransactions.length > 0 && (
                  <div className="flex items-center justify-center gap-2 py-3 border-t">
                    <Button variant="outline" size="sm" className="h-7 text-xs" disabled={currentPage === 0} onClick={() => setCurrentPage(p => p - 1)}>
                      <ChevronLeft className="h-3 w-3 mr-1" />Anterior
                    </Button>
                    <span className="text-xs text-muted-foreground">{currentPage + 1} / {totalPages}</span>
                    <Button variant="outline" size="sm" className="h-7 text-xs" disabled={currentPage >= totalPages - 1} onClick={() => setCurrentPage(p => p + 1)}>
                      Próxima<ChevronRightIcon className="h-3 w-3 ml-1" />
                    </Button>
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

      <TransferDialog
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
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

      <ConfirmDialog
        open={!!ignoreTarget}
        onOpenChange={() => setIgnoreTarget(null)}
        title="Ignorar movimentação?"
        description="Esta transação não será mais considerada nos relatórios e dashboards. Você poderá reativá-la a qualquer momento."
        confirmLabel="Ignorar"
        variant="warning"
        onConfirm={() => {
          if (ignoreTarget) {
            toggleIgnore.mutate(ignoreTarget);
            setIgnoreTarget(null);
          }
        }}
      />
    </AppLayout>
  );
}
