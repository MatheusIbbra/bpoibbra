import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  Category,
  CategoryType,
} from "@/hooks/useCategories";
import { Settings2, Plus, Pencil, Trash2, Loader2, X, Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

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
];

const COLOR_OPTIONS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
  "#f43f5e", "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#10b981", "#14b8a6", "#06b6d4",
  "#0ea5e9", "#3b82f6", "#6366f1",
];

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

interface CategoryFormData {
  name: string;
  icon: string;
  color: string;
  type: CategoryType;
  parent_id: string | null;
  description: string | null;
  dre_group: string | null;
  is_child: boolean;
}

interface CategoriesDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  category?: Category | null;
}

export function CategoriesDialog({ open: externalOpen, onOpenChange: externalOnOpenChange, category: initialCategory }: CategoriesDialogProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = externalOnOpenChange || setInternalOpen;
  
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<CategoryFormData>({
    name: "",
    icon: "circle",
    color: "#6366f1",
    type: "expense",
    parent_id: null,
    description: null,
    dre_group: null,
    is_child: false,
  });

  const { data: categories, isLoading } = useCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  // Auto-load category for editing when initialCategory is passed
  useEffect(() => {
    if (initialCategory && open) {
      handleEdit(initialCategory);
    } else if (!initialCategory && open) {
      handleCreate();
    }
  }, [initialCategory, open]);

  // Filter parent categories (categories without parent_id)
  const parentCategories = useMemo(() => {
    if (!categories) return [];
    return categories.filter(c => !c.parent_id);
  }, [categories]);

  // Filter parent categories by selected type
  const availableParentCategories = useMemo(() => {
    return parentCategories.filter(c => c.type === formData.type);
  }, [parentCategories, formData.type]);

  const resetForm = () => {
    setFormData({
      name: "",
      icon: "circle",
      color: "#6366f1",
      type: "expense",
      parent_id: null,
      description: null,
      dre_group: null,
      is_child: false,
    });
    setEditingCategory(null);
    setIsCreating(false);
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
      is_child: !!category.parent_id,
    });
    setIsCreating(false);
  };

  const handleCreate = () => {
    setIsCreating(true);
    setEditingCategory(null);
    setFormData({
      name: "",
      icon: "circle",
      color: "#6366f1",
      type: "expense",
      parent_id: null,
      description: null,
      dre_group: null,
      is_child: false,
    });
  };

  const handleSave = async () => {
    // Validation: if is_child, parent_id is required
    if (formData.is_child && !formData.parent_id) {
      return;
    }

    const dataToSave = {
      name: formData.name,
      icon: formData.icon,
      color: formData.color,
      type: formData.type,
      parent_id: formData.is_child ? formData.parent_id : null,
      description: formData.description,
      dre_group: formData.dre_group,
    };

    if (editingCategory) {
      await updateCategory.mutateAsync({
        id: editingCategory.id,
        ...dataToSave,
      });
    } else {
      await createCategory.mutateAsync(dataToSave);
    }
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta categoria?")) {
      await deleteCategory.mutateAsync(id);
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "income": return "Receita";
      case "expense": return "Despesa";
      case "investment": return "Investimento";
      case "redemption": return "Resgate";
      default: return type;
    }
  };

  const getTypeBadgeVariant = (type: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (type) {
      case "income": return "default";
      case "expense": return "destructive";
      default: return "secondary";
    }
  };

  // Get parent name for child category
  const getParentName = (parentId: string | null) => {
    if (!parentId || !categories) return null;
    const parent = categories.find(c => c.id === parentId);
    return parent?.name;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {externalOpen === undefined && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Settings2 className="h-4 w-4" />
            Categorias
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Gerenciar Categorias</DialogTitle>
        </DialogHeader>

        <div className="flex gap-4">
          {/* Categories List */}
          <div className="flex-1">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-medium">Suas Categorias</h3>
              <Button size="sm" onClick={handleCreate} className="gap-1">
                <Plus className="h-4 w-4" />
                Nova
              </Button>
            </div>

            {isLoading ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ScrollArea className="h-[450px] pr-4">
                <div className="space-y-2">
                  {categories?.map((category) => (
                    <div
                      key={category.id}
                      className={cn(
                        "flex items-center justify-between rounded-lg border p-3 transition-colors",
                        editingCategory?.id === category.id && "border-primary bg-primary/5",
                        category.parent_id && "ml-6 border-dashed"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {category.parent_id && (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <div
                          className="h-8 w-8 rounded-full shrink-0"
                          style={{ backgroundColor: category.color || "#6366f1" }}
                        />
                        <div>
                          <p className="font-medium">{category.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant={getTypeBadgeVariant(category.type)} className="text-xs">
                              {getTypeLabel(category.type)}
                            </Badge>
                            {category.parent_id && (
                              <span>→ {getParentName(category.parent_id)}</span>
                            )}
                            {category.dre_group && (
                              <Badge variant="outline" className="text-xs">
                                DRE
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
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
                          onClick={() => handleDelete(category.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Edit/Create Form */}
          {(editingCategory || isCreating) && (
            <div className="w-72 space-y-4 rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">
                  {editingCategory ? "Editar" : "Nova Categoria"}
                </h4>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={resetForm}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-3">
                <div>
                  <Label>Nome</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nome da categoria"
                  />
                </div>

                <div>
                  <Label>Tipo</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: CategoryType) =>
                      setFormData({ ...formData, type: value, parent_id: null })
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

                {/* Is Child Category Toggle */}
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <Label className="cursor-pointer">É subcategoria?</Label>
                  <Switch
                    checked={formData.is_child}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, is_child: checked, parent_id: checked ? formData.parent_id : null })
                    }
                  />
                </div>

                {/* Parent Category Selector - only show if is_child */}
                {formData.is_child && (
                  <div>
                    <Label>Categoria Pai *</Label>
                    <Select
                      value={formData.parent_id || ""}
                      onValueChange={(value) => setFormData({ ...formData, parent_id: value })}
                    >
                      <SelectTrigger className={!formData.parent_id ? "border-destructive" : ""}>
                        <SelectValue placeholder="Selecione a categoria pai" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableParentCategories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!formData.parent_id && (
                      <p className="text-xs text-destructive mt-1">
                        Obrigatório para subcategorias
                      </p>
                    )}
                    {availableParentCategories.length === 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Nenhuma categoria pai disponível para este tipo
                      </p>
                    )}
                  </div>
                )}

                {/* DRE Group - Only show for parent categories */}
                {!formData.is_child && (
                  <div>
                    <Label>Grupo DRE *</Label>
                    <Select
                      value={formData.dre_group || ""}
                      onValueChange={(value) => 
                        setFormData({ ...formData, dre_group: value || null })
                      }
                    >
                    <SelectTrigger className={!formData.dre_group ? "border-warning" : ""}>
                        <SelectValue placeholder="Selecione o grupo DRE" />
                      </SelectTrigger>
                      <SelectContent>
                        {DRE_GROUP_OPTIONS.map((group) => (
                          <SelectItem key={group.value} value={group.value}>
                            {group.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!formData.dre_group && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Recomendado para relatórios DRE
                      </p>
                    )}
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
                  <div className="mt-2 grid grid-cols-6 gap-2">
                    {COLOR_OPTIONS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={cn(
                          "h-6 w-6 rounded-full transition-transform hover:scale-110",
                          formData.color === color && "ring-2 ring-primary ring-offset-2"
                        )}
                        style={{ backgroundColor: color }}
                        onClick={() => setFormData({ ...formData, color })}
                      />
                    ))}
                  </div>
                </div>

                <Button
                  className="w-full gap-2"
                  onClick={handleSave}
                  disabled={
                    !formData.name || 
                    (formData.is_child && !formData.parent_id) ||
                    createCategory.isPending || 
                    updateCategory.isPending
                  }
                >
                  {(createCategory.isPending || updateCategory.isPending) ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Salvar
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
