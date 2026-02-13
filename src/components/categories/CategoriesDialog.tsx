import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Switch } from "@/components/ui/switch";
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  Category,
  CategoryType,
} from "@/hooks/useCategories";
import { Loader2, Check } from "lucide-react";
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
  expense_classification: string | null;
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

  const [formData, setFormData] = useState<CategoryFormData>({
    name: "",
    icon: "circle",
    color: "#6366f1",
    type: "expense",
    parent_id: null,
    description: null,
    dre_group: null,
    expense_classification: null,
    is_child: false,
  });

  const { data: categories } = useCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();

  const isEditing = !!initialCategory;

  // Load form data when dialog opens
  useEffect(() => {
    if (open) {
      if (initialCategory) {
        setFormData({
          name: initialCategory.name,
          icon: initialCategory.icon || "circle",
          color: initialCategory.color || "#6366f1",
          type: initialCategory.type,
          parent_id: initialCategory.parent_id,
          description: initialCategory.description,
          dre_group: initialCategory.dre_group,
          expense_classification: initialCategory.expense_classification,
          is_child: !!initialCategory.parent_id,
        });
      } else {
        setFormData({
          name: "",
          icon: "circle",
          color: "#6366f1",
          type: "expense",
          parent_id: null,
          description: null,
          dre_group: null,
          expense_classification: null,
          is_child: false,
        });
      }
    }
  }, [initialCategory, open]);

  // Filter parent categories by selected type
  const availableParentCategories = useMemo(() => {
    if (!categories) return [];
    return categories.filter(c => !c.parent_id && c.type === formData.type);
  }, [categories, formData.type]);

  const handleSave = async () => {
    if (formData.is_child && !formData.parent_id) return;

    const dataToSave = {
      name: formData.name,
      icon: formData.icon,
      color: formData.color,
      type: formData.type,
      parent_id: formData.is_child ? formData.parent_id : null,
      description: formData.description,
      dre_group: formData.dre_group,
      expense_classification: formData.type === "expense" ? formData.expense_classification : null,
    };

    if (initialCategory) {
      await updateCategory.mutateAsync({ id: initialCategory.id, ...dataToSave });
    } else {
      await createCategory.mutateAsync(dataToSave);
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
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

          {/* Parent Category Selector */}
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
                <p className="text-xs text-destructive mt-1">Obrigatório para subcategorias</p>
              )}
              {availableParentCategories.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">Nenhuma categoria pai disponível para este tipo</p>
              )}
            </div>
          )}

          {/* DRE Group - Only for parent categories */}
          {!formData.is_child && (
            <div>
              <Label>Grupo DRE</Label>
              <Select
                value={formData.dre_group || ""}
                onValueChange={(value) => setFormData({ ...formData, dre_group: value || null })}
              >
                <SelectTrigger>
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
                <p className="text-xs text-muted-foreground mt-1">Recomendado para relatórios DRE</p>
              )}
            </div>
          )}

          {/* Expense Classification - Only for expense categories */}
          {formData.type === "expense" && (
            <div>
              <Label>Classificação da Despesa</Label>
              <Select
                value={formData.expense_classification || ""}
                onValueChange={(value) => setFormData({ ...formData, expense_classification: value || null })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a classificação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixa">Fixa</SelectItem>
                  <SelectItem value="variavel_recorrente">Variável Recorrente</SelectItem>
                  <SelectItem value="variavel_programada">Variável Programada</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Define o tipo financeiro dos lançamentos desta categoria</p>
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
      </DialogContent>
    </Dialog>
  );
}
