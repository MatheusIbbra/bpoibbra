import { useState, useMemo } from "react";
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
import { useToggleIgnoreTransaction } from "@/hooks/useToggleIgnore";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { BaseRequiredAlert } from "@/components/common/BaseRequiredAlert";
import { MaskedValue } from "@/contexts/ValuesVisibilityContext";
import { cn } from "@/lib/utils";
import { formatCurrency, parseLocalDate } from "@/lib/formatters";
import { getAutoIcon } from "@/lib/category-icons";
import * as LucideIcons from "lucide-react";

interface GroupedTransactions {
  label: string;
  transactions: Transaction[];
}

function groupTransactionsByDate(transactions: Transaction[]): GroupedTransactions[] {
  const groups: Record<string, Transaction[]> = {};
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
  const { requiresBaseSelection } = useBaseFilter();
  const [activeTab, setActiveTab] = useState("transacoes");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [defaultType, setDefaultType] = useState<"transfer" | "income" | "expense">("transfer");

  const { data: allTransactions, isLoading } = useTransactions({
    search: search || undefined,
  });

  const deleteTransaction = useDeleteTransaction();
  const toggleIgnore = useToggleIgnoreTransaction();

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
  const grouped = useMemo(() => groupTransactionsByDate(filteredTransactions), [filteredTransactions]);

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
      case "investment": return "Aplicação";
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
      default: return "Nova Movimentação";
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
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-medium">
                  {isLoading ? "Carregando..." : `${filteredTransactions.length} movimentações`}
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
                                transaction.is_ignored && "opacity-50"
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
                                  transaction.type === "expense" && "text-destructive"
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
                                  <DropdownMenuItem onClick={() => handleEdit(transaction)}>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      toggleIgnore.mutate({
                                        id: transaction.id,
                                        is_ignored: !transaction.is_ignored,
                                      })
                                    }
                                  >
                                    {transaction.is_ignored ? (
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
