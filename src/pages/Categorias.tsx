import { useState } from "react";
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
  Tags,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSeedCategories } from "@/hooks/useSeedCategories";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { BaseRequiredAlert, useCanCreate } from "@/components/common/BaseRequiredAlert";
import { DeleteCategoryDialog } from "@/components/categories/DeleteCategoryDialog";

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

const ICON_OPTIONS = [
  { value: "circle", label: "Círculo" },
  { value: "briefcase", label: "Trabalho" },
  { value: "shopping-cart", label: "Compras" },
  { value: "home", label: "Casa" },
  { value: "car", label: "Carro" },
  { value: "utensils", label: "Alimentação" },
  { value: "heart", label: "Saúde" },
  { value: "book", label: "Educação" },
  { value: "plane", label: "Viagem" },
  { value: "gamepad-2", label: "Lazer" },
  { value: "gift", label: "Presente" },
  { value: "zap", label: "Energia" },
  { value: "droplet", label: "Água" },
  { value: "wifi", label: "Internet" },
  { value: "smartphone", label: "Telefone" },
  { value: "plus-circle", label: "Outros Ganhos" },
  { value: "banknote", label: "Dinheiro" },
  { value: "building-2", label: "Empresa" },
  { value: "wallet", label: "Carteira" },
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

  // Users who can edit DRE mappings (everyone except 'cliente')
  const canEditDre = userRole && userRole !== 'cliente';

  const [formData, setFormData] = useState<CategoryFormData>({
    name: "",
    icon: "circle",
    color: "#6366f1",
    type: "expense",
    parent_id: null,
    description: null,
    dre_group: null,
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
      icon: "circle",
      color: "#6366f1",
      type: "expense",
      parent_id: null,
      description: null,
      dre_group: null,
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
      }));
    }
    setDialogOpen(true);
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      icon: category.icon || "circle",
      color: category.color || "#6366f1",
      type: category.type,
      parent_id: category.parent_id,
      description: category.description,
      dre_group: category.dre_group,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    // For child categories, dre_group should be null
    const dataToSave = {
      ...formData,
      dre_group: formData.parent_id ? null : formData.dre_group,
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

  // Get the category to delete for the dialog
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

  const CategoryItem = ({ category, isChild = false }: { category: Category; isChild?: boolean }) => {
    const hasChildren = category.children && category.children.length > 0;
    const isExpanded = expandedCategories.has(category.id);

    return (
      <div className={cn("space-y-1", isChild && "ml-6 border-l-2 border-muted pl-4")}>
        <div
          className={cn(
            "flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50",
            isChild && "bg-muted/20"
          )}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {hasChildren ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={(e) => toggleExpand(e, category.id)}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            ) : (
              <div className="w-6" />
            )}
            
            <div
              className="h-8 w-8 rounded-full shrink-0 flex items-center justify-center"
              style={{ backgroundColor: category.color }}
            >
              <Tags className="h-4 w-4 text-white" />
            </div>
            
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium truncate">{category.name}</p>
                <Badge variant={getTypeBadgeVariant(category.type) as any} className="shrink-0 text-xs">
                  {getTypeLabel(category.type)}
                </Badge>
                {category.dre_group && (
                  <Badge variant="outline" className="shrink-0 text-xs bg-muted">
                    DRE: {category.dre_group}
                  </Badge>
                )}
              </div>
              {category.description && (
                <p className="text-xs text-muted-foreground truncate">
                  {category.description}
                </p>
              )}
            </div>
          </div>

          {/* Only show action buttons if base is selected */}
          {canCreate && (
            <div className="flex gap-1 shrink-0">
              {!isChild && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleCreate(category.id)}
                  title="Adicionar subcategoria"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleEdit(category)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => setDeleteId(category.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
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

  // Show base selection required state
  if (!canCreate) {
    return (
      <AppLayout title="Categorias">
        <div className="space-y-6">
          <BaseRequiredAlert action="gerenciar categorias" />
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Tags className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">Selecione uma base</h3>
              <p className="text-muted-foreground">
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filtrar tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="income">Receitas</SelectItem>
                <SelectItem value="expense">Despesas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => seedCategories.mutate()}
              disabled={seedCategories.isPending}
            >
              {seedCategories.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Criar Categorias Iniciais
            </Button>
            <Button onClick={() => handleCreate()}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Categoria Pai
            </Button>
          </div>
        </div>

        {/* Categories List - Grouped by Type */}
        {isLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : hierarchyCategories?.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Tags className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">Nenhuma categoria encontrada</h3>
              <p className="text-muted-foreground">
                Crie categorias para organizar suas transações.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Group categories by type and sort alphabetically */}
            {(() => {
              // Sort parent categories alphabetically and group by type
              const sortedCategories = [...(hierarchyCategories || [])].sort((a, b) => 
                a.name.localeCompare(b.name, 'pt-BR')
              );
              
              // Sort children alphabetically within each parent
              const categoriesWithSortedChildren = sortedCategories.map(cat => ({
                ...cat,
                children: cat.children 
                  ? [...cat.children].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
                  : []
              }));
              
              const incomeCategories = categoriesWithSortedChildren.filter(c => c.type === 'income');
              const expenseCategories = categoriesWithSortedChildren.filter(c => c.type === 'expense');
              
              return (
                <div className="space-y-6">
                  {/* Income Categories */}
                  {(typeFilter === 'all' || typeFilter === 'income') && incomeCategories.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <div className="h-3 w-3 rounded-full bg-primary" />
                          Receitas ({incomeCategories.length} categorias)
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {incomeCategories.map((category) => (
                          <CategoryItem key={category.id} category={category} />
                        ))}
                      </CardContent>
                    </Card>
                  )}
                  
                  {/* Expense Categories */}
                  {(typeFilter === 'all' || typeFilter === 'expense') && expenseCategories.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <div className="h-3 w-3 rounded-full bg-destructive" />
                          Despesas ({expenseCategories.length} categorias)
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {expenseCategories.map((category) => (
                          <CategoryItem key={category.id} category={category} />
                        ))}
                      </CardContent>
                    </Card>
                  )}
                  
                  {/* Empty state for filtered views */}
                  {typeFilter === 'income' && incomeCategories.length === 0 && (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <Tags className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold">Nenhuma categoria de receita</h3>
                      </CardContent>
                    </Card>
                  )}
                  {typeFilter === 'expense' && expenseCategories.length === 0 && (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <Tags className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold">Nenhuma categoria de despesa</h3>
                      </CardContent>
                    </Card>
                  )}
                </div>
              );
            })()}
          </>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Editar Categoria" : formData.parent_id ? "Nova Subcategoria" : "Nova Categoria Pai"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome da categoria"
              />
            </div>

            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value || null })}
                placeholder="Descrição da categoria"
                rows={2}
              />
            </div>

            <div>
              <Label>Tipo</Label>
              <Select
                value={formData.type}
                onValueChange={(value: CategoryType) =>
                  setFormData({ ...formData, type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Receita</SelectItem>
                  <SelectItem value="expense">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!formData.parent_id && !editingCategory?.parent_id && (
              <div>
                <Label>Categoria Pai (opcional)</Label>
                <Select
                  value={formData.parent_id || "none"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, parent_id: value === "none" ? null : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria pai" />
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

            {/* DRE Group - Only for parent categories and non-client users */}
            {canEditDre && !formData.parent_id && !editingCategory?.parent_id && (
              <div>
                <Label>Grupo DRE</Label>
                <Select
                  value={formData.dre_group || "none"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, dre_group: value === "none" ? null : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o grupo DRE" />
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
                <p className="text-xs text-muted-foreground mt-1">
                  Usado para agrupar categorias no Demonstrativo de Resultados
                </p>
              </div>
            )}

            <div>
              <Label>Ícone</Label>
              <Select
                value={formData.icon}
                onValueChange={(value) => setFormData({ ...formData, icon: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ICON_OPTIONS.map((icon) => (
                    <SelectItem key={icon.value} value={icon.value}>
                      {icon.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Cor</Label>
              <div className="mt-2 grid grid-cols-9 gap-2">
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={cn(
                      "h-7 w-7 rounded-full transition-transform hover:scale-110",
                      formData.color === color && "ring-2 ring-primary ring-offset-2"
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData({ ...formData, color })}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={handleSave}
                disabled={!formData.name || createCategory.isPending || updateCategory.isPending}
              >
                {(createCategory.isPending || updateCategory.isPending) ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Salvar"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation - Using new DeleteCategoryDialog component */}
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
