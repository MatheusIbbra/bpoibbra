import { useState } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Plus, Loader2, AlertCircle, Wallet, Pencil, Trash2, Check,
  ChevronsUpDown, Repeat, TrendingUp, TrendingDown, Target, PiggyBank,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CurrencyInput } from "@/components/ui/currency-input";
import { MonthSelector } from "@/components/dashboard/MonthSelector";
import { useBudgets, useCreateBudget, useUpdateBudget, useDeleteBudget, Budget } from "@/hooks/useBudgets";
import { useCategoriesHierarchy } from "@/hooks/useCategories";
import { useTransactions } from "@/hooks/useTransactions";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { BaseRequiredAlert, useCanCreate } from "@/components/common/BaseRequiredAlert";
import { BudgetAlerts } from "@/components/budget/BudgetAlerts";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import { MaskedValue } from "@/contexts/ValuesVisibilityContext";
import { getDaysInMonth } from "date-fns";

const budgetSchema = z.object({
  category_id: z.string().min(1, "Categoria é obrigatória"),
  amount: z.number().positive("Valor deve ser positivo"),
});

type FormData = z.infer<typeof budgetSchema>;

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export default function Orcamentos() {
  const { requiresBaseSelection } = useBaseFilter();
  const { canCreate } = useCanCreate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Budget | null>(null);
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const month = selectedMonth.getMonth() + 1;
  const year = selectedMonth.getFullYear();

  const startOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;
  const endOfMonth = new Date(year, month, 0).toISOString().split("T")[0];

  const { data: budgets, isLoading } = useBudgets(month, year);
  const { data: hierarchyCategories } = useCategoriesHierarchy();
  const { data: transactions } = useTransactions({ startDate: startOfMonth, endDate: endOfMonth });
  const { data: stats } = useDashboardStats(selectedMonth);

  const createBudget = useCreateBudget();
  const updateBudget = useUpdateBudget();
  const deleteBudget = useDeleteBudget();

  const form = useForm<FormData>({
    resolver: zodResolver(budgetSchema),
    defaultValues: { category_id: "", amount: 0 },
  });

  const getSpentForCategory = (categoryId: string) =>
    transactions?.filter((t) => t.category_id === categoryId && t.type === 'expense')
      .reduce((acc, t) => acc + Math.abs(Number(t.amount)), 0) || 0;

  const handleEdit = (budget: Budget) => {
    setEditingBudget(budget);
    form.reset({ category_id: budget.category_id, amount: Number(budget.amount) });
    setDialogOpen(true);
  };

  const handleDelete = async (deleteFuture: boolean) => {
    if (deleteTarget) {
      await deleteBudget.mutateAsync({ id: deleteTarget.id, deleteFuture });
      setDeleteTarget(null);
    }
  };

  const allChildCategories = hierarchyCategories?.flatMap(parent =>
    (parent.children || []).map(child => ({
      ...child, parentName: parent.name, parentType: parent.type,
    }))
  ) || [];

  const usedCategoryIds = budgets?.map((b) => b.category_id) || [];
  const availableCategories = allChildCategories.filter(
    (c) => !usedCategoryIds.includes(c.id) || c.id === editingBudget?.category_id
  );

  const groupedCategories = availableCategories.reduce<Record<string, { parentName: string; parentType: string; children: typeof availableCategories }>>((acc, cat) => {
    const key = cat.parentName;
    if (!acc[key]) acc[key] = { parentName: cat.parentName, parentType: cat.parentType, children: [] };
    acc[key].children.push(cat);
    return acc;
  }, {});

  const sortedGroups = Object.values(groupedCategories).sort((a, b) => {
    if (a.parentType !== b.parentType) return a.parentType === "income" ? -1 : 1;
    return a.parentName.localeCompare(b.parentName, "pt-BR");
  });

  const findCategoryName = (id: string) =>
    allChildCategories.find(c => c.id === id)?.name || budgets?.find(b => b.category_id === id)?.categories?.name || id;

  const onSubmit = async (data: FormData) => {
    const validCategory = allChildCategories.find(c => c.id === data.category_id);
    if (!validCategory) { toast.error("A categoria selecionada não existe ou não pertence a esta base"); return; }
    
    if (editingBudget) {
      await updateBudget.mutateAsync({
        id: editingBudget.id, amount: data.amount,
        updateFuture: !!editingBudget.recurring_group_id,
      });
    } else {
      await createBudget.mutateAsync({
        category_id: data.category_id, amount: data.amount,
        month, year, cost_center_id: null, is_recurring: isRecurring,
      });
    }
    setDialogOpen(false);
    setEditingBudget(null);
    setIsRecurring(false);
    form.reset();
  };

  const totalBudget = budgets?.reduce((acc, b) => acc + Number(b.amount), 0) || 0;
  const totalSpent = budgets?.reduce((acc, b) => acc + getSpentForCategory(b.category_id), 0) || 0;
  const income = stats?.monthlyIncome ?? 0;
  const budgetPct = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;
  const budgetRemaining = totalBudget - totalSpent;

  // Projection
  const today = new Date();
  const daysPassed = today.getDate();
  const totalDays = getDaysInMonth(selectedMonth);
  const projectedExpenses = daysPassed > 0 ? (totalSpent / daysPassed) * totalDays : 0;
  const projectionDiff = projectedExpenses - totalBudget;

  if (!canCreate) {
    return (
      <AppLayout title="Orçamentos">
        <div className="space-y-4">
          <BaseRequiredAlert action="gerenciar orçamentos" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Planejamento Financeiro">
      <div className="space-y-6">
        {/* Month Selector */}
        <div className="flex items-center justify-center">
          <div className="inline-flex items-center rounded-full border border-border/40 bg-card px-4 py-1.5 shadow-fintech">
            <MonthSelector selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} />
          </div>
        </div>

        {/* ── RENDA MENSAL ── */}
        <AnimatedCard>
          <Card className="overflow-hidden">
            <div className="bg-primary p-6">
              <p className="text-[10px] uppercase tracking-[0.2em] font-medium text-primary-foreground/40 mb-2">
                Renda Mensal
              </p>
              <p className="text-3xl font-bold text-primary-foreground leading-none tracking-tight">
                <MaskedValue>{formatCurrency(income)}</MaskedValue>
              </p>
            </div>
          </Card>
        </AnimatedCard>

        {/* ── DISTRIBUIÇÃO DA RENDA ── */}
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-[1.6fr_1fr]">
          {/* Left: Budget control */}
          <div className="space-y-6">
            {/* Summary card */}
            <Card>
              <CardHeader className="pb-2 pt-5 px-6 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Controle do Mês</CardTitle>
                  <p className="text-xs text-muted-foreground">Planejado × Realizado × Disponível</p>
                </div>
                <Button size="sm" className="h-8 text-xs" onClick={() => { setEditingBudget(null); setIsRecurring(false); form.reset(); setDialogOpen(true); }}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Novo
                </Button>
              </CardHeader>
              <CardContent className="px-6 pb-6 space-y-5">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Planejado</p>
                    <p className="text-lg font-bold"><MaskedValue>{formatCurrency(totalBudget)}</MaskedValue></p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Realizado</p>
                    <p className={cn("text-lg font-bold", totalSpent > totalBudget && "text-destructive")}>
                      <MaskedValue>{formatCurrency(totalSpent)}</MaskedValue>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Disponível</p>
                    <p className={cn("text-lg font-bold", budgetRemaining >= 0 ? "text-success" : "text-destructive")}>
                      <MaskedValue>{formatCurrency(budgetRemaining)}</MaskedValue>
                    </p>
                  </div>
                </div>
                <div>
                  <Progress value={budgetPct} className={cn("h-3 rounded-full", totalSpent > totalBudget && "[&>div]:bg-destructive")} />
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-muted-foreground">{budgetPct.toFixed(0)}% utilizado</p>
                    <Badge variant={budgetRemaining >= 0 ? "outline" : "destructive"} className="text-[10px]">
                      {budgetRemaining >= 0 ? "Dentro do planejamento" : "Acima do limite"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Budget List */}
            <Card>
              <CardHeader className="pb-2 pt-5 px-6">
                <CardTitle className="text-base font-semibold">Distribuição por Categoria</CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : budgets?.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Target className="h-10 w-10 text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">Nenhum orçamento definido para {MONTHS[month - 1]}</p>
                    <Button size="sm" className="mt-3 text-xs" onClick={() => { setEditingBudget(null); form.reset(); setDialogOpen(true); }}>
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Criar primeiro orçamento
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {budgets?.map((budget) => {
                      const spent = getSpentForCategory(budget.category_id);
                      const percentage = Math.min((spent / Number(budget.amount)) * 100, 100);
                      const isOverBudget = spent > Number(budget.amount);
                      const remaining = Number(budget.amount) - spent;

                      return (
                        <div key={budget.id} className="group">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2.5 flex-1 min-w-0">
                              <div className="h-8 w-8 rounded-xl flex items-center justify-center text-primary-foreground text-[10px] font-bold shrink-0"
                                style={{ backgroundColor: budget.categories?.color || "#6366f1" }}>
                                {budget.categories?.name?.charAt(0) || "?"}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm font-medium truncate">{budget.categories?.name}</span>
                                  {budget.recurring_group_id && <Repeat className="h-3 w-3 text-muted-foreground shrink-0" />}
                                </div>
                                <p className="text-[10px] text-muted-foreground">
                                  {isOverBudget
                                    ? `Excedido em ${formatCurrency(Math.abs(remaining))}`
                                    : `Disponível: ${formatCurrency(remaining)}`
                                  }
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={cn("text-sm font-semibold tabular-nums", isOverBudget && "text-destructive")}>
                                {formatCurrency(spent)}
                              </span>
                              <span className="text-[10px] text-muted-foreground">/ {formatCurrency(Number(budget.amount))}</span>
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 ml-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(budget)}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteTarget(budget)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                          <Progress value={percentage} className={cn("h-2 rounded-full", isOverBudget && "[&>div]:bg-destructive")} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: Diagnosis + Projection */}
          <div className="space-y-6">
            <div className="lg:sticky lg:top-4 space-y-6">
              {/* Projeção */}
              <Card>
                <CardHeader className="pb-2 pt-5 px-6">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    Projeção do Mês
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-6 pb-6 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-2xl bg-secondary/50">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Orçamento</p>
                      <p className="text-lg font-bold"><MaskedValue>{formatCurrency(totalBudget)}</MaskedValue></p>
                    </div>
                    <div className="p-4 rounded-2xl bg-secondary/50">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Projeção</p>
                      <p className={cn("text-lg font-bold", projectionDiff > 0 ? "text-destructive" : "text-success")}>
                        <MaskedValue>{formatCurrency(projectedExpenses)}</MaskedValue>
                      </p>
                    </div>
                  </div>
                  {totalBudget > 0 && (
                    <div className={cn("p-3 rounded-xl text-sm font-medium flex items-center gap-2",
                      projectionDiff > 0
                        ? "bg-destructive/8 text-destructive"
                        : "bg-success/8 text-success"
                    )}>
                      {projectionDiff > 0 ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                      {projectionDiff > 0
                        ? `Estouro previsto: ${formatCurrency(projectionDiff)}`
                        : `Economia prevista: ${formatCurrency(Math.abs(projectionDiff))}`
                      }
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Diagnóstico */}
              <Card>
                <CardHeader className="pb-2 pt-5 px-6">
                  <CardTitle className="text-base font-semibold">Diagnóstico</CardTitle>
                  <p className="text-xs text-muted-foreground">Diferença entre planejamento e realidade</p>
                </CardHeader>
                <CardContent className="px-6 pb-6 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-2xl bg-secondary/50">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Planejado</p>
                      <p className="text-base font-bold"><MaskedValue>{formatCurrency(totalBudget)}</MaskedValue></p>
                    </div>
                    <div className="p-4 rounded-2xl bg-secondary/50">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Realizado</p>
                      <p className={cn("text-base font-bold", totalSpent > totalBudget && "text-destructive")}>
                        <MaskedValue>{formatCurrency(totalSpent)}</MaskedValue>
                      </p>
                    </div>
                  </div>
                  <div className={cn("p-4 rounded-2xl text-center",
                    budgetRemaining >= 0 ? "bg-success/8" : "bg-destructive/8"
                  )}>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Diferença</p>
                    <p className={cn("text-xl font-bold", budgetRemaining >= 0 ? "text-success" : "text-destructive")}>
                      {budgetRemaining >= 0 ? "-" : "+"}{formatCurrency(Math.abs(budgetRemaining))}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Alertas */}
              <Card>
                <CardHeader className="pb-2 pt-5 px-6">
                  <CardTitle className="text-base font-semibold">Alertas</CardTitle>
                </CardHeader>
                <CardContent className="px-6 pb-6">
                  <BudgetAlerts showNotifications={false} compact selectedMonth={selectedMonth} />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">
              {editingBudget ? "Editar Orçamento" : "Novo Orçamento"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <FormField
                control={form.control}
                name="category_id"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-xs">Categoria</FormLabel>
                    <Popover open={categoryPopoverOpen} onOpenChange={setCategoryPopoverOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn("w-full justify-between font-normal h-10 text-sm", !field.value && "text-muted-foreground")}
                          >
                            {field.value ? findCategoryName(field.value) : "Buscar categoria..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-[--radix-popover-trigger-width] p-0 max-h-[60vh] overflow-hidden"
                        align="start" side="bottom" avoidCollisions={true}
                        onWheel={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}
                      >
                        <Command filter={(value, search) => {
                          const cat = allChildCategories.find(c => c.id === value);
                          return cat?.name.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
                        }}>
                          <CommandInput placeholder="Digitar para buscar..." />
                          <CommandList className="max-h-[200px] overflow-y-auto overscroll-contain" onTouchMove={(e) => e.stopPropagation()}>
                            <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
                            {sortedGroups.map((group) => (
                              <CommandGroup key={group.parentName} heading={
                                <span className="flex items-center gap-1.5">
                                  <span className={cn("h-2 w-2 rounded-full", group.parentType === "income" ? "bg-primary" : "bg-destructive")} />
                                  {group.parentName}
                                </span>
                              }>
                                {group.children.map((cat) => (
                                  <CommandItem key={cat.id} value={cat.id}
                                    onSelect={(val) => { field.onChange(val); setCategoryPopoverOpen(false); }}>
                                    <Check className={cn("mr-2 h-3 w-3", field.value === cat.id ? "opacity-100" : "opacity-0")} />
                                    <span className="text-sm">{cat.name}</span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            ))}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Limite (R$)</FormLabel>
                    <FormControl>
                      <CurrencyInput value={field.value} onChange={field.onChange} className="h-10 text-sm" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {!editingBudget && (
                <div className="flex items-center justify-between rounded-xl border p-3">
                  <div className="flex items-center gap-2">
                    <Repeat className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label className="text-xs cursor-pointer">Orçamento recorrente</Label>
                  </div>
                  <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
                </div>
              )}
              {!editingBudget && !isRecurring && (
                <p className="text-[10px] text-muted-foreground">
                  Será criado apenas para {MONTHS[month - 1]} de {year}
                </p>
              )}
              {!editingBudget && isRecurring && (
                <p className="text-[10px] text-muted-foreground">
                  Será criado de {MONTHS[month - 1]} até Dezembro de {year}
                </p>
              )}
              {editingBudget?.recurring_group_id && (
                <p className="text-[10px] text-accent flex items-center gap-1">
                  <Repeat className="h-3 w-3" />
                  A edição será aplicada a este e aos meses seguintes
                </p>
              )}
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" size="sm" className="flex-1" disabled={createBudget.isPending || updateBudget.isPending}>
                  {createBudget.isPending || updateBudget.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : editingBudget ? "Salvar" : "Criar"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Excluir orçamento?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              {deleteTarget?.recurring_group_id
                ? "Este orçamento é recorrente. O que deseja fazer?"
                : "Esta ação não pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={deleteTarget?.recurring_group_id ? "flex-col gap-2 sm:flex-col" : ""}>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {deleteTarget?.recurring_group_id ? (
              <>
                <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive/10" onClick={() => handleDelete(false)}>
                  Excluir só este mês
                </Button>
                <Button variant="destructive" onClick={() => handleDelete(true)}>
                  Excluir este e os próximos
                </Button>
              </>
            ) : (
              <Button variant="destructive" onClick={() => handleDelete(false)}>
                Excluir
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

// Simple animated wrapper
function AnimatedCard({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500" style={{ animationDelay: `${delay}s` }}>
      {children}
    </div>
  );
}
