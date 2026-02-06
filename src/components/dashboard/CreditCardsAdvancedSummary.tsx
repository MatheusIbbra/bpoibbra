import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard, Eye, ChevronDown, ChevronUp, Receipt } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreditCardAdvancedSummary, CreditCardAdvanced, CreditCardInvoiceMonth } from "@/hooks/useCreditCardAdvancedSummary";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";

function getUsageStatus(percentage: number) {
  if (percentage >= 90) return { color: "text-destructive", barColor: "bg-destructive", label: "Crítico" };
  if (percentage >= 70) return { color: "text-warning", barColor: "bg-warning", label: "Atenção" };
  return { color: "text-success", barColor: "bg-success", label: "OK" };
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const config = {
    paid: { label: "Paga", variant: "default" as const, className: "bg-success/10 text-success border-success/20" },
    partial: { label: "Parcial", variant: "default" as const, className: "bg-warning/10 text-warning border-warning/20" },
    open: { label: "Aberta", variant: "default" as const, className: "bg-destructive/10 text-destructive border-destructive/20" },
  };
  const c = config[status as keyof typeof config] || config.open;
  return <Badge variant={c.variant} className={cn("text-[10px] px-1.5 py-0", c.className)}>{c.label}</Badge>;
}

function InvoicesModal({ card, open, onClose }: { card: CreditCardAdvanced; open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Faturas — {card.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          {card.invoicesByMonth.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma fatura encontrada nos últimos 6 meses.
            </p>
          ) : (
            card.invoicesByMonth.map((inv) => (
              <Card key={`${inv.year}-${inv.month}`} className="overflow-hidden">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold">{inv.label}</span>
                    <InvoiceStatusBadge status={inv.status} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Compras</span>
                      <p className="font-medium">{formatCurrency(inv.totalPurchases)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Pagamentos</span>
                      <p className="font-medium text-success">{formatCurrency(inv.totalPayments)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Saldo</span>
                      <p className={cn("font-medium", inv.balance > 0 ? "text-destructive" : "text-success")}>
                        {formatCurrency(inv.balance)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CreditCardsAdvancedSummary() {
  const navigate = useNavigate();
  const { data, isLoading } = useCreditCardAdvancedSummary();
  const [invoiceCard, setInvoiceCard] = useState<CreditCardAdvanced | null>(null);
  const [expanded, setExpanded] = useState(true);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!data || data.cards.length === 0) return null;

  const consolidatedPercent = data.totalLimit > 0
    ? Math.min(100, Math.round((data.totalUsed / data.totalLimit) * 100))
    : 0;
  const consolidatedStatus = getUsageStatus(consolidatedPercent);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
        >
          <CreditCard className="h-4 w-4" />
          Visão Consolidada — Cartões de Crédito
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {expanded && (
        <>
          {/* Consolidated Summary Card */}
          <Card className="card-executive overflow-hidden">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                {/* Consolidated Numbers */}
                <div className="flex-1 grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-[11px] text-muted-foreground mb-0.5">Limite Total</p>
                    <p className="text-lg font-bold tracking-tight">{formatCurrency(data.totalLimit)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground mb-0.5">Utilizado</p>
                    <p className="text-lg font-bold tracking-tight text-destructive">{formatCurrency(data.totalUsed)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground mb-0.5">Disponível</p>
                    <p className="text-lg font-bold tracking-tight text-success">{formatCurrency(data.totalAvailable)}</p>
                  </div>
                </div>

                {/* Consolidated Progress */}
                <div className="w-full sm:w-48">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                    <span>Uso consolidado</span>
                    <span className={cn("font-semibold", consolidatedStatus.color)}>{consolidatedPercent}%</span>
                  </div>
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className={cn("h-full rounded-full transition-all duration-500", consolidatedStatus.barColor)}
                      style={{ width: `${consolidatedPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Individual Cards */}
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {data.cards.map((card) => {
              const usagePercent = card.limit > 0
                ? Math.min(100, Math.round((card.used / card.limit) * 100))
                : 0;
              const status = getUsageStatus(usagePercent);

              return (
                <Card key={card.id} className="card-executive-hover overflow-hidden">
                  <CardContent className="p-4">
                    {/* Header */}
                    <div className="flex items-center gap-2.5 mb-3">
                      {card.bankLogo ? (
                        <img
                          src={card.bankLogo}
                          alt={card.bankName || ""}
                          className="h-8 w-8 rounded-lg object-contain bg-muted p-0.5"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <CreditCard className="h-4 w-4 text-primary" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{card.name}</p>
                        {card.bankName && (
                          <p className="text-[11px] text-muted-foreground">{card.bankName}</p>
                        )}
                      </div>
                      <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full border", {
                        "bg-success/10 text-success border-success/20": usagePercent < 70,
                        "bg-warning/10 text-warning border-warning/20": usagePercent >= 70 && usagePercent < 90,
                        "bg-destructive/10 text-destructive border-destructive/20": usagePercent >= 90,
                      })}>
                        {status.label}
                      </span>
                    </div>

                    {/* Limit Details */}
                    <div className="grid grid-cols-3 gap-2 mb-3 text-[11px]">
                      <div>
                        <span className="text-muted-foreground">Limite</span>
                        <p className="font-medium">{formatCurrency(card.limit)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Utilizado</span>
                        <p className="font-medium text-destructive">{formatCurrency(card.used)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Disponível</span>
                        <p className="font-medium text-success">{formatCurrency(card.available)}</p>
                      </div>
                    </div>

                    {/* Usage Bar */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                        <span>Limite utilizado</span>
                        <span className={cn("font-medium", status.color)}>{usagePercent}%</span>
                      </div>
                      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className={cn("h-full rounded-full transition-all", status.barColor)}
                          style={{ width: `${usagePercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Invoice + Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-border/50">
                      <div className="text-[11px]">
                        <span className="text-muted-foreground">Fatura Atual: </span>
                        <span className="font-semibold text-destructive">{formatCurrency(card.invoiceAmount)}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[11px] gap-1 px-2"
                        onClick={() => setInvoiceCard(card)}
                      >
                        <Eye className="h-3 w-3" />
                        Ver Faturas
                      </Button>
                    </div>

                    {/* Due date / Best purchase day if available */}
                    {(card.dueDate || card.bestPurchaseDay) && (
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-2 pt-2 border-t border-border/30">
                        {card.dueDate && <span>Vencimento: {card.dueDate}</span>}
                        {card.bestPurchaseDay && <span>Melhor dia de compra: {card.bestPurchaseDay}</span>}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Invoice Modal */}
      {invoiceCard && (
        <InvoicesModal
          card={invoiceCard}
          open={!!invoiceCard}
          onClose={() => setInvoiceCard(null)}
        />
      )}
    </div>
  );
}
