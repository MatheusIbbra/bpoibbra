import { useState, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import {
  useCategoriesHierarchy,
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  Category,
  CategoryType,
} from "@/hooks/useCategories";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ChevronRight,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { icons } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSeedCategories } from "@/hooks/useSeedCategories";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { BaseRequiredAlert, useCanCreate } from "@/components/common/BaseRequiredAlert";
import { DeleteCategoryDialog } from "@/components/categories/DeleteCategoryDialog";
import { getAutoIcon } from "@/lib/category-icons";

const DRE_GROUP_OPTIONS = [
  { value: "receita_operacional", label: "Receita Operacional" },
  { value: "deducoes_receita", label: "Deduções de Receita" },
  { value: "custo_produtos_vendidos", label: "Custo dos Produtos Vendidos" },
  { value: "despesas_operacionais", label: "Despesas Operacionais" },
  { value: "despesas_administrativas", label: "Despesas Administrativas" },
  { value: "despesas_financeiras", label: "Despesas Financeiras" },
  { value: "outras_receitas", label: "Outras Receitas" },
  { value: "outras_despesas", label: "Outras Despesas" },
  { value: "impostos", label: "Impostos" },
];

const EXPENSE_CLASSIFICATION_OPTIONS = [
  { value: "fixa", label: "Despesa Fixa" },
  { value: "variavel_programada", label: "Despesa Variável Programada" },
  { value: "variavel_recorrente", label: "Despesa Variável Recorrente" },
];

const COLOR_OPTIONS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
  "#f43f5e", "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#10b981", "#14b8a6", "#06b6d4",
  "#0ea5e9", "#3b82f6", "#1e40af",
];

interface CategoryFormData {
  name: string;
  icon: string;
  color: string;
  type: CategoryType;
  parent_id: string | null;
  description: string | null;
  dre_group: string | null;
  expense_classification: string | null;
}

// Render a lucide icon by kebab-case name
function LucideIcon({ name, className, style }: { name: string; className?: string; style?: React.CSSProperties }) {
  // Convert kebab-case to PascalCase
  const pascalName = name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  const IconComponent = (icons as any)[pascalName];
  if (!IconComponent) return <icons.Tag className={className} style={style} />;
  return <IconComponent className={className} style={style} />;
}

// Get effective icon for a category (child inherits from parent)
function getEffectiveIcon(category: Category, allCategories?: Category[]): string {
  if (category.parent_id && allCategories) {
    const parent = allCategories.find(c => c.id === category.parent_id);
    if (parent) {
      return parent.icon || getAutoIcon(parent.name);
    }
  }
  return category.icon || getAutoIcon(category.name);
}

export default function Categorias() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: hierarchyCategories, isLoading } = useCategoriesHierarchy(
    typeFilter !== "all" ? (typeFilter as CategoryType) : undefined
  );
  const { data: allCategories } = useCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const seedCategories = useSeedCategories();
  const { userRole } = useBaseFilter();
  const { canCreate } = useCanCreate();

  const canEditDre = userRole && userRole !== 'cliente';

  const [formData, setFormData] = useState<CategoryFormData>({
    name: "",
    icon: "",
    color: "#6366f1",
    type: "expense",
    parent_id: null,
    description: null,
    dre_group: null,
    expense_classification: null,
  });

  if (!authLoading && !user) {
    navigate("/auth");
    return null;
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const parentCategories = allCategories?.filter(c => !c.parent_id) || [];

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

  const resetForm = () => {
    setFormData({
      name: "",
      icon: "",
      color: "#6366f1",
      type: "expense",
      parent_id: null,
      description: null,
      dre_group: null,
      expense_classification: null,
    });
    setEditingCategory(null);
  };

  const handleCreate = (parentId?: string) => {
    resetForm();
    if (parentId) {
      const parent = allCategories?.find(c => c.id === parentId);
      setFormData(prev => ({
        ...prev,
        parent_id: parentId,
        type: parent?.type || "expense",
        color: parent?.color || "#6366f1",
        icon: parent?.icon || getAutoIcon(parent?.name || ""),
      }));
    }
    setDialogOpen(true);
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      icon: category.icon || getAutoIcon(category.name),
      color: category.color || "#6366f1",
      type: category.type,
      parent_id: category.parent_id,
      description: category.description,
      dre_group: category.dre_group,
      expense_classification: (category as any).expense_classification || null,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const autoIcon = formData.icon || getAutoIcon(formData.name);
    const dataToSave = {
      ...formData,
      icon: autoIcon,
      dre_group: formData.parent_id ? null : formData.dre_group,
      expense_classification: formData.type === 'expense' ? formData.expense_classification : null,
    };

    if (editingCategory) {
      await updateCategory.mutateAsync({
        id: editingCategory.id,
        ...dataToSave,
      });
    } else {
      await createCategory.mutateAsync(dataToSave);
    }
    setDialogOpen(false);
    resetForm();
  };

  const categoryToDelete = deleteId ? allCategories?.find(c => c.id === deleteId) || null : null;

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "income": return "Receita";
      case "expense": return "Despesa";
      case "investment": return "Investimento";
      case "redemption": return "Resgate";
      default: return type;
    }
  };

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case "income": return "default";
      case "expense": return "destructive";
      case "investment": return "secondary";
      case "redemption": return "outline";
      default: return "secondary";
    }
  };

  const getExpenseClassificationLabel = (classification: string | null): string => {
    switch (classification) {
      case "fixa": return "Fixa";
      case "variavel_programada": return "Var. Programada";
      case "variavel_recorrente": return "Var. Recorrente";
      default: return "";
    }
  };

  const CategoryItem = ({ category, isChild = false }: { category: Category; isChild?: boolean }) => {
    const hasChildren = category.children && category.children.length > 0;
    const isExpanded = expandedCategories.has(category.id);
    const effectiveIcon = getEffectiveIcon(category, allCategories || []);

    return (
      <div className={cn("space-y-0.5", isChild && "ml-6 border-l-2 border-muted pl-3")}>
        <div
          className={cn(
            "flex items-center justify-between rounded-lg border px-3 py-2 transition-colors hover:bg-muted/50",
            isChild && "bg-muted/20 border-dashed"
          )}
        >
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            {hasChildren ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={(e) => toggleExpand(e, category.id)}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </Button>
            ) : (
              <div className="w-6" />
            )}
            
            <div
              className="h-7 w-7 rounded-lg shrink-0 flex items-center justify-center"
              style={{ backgroundColor: category.color || "#6366f1" }}
            >
              <LucideIcon name={effectiveIcon} className="h-3.5 w-3.5 text-white" />
            </div>
            
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="font-medium text-sm truncate">{category.name}</p>
                <Badge variant={getTypeBadgeVariant(category.type) as any} className="shrink-0 text-[10px] px-1.5 py-0">
                  {getTypeLabel(category.type)}
                </Badge>
                {(category as any).expense_classification && (
                  <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0">
                    {getExpenseClassificationLabel((category as any).expense_classification)}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {canCreate && (
            <div className="flex gap-0.5 shrink-0">
              {!isChild && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleCreate(category.id)}
                  title="Adicionar subcategoria"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleEdit(category)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => setDeleteId(category.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div className="space-y-0.5">
            {category.children!.map((child) => (
              <CategoryItem key={child.id} category={child} isChild />
            ))}
          </div>
        )}
      </div>
    );
  };

  if (!canCreate) {
    return (
      <AppLayout title="Categorias">
        <div className="space-y-4">
          <BaseRequiredAlert action="gerenciar categorias" />
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <LucideIcon name="tag" className="h-10 w-10 text-muted-foreground mb-3" />
              <h3 className="text-base font-semibold">Selecione uma base</h3>
              <p className="text-sm text-muted-foreground">
                Selecione uma base específica no menu superior para visualizar e gerenciar categorias.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Categorias">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px] h-8 text-sm">
              <SelectValue placeholder="Filtrar tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="income">Receitas</SelectItem>
              <SelectItem value="expense">Despesas</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button 
              variant="outline"
              size="sm"
              onClick={() => seedCategories.mutate()}
              disabled={seedCategories.isPending}
            >
              {seedCategories.isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              )}
              Criar Iniciais
            </Button>
            <Button size="sm" onClick={() => handleCreate()}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Nova Categoria
            </Button>
          </div>
        </div>

        {/* Categories List */}
        {isLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : hierarchyCategories?.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <LucideIcon name="tag" className="h-10 w-10 text-muted-foreground mb-3" />
              <h3 className="text-base font-semibold">Nenhuma categoria encontrada</h3>
              <p className="text-sm text-muted-foreground">
                Crie categorias para organizar suas transações.
              </p>
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
                {(typeFilter === 'all' || typeFilter === 'income') && incomeCategories.length > 0 && (
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
                
                {(typeFilter === 'all' || typeFilter === 'expense') && expenseCategories.length > 0 && (
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
      </div>

      {/* Simplified Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">
              {editingCategory ? "Editar Categoria" : formData.parent_id ? "Nova Subcategoria" : "Nova Categoria"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {/* Preview */}
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <div
                className="h-9 w-9 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: formData.color }}
              >
                <LucideIcon 
                  name={formData.icon || getAutoIcon(formData.name)} 
                  className="h-4 w-4 text-white" 
                />
              </div>
              <div>
                <p className="font-medium text-sm">{formData.name || "Nome da categoria"}</p>
                <p className="text-[11px] text-muted-foreground">
                  {formData.type === "income" ? "Receita" : "Despesa"}
                  {formData.parent_id && " • Subcategoria"}
                </p>
              </div>
            </div>

            <div>
              <Label className="text-xs">Nome</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value, icon: "" })}
                placeholder="Nome da categoria"
                className="h-8 text-sm"
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Ícone é definido automaticamente pelo nome
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: CategoryType) =>
                    setFormData({ ...formData, type: value })
                  }
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Receita</SelectItem>
                    <SelectItem value="expense">Despesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.type === 'expense' && (
                <div>
                  <Label className="text-xs">Classificação <span className="text-destructive">*</span></Label>
                  <Select
                    value={formData.expense_classification || ""}
                    onValueChange={(value) =>
                      setFormData({ ...formData, expense_classification: value || null })
                    }
                  >
                    <SelectTrigger className={cn("h-8 text-sm", !formData.expense_classification && "border-destructive/50")}>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPENSE_CLASSIFICATION_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {!formData.parent_id && !editingCategory?.parent_id && (
              <div>
                <Label className="text-xs">Categoria Pai (opcional)</Label>
                <Select
                  value={formData.parent_id || "none"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, parent_id: value === "none" ? null : value })
                  }
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Nenhuma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma (categoria pai)</SelectItem>
                    {parentCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {canEditDre && !formData.parent_id && !editingCategory?.parent_id && (
              <div>
                <Label className="text-xs">Grupo DRE</Label>
                <Select
                  value={formData.dre_group || "none"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, dre_group: value === "none" ? null : value })
                  }
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {DRE_GROUP_OPTIONS.map((group) => (
                      <SelectItem key={group.value} value={group.value}>
                        {group.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Color picker - compact */}
            <div>
              <Label className="text-xs">Cor</Label>
              <div className="mt-1.5 grid grid-cols-9 gap-1.5">
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={cn(
                      "h-6 w-6 rounded-full transition-transform hover:scale-110",
                      formData.color === color && "ring-2 ring-primary ring-offset-1"
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData({ ...formData, color })}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={handleSave}
                disabled={
                  !formData.name || 
                  createCategory.isPending || 
                  updateCategory.isPending ||
                  (formData.type === 'expense' && !formData.expense_classification)
                }
              >
                {(createCategory.isPending || updateCategory.isPending) ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Salvar"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteCategoryDialog
        category={categoryToDelete}
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        allCategories={allCategories || []}
        onDeleted={() => setDeleteId(null)}
      />
    </AppLayout>
  );
}
