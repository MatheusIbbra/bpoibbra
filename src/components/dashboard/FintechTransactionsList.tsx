import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { format, isToday, isYesterday, differenceInDays, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { useTransactions, Transaction } from "@/hooks/useTransactions";
import { formatCurrency } from "@/lib/formatters";
import { parseLocalDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { getAutoIcon } from "@/lib/category-icons";
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
  const [isExpanded, setIsExpanded] = useState(true);

  // Take the last 10 transactions (smaller)
  const recentTransactions = useMemo(
    () => (transactions || []).slice(0, 10),
    [transactions]
  );

  const grouped = useMemo(
    () => groupByDate(recentTransactions),
    [recentTransactions]
  );

  if (isLoading) {
    return (
      <Card className="card-executive">
        <CardHeader className="pb-2 px-4 pt-4">
          <CardTitle className="text-sm">Últimas Movimentações</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-1">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
        >
          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          Últimas Movimentações
        </button>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-6 text-muted-foreground hover:text-foreground"
          onClick={() => navigate("/movimentacoes")}
        >
          Ver todas
          <ChevronRight className="h-3 w-3 ml-0.5" />
        </Button>
      </div>
      {!isExpanded ? null : grouped.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhuma movimentação encontrada
        </p>
      ) : (
        <div>
          {grouped.map((group) => (
            <div key={group.label}>
              <div className="px-1 pt-2 pb-1">
                <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest">
                  {group.label}
                </p>
              </div>
              <div className="space-y-px">
                {group.transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-muted/40 transition-colors cursor-pointer"
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
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate leading-tight">
                        {tx.description || "Movimentação"}
                      </p>
                    </div>
                    <p
                      className={cn(
                        "text-xs font-semibold tabular-nums shrink-0",
                        tx.type === "income" && "text-success",
                        tx.type === "expense" && "text-destructive",
                        tx.type !== "income" && tx.type !== "expense" && "text-muted-foreground"
                      )}
                    >
                      {tx.type === "income" ? "+" : tx.type === "expense" ? "−" : ""}
                      {formatCurrency(tx.amount)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
