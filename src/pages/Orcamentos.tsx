import React, { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Plus, Loader2, AlertCircle, Pencil, Trash2, Check,
  ChevronsUpDown, Repeat, TrendingUp, TrendingDown, Target, PiggyBank,
  CheckCircle2, HelpCircle,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Popover as HoverPopover, PopoverContent as HoverPopoverContent, PopoverTrigger as HoverPopoverTrigger } from "@/components/ui/popover";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CurrencyInput } from "@/components/ui/currency-input";
import { MonthSelector } from "@/components/dashboard/MonthSelector";
import { useBudgets, useCreateBudget, useUpdateBudget, useDeleteBudget, Budget } from "@/hooks/useBudgets";
import { useBudgetAnalysis } from "@/hooks/useBudgetAnalysis";
import { useCategoriesHierarchy } from "@/hooks/useCategories";
import { useTransactions } from "@/hooks/useTransactions";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useMonthlyPlan, useUpsertMonthlyPlan } from "@/hooks/useMonthlyPlan";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { useDisciplineScore, DisciplineIndicator } from "@/hooks/useDisciplineScore";
import { BaseRequiredAlert, useCanCreate } from "@/components/common/BaseRequiredAlert";
import { GaugeChart } from "@/components/dashboard/GaugeChart";
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

/* ────────────────────────────────────────────
   Playfair section title
   ──────────────────────────────────────────── */
function SectionTitle({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <h2
      className="text-xl font-bold tracking-tight text-foreground animate-in fade-in slide-in-from-bottom-2 duration-500"
      style={{ fontFamily: "'Playfair Display', Georgia, serif", animationDelay: `${delay}ms` }}
    >
      {children}
    </h2>
  );
}

/* ────────────────────────────────────────────
   Animated card wrapper with stagger
   ──────────────────────────────────────────── */
function FadeCard({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <div
      className={cn("animate-in fade-in slide-in-from-bottom-3 duration-600", className)}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

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
  const { data: monthlyPlan } = useMonthlyPlan(month, year);
  const { data: analysis } = useBudgetAnalysis(month, year);
  const upsertPlan = useUpsertMonthlyPlan();

  const [editingPlan, setEditingPlan] = useState(false);
  const [planIncome, setPlanIncome] = useState(0);
  const [planInvestment, setPlanInvestment] = useState(0);

  const planSynced = React.useRef<string>("");
  React.useEffect(() => {
    const key = `${month}-${year}-${monthlyPlan?.id}`;
    if (planSynced.current !== key) {
      planSynced.current = key;
      setPlanIncome(monthlyPlan?.income_target ?? 0);
      setPlanInvestment(monthlyPlan?.investment_target ?? 0);
    }
  }, [monthlyPlan, month, year]);

  const createBudget = useCreateBudget();
  const updateBudget = useUpdateBudget();
  const deleteBudget = useDeleteBudget();

  const form = useForm<FormData>({
    resolver: zodResolver(budgetSchema),
    defaultValues: { category_id: "", amount: 0 },
  });

  const getSpentForCategory = (categoryId: string) =>
    transactions?.filter((t) => t.category_id === categoryId && t.type === "expense")
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

  const effectiveIncome = planIncome > 0 ? planIncome : income;
  const freeBalance = effectiveIncome - planInvestment - totalBudget;
  const budgetRemaining = totalBudget - totalSpent;

  const today = new Date();
  const totalDays = getDaysInMonth(selectedMonth);
  const isCurrentMonth = selectedMonth.getMonth() === today.getMonth() && selectedMonth.getFullYear() === today.getFullYear();
  const isPastMonth = selectedMonth < new Date(today.getFullYear(), today.getMonth(), 1);
  const daysPassed = isPastMonth ? totalDays : isCurrentMonth ? today.getDate() : 0;
  const projectedExpenses = daysPassed > 0 ? (totalSpent / daysPassed) * totalDays : totalSpent;
  const projectionDiff = projectedExpenses - totalBudget;

  // Discipline score from shared hook
  const { score: disciplineScore } = useDisciplineScore(selectedMonth);

  const scoreColor = disciplineScore >= 70 ? "text-success" : disciplineScore >= 40 ? "text-warning" : "text-destructive";
  const scoreRing = disciplineScore >= 70 ? "stroke-success" : disciplineScore >= 40 ? "stroke-warning" : "stroke-destructive";
  const circumference = 2 * Math.PI * 54;
  const scoreOffset = circumference - (disciplineScore / 100) * circumference;

  // Budget summary
  const overBudgetCount = budgets?.filter(b => getSpentForCategory(b.category_id) > Number(b.amount)).length || 0;
  const onTrackCount = (budgets?.length || 0) - overBudgetCount;

  if (!canCreate) {
    return (
      <AppLayout title="Orçamentos">
        <div className="space-y-4"><BaseRequiredAlert action="gerenciar orçamentos" /></div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Planejamento">
      <div className="space-y-8 max-w-5xl mx-auto pb-8">

        {/* Month Selector */}
        <FadeCard delay={0}>
          <div className="flex items-center justify-center">
            <div className="inline-flex items-center rounded-full border border-border/30 bg-card/80 px-1.5 py-px">
              <MonthSelector selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} />
            </div>
          </div>
        </FadeCard>

        {/* ═══════════════════════════════════════
           1. DISCIPLINE SCORE — Round clickable card
           ═══════════════════════════════════════ */}
        <DisciplineScoreBubble score={disciplineScore} scoreColor={scoreColor} scoreRing={scoreRing} circumference={circumference} scoreOffset={scoreOffset} selectedMonth={selectedMonth} />

        {/* ═══════════════════════════════════════
           2. PLANEJAMENTO — Monthly Plan
           ═══════════════════════════════════════ */}
        <div className="space-y-3">
          <FadeCard delay={160}>
            <SectionTitle delay={160}>Planejamento</SectionTitle>
          </FadeCard>

          <FadeCard delay={200}>
            <div className="overflow-visible">
              <div className="p-0">
                <div className="flex items-center justify-end mb-4">
                  <div className="flex items-center gap-2">
                    {/* Saldo Livre tooltip */}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button className="flex items-center justify-center h-7 w-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                            <HelpCircle className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[220px] p-3 rounded-xl">
                          <p className="text-xs font-semibold mb-1">Saldo Livre</p>
                          <p className="text-lg font-bold tabular-nums" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                            <MaskedValue>{formatCurrency(freeBalance)}</MaskedValue>
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Receita − Investimento − Despesas
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <Button
                      size="sm" variant="ghost"
                      className="h-7 text-[10px] text-muted-foreground hover:text-foreground"
                      onClick={() => setEditingPlan(!editingPlan)}
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      {editingPlan ? "Fechar" : "Editar"}
                    </Button>
                  </div>
                </div>

                {editingPlan ? (
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1">Meta de Receita</p>
                      <CurrencyInput value={planIncome} onChange={setPlanIncome} />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1">Meta de Investimento</p>
                      <CurrencyInput value={planInvestment} onChange={setPlanInvestment} />
                    </div>
                    <Button
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => {
                        upsertPlan.mutate({ month, year, income_target: planIncome, investment_target: planInvestment });
                        setEditingPlan(false);
                      }}
                      disabled={upsertPlan.isPending}
                    >
                      {upsertPlan.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Salvar Plano"}
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 py-4" style={{ gap: 32 }}>
                    <div className="flex flex-col items-center">
                      <GaugeChart
                        label="Receita"
                        valorPlanejado={effectiveIncome}
                        valorRealizado={income}
                        variant="success"
                        compact
                      />
                    </div>
                    <div className="flex flex-col items-center">
                      <GaugeChart
                        label="Investimento"
                        valorPlanejado={planInvestment || 1}
                        valorRealizado={0}
                        variant="blue"
                        compact
                      />
                    </div>
                    <div className="flex flex-col items-center">
                      <GaugeChart
                        label="Despesas"
                        valorPlanejado={totalBudget || 1}
                        valorRealizado={totalSpent}
                        variant="destructive"
                        compact
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </FadeCard>
        </div>

        {/* ═══════════════════════════════════════
           3. RESUMO ORÇAMENTÁRIO + Budget Items
           ═══════════════════════════════════════ */}
        <div className="space-y-3">
          <FadeCard delay={280}>
            <div className="flex items-center justify-between">
              <SectionTitle delay={280}>Orçamentos</SectionTitle>
              <Button size="sm" className="h-8 text-xs rounded-full px-4" onClick={() => { setEditingBudget(null); setIsRecurring(false); form.reset(); setDialogOpen(true); }}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Nova Categoria
              </Button>
            </div>
          </FadeCard>

          {/* Category cards */}
          <div className="space-y-3">
            {isLoading ? (
              <FadeCard delay={400}>
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              </FadeCard>
            ) : budgets?.length === 0 ? (
              <FadeCard delay={400}>
                <Card className="border-0 shadow-fintech">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <Target className="h-12 w-12 text-muted-foreground/20 mb-4" />
                    <p className="text-sm text-muted-foreground">Nenhum orçamento para {MONTHS[month - 1]}</p>
                    <Button size="sm" className="mt-4 text-xs rounded-full px-4" onClick={() => { setEditingBudget(null); form.reset(); setDialogOpen(true); }}>
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Criar primeiro orçamento
                    </Button>
                  </CardContent>
                </Card>
              </FadeCard>
            ) : (
              budgets?.map((budget, idx) => {
                const spent = getSpentForCategory(budget.category_id);
                const pct = Math.min((spent / Number(budget.amount)) * 100, 100);
                const isOverBudget = spent > Number(budget.amount);
                const remaining = Number(budget.amount) - spent;

                return (
                  <FadeCard key={budget.id} delay={400 + idx * 60}>
                    <Card className="border-0 shadow-fintech group">
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div
                              className="h-10 w-10 rounded-2xl flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0"
                              style={{ backgroundColor: budget.categories?.color || "hsl(var(--accent))" }}
                            >
                              {budget.categories?.name?.charAt(0) || "?"}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-semibold truncate">{budget.categories?.name}</span>
                                {budget.recurring_group_id && <Repeat className="h-3 w-3 text-muted-foreground shrink-0" />}
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                {isOverBudget
                                  ? `Excedido em ${formatCurrency(Math.abs(remaining))}`
                                  : `Disponível: ${formatCurrency(remaining)}`
                                }
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <span className={cn("text-base font-bold tabular-nums", isOverBudget && "text-destructive")}>
                                <MaskedValue>{formatCurrency(spent)}</MaskedValue>
                              </span>
                              <span className="text-[10px] text-muted-foreground block">
                                de <MaskedValue>{formatCurrency(Number(budget.amount))}</MaskedValue>
                              </span>
                            </div>
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(budget)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteTarget(budget)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-muted/30 overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-700",
                              isOverBudget
                                ? "bg-destructive"
                                : "bg-gradient-to-r from-[hsl(210,100%,75%)] to-[hsl(210,100%,36%)]"
                            )}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </FadeCard>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* ══════════ DIALOGS ══════════ */}
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
                            variant="outline" role="combobox"
                            className={cn("w-full justify-between font-normal h-10 text-sm", !field.value && "text-muted-foreground")}
                          >
                            {field.value ? findCategoryName(field.value) : "Buscar categoria..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-[--radix-popover-trigger-width] p-0 max-h-[60vh] overflow-hidden"
                        align="start" side="bottom" avoidCollisions
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
                <p className="text-[10px] text-muted-foreground">Será criado apenas para {MONTHS[month - 1]} de {year}</p>
              )}
              {!editingBudget && isRecurring && (
                <p className="text-[10px] text-muted-foreground">Será criado para 12 meses a partir de {MONTHS[month - 1]} de {year}</p>
              )}
              {editingBudget?.recurring_group_id && (
                <p className="text-[10px] text-accent flex items-center gap-1">
                  <Repeat className="h-3 w-3" />
                  A edição será aplicada a este e aos meses seguintes
                </p>
              )}
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" size="sm" className="flex-1" disabled={createBudget.isPending || updateBudget.isPending}>
                  {createBudget.isPending || updateBudget.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : editingBudget ? "Salvar" : "Criar"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Excluir orçamento?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              {deleteTarget?.recurring_group_id ? "Este orçamento é recorrente. O que deseja fazer?" : "Esta ação não pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={deleteTarget?.recurring_group_id ? "flex-col gap-2 sm:flex-col" : ""}>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {deleteTarget?.recurring_group_id ? (
              <>
                <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive/10" onClick={() => handleDelete(false)}>
                  Excluir só este mês
                </Button>
                <Button variant="destructive" onClick={() => handleDelete(true)}>Excluir este e os próximos</Button>
              </>
            ) : (
              <Button variant="destructive" onClick={() => handleDelete(false)}>Excluir</Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

/* ────────────────────────────────────────────
   Discipline Score Bubble — round clickable card
   ──────────────────────────────────────────── */
function IndicatorRow({ ind }: { ind: DisciplineIndicator }) {
  const barColor =
    ind.status === "ok" ? "bg-success" :
    ind.status === "warning" ? "bg-warning" :
    "bg-destructive";

  const statusColor =
    ind.status === "ok" ? "text-success" :
    ind.status === "warning" ? "text-warning" :
    "text-destructive";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">{ind.label}</span>
        <span className={cn("font-bold tabular-nums", statusColor)}>
          {ind.points}/{ind.maxPoints}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barColor)}
          style={{ width: `${ind.pct}%` }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground leading-snug">{ind.detail}</p>
    </div>
  );
}

function DisciplineScoreBubble({
  score, scoreColor, scoreRing, circumference, scoreOffset, selectedMonth,
}: {
  score: number;
  scoreColor: string;
  scoreRing: string;
  circumference: number;
  scoreOffset: number;
  selectedMonth: Date;
}) {
  const { indicators, tips, isLoading } = useDisciplineScore(selectedMonth);

  return (
    <FadeCard delay={80}>
      <div className="flex justify-center">
        <HoverPopover>
          <HoverPopoverTrigger asChild>
            <button
              className="relative h-24 w-24 rounded-full group transition-transform hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={`Disciplina financeira: ${score} pontos`}
            >
              <svg className="h-24 w-24 -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="54" fill="none" className="stroke-muted/20" strokeWidth="6" />
                <circle
                  cx="60" cy="60" r="54"
                  fill="none"
                  className={cn(scoreRing, "transition-all duration-700")}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={scoreOffset}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn("text-2xl font-bold", scoreColor)} style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                  {score}
                </span>
                <span className="text-[8px] text-muted-foreground uppercase tracking-wider mt-0.5">disciplina</span>
              </div>
            </button>
          </HoverPopoverTrigger>
          <HoverPopoverContent
            className="w-80 md:w-96 p-5 rounded-2xl shadow-xl border border-border/50 bg-card"
            side="bottom"
            align="center"
            sideOffset={8}
          >
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                  Disciplina Financeira
                </h3>
              </div>

              {/* Score circle */}
              <div className="flex justify-center">
                <div className="relative h-24 w-24">
                  <svg className="h-24 w-24 -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="52" fill="none" className="stroke-muted/20" strokeWidth="7" />
                    <circle
                      cx="60" cy="60" r="52"
                      fill="none"
                      className={cn(scoreRing, "transition-all duration-700")}
                      strokeWidth="7"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={scoreOffset}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={cn("text-2xl font-bold", scoreColor)} style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                      {score}
                    </span>
                    <span className="text-[9px] text-muted-foreground">/100</span>
                  </div>
                </div>
              </div>

              {/* Indicators */}
              {indicators.length > 0 && (
                <div className="space-y-3">
                  {indicators.map((ind, i) => (
                    <IndicatorRow key={i} ind={ind} />
                  ))}
                </div>
              )}

              {/* Tips */}
              {tips.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-success pt-2 border-t">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-medium">Disciplina perfeita neste mês!</span>
                </div>
              ) : (
                <div className="space-y-1.5 border-t pt-3">
                  <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">
                    O que melhorar
                  </p>
                  {tips.slice(0, 3).map((tip, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <AlertCircle className="h-3 w-3 text-warning shrink-0 mt-0.5" />
                      <span>{tip}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </HoverPopoverContent>
        </HoverPopover>
      </div>
    </FadeCard>
  );
}
