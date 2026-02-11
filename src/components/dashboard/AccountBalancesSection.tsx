import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Wallet,
  TrendingUp,
  Landmark,
  ChevronDown,
  ChevronUp,
  PiggyBank,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
  Banknote,
} from "lucide-react";
import { useAccounts, Account } from "@/hooks/useAccounts";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { MaskedValue } from "@/contexts/ValuesVisibilityContext";

function getAccountIcon(type: string) {
  switch (type) {
    case "checking": return <Landmark className="h-4 w-4" />;
    case "savings": return <PiggyBank className="h-4 w-4" />;
    case "investment": return <TrendingUp className="h-4 w-4" />;
    case "cash": return <Banknote className="h-4 w-4" />;
    default: return <Building2 className="h-4 w-4" />;
  }
}

function getAccountTypeLabel(type: string) {
  switch (type) {
    case "checking": return "Conta Corrente";
    case "savings": return "Poupança";
    case "investment": return "Investimento";
    case "cash": return "Dinheiro";
    default: return "Conta";
  }
}

export function AccountBalancesSection() {
  const navigate = useNavigate();
  const { data: accounts, isLoading } = useAccounts();
  const [showDetails, setShowDetails] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-32" />
        <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-[120px] rounded-xl" />)}
        </div>
      </div>
    );
  }

  // Separate by type, exclude credit cards
  const checkingAccounts = (accounts || []).filter(a => ["checking", "savings", "cash"].includes(a.account_type) && a.status === "active");
  const investmentAccounts = (accounts || []).filter(a => a.account_type === "investment" && a.status === "active");
  const allDisplayAccounts = [...checkingAccounts, ...investmentAccounts];

  const checkingBalance = checkingAccounts.reduce((sum, a) => sum + (a.current_balance ?? 0), 0);
  const investmentBalance = investmentAccounts.reduce((sum, a) => sum + (a.current_balance ?? 0), 0);
  const totalBalance = checkingBalance + investmentBalance;

  if (allDisplayAccounts.length === 0) return null;

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

      {/* Detalhes Expansível */}
      <div className="space-y-2">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {showDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          Detalhes por Conta
        </button>

        {showDetails && (
          <Card className="card-executive">
            <CardContent className="p-3">
              <div className="space-y-1">
                {allDisplayAccounts.map(account => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={cn(
                        "h-8 w-8 rounded-lg flex items-center justify-center",
                        account.account_type === "investment" ? "bg-success/10 text-success" : "bg-info/10 text-info"
                      )}>
                        {getAccountIcon(account.account_type)}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{account.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {account.bank_name || "Conta Manual"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <p className="text-sm font-semibold">
                        <MaskedValue>{formatCurrency(account.current_balance)}</MaskedValue>
                      </p>
                      {account.official_balance !== null && account.official_balance !== undefined && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1">Open Finance</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
