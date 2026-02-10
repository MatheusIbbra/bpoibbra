import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { format, isToday, isYesterday, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { useTransactions, Transaction } from "@/hooks/useTransactions";
import { formatCurrency } from "@/lib/formatters";
import { parseLocalDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { getAutoIcon } from "@/lib/category-icons";
import { MaskedValue } from "@/contexts/ValuesVisibilityContext";
import * as LucideIcons from "lucide-react";

interface GroupedTransactions {
  label: string;
  transactions: Transaction[];
}

function groupByDate(transactions: Transaction[]): GroupedTransactions[] {
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

function getTransactionIcon(type: string, categoryIcon?: string | null) {
  if (categoryIcon) {
    const iconName = getAutoIcon(categoryIcon);
    const PascalName = iconName.charAt(0).toUpperCase() + iconName.slice(1).replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    const IconComp = (LucideIcons as any)[PascalName];
    if (IconComp) return <IconComp className="h-4 w-4" />;
  }

  switch (type) {
    case "income":
      return <ArrowUpRight className="h-4 w-4" />;
    case "expense":
      return <ArrowDownLeft className="h-4 w-4" />;
    case "transfer":
      return <ArrowLeftRight className="h-4 w-4" />;
    case "investment":
      return <TrendingDown className="h-4 w-4" />;
    case "redemption":
      return <TrendingUp className="h-4 w-4" />;
    default:
      return <ArrowLeftRight className="h-4 w-4" />;
  }
}

function getIconBg(type: string) {
  switch (type) {
    case "income":
      return "bg-success/10 text-success";
    case "expense":
      return "bg-destructive/10 text-destructive";
    case "transfer":
      return "bg-info/10 text-info";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function FintechTransactionsList() {
  const navigate = useNavigate();
  const { data: transactions, isLoading } = useTransactions({});
  

  const recentTransactions = useMemo(
    () => (transactions || []).slice(0, 15),
    [transactions]
  );

  const grouped = useMemo(
    () => groupByDate(recentTransactions),
    [recentTransactions]
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-semibold">Últimas Movimentações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-muted/30 rounded-lg animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold">Últimas Movimentações</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-6 text-muted-foreground hover:text-foreground"
          onClick={() => navigate("/movimentacoes")}
        >
          Ver todas
          <ChevronRight className="h-3 w-3 ml-0.5" />
        </Button>
      </CardHeader>
      <CardContent>
        {grouped.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma movimentação encontrada
          </p>
        ) : (
          <div>
            {grouped.map((group) => (
              <div key={group.label}>
                <div className="pt-2 pb-1">
                  <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest">
                    {group.label}
                  </p>
                </div>
                <div className="space-y-px">
                  {group.transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className={cn(
                        "flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/40 transition-colors cursor-pointer",
                        tx.is_ignored && "opacity-50"
                      )}
                      onClick={() => navigate("/movimentacoes")}
                    >
                      <div
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-full shrink-0",
                          getIconBg(tx.type)
                        )}
                      >
                        {getTransactionIcon(tx.type, tx.categories?.icon)}
                      </div>
                      <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-x-2 items-center">
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate leading-tight">
                            {tx.description || "Movimentação"}
                          </p>
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground truncate">
                            <span>{format(parseLocalDate(tx.date), "dd/MM", { locale: ptBR })}</span>
                            {tx.accounts?.bank_name && (
                              <>
                                <span>·</span>
                                <span className="truncate">{tx.accounts.bank_name}</span>
                              </>
                            )}
                            {tx.categories?.name && (
                              <>
                                <span>·</span>
                                <span className="truncate hidden sm:inline">{tx.categories.name}</span>
                              </>
                            )}
                            {tx.cost_centers?.name && (
                              <>
                                <span className="hidden md:inline">·</span>
                                <span className="truncate hidden md:inline">{tx.cost_centers.name}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <p
                        className={cn(
                          "text-xs font-semibold tabular-nums shrink-0",
                          tx.type === "income" && "text-success",
                          tx.type === "expense" && "text-destructive",
                          tx.type !== "income" && tx.type !== "expense" && "text-muted-foreground"
                        )}
                      >
                        <MaskedValue>
                          {tx.type === "income" ? "+" : tx.type === "expense" ? "−" : ""}
                          {formatCurrency(tx.amount)}
                        </MaskedValue>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
