import { useState } from "react";
import { Plus, Trash2, Loader2, Scale, TrendingUp, TrendingDown, Sparkles, AlertTriangle } from "lucide-react";
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
import { useReconciliationRules, useCreateReconciliationRule, useDeleteReconciliationRule } from "@/hooks/useReconciliationRules";
import { useClearReconciliationRules } from "@/hooks/useClearReconciliationRules";
import { useCategories } from "@/hooks/useCategories";
import { useCostCenters } from "@/hooks/useCostCenters";
import { useSeedReconciliationRules } from "@/hooks/useSeedReconciliationRules";

export default function RegrasConciliacao() {
  const { requiresBaseSelection, selectedOrganization } = useBaseFilter();
  const { data: rules, isLoading } = useReconciliationRules();
  const { data: categories } = useCategories();
  const { data: costCenters } = useCostCenters();
  const seedRules = useSeedReconciliationRules();
  const createRule = useCreateReconciliationRule();
  const deleteRule = useDeleteReconciliationRule();
  const clearRules = useClearReconciliationRules();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const [newRule, setNewRule] = useState({
    description: "",
    amount: "",
    due_day: "",
    category_id: "",
    cost_center_id: "",
    transaction_type: "expense",
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const handleCreateRule = async () => {
    if (!newRule.description || !newRule.amount) return;
    
    await createRule.mutateAsync({
      description: newRule.description,
      amount: parseFloat(newRule.amount.replace(",", ".")),
      due_day: newRule.due_day ? parseInt(newRule.due_day) : null,
      category_id: newRule.category_id || null,
      cost_center_id: newRule.cost_center_id || null,
      transaction_type: newRule.transaction_type,
    });
    
    setNewRule({
      description: "",
      amount: "",
      due_day: "",
      category_id: "",
      cost_center_id: "",
      transaction_type: "expense",
    });
    setIsDialogOpen(false);
  };

  const filteredCategories = categories?.filter(c => {
    if (newRule.transaction_type === "income") return c.type === "income";
    if (newRule.transaction_type === "expense") return c.type === "expense";
    return true;
  }) || [];

  // Show base selection required state
  if (requiresBaseSelection) {
    return (
      <AppLayout title="Regras de Conciliação">
        <div className="space-y-6">
          <BaseRequiredAlert action="gerenciar regras de conciliação" />
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Scale className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">Selecione uma base</h3>
              <p className="text-muted-foreground">
                Selecione uma base específica no menu superior para visualizar e gerenciar regras de conciliação.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Regras de Conciliação">
      <div className="space-y-6">
        
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5" />
                Regras de Conciliação Automática
              </CardTitle>
              
              <div className="flex gap-2 flex-wrap">
                <Button 
                  variant="outline"
                  onClick={() => seedRules.mutate()}
                  disabled={requiresBaseSelection || seedRules.isPending}
                >
                  {seedRules.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Criar Regras Iniciais
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={() => setShowClearConfirmation(true)}
                  disabled={requiresBaseSelection || clearRules.isPending || !rules || rules.length === 0}
                  className="text-destructive hover:text-destructive"
                >
                  {clearRules.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Limpar Regras
                </Button>
                
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button disabled={requiresBaseSelection}>
                      <Plus className="h-4 w-4 mr-2" />
                      Nova Regra
                    </Button>
                  </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Regra de Conciliação</DialogTitle>
                    <DialogDescription>
                      Regras são usadas para sugerir classificações automáticas quando transações similares são importadas.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Descrição</Label>
                      <Input
                        placeholder="Ex: Aluguel Escritório, Energia Elétrica..."
                        value={newRule.description}
                        onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Valor</Label>
                        <Input
                          placeholder="0,00"
                          value={newRule.amount}
                          onChange={(e) => setNewRule({ ...newRule, amount: e.target.value })}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Dia de Vencimento</Label>
                        <Input
                          type="number"
                          min="1"
                          max="31"
                          placeholder="1-31"
                          value={newRule.due_day}
                          onChange={(e) => setNewRule({ ...newRule, due_day: e.target.value })}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Tipo</Label>
                      <Select
                        value={newRule.transaction_type}
                        onValueChange={(v) => setNewRule({ ...newRule, transaction_type: v, category_id: "" })}
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
                        value={newRule.category_id}
                        onValueChange={(v) => setNewRule({ ...newRule, category_id: v })}
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
                      <Label>Centro de Custo Sugerido</Label>
                      <Select
                        value={newRule.cost_center_id}
                        onValueChange={(v) => setNewRule({ ...newRule, cost_center_id: v })}
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
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button 
                      onClick={handleCreateRule}
                      disabled={!newRule.description || !newRule.amount || createRule.isPending}
                    >
                      {createRule.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Criar Regra
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Quando novas transações são importadas, o sistema compara descrição, valor e data de vencimento.
              Se a similaridade for maior que 70%, a IA sugere a classificação configurada na regra.
            </p>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !rules || rules.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Scale className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma regra de conciliação cadastrada.</p>
                <p className="text-sm">Crie regras para automatizar a classificação de transações recorrentes.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-center">Vencimento</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule) => {
                    const category = categories?.find(c => c.id === rule.category_id);
                    
                    return (
                      <TableRow key={rule.id}>
                        <TableCell className="font-medium">{rule.description}</TableCell>
                        <TableCell className="text-right">{formatCurrency(rule.amount)}</TableCell>
                        <TableCell className="text-center">
                          {rule.due_day ? `Dia ${rule.due_day}` : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={rule.transaction_type === "income" ? "default" : "destructive"}>
                            {rule.transaction_type === "income" ? "Receita" : "Despesa"}
                          </Badge>
                        </TableCell>
                        <TableCell>{category?.name || "-"}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteRule.mutate(rule.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Clear Rules Confirmation Dialog */}
      <AlertDialog open={showClearConfirmation} onOpenChange={setShowClearConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Limpar Todas as Regras
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Tem certeza que deseja excluir <strong>todas as {rules?.length || 0} regras de conciliação</strong>
                {selectedOrganization && (
                  <> da base <strong>"{selectedOrganization.name}"</strong></>
                )}
                ?
              </p>
              <p className="text-destructive font-medium">
                Esta ação é irreversível e não pode ser desfeita.
              </p>
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
              {clearRules.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Limpar Regras
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
