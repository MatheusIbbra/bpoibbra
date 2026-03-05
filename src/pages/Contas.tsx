import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2, Building2, CreditCard, PiggyBank, TrendingUp, ArrowRightLeft, Wallet } from "lucide-react";
import { shortenAccountName } from "@/lib/formatters";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useAccounts, useDeleteAccount, AccountType } from "@/hooks/useAccounts";
import { useBankConnections } from "@/hooks/useBankConnections";
import { AccountDialog } from "@/components/accounts/AccountDialog";
import { TransferDialog } from "@/components/transfers/TransferDialog";
import { BaseRequiredAlert, useCanCreate } from "@/components/common/BaseRequiredAlert";
import { EmptyState } from "@/components/common/EmptyState";

const ACCOUNT_TYPE_ICONS: Record<AccountType, typeof Building2> = {
  checking: Building2,
  savings: PiggyBank,
  investment: TrendingUp,
  credit_card: CreditCard,
  cash: Wallet,
};

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: "Conta Corrente",
  savings: "Poupança",
  investment: "Investimento",
  credit_card: "Cartão de Crédito",
  cash: "Dinheiro",
};

export default function Contas() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [deleteAccountId, setDeleteAccountId] = useState<string | null>(null);

  const { data: accounts, isLoading: loadingAccounts } = useAccounts();
  const { data: bankConnections } = useBankConnections();

  const bankLogoMap = new Map<string, string>();
  bankConnections?.forEach((conn) => {
    const meta = (conn as any).metadata as { bank_name?: string; bank_logo_url?: string | null } | null;
    if (meta?.bank_name && meta?.bank_logo_url) {
      bankLogoMap.set(meta.bank_name, meta.bank_logo_url);
    }
  });
  const deleteAccount = useDeleteAccount();
  const { canCreate } = useCanCreate();

  if (!user) {
    navigate("/auth");
    return null;
  }

  if (!canCreate) {
    return (
      <AppLayout title="Contas Bancárias">
        <div className="space-y-6">
          <BaseRequiredAlert action="gerenciar contas bancárias" />
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">Selecione uma base</h3>
              <p className="text-muted-foreground">
                Selecione uma base específica no menu superior para visualizar e gerenciar contas bancárias.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const activeAccounts = accounts?.filter((a) => a.status === "active") || [];
  const availableAccounts = activeAccounts.filter(a => a.account_type !== "credit_card");
  const creditCardAccounts = activeAccounts.filter(a => a.account_type === "credit_card");
  const totalBalance = availableAccounts.reduce((sum, acc) => sum + (acc.current_balance || 0), 0);
  const totalCreditCardDebt = creditCardAccounts.reduce((sum, acc) => sum + Math.abs(acc.current_balance || 0), 0);
  const netBalance = totalBalance - totalCreditCardDebt;

  const handleEdit = (account: any) => {
    setSelectedAccount(account);
    setAccountDialogOpen(true);
  };

  const handleDelete = async () => {
    if (deleteAccountId) {
      await deleteAccount.mutateAsync(deleteAccountId);
      setDeleteAccountId(null);
    }
  };

  return (
    <AppLayout title="Contas Bancárias">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg sm:text-2xl font-bold tracking-tight">Contas</h1>
            <p className="text-[11px] sm:text-sm text-muted-foreground">Gerencie suas contas</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTransferDialogOpen(true)}
              disabled={!canCreate}
              className="text-xs h-8 px-2.5"
            >
              <ArrowRightLeft className="mr-1 h-3.5 w-3.5" />
              <span className="hidden sm:inline">Transferência</span>
            </Button>
            <Button
              size="sm"
              onClick={() => { setSelectedAccount(null); setAccountDialogOpen(true); }}
              disabled={!canCreate}
              className="text-xs h-8 px-2.5"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              <span className="hidden sm:inline">Nova Conta</span>
            </Button>
          </div>
        </div>

        {/* Unified Summary Card */}
        <Card className="border-0 bg-gradient-to-br from-card to-muted/30 overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Patrimônio Líquido</p>
              <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
                {activeAccounts.length} conta(s)
              </Badge>
            </div>
            <p className={`text-3xl font-bold ${netBalance >= 0 ? "text-success" : "text-destructive"}`}>
              {formatCurrency(netBalance)}
            </p>
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/30">
              <div className="flex-1">
                <p className="text-[10px] text-muted-foreground">Disponível</p>
                <p className="text-sm font-semibold text-success">{formatCurrency(totalBalance)}</p>
              </div>
              {creditCardAccounts.length > 0 && (
                <div className="flex-1">
                  <p className="text-[10px] text-muted-foreground">Cartões</p>
                  <p className="text-sm font-semibold text-destructive">-{formatCurrency(totalCreditCardDebt)}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Accounts List */}
        {loadingAccounts ? (
          <p className="text-muted-foreground text-center py-8 text-sm">Carregando...</p>
        ) : accounts?.length === 0 ? (
          <EmptyState variant="accounts" />
        ) : (
          <div className="space-y-2">
            {accounts?.map((account) => {
              const Icon = ACCOUNT_TYPE_ICONS[account.account_type] || Building2;
              const bankLogo = account.bank_name ? bankLogoMap.get(account.bank_name) : undefined;
              const balance = account.current_balance || 0;
              return (
                <div
                  key={account.id}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border/40 active:scale-[0.99] transition-transform"
                >
                  {/* Icon */}
                  {bankLogo ? (
                    <img
                      src={bankLogo}
                      alt={account.bank_name || ""}
                      className="h-10 w-10 rounded-xl object-contain bg-muted p-0.5 shrink-0"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <div
                      className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: account.color || "hsl(var(--primary))" }}
                    >
                      <Icon className="h-4.5 w-4.5 text-white" />
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate leading-tight">
                      {shortenAccountName(account.name, account.account_type)}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {account.bank_name && `${account.bank_name} · `}
                      {ACCOUNT_TYPE_LABELS[account.account_type] || account.account_type}
                    </p>
                  </div>

                  {/* Balance + Actions */}
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold ${balance >= 0 ? "text-success" : "text-destructive"}`}>
                      {formatCurrency(balance)}
                    </p>
                    <div className="flex gap-0.5 justify-end mt-0.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEdit(account); }}
                        className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-muted/50 text-muted-foreground"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteAccountId(account.id); }}
                        className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-destructive/10 text-destructive/60"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AccountDialog
        open={accountDialogOpen}
        onOpenChange={setAccountDialogOpen}
        account={selectedAccount}
      />

      <TransferDialog
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
      />

      <AlertDialog open={!!deleteAccountId} onOpenChange={() => setDeleteAccountId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todas as transações vinculadas a esta conta perderão a referência.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
