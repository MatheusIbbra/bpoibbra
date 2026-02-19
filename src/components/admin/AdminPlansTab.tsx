import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Loader2, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  max_transactions: number;
  max_ai_requests: number;
  max_bank_connections: number;
  max_sync_per_day: number;
  max_reports_per_day: number;
  allow_forecast: boolean;
  allow_anomaly_detection: boolean;
  allow_simulator: boolean;
  is_active: boolean;
  sort_order: number;
}

export function AdminPlansTab() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);

  const { data: plans, isLoading } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plans").select("*").order("sort_order");
      if (error) throw error;
      return data as Plan[];
    },
  });

  const upsertPlan = useMutation({
    mutationFn: async (plan: Partial<Plan>) => {
      if (plan.id) {
        const { error } = await supabase.from("plans").update(plan).eq("id", plan.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("plans").insert([plan as any]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
      setDialogOpen(false);
      setEditing(null);
      toast.success("Plano salvo");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const [form, setForm] = useState<Partial<Plan>>({});

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", slug: "", price: 0, max_transactions: 200, max_ai_requests: 10, max_bank_connections: 1, max_sync_per_day: 10, max_reports_per_day: 20, allow_forecast: false, allow_anomaly_detection: false, allow_simulator: false, is_active: true, sort_order: (plans?.length || 0) + 1 });
    setDialogOpen(true);
  };

  const openEdit = (plan: Plan) => {
    setEditing(plan);
    setForm({ ...plan });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name || !form.slug) { toast.error("Nome e slug obrigatórios"); return; }
    upsertPlan.mutate(form);
  };

  const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Planos</h2>
        <Button size="sm" className="h-7 text-xs" onClick={openNew}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Novo Plano
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {plans?.map((plan) => (
            <Card key={plan.id} className={cn(!plan.is_active && "opacity-60")}>
              <CardHeader className="pb-2 px-4 pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm">{plan.name}</CardTitle>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(plan)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                <p className="text-xl font-bold">{formatCurrency(plan.price)}<span className="text-xs font-normal text-muted-foreground">/mês</span></p>
                <p className="text-xs text-muted-foreground">{plan.description}</p>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-[10px]">{plan.max_transactions} tx</Badge>
                  <Badge variant="outline" className="text-[10px]">{plan.max_ai_requests} IA</Badge>
                  <Badge variant="outline" className="text-[10px]">{plan.max_bank_connections} conex</Badge>
                  {plan.allow_forecast && <Badge className="text-[10px]">Forecast</Badge>}
                  {plan.allow_simulator && <Badge className="text-[10px]">Simulador</Badge>}
                </div>
                {!plan.is_active && <Badge variant="destructive" className="text-[10px]">Inativo</Badge>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">{editing ? "Editar Plano" : "Novo Plano"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Nome</Label><Input value={form.name || ""} onChange={e => setForm({...form, name: e.target.value})} className="h-8 text-sm" /></div>
              <div><Label className="text-xs">Slug</Label><Input value={form.slug || ""} onChange={e => setForm({...form, slug: e.target.value})} className="h-8 text-sm" /></div>
            </div>
            <div><Label className="text-xs">Descrição</Label><Input value={form.description || ""} onChange={e => setForm({...form, description: e.target.value})} className="h-8 text-sm" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Preço (R$)</Label><Input type="number" value={form.price || 0} onChange={e => setForm({...form, price: parseFloat(e.target.value)})} className="h-8 text-sm" /></div>
              <div><Label className="text-xs">Ordem</Label><Input type="number" value={form.sort_order || 1} onChange={e => setForm({...form, sort_order: parseInt(e.target.value)})} className="h-8 text-sm" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Max Transações</Label><Input type="number" value={form.max_transactions || 0} onChange={e => setForm({...form, max_transactions: parseInt(e.target.value)})} className="h-8 text-sm" /></div>
              <div><Label className="text-xs">Max IA/mês</Label><Input type="number" value={form.max_ai_requests || 0} onChange={e => setForm({...form, max_ai_requests: parseInt(e.target.value)})} className="h-8 text-sm" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Max Conexões</Label><Input type="number" value={form.max_bank_connections || 0} onChange={e => setForm({...form, max_bank_connections: parseInt(e.target.value)})} className="h-8 text-sm" /></div>
              <div><Label className="text-xs">Max Sync/dia</Label><Input type="number" value={form.max_sync_per_day || 0} onChange={e => setForm({...form, max_sync_per_day: parseInt(e.target.value)})} className="h-8 text-sm" /></div>
            </div>
            <div className="space-y-2">
              {[
                { key: "allow_forecast" as const, label: "Previsão de Fluxo" },
                { key: "allow_anomaly_detection" as const, label: "Detecção de Anomalias" },
                { key: "allow_simulator" as const, label: "Simulador Financeiro" },
                { key: "is_active" as const, label: "Ativo" },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between">
                  <Label className="text-xs">{item.label}</Label>
                  <Switch checked={!!form[item.key]} onCheckedChange={v => setForm({...form, [item.key]: v})} />
                </div>
              ))}
            </div>
            <Button className="w-full" size="sm" onClick={handleSave} disabled={upsertPlan.isPending}>
              {upsertPlan.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "Salvar" : "Criar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
