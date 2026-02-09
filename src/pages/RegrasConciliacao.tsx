import { useState } from "react";
import { Plus, Trash2, Loader2, Scale, TrendingUp, TrendingDown, Sparkles, AlertTriangle, Pencil } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { BaseRequiredAlert } from "@/components/common/BaseRequiredAlert";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { useReconciliationRules, useCreateReconciliationRule, useUpdateReconciliationRule, useDeleteReconciliationRule, ReconciliationRule } from "@/hooks/useReconciliationRules";
import { useClearReconciliationRules } from "@/hooks/useClearReconciliationRules";
import { useCategories } from "@/hooks/useCategories";
import { useCostCenters } from "@/hooks/useCostCenters";
import { useSeedReconciliationRules } from "@/hooks/useSeedReconciliationRules";
import { cn } from "@/lib/utils";

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

export default function RegrasConciliacao() {
  const { requiresBaseSelection, selectedOrganization } = useBaseFilter();
  const { data: rules, isLoading } = useReconciliationRules();
  const { data: categories } = useCategories();
  const { data: costCenters } = useCostCenters();
  const seedRules = useSeedReconciliationRules();
  const createRule = useCreateReconciliationRule();
  const updateRule = useUpdateReconciliationRule();
  const deleteRule = useDeleteReconciliationRule();
  const clearRules = useClearReconciliationRules();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ReconciliationRule | null>(null);
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const [formData, setFormData] = useState<RuleFormData>(initialFormData);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setEditingRule(null);
  };

  const handleOpenDialog = (rule?: ReconciliationRule) => {
    if (rule) {
      setEditingRule(rule);
      setFormData({
        description: rule.description,
        amount: rule.amount.toString(),
        due_day: rule.due_day?.toString() || "",
        category_id: rule.category_id || "",
        cost_center_id: rule.cost_center_id || "",
        transaction_type: rule.transaction_type,
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    resetForm();
  };

  const handleSaveRule = async () => {
    if (!formData.description || !formData.amount) return;
    
    const ruleData = {
      description: formData.description,
      amount: parseFloat(formData.amount.replace(",", ".")),
      due_day: formData.due_day ? parseInt(formData.due_day) : null,
      category_id: formData.category_id || null,
      cost_center_id: formData.cost_center_id || null,
      transaction_type: formData.transaction_type,
    };

    if (editingRule) {
      await updateRule.mutateAsync({ id: editingRule.id, ...ruleData });
    } else {
      await createRule.mutateAsync(ruleData);
    }
    
    handleCloseDialog();
  };

  const filteredCategories = categories?.filter(c => {
    if (formData.transaction_type === "income") return c.type === "income";
    if (formData.transaction_type === "expense") return c.type === "expense";
    return true;
  }) || [];

  if (requiresBaseSelection) {
    return (
      <AppLayout title="Regras de Conciliação">
        <div className="space-y-4">
          <BaseRequiredAlert action="gerenciar regras de conciliação" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Regras de Conciliação">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Scale className="h-4 w-4 text-muted-foreground" />
              Regras de Conciliação Automática
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Sugestões de classificação automática em transações importadas
            </p>
          </div>
          
          <div className="flex gap-2 flex-wrap">
            <Button 
              variant="outline"
              size="sm"
              onClick={() => seedRules.mutate()}
              disabled={seedRules.isPending}
            >
              {seedRules.isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              )}
              Criar Iniciais
            </Button>
            
            <Button 
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setShowClearConfirmation(true)}
              disabled={clearRules.isPending || !rules || rules.length === 0}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Limpar
            </Button>
            
            <Button size="sm" onClick={() => handleOpenDialog()}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Incluir Nova Regra
            </Button>
          </div>
        </div>

        {/* Rules List - Card-based minimal design */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !rules || rules.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <Scale className="h-8 w-8 text-muted-foreground mb-2 opacity-50" />
              <p className="text-sm text-muted-foreground">Nenhuma regra cadastrada</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-2">
            {rules.map((rule) => {
              const category = categories?.find(c => c.id === rule.category_id);
              const costCenter = costCenters?.find(cc => cc.id === rule.cost_center_id);
              const isIncome = rule.transaction_type === "income";
              
              return (
                <div
                  key={rule.id}
                  className={cn(
                    "flex items-center justify-between px-3 py-2.5 rounded-lg border bg-card transition-colors hover:bg-muted/30",
                    isIncome ? "border-l-2 border-l-primary" : "border-l-2 border-l-destructive"
                  )}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={cn(
                      "shrink-0 h-7 w-7 rounded-full flex items-center justify-center",
                      isIncome ? "bg-primary/10" : "bg-destructive/10"
                    )}>
                      {isIncome ? (
                        <TrendingUp className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{rule.description}</p>
                        <span className="text-sm font-semibold tabular-nums shrink-0">
                          {formatCurrency(rule.amount)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {category && (
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <div 
                              className="h-1.5 w-1.5 rounded-full" 
                              style={{ backgroundColor: category.color || "#6366f1" }} 
                            />
                            {category.name}
                          </span>
                        )}
                        {costCenter && (
                          <span className="text-[11px] text-muted-foreground">
                            • {costCenter.name}
                          </span>
                        )}
                        {rule.due_day && (
                          <span className="text-[11px] text-muted-foreground">
                            • Dia {rule.due_day}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-0.5 shrink-0 ml-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleOpenDialog(rule)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => deleteRule.mutate(rule.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Rule Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">{editingRule ? "Editar Regra" : "Nova Regra"}</DialogTitle>
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
            <Button variant="outline" size="sm" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button 
              size="sm"
              onClick={handleSaveRule}
              disabled={!formData.description || !formData.amount || createRule.isPending || updateRule.isPending}
            >
              {(createRule.isPending || updateRule.isPending) && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              {editingRule ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Clear Rules Confirmation */}
      <AlertDialog open={showClearConfirmation} onOpenChange={setShowClearConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive text-base">
              <AlertTriangle className="h-4 w-4" />
              Limpar Todas as Regras
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Tem certeza que deseja excluir todas as {rules?.length || 0} regras
              {selectedOrganization && ` da base "${selectedOrganization.name}"`}?
              Esta ação é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                clearRules.mutate();
                setShowClearConfirmation(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Limpar Regras
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
