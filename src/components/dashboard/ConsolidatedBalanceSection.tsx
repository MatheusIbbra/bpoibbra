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

  // Separate accounts by type
  let availableBalance = 0; // checking + savings + cash
  let investmentBalance = 0;
  let creditCardDebt = 0;
  let availableCount = 0;
  let investmentCount = 0;
  let creditCardCount = 0;

  (accounts || []).forEach((acc) => {
    const balance = acc.current_balance ?? 0;
    switch (acc.account_type) {
      case "checking":
      case "savings":
      case "cash":
        availableBalance += balance;
        availableCount++;
        break;
      case "investment":
        investmentBalance += balance;
        investmentCount++;
        break;
      case "credit_card":
        // Credit card balance is typically negative (debt)
        creditCardDebt += Math.abs(balance);
        creditCardCount++;
        break;
    }
  });

  const monthlyVariation = stats
    ? stats.monthlyIncome - stats.monthlyExpenses
    : 0;

  return (
    <Card className="card-executive overflow-hidden">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          {/* Main available balance */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Saldo Disponível
              </span>
            </div>
            <p className="text-3xl font-bold tracking-tight">
              {formatCurrency(availableBalance)}
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

          {/* Breakdown: Investments + Credit Cards */}
          <div className="flex flex-wrap gap-5">
            {investmentCount > 0 && (
              <div className="text-right min-w-[110px]">
                <div className="flex items-center gap-1.5 justify-end text-muted-foreground mb-0.5">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span className="text-[11px]">Investimentos</span>
                </div>
                <p className="text-sm font-semibold text-success">
                  {formatCurrency(investmentBalance)}
                </p>
              </div>
            )}

            {creditCardCount > 0 && (
              <div className="text-right min-w-[110px]">
                <div className="flex items-center gap-1.5 justify-end text-muted-foreground mb-0.5">
                  <CreditCard className="h-3.5 w-3.5" />
                  <span className="text-[11px]">Cartões a Pagar</span>
                </div>
                <p className="text-sm font-semibold text-destructive">
                  {creditCardDebt > 0 ? `-${formatCurrency(creditCardDebt)}` : formatCurrency(0)}
                </p>
              </div>
            )}

            {availableCount > 0 && (
              <div className="text-right min-w-[100px]">
                <div className="flex items-center gap-1.5 justify-end text-muted-foreground mb-0.5">
                  <Landmark className="h-3.5 w-3.5" />
                  <span className="text-[11px]">Contas</span>
                </div>
                <p className="text-sm font-semibold">
                  {availableCount} ativa{availableCount !== 1 ? "s" : ""}
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
