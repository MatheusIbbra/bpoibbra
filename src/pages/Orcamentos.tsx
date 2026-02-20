import { useState } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Plus,
  Loader2,
  AlertCircle,
  Wallet,
  Pencil,
  Trash2,
  Check,
  ChevronsUpDown,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
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
import { CurrencyInput } from "@/components/ui/currency-input";
import { useBudgets, useCreateBudget, useUpdateBudget, useDeleteBudget, Budget } from "@/hooks/useBudgets";
import { useCategoriesHierarchy } from "@/hooks/useCategories";
import { useTransactions } from "@/hooks/useTransactions";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { BaseRequiredAlert, useCanCreate } from "@/components/common/BaseRequiredAlert";
import { BudgetAlerts } from "@/components/budget/BudgetAlerts";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const budgetSchema = z.object({
  category_id: z.string().min(1, "Categoria é obrigatória"),
  amount: z.number().positive("Valor deve ser positivo"),
});

type FormData = z.infer<typeof budgetSchema>;

export default function Orcamentos() {
  const { requiresBaseSelection } = useBaseFilter();
  const { canCreate } = useCanCreate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false);

  const currentDate = new Date();
  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  const startOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;
  const endOfMonth = new Date(year, month, 0).toISOString().split("T")[0];

  const { data: budgets, isLoading } = useBudgets(month, year);
  // Load ALL categories in hierarchy (income + expense)
  const { data: hierarchyCategories } = useCategoriesHierarchy();
  const { data: transactions } = useTransactions({
    startDate: startOfMonth,
    endDate: endOfMonth,
  });

  const createBudget = useCreateBudget();
  const updateBudget = useUpdateBudget();
  const deleteBudget = useDeleteBudget();

  const form = useForm<FormData>({
    resolver: zodResolver(budgetSchema),
    defaultValues: { category_id: "", amount: 0 },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getSpentForCategory = (categoryId: string) => {
    return transactions
      ?.filter((t) => t.category_id === categoryId)
      .reduce((acc, t) => acc + Math.abs(Number(t.amount)), 0) || 0;
  };

  const handleEdit = (budget: Budget) => {
    setEditingBudget(budget);
    form.reset({
      category_id: budget.category_id,
      amount: Number(budget.amount),
    });
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteBudget.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  // Build flat list of child categories from hierarchy for selection
  const allChildCategories = hierarchyCategories?.flatMap(parent =>
    (parent.children || []).map(child => ({
      ...child,
      parentName: parent.name,
      parentType: parent.type,
    }))
  ) || [];

  const usedCategoryIds = budgets?.map((b) => b.category_id) || [];
  const availableCategories = allChildCategories.filter(
    (c) => !usedCategoryIds.includes(c.id) || c.id === editingBudget?.category_id
  );

  // Group available categories by parent for display
  const groupedCategories = availableCategories.reduce<Record<string, { parentName: string; parentType: string; children: typeof availableCategories }>>((acc, cat) => {
    const key = cat.parentName;
    if (!acc[key]) {
      acc[key] = { parentName: cat.parentName, parentType: cat.parentType, children: [] };
    }
    acc[key].children.push(cat);
    return acc;
  }, {});

  // Sort groups: income first, then expense, alphabetically within
  const sortedGroups = Object.values(groupedCategories).sort((a, b) => {
    if (a.parentType !== b.parentType) {
      return a.parentType === "income" ? -1 : 1;
    }
    return a.parentName.localeCompare(b.parentName, "pt-BR");
  });

  const findCategoryName = (id: string) => {
    return allChildCategories.find(c => c.id === id)?.name || 
           budgets?.find(b => b.category_id === id)?.categories?.name || id;
  };

  const onSubmit = async (data: FormData) => {
    const validCategory = allChildCategories.find(c => c.id === data.category_id);
    if (!validCategory) {
      toast.error("A categoria selecionada não existe ou não pertence a esta base");
      return;
    }
    
    if (editingBudget) {
      await updateBudget.mutateAsync({ id: editingBudget.id, ...data });
    } else {
      await createBudget.mutateAsync({ category_id: data.category_id, amount: data.amount, month, year, cost_center_id: null });
    }
    setDialogOpen(false);
    setEditingBudget(null);
    form.reset();
  };

  const totalBudget = budgets?.reduce((acc, b) => acc + Number(b.amount), 0) || 0;
  const totalSpent = budgets?.reduce((acc, b) => acc + getSpentForCategory(b.category_id), 0) || 0;

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
    <AppLayout title="Orçamentos">
      <div className="space-y-4">
        {/* Summary - Compact */}
        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs text-muted-foreground">Orçamento Total</p>
                <p className="text-lg font-bold">{formatCurrency(totalBudget)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Disponível</p>
                <p className={cn("text-lg font-bold", (totalBudget - totalSpent) >= 0 ? "text-success" : "text-destructive")}>
                  {formatCurrency(totalBudget - totalSpent)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Gasto</p>
                <p className={cn("text-lg font-bold", totalSpent > totalBudget && "text-destructive")}>
                  {formatCurrency(totalSpent)}
                </p>
              </div>
            </div>
            <Progress
              value={totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0}
              className={cn("h-2", totalSpent > totalBudget && "[&>div]:bg-destructive")}
            />
            <div className="flex items-center justify-between mt-2">
              <p className="text-[11px] text-muted-foreground">
                {totalBudget > 0 ? ((totalSpent / totalBudget) * 100).toFixed(0) : 0}% utilizado
              </p>
              <Link to="/analise-orcamento">
                <Badge variant="outline" className="cursor-pointer hover:bg-secondary text-[10px]">
                  Ver análise completa
                </Badge>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Budget Alerts */}
        <BudgetAlerts showNotifications={false} compact />

        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Orçamentos por Categoria</h2>
          <Button size="sm" className="h-7 text-xs" onClick={() => { setEditingBudget(null); form.reset(); setDialogOpen(true); }}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Novo Orçamento
          </Button>
        </div>

        {/* Budget List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : budgets?.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-6 text-center">
              <Wallet className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum orçamento definido</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-2 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {budgets?.map((budget) => {
              const spent = getSpentForCategory(budget.category_id);
              const percentage = Math.min((spent / Number(budget.amount)) * 100, 100);
              const isOverBudget = spent > Number(budget.amount);

              return (
                <Card key={budget.id}>
                  <CardContent className="py-2.5 px-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-sm font-medium truncate flex-1">{budget.categories?.name}</p>
                      <div className="flex gap-0.5 shrink-0 ml-2">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEdit(budget)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDeleteId(budget.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className={cn(isOverBudget && "text-destructive font-medium")}>
                        {formatCurrency(spent)}
                      </span>
                      <span className="text-muted-foreground">
                        de {formatCurrency(Number(budget.amount))}
                      </span>
                    </div>
                    <Progress
                      value={percentage}
                      className={cn("h-1.5", isOverBudget && "[&>div]:bg-destructive")}
                    />
                    {isOverBudget && (
                      <p className="text-[10px] text-destructive flex items-center gap-0.5 mt-1">
                        <AlertCircle className="h-2.5 w-2.5" />
                        Excedido em {formatCurrency(spent - Number(budget.amount))}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

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
                            className={cn(
                              "w-full justify-between bg-white dark:bg-muted font-normal h-8 text-sm",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? findCategoryName(field.value) : "Buscar categoria..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-[--radix-popover-trigger-width] p-0"
                        align="start"
                        onWheel={(e) => e.stopPropagation()}
                      >
                        <Command filter={(value, search) => {
                          const cat = allChildCategories.find(c => c.id === value);
                          if (!cat) return 0;
                          return cat.name.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
                        }}>
                          <CommandInput placeholder="Digitar para buscar..." />
                          <CommandList className="max-h-[250px] overflow-y-auto">
                            <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
                            {sortedGroups.map((group) => (
                              <CommandGroup
                                key={group.parentName}
                                heading={
                                  <span className="flex items-center gap-1.5">
                                    <span className={cn(
                                      "h-2 w-2 rounded-full",
                                      group.parentType === "income" ? "bg-primary" : "bg-destructive"
                                    )} />
                                    {group.parentName}
                                  </span>
                                }
                              >
                                {group.children.map((cat) => (
                                  <CommandItem
                                    key={cat.id}
                                    value={cat.id}
                                    onSelect={(val) => {
                                      field.onChange(val);
                                      setCategoryPopoverOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-3 w-3",
                                        field.value === cat.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
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
                      <CurrencyInput
                        value={field.value}
                        onChange={field.onChange}
                        className="h-8 text-sm bg-white dark:bg-muted"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-2">
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

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Excluir orçamento?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
