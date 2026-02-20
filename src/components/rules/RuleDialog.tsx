import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useCategories } from "@/hooks/useCategories";
import { useCostCenters } from "@/hooks/useCostCenters";
import { useCreateReconciliationRule, useUpdateReconciliationRule, ReconciliationRule } from "@/hooks/useReconciliationRules";

interface RuleFormData {
  description: string;
  amount: string;
  due_day: string;
  category_id: string;
  cost_center_id: string;
  transaction_type: string;
}

const initialFormData: RuleFormData = {
  description: "",
  amount: "",
  due_day: "",
  category_id: "",
  cost_center_id: "",
  transaction_type: "expense",
};

interface RuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule?: ReconciliationRule | null;
}

export function RuleDialog({ open, onOpenChange, rule }: RuleDialogProps) {
  const { data: categories } = useCategories();
  const { data: costCenters } = useCostCenters();
  const createRule = useCreateReconciliationRule();
  const updateRule = useUpdateReconciliationRule();
  const [formData, setFormData] = useState<RuleFormData>(initialFormData);

  useEffect(() => {
    if (open && rule) {
      setFormData({
        description: rule.description,
        amount: rule.amount.toString(),
        due_day: rule.due_day?.toString() || "",
        category_id: rule.category_id || "",
        cost_center_id: rule.cost_center_id || "",
        transaction_type: rule.transaction_type,
      });
    } else if (open) {
      setFormData(initialFormData);
    }
  }, [open, rule]);

  const handleSave = async () => {
    if (!formData.description || !formData.amount) return;

    const ruleData = {
      description: formData.description,
      amount: parseFloat(formData.amount.replace(",", ".")),
      due_day: formData.due_day ? parseInt(formData.due_day) : null,
      category_id: formData.category_id || null,
      cost_center_id: formData.cost_center_id || null,
      transaction_type: formData.transaction_type,
    };

    if (rule) {
      await updateRule.mutateAsync({ id: rule.id, ...ruleData });
    } else {
      await createRule.mutateAsync(ruleData);
    }

    onOpenChange(false);
  };

  const filteredCategories = categories?.filter(c => {
    // Only show child categories (those with parent_id)
    if (!c.parent_id) return false;
    if (formData.transaction_type === "income") return c.type === "income";
    if (formData.transaction_type === "expense") return c.type === "expense";
    return true;
  }) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">{rule ? "Editar Regra" : "Nova Regra"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Descrição</Label>
            <Input
              placeholder="Ex: Aluguel Escritório..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="h-8 text-sm"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Valor</Label>
              <Input
                placeholder="0,00"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Dia Venc.</Label>
              <Input
                type="number"
                min="1"
                max="31"
                placeholder="1-31"
                value={formData.due_day}
                onChange={(e) => setFormData({ ...formData, due_day: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select
                value={formData.transaction_type}
                onValueChange={(v) => setFormData({ ...formData, transaction_type: v, category_id: "" })}
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
          </div>

          <div>
            <Label className="text-xs">Categoria</Label>
            <Select
              value={formData.category_id}
              onValueChange={(v) => setFormData({ ...formData, category_id: v })}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {filteredCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Centro de Custo</Label>
            <Select
              value={formData.cost_center_id}
              onValueChange={(v) => setFormData({ ...formData, cost_center_id: v })}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {costCenters?.map((cc) => (
                  <SelectItem key={cc.id} value={cc.id}>{cc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!formData.description || !formData.amount || createRule.isPending || updateRule.isPending}
          >
            {(createRule.isPending || updateRule.isPending) && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            {rule ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
