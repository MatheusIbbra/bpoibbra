import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2, Building2, CreditCard, PiggyBank, TrendingUp, ArrowRightLeft, Wallet } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useTransfers, useDeleteTransfer } from "@/hooks/useTransfers";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BaseRequiredAlert, useCanCreate } from "@/components/common/BaseRequiredAlert";

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
  const [deleteTransferId, setDeleteTransferId] = useState<string | null>(null);

  const { data: accounts, isLoading: loadingAccounts } = useAccounts();
  const { data: transfers, isLoading: loadingTransfers } = useTransfers();
  const { data: bankConnections } = useBankConnections();

  // Build a map of bank_name -> logo_url from connections metadata
  const bankLogoMap = new Map<string, string>();
  bankConnections?.forEach((conn) => {
    const meta = (conn as any).metadata as { bank_name?: string; bank_logo_url?: string | null } | null;
    if (meta?.bank_name && meta?.bank_logo_url) {
      bankLogoMap.set(meta.bank_name, meta.bank_logo_url);
    }
  });
  const deleteAccount = useDeleteAccount();
  const deleteTransfer = useDeleteTransfer();
  const { canCreate } = useCanCreate();

  if (!user) {
    navigate("/auth");
    return null;
  }

  // Show base selection required state
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

  // Exclude credit cards from total available balance (they are liabilities)
  const activeAccounts = accounts?.filter((a) => a.status === "active") || [];
  const availableAccounts = activeAccounts.filter(a => a.account_type !== "credit_card");
  const creditCardAccounts = activeAccounts.filter(a => a.account_type === "credit_card");
  const totalBalance = availableAccounts.reduce((sum, acc) => sum + (acc.current_balance || 0), 0);
  const totalCreditCardDebt = creditCardAccounts.reduce((sum, acc) => sum + Math.abs(acc.current_balance || 0), 0);

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

  const handleDeleteTransfer = async () => {
    if (deleteTransferId) {
      await deleteTransfer.mutateAsync(deleteTransferId);
      setDeleteTransferId(null);
    }
  };

  return (
    <AppLayout title="Contas Bancárias">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-lg md:text-3xl font-bold">Contas Bancárias</h1>
            <p className="text-muted-foreground">Gerencie suas contas e transferências</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button 
              variant="outline" 
              onClick={() => setTransferDialogOpen(true)}
              disabled={!canCreate}
            >
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              Nova Transferência
            </Button>
            <Button 
              onClick={() => { setSelectedAccount(null); setAccountDialogOpen(true); }}
              disabled={!canCreate}
            >
              <Plus className="mr-2 h-4 w-4" />
              Nova Conta
            </Button>
          </div>
        </div>

        {/* Summary Card */}
        <Card className="responsive-card">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Saldo Disponível</p>
                <p className={`text-3xl md:text-4xl font-bold ${totalBalance >= 0 ? "text-green-600" : "text-destructive"}`}>
                  {formatCurrency(totalBalance)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {availableAccounts.length} conta(s)
                </p>
              </div>
              {creditCardAccounts.length > 0 && (
                <div className="text-center border-l border-border pl-6 sm:pl-10">
                  <p className="text-sm text-muted-foreground">Cartões a Pagar</p>
                  <p className="text-2xl md:text-3xl font-bold text-destructive">
                    -{formatCurrency(totalCreditCardDebt)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {creditCardAccounts.length} cartão(ões)
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Accounts Grid */}
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {loadingAccounts ? (
            <p className="text-muted-foreground col-span-full text-center py-8">Carregando...</p>
          ) : accounts?.length === 0 ? (
            <Card className="col-span-full">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhuma conta cadastrada</p>
                <Button 
                  className="mt-4" 
                  onClick={() => setAccountDialogOpen(true)}
                  disabled={!canCreate}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Conta
                </Button>
              </CardContent>
            </Card>
          ) : (
            accounts?.map((account) => {
              const Icon = ACCOUNT_TYPE_ICONS[account.account_type] || Building2;
              const bankLogo = account.bank_name ? bankLogoMap.get(account.bank_name) : undefined;
              return (
                <Card key={account.id} className="relative">
                  <div className="absolute top-3 right-3 flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(account)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteAccountId(account.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      {bankLogo ? (
                        <img
                          src={bankLogo}
                          alt={account.bank_name || ""}
                          className="h-10 w-10 rounded-lg object-contain bg-muted p-0.5"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <div
                          className="h-10 w-10 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: account.color || "#3b82f6" }}
                        >
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                      )}
                      <div>
                        <CardTitle className="text-base">{account.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">{account.bank_name}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge variant={account.status === "active" ? "default" : "secondary"}>
                          {account.status === "active" ? "Ativa" : "Inativa"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {ACCOUNT_TYPE_LABELS[account.account_type] || account.account_type}
                        </span>
                      </div>
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground">Saldo Atual</p>
                        <p className={`text-xl font-bold ${(account.current_balance || 0) >= 0 ? "text-green-600" : "text-destructive"}`}>
                          {formatCurrency(account.current_balance || 0)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Recent Transfers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Transferências Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingTransfers ? (
              <p className="text-muted-foreground text-center py-4">Carregando...</p>
            ) : transfers?.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Nenhuma transferência realizada</p>
            ) : (
              <div className="space-y-3">
                {transfers?.slice(0, 5).map((transfer) => (
                  <div key={transfer.id} className="flex items-center justify-between p-2.5 md:p-3 rounded-lg border gap-2">
                    <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                      <ArrowRightLeft className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-xs md:text-sm truncate">
                          {transfer.origin_account?.name} → {transfer.destination_account?.name}
                        </p>
                        <p className="text-[10px] md:text-xs text-muted-foreground truncate">
                          {format(new Date(transfer.transfer_date), "dd/MM/yyyy", { locale: ptBR })}
                          {transfer.description && ` • ${transfer.description}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
                      <span className="font-medium text-xs md:text-sm">{formatCurrency(Number(transfer.amount))}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setDeleteTransferId(transfer.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
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

      <AlertDialog open={!!deleteTransferId} onOpenChange={() => setDeleteTransferId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir transferência?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Os saldos das contas serão recalculados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTransfer}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
