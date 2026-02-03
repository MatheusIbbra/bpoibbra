import { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, AlertTriangle, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Category } from "@/hooks/useCategories";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface DeleteCategoryDialogProps {
  category: Category | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allCategories: Category[];
  onDeleted: () => void;
}

export function DeleteCategoryDialog({
  category,
  open,
  onOpenChange,
  allCategories,
  onDeleted,
}: DeleteCategoryDialogProps) {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [hasChildren, setHasChildren] = useState(false);
  const [linkedTransactionsCount, setLinkedTransactionsCount] = useState(0);
  const [replacementCategoryId, setReplacementCategoryId] = useState<string>("");
  const [checkingDependencies, setCheckingDependencies] = useState(true);

  // Check for dependencies when category changes
  useEffect(() => {
    if (!category || !open) {
      setHasChildren(false);
      setLinkedTransactionsCount(0);
      setReplacementCategoryId("");
      setCheckingDependencies(false);
      return;
    }

    const checkDependencies = async () => {
      setCheckingDependencies(true);

      // Check if it's a parent category with children
      const children = allCategories.filter((c) => c.parent_id === category.id);
      setHasChildren(children.length > 0);

      if (children.length > 0) {
        setCheckingDependencies(false);
        return;
      }

      // Check for linked transactions
      const { count, error } = await supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("category_id", category.id);

      if (error) {
        console.error("Error checking transactions:", error);
        setLinkedTransactionsCount(0);
      } else {
        setLinkedTransactionsCount(count || 0);
      }

      setCheckingDependencies(false);
    };

    checkDependencies();
  }, [category, open, allCategories]);

  // Get available replacement categories (same type, not the current category, only child categories)
  const availableReplacements = allCategories.filter(
    (c) =>
      c.id !== category?.id &&
      c.type === category?.type &&
      c.parent_id !== null // Only child categories can be replacements
  );

  const handleDelete = async () => {
    if (!category) return;

    setIsLoading(true);

    try {
      // If there are linked transactions, reassign them first
      if (linkedTransactionsCount > 0) {
        if (!replacementCategoryId) {
          toast.error("Selecione uma categoria substituta");
          setIsLoading(false);
          return;
        }

        const { error: updateError } = await supabase
          .from("transactions")
          .update({ category_id: replacementCategoryId })
          .eq("category_id", category.id);

        if (updateError) {
          throw updateError;
        }

        const replacementCat = allCategories.find((c) => c.id === replacementCategoryId);
        toast.success(
          `${linkedTransactionsCount} lançamentos reclassificados para "${replacementCat?.name}"`
        );
      }

      // Now delete the category
      const { error: deleteError } = await supabase
        .from("categories")
        .delete()
        .eq("id", category.id);

      if (deleteError) {
        throw deleteError;
      }

      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories-hierarchy"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });

      toast.success("Categoria excluída com sucesso!");
      onDeleted();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(`Erro ao excluir categoria: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!category) return null;

  // Parent category with children - block deletion
  if (hasChildren) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Não é possível excluir
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                A categoria <strong>"{category.name}"</strong> possui subcategorias vinculadas.
              </p>
              <p>
                Para excluir esta categoria pai, primeiro remova ou mova todas as subcategorias.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Entendi</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // Loading dependencies
  if (checkingDependencies) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Verificando dependências...</span>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // Child category with linked transactions - require replacement
  if (linkedTransactionsCount > 0) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Reclassificação Necessária
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                A categoria <strong>"{category.name}"</strong> possui{" "}
                <strong>{linkedTransactionsCount}</strong> lançamento(s) vinculado(s).
              </p>
              <p>Selecione uma categoria substituta para reclassificar os lançamentos:</p>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-4 space-y-4">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <span className="text-sm font-medium">{category.name}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <Select value={replacementCategoryId} onValueChange={setReplacementCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria substituta..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableReplacements.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {availableReplacements.length === 0 && (
              <p className="text-sm text-destructive">
                Não há outras categorias disponíveis do mesmo tipo para reclassificação.
              </p>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={!replacementCategoryId || isLoading || availableReplacements.length === 0}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Processando...
                </>
              ) : (
                "Reclassificar e Excluir"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // No dependencies - simple deletion
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir Categoria</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir a categoria <strong>"{category.name}"</strong>?
            <br />
            Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Excluindo...
              </>
            ) : (
              "Excluir"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
