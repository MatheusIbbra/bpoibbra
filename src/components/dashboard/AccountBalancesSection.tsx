import { Card, CardContent } from "@/components/ui/card";
import { SkeletonCard } from "@/components/common/SkeletonCard";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Wallet,
  TrendingUp,
  Landmark,
} from "lucide-react";
import { useAccounts } from "@/hooks/useAccounts";
import { formatCurrency } from "@/lib/formatters";
import { MaskedValue } from "@/contexts/ValuesVisibilityContext";

export function AccountBalancesSection() {
  const { data: accounts, isLoading } = useAccounts();

  if (isLoading) {
    return <SkeletonCard variant="account-balances" />;
  }

  // Separate by type, exclude credit cards
  const checkingAccounts = (accounts || []).filter(a => ["checking", "savings", "cash"].includes(a.account_type) && a.status === "active");
  const investmentAccounts = (accounts || []).filter(a => a.account_type === "investment" && a.status === "active");
  

  const checkingBalance = checkingAccounts.reduce((sum, a) => sum + (a.current_balance ?? 0), 0);
  const investmentBalance = investmentAccounts.reduce((sum, a) => sum + (a.current_balance ?? 0), 0);
  const totalBalance = checkingBalance + investmentBalance;

  if (checkingAccounts.length === 0 && investmentAccounts.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Seus Saldos
      </h3>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        {/* Saldo Total */}
        <Card className="card-executive overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Wallet className="h-4.5 w-4.5 text-primary" />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">
              Saldo Total Acumulado
            </p>
            <p className="text-2xl font-bold tracking-tight">
              <MaskedValue>{formatCurrency(totalBalance)}</MaskedValue>
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Atualizado em {new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </p>
          </CardContent>
        </Card>

        {/* Contas Correntes */}
        <Card className="card-executive overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="h-9 w-9 rounded-xl bg-info/10 flex items-center justify-center">
                <Landmark className="h-4.5 w-4.5 text-info" />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">
              Contas Correntes
            </p>
            <p className="text-2xl font-bold tracking-tight">
              <MaskedValue>{formatCurrency(checkingBalance)}</MaskedValue>
            </p>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex -space-x-1.5">
                {checkingAccounts.slice(0, 3).map(acc => (
                  <Avatar key={acc.id} className="h-5 w-5 border border-background">
                    <AvatarFallback className="text-[8px] font-semibold bg-muted">
                      {acc.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <span className="text-[10px] text-muted-foreground">
                {checkingAccounts.length} conta(s)
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Investimentos */}
        <Card className="card-executive overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="h-9 w-9 rounded-xl bg-success/10 flex items-center justify-center">
                <TrendingUp className="h-4.5 w-4.5 text-success" />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">
              Investimentos
            </p>
            <p className="text-2xl font-bold tracking-tight">
              <MaskedValue>{formatCurrency(investmentBalance)}</MaskedValue>
            </p>
            <span className="text-[10px] text-muted-foreground">
              {investmentAccounts.length} investimento(s)
            </span>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
