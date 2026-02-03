import { useState } from "react";
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
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { useBudgets, useCreateBudget, useUpdateBudget, useDeleteBudget, Budget } from "@/hooks/useBudgets";
import { useCategories } from "@/hooks/useCategories";
import { useTransactions } from "@/hooks/useTransactions";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { BaseRequiredAlert, useCanCreate } from "@/components/common/BaseRequiredAlert";
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

  const currentDate = new Date();
  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  const startOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;
  const endOfMonth = new Date(year, month, 0).toISOString().split("T")[0];

  const { data: budgets, isLoading } = useBudgets(month, year);
  const { data: categories } = useCategories("expense");
  const { data: transactions } = useTransactions({
    type: "expense",
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
      .reduce((acc, t) => acc + Number(t.amount), 0) || 0;
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

  const onSubmit = async (data: FormData) => {
    // Validar que a categoria existe na base selecionada
    const validCategory = categories?.find(c => c.id === data.category_id);
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

  const usedCategoryIds = budgets?.map((b) => b.category_id) || [];
  const availableCategories = categories?.filter(
    (c) => !usedCategoryIds.includes(c.id) || c.id === editingBudget?.category_id
  );

  const totalBudget = budgets?.reduce((acc, b) => acc + Number(b.amount), 0) || 0;
  const totalSpent = budgets?.reduce((acc, b) => acc + getSpentForCategory(b.category_id), 0) || 0;

  // Show base selection required state
  if (!canCreate) {
    return (
      <AppLayout title="Orçamentos">
        <div className="space-y-6">
          <BaseRequiredAlert action="gerenciar orçamentos" />
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">Selecione uma base</h3>
              <p className="text-muted-foreground">
                Selecione uma base específica no menu superior para visualizar e gerenciar orçamentos.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Orçamentos">
      <div className="space-y-6">
        {/* Summary */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground">Orçamento Total do Mês</p>
                <p className="text-2xl font-bold">{formatCurrency(totalBudget)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Gasto</p>
                <p className={cn("text-2xl font-bold", totalSpent > totalBudget && "text-destructive")}>
                  {formatCurrency(totalSpent)}
                </p>
              </div>
            </div>
            <Progress
              value={totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0}
              className={cn(totalSpent > totalBudget && "[&>div]:bg-destructive")}
            />
          </CardContent>
        </Card>

        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Orçamentos por Categoria</h2>
          <Button onClick={() => { setEditingBudget(null); form.reset(); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Orçamento
          </Button>
        </div>

        {/* Budget List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : budgets?.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">Nenhum orçamento definido</h3>
              <p className="text-muted-foreground">
                Defina limites de gastos por categoria.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {budgets?.map((budget) => {
              const spent = getSpentForCategory(budget.category_id);
              const percentage = Math.min((spent / Number(budget.amount)) * 100, 100);
              const isOverBudget = spent > Number(budget.amount);

              return (
                <Card key={budget.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{budget.categories?.name}</CardTitle>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(budget)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(budget.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className={cn(isOverBudget && "text-destructive font-medium")}>
                        {formatCurrency(spent)}
                      </span>
                      <span className="text-muted-foreground">
                        de {formatCurrency(Number(budget.amount))}
                      </span>
                    </div>
                    <Progress
                      value={percentage}
                      className={cn(isOverBudget && "[&>div]:bg-destructive")}
                    />
                    {isOverBudget && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingBudget ? "Editar Orçamento" : "Novo Orçamento"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="category_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma categoria" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableCategories?.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Limite (R$)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={createBudget.isPending || updateBudget.isPending}>
                  {createBudget.isPending || updateBudget.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
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
            <AlertDialogTitle>Excluir orçamento?</AlertDialogTitle>
            <AlertDialogDescription>
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
