import { CreditCard } from "lucide-react";
import { useCreditCardSummary } from "@/hooks/useCreditCardSummary";
import { useBankConnections } from "@/hooks/useBankConnections";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";

export function CreditCardSummary() {
  const { data: cards, isLoading } = useCreditCardSummary();
  const { data: bankConnections } = useBankConnections();

  // Build bank logo map
  const bankLogoMap = new Map<string, string>();
  bankConnections?.forEach((conn) => {
    const meta = (conn as any).metadata as { bank_name?: string; bank_logo_url?: string | null } | null;
    if (meta?.bank_name && meta?.bank_logo_url) {
      bankLogoMap.set(meta.bank_name, meta.bank_logo_url);
    }
  });

  if (isLoading || !cards || cards.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
        Cartões de Crédito
      </h3>
      <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const logo = card.bankName ? bankLogoMap.get(card.bankName) : undefined;
          
          return (
            <div
              key={card.accountId}
              className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
            >
              {logo ? (
                <img
                  src={logo}
                  alt={card.bankName || ""}
                  className="h-8 w-8 rounded-lg object-contain bg-muted p-0.5 shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <CreditCard className="h-4 w-4 text-primary" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{card.accountName}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[10px] text-muted-foreground">
                    Compras: <span className="text-destructive font-medium">{formatCurrency(card.monthlyPurchases)}</span>
                  </span>
                  {card.monthlyPayments > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      Pago: <span className="text-success font-medium">{formatCurrency(card.monthlyPayments)}</span>
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className={cn(
                  "text-sm font-bold tabular-nums",
                  card.currentBalance < 0 ? "text-destructive" : "text-success"
                )}>
                  {formatCurrency(Math.abs(card.currentBalance))}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {card.currentBalance < 0 ? "a pagar" : "saldo"}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
