import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Search, Building2, CreditCard, ArrowRight, Users, BarChart3, Brain, Radio } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OrgSubscription {
  id: string;
  organization_id: string;
  plan_id: string;
  status: string;
  started_at: string;
  expires_at: string | null;
  org_name?: string;
  plan_name?: string;
  plan_price?: number;
}

export function AdminClientPlansTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("__all__");
  const [planFilter, setPlanFilter] = useState("__all__");
  const [changePlanDialog, setChangePlanDialog] = useState<{ orgId: string; orgName: string; currentPlanId: string | null } | null>(null);
  const [selectedNewPlan, setSelectedNewPlan] = useState("");

  // Fetch all plans
  const { data: plans } = useQuery({
    queryKey: ["admin-plans-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plans").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  // Fetch all organizations with their subscriptions
  const { data: orgsWithSubs, isLoading } = useQuery({
    queryKey: ["admin-orgs-subscriptions"],
    queryFn: async () => {
      const { data: orgs, error: orgError } = await supabase
        .from("organizations")
        .select("id, name, cpf_cnpj, is_blocked, created_at")
        .order("name");
      if (orgError) throw orgError;

      const { data: subs, error: subError } = await supabase
        .from("organization_subscriptions")
        .select("*, plans(name, price, slug)")
        .eq("status", "active");
      if (subError) throw subError;

      const subsMap = new Map<string, any>();
      subs?.forEach(s => subsMap.set(s.organization_id, s));

      // Count members per org
      const { data: memberCounts } = await supabase
        .from("organization_members")
        .select("organization_id");

      const countMap = new Map<string, number>();
      memberCounts?.forEach(m => {
        countMap.set(m.organization_id, (countMap.get(m.organization_id) || 0) + 1);
      });

      return (orgs || []).map(org => ({
        ...org,
        subscription: subsMap.get(org.id) || null,
        plan_name: subsMap.get(org.id)?.plans?.name || "Sem plano",
        plan_slug: subsMap.get(org.id)?.plans?.slug || null,
        plan_price: subsMap.get(org.id)?.plans?.price || 0,
        plan_id: subsMap.get(org.id)?.plan_id || null,
        member_count: countMap.get(org.id) || 0,
      }));
    },
  });

  const changePlan = useMutation({
    mutationFn: async ({ orgId, planId }: { orgId: string; planId: string }) => {
      // Check if subscription exists
      const { data: existing } = await supabase
        .from("organization_subscriptions")
        .select("id")
        .eq("organization_id", orgId)
        .eq("status", "active")
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("organization_subscriptions")
          .update({ plan_id: planId, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("organization_subscriptions")
          .insert([{ organization_id: orgId, plan_id: planId, status: "active" }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orgs-subscriptions"] });
      setChangePlanDialog(null);
      setSelectedNewPlan("");
      toast.success("Plano atualizado com sucesso");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const filtered = useMemo(() => {
    if (!orgsWithSubs) return [];
    return orgsWithSubs.filter(org => {
      if (search) {
        const q = search.toLowerCase();
        if (!(org.name?.toLowerCase().includes(q) || org.cpf_cnpj?.toLowerCase().includes(q))) return false;
      }
      if (statusFilter === "active" && org.is_blocked) return false;
      if (statusFilter === "blocked" && !org.is_blocked) return false;
      if (planFilter !== "__all__" && org.plan_id !== planFilter) return false;
      return true;
    });
  }, [orgsWithSubs, search, statusFilter, planFilter]);

  const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  // Summary stats
  const totalOrgs = orgsWithSubs?.length || 0;
  const withPlan = orgsWithSubs?.filter(o => o.plan_id).length || 0;
  const withoutPlan = totalOrgs - withPlan;
  const mrr = orgsWithSubs?.reduce((sum, o) => sum + (o.plan_price || 0), 0) || 0;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="card-executive">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] uppercase text-muted-foreground">Total Clientes</span>
            </div>
            <p className="text-xl font-bold">{totalOrgs}</p>
          </CardContent>
        </Card>
        <Card className="card-executive">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] uppercase text-muted-foreground">Com Plano</span>
            </div>
            <p className="text-xl font-bold text-success">{withPlan}</p>
          </CardContent>
        </Card>
        <Card className="card-executive">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] uppercase text-muted-foreground">Sem Plano</span>
            </div>
            <p className="text-xl font-bold text-warning">{withoutPlan}</p>
          </CardContent>
        </Card>
        <Card className="card-executive">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] uppercase text-muted-foreground">MRR</span>
            </div>
            <p className="text-xl font-bold text-primary">{formatCurrency(mrr)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="blocked">Bloqueados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="w-[150px] h-8 text-xs">
            <SelectValue placeholder="Plano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos planos</SelectItem>
            {plans?.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs bg-muted/30">
                    <TableHead>Cliente</TableHead>
                    <TableHead>CPF/CNPJ</TableHead>
                    <TableHead>Plano Atual</TableHead>
                    <TableHead className="text-center">Membros</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(org => (
                    <TableRow key={org.id} className="text-sm">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Building2 className="h-4 w-4 text-primary" />
                          </div>
                          <span className="font-medium truncate max-w-[200px]">{org.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">{org.cpf_cnpj || "—"}</TableCell>
                      <TableCell>
                        {org.plan_id ? (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <CreditCard className="h-3 w-3" />
                            {org.plan_name}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">Sem plano</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">{org.member_count}</TableCell>
                      <TableCell>
                        {org.is_blocked ? (
                          <Badge variant="destructive" className="text-xs">Bloqueado</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-success border-success/30">Ativo</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => setChangePlanDialog({
                            orgId: org.id,
                            orgName: org.name,
                            currentPlanId: org.plan_id,
                          })}
                        >
                          <ArrowRight className="h-3 w-3" />
                          Alterar Plano
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                        Nenhum cliente encontrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Change Plan Dialog */}
      <Dialog open={!!changePlanDialog} onOpenChange={(o) => !o && setChangePlanDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Alterar Plano
            </DialogTitle>
            <DialogDescription>
              {changePlanDialog?.orgName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid gap-2">
              {plans?.filter(p => p.is_active).map(plan => (
                <button
                  key={plan.id}
                  onClick={() => setSelectedNewPlan(plan.id)}
                  className={`flex items-center justify-between p-3 rounded-lg border text-left transition-all ${
                    selectedNewPlan === plan.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : changePlanDialog?.currentPlanId === plan.id
                      ? "border-muted bg-muted/30"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium flex items-center gap-2">
                      {plan.name}
                      {changePlanDialog?.currentPlanId === plan.id && (
                        <Badge variant="secondary" className="text-[9px]">Atual</Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{plan.description}</p>
                    <div className="flex gap-2 mt-1.5">
                      <Badge variant="outline" className="text-[9px]">
                        <Radio className="h-2.5 w-2.5 mr-0.5" />
                        {plan.max_bank_connections} conex
                      </Badge>
                      <Badge variant="outline" className="text-[9px]">
                        <Brain className="h-2.5 w-2.5 mr-0.5" />
                        {plan.max_ai_requests} IA
                      </Badge>
                      <Badge variant="outline" className="text-[9px]">
                        {plan.max_reports_per_day} relat/dia
                      </Badge>
                    </div>
                  </div>
                  <p className="text-lg font-bold shrink-0 ml-4">
                    {formatCurrency(plan.price)}
                    <span className="text-[10px] font-normal text-muted-foreground">/mês</span>
                  </p>
                </button>
              ))}
            </div>
            <Button
              className="w-full"
              disabled={!selectedNewPlan || changePlan.isPending || selectedNewPlan === changePlanDialog?.currentPlanId}
              onClick={() => {
                if (changePlanDialog && selectedNewPlan) {
                  changePlan.mutate({ orgId: changePlanDialog.orgId, planId: selectedNewPlan });
                }
              }}
            >
              {changePlan.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar Alteração
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
