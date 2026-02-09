import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Building2, 
  CreditCard, 
  PiggyBank, 
  TrendingUp, 
  ArrowRightLeft, 
  Wallet,
  Tags,
  FolderKanban,
  Scale,
  Loader2,
  ChevronRight,
  ChevronDown,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useCategoriesHierarchy, useCategories, Category, useCreateCategory } from "@/hooks/useCategories";
import { useSeedCategories } from "@/hooks/useSeedCategories";
import { useCostCenters, useDeleteCostCenter } from "@/hooks/useCostCenters";
import { useReconciliationRules, useDeleteReconciliationRule } from "@/hooks/useReconciliationRules";
import { useSeedReconciliationRules } from "@/hooks/useSeedReconciliationRules";
import { useClearReconciliationRules } from "@/hooks/useClearReconciliationRules";
import { AccountDialog } from "@/components/accounts/AccountDialog";
import { CategoriesDialog } from "@/components/categories/CategoriesDialog";
import { CostCenterDialog } from "@/components/cost-centers/CostCenterDialog";
import { TransferDialog } from "@/components/transfers/TransferDialog";
import { RuleDialog } from "@/components/rules/RuleDialog";
import { BaseRequiredAlert, useCanCreate } from "@/components/common/BaseRequiredAlert";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { cn } from "@/lib/utils";

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

export default function Cadastros() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("contas");
  
  // Account state
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [deleteAccountId, setDeleteAccountId] = useState<string | null>(null);
  
  // Category state
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  
  // Cost center state
  const [costCenterDialogOpen, setCostCenterDialogOpen] = useState(false);
  const [selectedCostCenter, setSelectedCostCenter] = useState<any>(null);
  const [deleteCostCenterId, setDeleteCostCenterId] = useState<string | null>(null);
  
  // Rule state
  const [deleteRuleId, setDeleteRuleId] = useState<string | null>(null);
  const [showClearRulesConfirmation, setShowClearRulesConfirmation] = useState(false);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);

  // Data hooks
  const { data: accounts, isLoading: loadingAccounts } = useAccounts();
  const { data: hierarchyCategories, isLoading: loadingCategories } = useCategoriesHierarchy();
  const { data: allCategories } = useCategories();
  const { data: costCenters, isLoading: loadingCostCenters } = useCostCenters();
  const { data: rules, isLoading: loadingRules } = useReconciliationRules();
  
  const deleteAccount = useDeleteAccount();
  const deleteCostCenter = useDeleteCostCenter();
  const deleteRule = useDeleteReconciliationRule();
  const seedRules = useSeedReconciliationRules();
  const clearRules = useClearReconciliationRules();
  const seedCategories = useSeedCategories();
  const { canCreate } = useCanCreate();
  const { selectedOrganization } = useBaseFilter();

  if (!user) {
    navigate("/auth");
    return null;
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const totalBalance = accounts?.reduce((sum, acc) => sum + (acc.current_balance || 0), 0) || 0;

  const toggleExpand = (e: React.MouseEvent, categoryId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  // Show base selection required state
  if (!canCreate) {
    return (
      <AppLayout title="Cadastros">
        <div className="space-y-4">
          <BaseRequiredAlert action="gerenciar cadastros" />
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <Building2 className="h-10 w-10 text-muted-foreground mb-3" />
              <h3 className="font-semibold">Selecione uma base</h3>
              <p className="text-sm text-muted-foreground">
                Selecione uma base específica no menu superior para gerenciar cadastros.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const CategoryItem = ({ category, isChild = false }: { category: Category; isChild?: boolean }) => {
    const hasChildren = category.children && category.children.length > 0;
    const isExpanded = expandedCategories.has(category.id);

    return (
      <div className={cn("space-y-1", isChild && "ml-4 border-l border-muted pl-3")}>
        <div className={cn(
          "flex items-center justify-between rounded-md border p-2 transition-colors hover:bg-muted/50",
          isChild && "bg-muted/20"
        )}>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {hasChildren ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 shrink-0"
                onClick={(e) => toggleExpand(e, category.id)}
              >
                {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </Button>
            ) : (
              <div className="w-5" />
            )}
            
            <div
              className="h-6 w-6 rounded-full shrink-0 flex items-center justify-center"
              style={{ backgroundColor: category.color }}
            >
              <Tags className="h-3 w-3 text-white" />
            </div>
            
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm font-medium truncate">{category.name}</span>
                <Badge 
                  variant={category.type === "income" ? "default" : "destructive"} 
                  className="text-[10px] h-4 px-1"
                >
                  {category.type === "income" ? "Receita" : "Despesa"}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex gap-0.5 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                setEditingCategory(category);
                setCategoryDialogOpen(true);
              }}
              title="Editar categoria"
            >
              <Pencil className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="space-y-1">
            {category.children!.map((child) => (
              <CategoryItem key={child.id} category={child} isChild />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <AppLayout title="Cadastros">
      <div className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <TabsList className="grid w-full sm:w-auto grid-cols-4">
              <TabsTrigger value="contas" className="text-xs sm:text-sm">Contas</TabsTrigger>
              <TabsTrigger value="categorias" className="text-xs sm:text-sm">Categorias</TabsTrigger>
              <TabsTrigger value="centros" className="text-xs sm:text-sm">Centros</TabsTrigger>
              <TabsTrigger value="regras" className="text-xs sm:text-sm">Regras</TabsTrigger>
            </TabsList>
            
            {activeTab === "contas" && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setTransferDialogOpen(true)}>
                  <ArrowRightLeft className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Transferir</span>
                </Button>
                <Button size="sm" onClick={() => { setSelectedAccount(null); setAccountDialogOpen(true); }}>
                  <Plus className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Nova Conta</span>
                </Button>
              </div>
            )}
            {activeTab === "categorias" && (
              <div className="flex gap-2">
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => seedCategories.mutate()}
                  disabled={seedCategories.isPending}
                >
                  {seedCategories.isPending ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3 mr-1" />
                  )}
                  <span className="hidden sm:inline">Criar Iniciais</span>
                </Button>
                <Button size="sm" onClick={() => { setEditingCategory(null); setCategoryDialogOpen(true); }}>
                  <Plus className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Nova Categoria</span>
                </Button>
              </div>
            )}
            {activeTab === "centros" && (
              <Button size="sm" onClick={() => { setSelectedCostCenter(null); setCostCenterDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Novo Centro</span>
              </Button>
            )}
            {activeTab === "regras" && (
              <div className="flex gap-2">
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => seedRules.mutate()}
                  disabled={seedRules.isPending}
                >
                  {seedRules.isPending ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3 mr-1" />
                  )}
                  <span className="hidden sm:inline">Criar Iniciais</span>
                </Button>
                
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => setShowClearRulesConfirmation(true)}
                  disabled={clearRules.isPending || !rules || rules.length === 0}
                  className="text-destructive hover:text-destructive"
                >
                  {clearRules.isPending ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3 mr-1" />
                  )}
                  <span className="hidden sm:inline">Limpar</span>
                </Button>

                <Button size="sm" onClick={() => { setEditingRule(null); setRuleDialogOpen(true); }}>
                  <Plus className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Incluir Nova Regra</span>
                  <span className="sm:hidden">Nova</span>
                </Button>
              </div>
            )}
          </div>

          {/* Contas Tab */}
          <TabsContent value="contas" className="mt-4 space-y-4">
            <Card>
              <CardContent className="py-4">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Saldo Total</p>
                  <p className={cn("text-xl font-bold", totalBalance >= 0 ? "text-success" : "text-destructive")}>
                    {formatCurrency(totalBalance)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {loadingAccounts ? (
                <div className="col-span-full flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : accounts?.length === 0 ? (
                <Card className="col-span-full">
                  <CardContent className="flex flex-col items-center justify-center py-8">
                    <Building2 className="h-10 w-10 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">Nenhuma conta cadastrada</p>
                  </CardContent>
                </Card>
              ) : (
                accounts?.map((account) => {
                  const Icon = ACCOUNT_TYPE_ICONS[account.account_type] || Building2;
                  return (
                    <Card key={account.id} className="relative">
                      <div className="absolute top-2 right-2 flex gap-0.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                          setSelectedAccount(account);
                          setAccountDialogOpen(true);
                        }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteAccountId(account.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <CardHeader className="pb-2 pt-3 px-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-8 w-8 rounded-md flex items-center justify-center"
                            style={{ backgroundColor: account.color || "#3b82f6" }}
                          >
                            <Icon className="h-4 w-4 text-white" />
                          </div>
                          <div className="min-w-0">
                            <CardTitle className="text-sm truncate">{account.name}</CardTitle>
                            <p className="text-xs text-muted-foreground truncate">{account.bank_name}</p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 pb-3 px-3">
                        <div className="flex items-center justify-between">
                          <Badge variant={account.status === "active" ? "default" : "secondary"} className="text-[10px] h-5">
                            {account.status === "active" ? "Ativa" : "Inativa"}
                          </Badge>
                          <p className={cn("text-sm font-bold", (account.current_balance || 0) >= 0 ? "text-success" : "text-destructive")}>
                            {formatCurrency(account.current_balance || 0)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>

          {/* Categorias Tab - same layout as Categorias page */}
          <TabsContent value="categorias" className="mt-4">
            {loadingCategories ? (
              <Card>
                <CardContent className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </CardContent>
              </Card>
            ) : hierarchyCategories?.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <Tags className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhuma categoria cadastrada</p>
                </CardContent>
              </Card>
            ) : (
              (() => {
                const sortedCategories = [...(hierarchyCategories || [])].sort((a, b) =>
                  a.name.localeCompare(b.name, 'pt-BR')
                );
                const categoriesWithSortedChildren = sortedCategories.map(cat => ({
                  ...cat,
                  children: cat.children
                    ? [...cat.children].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
                    : []
                }));
                const incomeCategories = categoriesWithSortedChildren.filter(c => c.type === 'income');
                const expenseCategories = categoriesWithSortedChildren.filter(c => c.type === 'expense');

                return (
                  <div className="space-y-4">
                    {incomeCategories.length > 0 && (
                      <Card>
                        <CardHeader className="py-2.5 px-4">
                          <CardTitle className="flex items-center gap-2 text-sm">
                            <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                            Receitas ({incomeCategories.length})
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 pb-3 pt-0 space-y-0.5">
                          {incomeCategories.map((category) => (
                            <CategoryItem key={category.id} category={category} />
                          ))}
                        </CardContent>
                      </Card>
                    )}

                    {expenseCategories.length > 0 && (
                      <Card>
                        <CardHeader className="py-2.5 px-4">
                          <CardTitle className="flex items-center gap-2 text-sm">
                            <div className="h-2.5 w-2.5 rounded-full bg-destructive" />
                            Despesas ({expenseCategories.length})
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 pb-3 pt-0 space-y-0.5">
                          {expenseCategories.map((category) => (
                            <CategoryItem key={category.id} category={category} />
                          ))}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                );
              })()
            )}
          </TabsContent>

          {/* Centros de Custo Tab */}
          <TabsContent value="centros" className="mt-4">
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-medium">
                  {loadingCostCenters ? "Carregando..." : `${costCenters?.length || 0} centros de custo`}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {loadingCostCenters ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : costCenters?.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <FolderKanban className="h-10 w-10 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">Nenhum centro de custo cadastrado</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {costCenters?.map((center) => (
                      <div key={center.id} className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
                            <FolderKanban className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{center.name}</p>
                            {center.description && (
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">{center.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant={center.is_active ? "default" : "secondary"} className="text-[10px] h-5">
                            {center.is_active ? "Ativo" : "Inativo"}
                          </Badge>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                            setSelectedCostCenter(center);
                            setCostCenterDialogOpen(true);
                          }}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => setDeleteCostCenterId(center.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Regras de Conciliação Tab */}
          <TabsContent value="regras" className="mt-4">
            {loadingRules ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !rules || rules.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <Scale className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhuma regra cadastrada</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-2">
                {rules.map((rule) => {
                  const category = allCategories?.find(c => c.id === rule.category_id);
                  const costCenter = costCenters?.find((cc: any) => cc.id === rule.cost_center_id);
                  const isIncome = rule.transaction_type === "income";
                  return (
                    <div
                      key={rule.id}
                      className={cn(
                        "flex items-center justify-between px-3 py-2.5 rounded-lg border bg-card transition-colors hover:bg-muted/30",
                        isIncome ? "border-l-2 border-l-primary" : "border-l-2 border-l-destructive"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium truncate">{rule.description}</p>
                          <span className="text-sm font-semibold tabular-nums shrink-0">
                            {formatCurrency(rule.amount)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <Badge variant={isIncome ? "default" : "destructive"} className="text-[10px] h-4 px-1">
                            {isIncome ? "Receita" : "Despesa"}
                          </Badge>
                          {category && (
                            <span className="text-[11px] text-muted-foreground">{category.name}</span>
                          )}
                          {costCenter && (
                            <span className="text-[11px] text-muted-foreground">• {costCenter.name}</span>
                          )}
                          {rule.due_day && (
                            <span className="text-[11px] text-muted-foreground">• Dia {rule.due_day}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-0.5 shrink-0 ml-2">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingRule(rule); setRuleDialogOpen(true); }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteRuleId(rule.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <AccountDialog
        open={accountDialogOpen}
        onOpenChange={setAccountDialogOpen}
        account={selectedAccount}
      />

      <TransferDialog
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
      />

      <CategoriesDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        category={editingCategory}
      />

      <CostCenterDialog
        open={costCenterDialogOpen}
        onOpenChange={setCostCenterDialogOpen}
        costCenter={selectedCostCenter}
      />

      <RuleDialog
        open={ruleDialogOpen}
        onOpenChange={setRuleDialogOpen}
        rule={editingRule}
      />

      {/* Delete Dialogs */}
      <AlertDialog open={!!deleteAccountId} onOpenChange={() => setDeleteAccountId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (deleteAccountId) {
                deleteAccount.mutateAsync(deleteAccountId);
                setDeleteAccountId(null);
              }
            }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteCostCenterId} onOpenChange={() => setDeleteCostCenterId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir centro de custo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (deleteCostCenterId) {
                deleteCostCenter.mutateAsync(deleteCostCenterId);
                setDeleteCostCenterId(null);
              }
            }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteRuleId} onOpenChange={() => setDeleteRuleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir regra?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (deleteRuleId) {
                deleteRule.mutate(deleteRuleId);
                setDeleteRuleId(null);
              }
            }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear Rules Confirmation Dialog */}
      <AlertDialog open={showClearRulesConfirmation} onOpenChange={setShowClearRulesConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Limpar Todas as Regras
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir todas as {rules?.length || 0} regras
              {selectedOrganization && ` da base "${selectedOrganization.name}"`}?
              Esta ação é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                clearRules.mutate();
                setShowClearRulesConfirmation(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Limpar Regras
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
