import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useCreditCardDetails, CreditCardInvoice, CreditCardTransaction } from "@/hooks/useCreditCardDetails";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  CreditCard,
  ArrowLeft,
  FileText,
  List,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

function getUsageStatus(percentage: number) {
  if (percentage >= 90) return { color: "text-destructive", barColor: "bg-destructive", label: "Crítico" };
  if (percentage >= 70) return { color: "text-warning", barColor: "bg-warning", label: "Atenção" };
  return { color: "text-success", barColor: "bg-success", label: "OK" };
}

function InvoiceStatusBadge({ status }: { status: "paid" | "partial" | "open" }) {
  const config = {
    paid: { label: "Paga", variant: "default" as const, className: "bg-success/10 text-success border-success/20" },
    partial: { label: "Parcial", variant: "default" as const, className: "bg-warning/10 text-warning border-warning/20" },
    open: { label: "Em aberto", variant: "default" as const, className: "bg-destructive/10 text-destructive border-destructive/20" },
  };
  const c = config[status];
  return (
    <Badge variant={c.variant} className={cn("text-[10px] border", c.className)}>
      {status === "paid" && <CheckCircle2 className="h-3 w-3 mr-1" />}
      {status === "partial" && <Clock className="h-3 w-3 mr-1" />}
      {status === "open" && <AlertCircle className="h-3 w-3 mr-1" />}
      {c.label}
    </Badge>
  );
}

function TransactionRow({ tx }: { tx: CreditCardTransaction }) {
  const isPayment = tx.type === "income" || tx.type === "transfer";
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="h-7 w-7 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: tx.category_color ? `${tx.category_color}20` : "hsl(var(--muted))" }}
        >
          <span className="text-xs">{tx.category_icon || "📄"}</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{tx.description || "Sem descrição"}</p>
          <p className="text-[11px] text-muted-foreground">
            {format(parseISO(tx.date), "dd MMM", { locale: ptBR })}
            {tx.category_name && ` · ${tx.category_name}`}
          </p>
        </div>
      </div>
      <span className={cn("text-sm font-semibold shrink-0 ml-2", isPayment ? "text-success" : "text-destructive")}>
        {isPayment ? "+" : "-"}{formatCurrency(tx.amount)}
      </span>
    </div>
  );
}

export default function CartaoCredito() {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const { account, isLoadingAccount, invoices, isLoadingInvoices } = useCreditCardDetails(accountId);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // CREDIT CARD RULE: credit_card accounts are liabilities (passivo).
  // Never include in available balance calculations.
  const debt = account ? Math.abs(account.currentBalance) : 0;
  const usagePercent = account?.totalLimit
    ? Math.min(100, Math.round((debt / account.totalLimit) * 100))
    : 0;
  const status = getUsageStatus(usagePercent);

  // Filtered transactions for "Transações" tab
  const allTransactions = useMemo(() => {
    const all: CreditCardTransaction[] = [];
    invoices.forEach((inv) => inv.transactions.forEach((tx) => all.push(tx)));
    return all;
  }, [invoices]);

  const filteredTransactions = useMemo(() => {
    return allTransactions.filter((tx) => {
      if (searchTerm && !tx.description?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (filterStatus === "paid" && tx.type === "expense") return false;
      if (filterStatus === "open" && tx.type !== "expense") return false;
      return true;
    });
  }, [allTransactions, searchTerm, filterStatus]);

  if (isLoadingAccount) {
    return (
      <AppLayout title="Cartão de Crédito">
        <div className="space-y-4">
          <Skeleton className="h-[200px] rounded-xl" />
          <Skeleton className="h-[300px] rounded-xl" />
        </div>
      </AppLayout>
    );
  }

  if (!account) {
    return (
      <AppLayout title="Cartão de Crédito">
        <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
          <CreditCard className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-muted-foreground">Cartão não encontrado</p>
          <Button variant="outline" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Cartão de Crédito">
      <div className="space-y-4">
        {/* Back button */}
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>

        {/* Tabs */}
        <Tabs defaultValue="faturas" className="w-full">
          <TabsList className="w-full max-w-[300px]">
            <TabsTrigger value="faturas" className="flex-1 gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Faturas
            </TabsTrigger>
            <TabsTrigger value="transacoes" className="flex-1 gap-1.5">
              <List className="h-3.5 w-3.5" />
              Transações
            </TabsTrigger>
          </TabsList>

          {/* FATURAS TAB */}
          <TabsContent value="faturas" className="mt-3">
            {isLoadingInvoices ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
            ) : invoices.length === 0 ? (
              <Card className="card-executive">
                <CardContent className="py-12 text-center">
                  <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-muted-foreground">Nenhuma fatura encontrada</p>
                </CardContent>
              </Card>
            ) : (
              <Accordion type="single" collapsible className="space-y-2">
                {invoices.map((invoice) => (
                  <AccordionItem
                    key={`${invoice.year}-${invoice.month}`}
                    value={`${invoice.year}-${invoice.month}`}
                    className="border rounded-xl overflow-hidden bg-card"
                  >
                    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-accent/30 transition-colors">
                      <div className="flex items-center justify-between w-full pr-2">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold">{invoice.label}</span>
                          <InvoiceStatusBadge status={invoice.status} />
                        </div>
                        <div className="flex items-center gap-4 text-right">
                          <div>
                            <p className="text-[10px] text-muted-foreground">Compras</p>
                            <p className="text-sm font-semibold text-destructive">
                              {formatCurrency(invoice.totalPurchases)}
                            </p>
                          </div>
                          {invoice.totalPayments > 0 && (
                            <div>
                              <p className="text-[10px] text-muted-foreground">Pagamentos</p>
                              <p className="text-sm font-semibold text-success">
                                {formatCurrency(invoice.totalPayments)}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-2 pb-2">
                      <div className="divide-y divide-border/50">
                        {invoice.transactions.map((tx) => (
                          <TransactionRow key={tx.id} tx={tx} />
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </TabsContent>

          {/* TRANSAÇÕES TAB */}
          <TabsContent value="transacoes" className="mt-3">
            <div className="flex flex-wrap gap-2 mb-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por descrição..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <div className="flex gap-1">
                {[
                  { value: "all", label: "Todas" },
                  { value: "open", label: "Compras" },
                  { value: "paid", label: "Pagamentos" },
                ].map((opt) => (
                  <Button
                    key={opt.value}
                    variant={filterStatus === opt.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterStatus(opt.value)}
                    className="h-9 text-xs"
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>

            <Card className="card-executive">
              <CardContent className="p-2">
                {filteredTransactions.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    Nenhuma transação encontrada
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {filteredTransactions.map((tx) => (
                      <TransactionRow key={tx.id} tx={tx} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
