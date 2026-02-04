import { useState } from "react";
import { Plus, Trash2, Loader2, Scale, TrendingUp, TrendingDown, Sparkles, AlertTriangle, Pencil } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
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

  // Show base selection required state
  if (requiresBaseSelection) {
    return (
      <AppLayout title="Regras de Conciliação">
        <div className="space-y-4">
          <BaseRequiredAlert action="gerenciar regras de conciliação" />
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <Scale className="h-10 w-10 text-muted-foreground mb-3" />
              <h3 className="text-base font-semibold">Selecione uma base</h3>
              <p className="text-sm text-muted-foreground">
                Selecione uma base específica no menu superior para gerenciar regras.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Regras de Conciliação">
      <div className="space-y-4">
        <Card className="shadow-sm">
          <CardHeader className="py-3 px-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Scale className="h-4 w-4" />
                Regras de Conciliação Automática
              </CardTitle>
              
              <div className="flex gap-2 flex-wrap">
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => seedRules.mutate()}
                  disabled={requiresBaseSelection || seedRules.isPending}
                >
                  {seedRules.isPending ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3 mr-1" />
                  )}
                  Criar Iniciais
                </Button>
                
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => setShowClearConfirmation(true)}
                  disabled={requiresBaseSelection || clearRules.isPending || !rules || rules.length === 0}
                  className="text-destructive hover:text-destructive"
                >
                  {clearRules.isPending ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3 mr-1" />
                  )}
                  Limpar
                </Button>
                
                <Button size="sm" onClick={() => handleOpenDialog()} disabled={requiresBaseSelection}>
                  <Plus className="h-3 w-3 mr-1" />
                  Nova Regra
                </Button>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="px-4 pb-4 pt-0">
            <p className="text-xs text-muted-foreground mb-3">
              Regras são usadas para sugerir classificações automáticas em transações importadas.
            </p>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : !rules || rules.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Scale className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Nenhuma regra cadastrada.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-center">Venc.</TableHead>
                      <TableHead className="text-center">Tipo</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((rule) => {
                      const category = categories?.find(c => c.id === rule.category_id);
                      
                      return (
                        <TableRow key={rule.id} className="text-sm">
                          <TableCell className="font-medium max-w-[150px] truncate">{rule.description}</TableCell>
                          <TableCell className="text-right">{formatCurrency(rule.amount)}</TableCell>
                          <TableCell className="text-center text-xs">
                            {rule.due_day ? `Dia ${rule.due_day}` : "-"}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={rule.transaction_type === "income" ? "default" : "destructive"} className="text-[10px]">
                              {rule.transaction_type === "income" ? "Receita" : "Despesa"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[100px] truncate">
                            {category?.name || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
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
                                className="h-7 w-7"
                                onClick={() => deleteRule.mutate(rule.id)}
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Rule Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRule ? "Editar Regra" : "Nova Regra de Conciliação"}</DialogTitle>
            <DialogDescription>
              Regras são usadas para sugerir classificações automáticas.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                placeholder="Ex: Aluguel Escritório..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor</Label>
                <Input
                  placeholder="0,00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Dia Vencimento</Label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  placeholder="1-31"
                  value={formData.due_day}
                  onChange={(e) => setFormData({ ...formData, due_day: e.target.value })}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={formData.transaction_type}
                onValueChange={(v) => setFormData({ ...formData, transaction_type: v, category_id: "" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">
                    <span className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-success" /> Receita
                    </span>
                  </SelectItem>
                  <SelectItem value="expense">
                    <span className="flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-destructive" /> Despesa
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Categoria Sugerida</Label>
              <Select
                value={formData.category_id}
                onValueChange={(v) => setFormData({ ...formData, category_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Centro de Custo</Label>
              <Select
                value={formData.cost_center_id}
                onValueChange={(v) => setFormData({ ...formData, cost_center_id: v })}
              >
                <SelectTrigger>
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
          
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveRule}
              disabled={!formData.description || !formData.amount || createRule.isPending || updateRule.isPending}
            >
              {(createRule.isPending || updateRule.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingRule ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Clear Rules Confirmation Dialog */}
      <AlertDialog open={showClearConfirmation} onOpenChange={setShowClearConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Limpar Todas as Regras
            </AlertDialogTitle>
            <AlertDialogDescription>
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
