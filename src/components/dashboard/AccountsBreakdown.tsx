import { Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { MaskedValue } from "@/contexts/ValuesVisibilityContext";

interface Account {
  id: string;
  name: string;
  bank_name: string | null;
  current_balance: number | null;
  account_type: string;
  color: string | null;
}

function typeLabel(t: string) {
  switch (t) {
    case "checking": return "Conta Corrente";
    case "savings": return "Poupança";
    case "cash": return "Dinheiro";
    case "investment": return "Investimento";
    default: return t;
  }
}

export function AccountsBreakdown({ accounts }: { accounts: Account[] }) {
  if (!accounts || accounts.length === 0) {
    return (
      <div className="p-3 text-center">
        <p className="text-xs text-muted-foreground">Nenhuma conta cadastrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[50vh] overflow-y-auto overscroll-contain">
      {accounts.map((a) => (
        <div key={a.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/30">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: a.color || "hsl(var(--primary))" }}
            >
              <Wallet className="h-3.5 w-3.5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{a.name}</p>
              <p className="text-[10px] text-muted-foreground">{a.bank_name || typeLabel(a.account_type)}</p>
            </div>
          </div>
          <p className="text-sm font-semibold tabular-nums shrink-0 ml-3">
            <MaskedValue>{formatCurrency(a.current_balance ?? 0)}</MaskedValue>
          </p>
        </div>
      ))}
    </div>
  );
}
