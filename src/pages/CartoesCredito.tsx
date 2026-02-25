import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  Plus,
  Eye,
  Receipt,
  Calendar,
  ChevronRight,
} from "lucide-react";
import { useCreditCardAdvancedSummary, CreditCardAdvanced, CreditCardInvoiceMonth } from "@/hooks/useCreditCardAdvancedSummary";
import { formatCurrency, shortenAccountName } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { AccountDialog } from "@/components/accounts/AccountDialog";

const BANK_COLORS: Record<string, string> = {
  nubank: "#8A05BE",
  inter: "#FF7A00",
  itau: "#EC7000",
  itaú: "#EC7000",
  bradesco: "#CC092F",
  santander: "#EC0000",
  c6bank: "#1A1A1A",
  c6: "#1A1A1A",
  picpay: "#21C25E",
  neon: "#00BFFF",
  next: "#00AB63",
  original: "#7FD321",
  pan: "#006AB3",
  safra: "#004B8D",
  bb: "#FDCB03",
  "banco do brasil": "#FDCB03",
  caixa: "#0066B3",
  btg: "#1A1A1A",
  xp: "#1A1A1A",
  modal: "#F15A24",
};

function getBankColor(bankName: string | null): string {
  if (!bankName) return "hsl(var(--primary))";
  const lower = bankName.toLowerCase();
  for (const [key, color] of Object.entries(BANK_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return "hsl(var(--primary))";
}

function isDarkColor(hex: string): boolean {
  if (hex.startsWith("hsl")) return true;
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

function getUsageStatus(percentage: number) {
  if (percentage >= 90) return { color: "text-destructive", barColor: "bg-destructive", label: "Crítico" };
  if (percentage >= 70) return { color: "text-warning", barColor: "bg-warning", label: "Atenção" };
  return { color: "text-success", barColor: "bg-success", label: "OK" };
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const config = {
    paid: { label: "Paga", className: "bg-success/10 text-success border-success/20" },
    partial: { label: "Parcial", className: "bg-warning/10 text-warning border-warning/20" },
    open: { label: "Aberta", className: "bg-destructive/10 text-destructive border-destructive/20" },
  };
  const c = config[status as keyof typeof config] || config.open;
  return <Badge variant="default" className={cn("text-[10px] px-1.5 py-0 border", c.className)}>{c.label}</Badge>;
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

function CreditCardVisual({ card, onViewInvoices, onNavigate }: {
  card: CreditCardAdvanced;
  onViewInvoices: () => void;
  onNavigate: () => void;
}) {
  const bankColor = getBankColor(card.bankName);
  const textLight = isDarkColor(bankColor);
  const usagePercent = card.limit > 0 ? Math.round((card.used / card.limit) * 100) : 0;
  const isOverLimit = usagePercent > 100;
  const status = getUsageStatus(usagePercent);

  return (
    <div className="group">
      {/* Card Visual - Estilo de Cartão Real */}
      <div
        className="relative rounded-2xl p-5 aspect-[1.6/1] flex flex-col justify-between overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-xl"
        style={{ background: `linear-gradient(135deg, ${bankColor}, ${bankColor}dd)` }}
        onClick={onNavigate}
      >
        {/* Padrão decorativo */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-10" style={{ background: "white" }} />
          <div className="absolute -bottom-16 -left-8 w-48 h-48 rounded-full opacity-5" style={{ background: "white" }} />
        </div>

        {/* Header */}
        <div className="relative flex items-start justify-between">
          {card.bankLogo ? (
            <div className="h-8 w-8 rounded-lg bg-white/20 p-1 flex items-center justify-center backdrop-blur-sm">
              <img src={card.bankLogo} alt={card.bankName || ""} className="h-6 w-6 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>
          ) : (
            <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <CreditCard className={`h-4 w-4 ${textLight ? "text-white" : "text-foreground"}`} />
            </div>
          )}
          <CreditCard className={`h-5 w-5 ${textLight ? "text-white/60" : "text-foreground/60"}`} />
        </div>

        {/* Nome */}
        <div className="relative">
          <p className={`text-xs font-medium ${textLight ? "text-white/70" : "text-foreground/70"}`}>
            {card.bankName || "Cartão"}
          </p>
          <p className={`text-sm font-bold ${textLight ? "text-white" : "text-foreground"}`}>
            {shortenAccountName(card.name, "credit_card")}
          </p>
        </div>

        {/* Footer do Card */}
        <div className="relative flex items-end justify-between">
          {card.dueDate && (
            <div>
              <p className={`text-[9px] uppercase tracking-wider ${textLight ? "text-white/50" : "text-foreground/50"}`}>Vencimento</p>
              <p className={`text-xs font-semibold ${textLight ? "text-white/90" : "text-foreground/90"}`}>{card.dueDate}</p>
            </div>
          )}
          {card.bestPurchaseDay && (
            <div className="text-right">
              <p className={`text-[9px] uppercase tracking-wider ${textLight ? "text-white/50" : "text-foreground/50"}`}>Melhor Compra</p>
              <p className={`text-xs font-semibold ${textLight ? "text-white/90" : "text-foreground/90"}`}>{card.bestPurchaseDay}</p>
            </div>
          )}
        </div>

        {/* Hover shine */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      </div>

      {/* Informações Abaixo do Card */}
      <div className="mt-3 space-y-3 px-1">
        {/* Limite e Disponível */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[11px] text-muted-foreground">Limite Total</p>
            <p className="text-sm font-bold">{formatCurrency(card.limit)}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-muted-foreground">Disponível</p>
            <p className="text-sm font-bold text-success">{formatCurrency(card.available)}</p>
          </div>
        </div>

        {/* Barra de Progresso */}
        <div>
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="text-muted-foreground">Utilizado</span>
            <span className={cn("font-semibold", status.color)}>{usagePercent}%</span>
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={cn("h-full rounded-full transition-all duration-500", status.barColor)}
              style={{ width: `${Math.min(100, usagePercent)}%` }}
            />
          </div>
        </div>

        {/* Fatura Atual */}
        <div className="pt-2 border-t border-border/50">
          <p className="text-[11px] text-muted-foreground">Fatura Atual</p>
          <p className="text-base font-bold text-destructive">{formatCurrency(card.invoiceAmount)}</p>
        </div>
      </div>
    </div>
  );
}

export default function CartoesCredito() {
  const navigate = useNavigate();
  const { data, isLoading } = useCreditCardAdvancedSummary();
  const [invoiceCard, setInvoiceCard] = useState<CreditCardAdvanced | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);

  if (isLoading) {
    return (
      <AppLayout title="Cartões de Crédito">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-64 mt-2" />
            </div>
            <Skeleton className="h-9 w-36" />
          </div>
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-[320px] rounded-2xl" />)}
          </div>
        </div>
      </AppLayout>
    );
  }

  const cards = data?.cards || [];

  return (
    <AppLayout title="Cartões de Crédito">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Cartões de Crédito</h1>
            <p className="text-sm text-muted-foreground">Gerencie todos os seus cartões em um só lugar</p>
          </div>
          <Button onClick={() => setShowAddDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Adicionar Cartão
          </Button>
        </div>

        {/* Consolidated Summary */}
        {data && cards.length > 0 && (
          <Card className="card-executive overflow-hidden">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
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
                <div className="w-full sm:w-48">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                    <span>Uso consolidado</span>
                    <span className={cn("font-semibold", getUsageStatus(data.totalLimit > 0 ? Math.round((data.totalUsed / data.totalLimit) * 100) : 0).color)}>
                      {data.totalLimit > 0 ? Math.round((data.totalUsed / data.totalLimit) * 100) : 0}%
                    </span>
                  </div>
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className={cn("h-full rounded-full transition-all duration-500", getUsageStatus(data.totalLimit > 0 ? Math.round((data.totalUsed / data.totalLimit) * 100) : 0).barColor)}
                      style={{ width: `${data.totalLimit > 0 ? Math.min(100, Math.round((data.totalUsed / data.totalLimit) * 100)) : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cards Grid */}
        {cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <CreditCard className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Nenhum cartão cadastrado</h3>
            <p className="text-sm text-muted-foreground mb-4">Adicione seu primeiro cartão para começar</p>
            <Button onClick={() => setShowAddDialog(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Adicionar Cartão
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => (
              <CreditCardVisual
                key={card.id}
                card={card}
                onViewInvoices={() => setInvoiceCard(card)}
                onNavigate={() => navigate(`/cartao/${card.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Invoice Modal */}
      {invoiceCard && (
        <InvoicesModal card={invoiceCard} open={!!invoiceCard} onClose={() => setInvoiceCard(null)} />
      )}

      {/* Add Card Dialog - reuses account dialog with credit_card type */}
      <AccountDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        account={null}
      />
    </AppLayout>
  );
}
