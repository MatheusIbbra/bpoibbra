import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Landmark,
  CreditCard,
  PiggyBank,
} from "lucide-react";
import { useAccounts } from "@/hooks/useAccounts";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface AccountGroup {
  label: string;
  icon: React.ReactNode;
  total: number;
  count: number;
}

export function ConsolidatedBalanceSection() {
  const { data: accounts, isLoading: accountsLoading } = useAccounts();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();

  const isLoading = accountsLoading || statsLoading;

  if (isLoading) {
    return (
      <Card className="card-executive">
        <CardContent className="p-4">
          <Skeleton className="h-[100px] w-full" />
        </CardContent>
      </Card>
    );
  }

  // Group accounts by type
  const groups: Record<string, AccountGroup> = {};
  let totalPatrimony = 0;

  (accounts || []).forEach((acc) => {
    const type = acc.account_type;
    if (!groups[type]) {
      groups[type] = {
        label: getTypeLabel(type),
        icon: getTypeIcon(type),
        total: 0,
        count: 0,
      };
    }
    groups[type].total += acc.current_balance;
    groups[type].count++;
    totalPatrimony += acc.current_balance;
  });

  const orderedTypes = ["checking", "savings", "investment", "credit_card", "cash"];
  const sortedGroups = orderedTypes
    .filter((t) => groups[t])
    .map((t) => groups[t]);

  const monthlyVariation = stats
    ? stats.monthlyIncome - stats.monthlyExpenses
    : 0;
  const variationPercent = stats?.incomeChange || 0;

  return (
    <Card className="card-executive overflow-hidden">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          {/* Main balance */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Patrimônio Total
              </span>
            </div>
            <p className="text-3xl font-bold tracking-tight">
              {formatCurrency(totalPatrimony)}
            </p>
            {monthlyVariation !== 0 && (
              <div className="flex items-center gap-1 mt-1">
                {monthlyVariation > 0 ? (
                  <TrendingUp className="h-3.5 w-3.5 text-success" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                )}
                <span
                  className={cn(
                    "text-xs font-medium",
                    monthlyVariation > 0 ? "text-success" : "text-destructive"
                  )}
                >
                  {monthlyVariation > 0 ? "+" : ""}
                  {formatCurrency(monthlyVariation)} este mês
                </span>
              </div>
            )}
          </div>

          {/* Account type breakdown */}
          <div className="flex flex-wrap gap-4">
            {sortedGroups.map((group) => (
              <div key={group.label} className="text-right min-w-[100px]">
                <div className="flex items-center gap-1.5 justify-end text-muted-foreground mb-0.5">
                  {group.icon}
                  <span className="text-[11px]">{group.label}</span>
                </div>
                <p className="text-sm font-semibold">{formatCurrency(group.total)}</p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getTypeLabel(type: string): string {
  switch (type) {
    case "checking":
      return "Corrente";
    case "savings":
      return "Poupança";
    case "investment":
      return "Investimentos";
    case "credit_card":
      return "Cartões";
    case "cash":
      return "Caixa";
    default:
      return type;
  }
}

function getTypeIcon(type: string): React.ReactNode {
  const cls = "h-3.5 w-3.5";
  switch (type) {
    case "checking":
      return <Landmark className={cls} />;
    case "savings":
      return <PiggyBank className={cls} />;
    case "investment":
      return <TrendingUp className={cls} />;
    case "credit_card":
      return <CreditCard className={cls} />;
    default:
      return <Wallet className={cls} />;
  }
}
