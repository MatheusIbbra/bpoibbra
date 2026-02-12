import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useFinancialEntities } from "@/hooks/useFinancialEntities";
import { usePatrimonyAssets } from "@/hooks/usePatrimonyAssets";
import { usePatrimonyLiabilities } from "@/hooks/usePatrimonyLiabilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MaskedValue } from "@/contexts/ValuesVisibilityContext";
import { Plus, Building2, Shield, PiggyBank, Trash2, Pencil, Loader2, Landmark, TrendingDown } from "lucide-react";
import { toast } from "sonner";

const ENTITY_TYPE_LABELS: Record<string, string> = { pf: "Pessoa Física", holding: "Holding", empresa: "Empresa" };
const ASSET_TYPE_LABELS: Record<string, string> = { conta: "Conta", investimento: "Investimento", imovel: "Imóvel", participacao: "Participação", outro: "Outro" };
const LIABILITY_TYPE_LABELS: Record<string, string> = { emprestimo: "Empréstimo", financiamento: "Financiamento", divida: "Dívida", outro: "Outro" };
const LIQUIDITY_LABELS: Record<string, string> = { alta: "Alta", media: "Média", baixa: "Baixa" };

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export default function Consolidacao() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { entities, isLoading: entLoading, createEntity, deleteEntity } = useFinancialEntities();
  const { assets, isLoading: assetsLoading, createAsset, deleteAsset } = usePatrimonyAssets();
  const { liabilities, isLoading: liabLoading, createLiability, deleteLiability } = usePatrimonyLiabilities();

  const [entityDialog, setEntityDialog] = useState(false);
  const [assetDialog, setAssetDialog] = useState(false);
  const [liabilityDialog, setLiabilityDialog] = useState(false);
  const [entityForm, setEntityForm] = useState({ name: "", entity_type: "pf" as string, description: "" });
  const [assetForm, setAssetForm] = useState({ entity_id: "", asset_type: "conta" as string, description: "", current_value: "", liquidity: "media" as string, reference_date: new Date().toISOString().split("T")[0] });
  const [liabilityForm, setLiabilityForm] = useState({ entity_id: "", liability_type: "outro" as string, description: "", current_value: "", reference_date: new Date().toISOString().split("T")[0] });

  useEffect(() => { if (!authLoading && !user) navigate("/auth"); }, [user, authLoading, navigate]);
  if (authLoading || entLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return null;

  const handleCreateEntity = () => {
    if (!entityForm.name.trim()) { toast.error("Nome obrigatório"); return; }
    createEntity.mutate(entityForm);
    setEntityDialog(false);
    setEntityForm({ name: "", entity_type: "pf", description: "" });
  };

  const handleCreateAsset = () => {
    if (!assetForm.entity_id || !assetForm.description.trim()) { toast.error("Preencha todos os campos"); return; }
    createAsset.mutate({ ...assetForm, current_value: parseFloat(assetForm.current_value) || 0, reference_date: assetForm.reference_date, notes: null } as any);
    setAssetDialog(false);
    setAssetForm({ entity_id: "", asset_type: "conta", description: "", current_value: "", liquidity: "media", reference_date: new Date().toISOString().split("T")[0] });
  };

  const handleCreateLiability = () => {
    if (!liabilityForm.entity_id || !liabilityForm.description.trim()) { toast.error("Preencha todos os campos"); return; }
    createLiability.mutate({ ...liabilityForm, current_value: parseFloat(liabilityForm.current_value) || 0, reference_date: liabilityForm.reference_date, notes: null } as any);
    setLiabilityDialog(false);
    setLiabilityForm({ entity_id: "", liability_type: "outro", description: "", current_value: "", reference_date: new Date().toISOString().split("T")[0] });
  };

  return (
    <AppLayout title="Consolidação Patrimonial">
      <div className="space-y-6">
        <Tabs defaultValue="entidades">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="entidades" className="gap-1.5 text-xs sm:text-sm"><Building2 className="h-3.5 w-3.5" />Entidades</TabsTrigger>
            <TabsTrigger value="ativos" className="gap-1.5 text-xs sm:text-sm"><Landmark className="h-3.5 w-3.5" />Ativos</TabsTrigger>
            <TabsTrigger value="passivos" className="gap-1.5 text-xs sm:text-sm"><TrendingDown className="h-3.5 w-3.5" />Passivos</TabsTrigger>
          </TabsList>

          <TabsContent value="entidades" className="mt-4 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-medium text-muted-foreground">Entidades Financeiras</h3>
              <Button size="sm" onClick={() => setEntityDialog(true)}><Plus className="h-4 w-4 mr-1" />Nova Entidade</Button>
            </div>
            {entities.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Nenhuma entidade cadastrada. Crie sua primeira entidade para começar.</CardContent></Card>
            ) : (
              <div className="grid gap-3">
                {entities.map(e => (
                  <Card key={e.id} className="hover:shadow-executive-lg transition-all">
                    <CardContent className="px-5 py-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-accent/8 flex items-center justify-center">
                          {e.entity_type === "pf" ? <Shield className="h-4 w-4 text-accent" /> : e.entity_type === "holding" ? <Building2 className="h-4 w-4 text-accent" /> : <PiggyBank className="h-4 w-4 text-accent" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{e.name}</p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{ENTITY_TYPE_LABELS[e.entity_type]}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="text-destructive/60 hover:text-destructive" onClick={() => deleteEntity.mutate(e.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="ativos" className="mt-4 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-medium text-muted-foreground">Ativos Patrimoniais</h3>
              <Button size="sm" onClick={() => setAssetDialog(true)} disabled={entities.length === 0}><Plus className="h-4 w-4 mr-1" />Novo Ativo</Button>
            </div>
            {assets.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Nenhum ativo cadastrado.</CardContent></Card>
            ) : (
              <div className="space-y-2">
                {assets.map(a => (
                  <Card key={a.id}>
                    <CardContent className="px-5 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{a.description}</p>
                        <p className="text-[10px] text-muted-foreground">{ASSET_TYPE_LABELS[a.asset_type]} • Liquidez {LIQUIDITY_LABELS[a.liquidity]}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-success"><MaskedValue>{formatCurrency(a.current_value)}</MaskedValue></p>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive" onClick={() => deleteAsset.mutate(a.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="passivos" className="mt-4 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-medium text-muted-foreground">Passivos</h3>
              <Button size="sm" onClick={() => setLiabilityDialog(true)} disabled={entities.length === 0}><Plus className="h-4 w-4 mr-1" />Novo Passivo</Button>
            </div>
            {liabilities.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Nenhum passivo cadastrado.</CardContent></Card>
            ) : (
              <div className="space-y-2">
                {liabilities.map(l => (
                  <Card key={l.id}>
                    <CardContent className="px-5 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{l.description}</p>
                        <p className="text-[10px] text-muted-foreground">{LIABILITY_TYPE_LABELS[l.liability_type]}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-destructive"><MaskedValue>{formatCurrency(l.current_value)}</MaskedValue></p>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive" onClick={() => deleteLiability.mutate(l.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Entity Dialog */}
        <Dialog open={entityDialog} onOpenChange={setEntityDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Entidade Financeira</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Nome</Label><Input value={entityForm.name} onChange={e => setEntityForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: João Silva PF" /></div>
              <div><Label>Tipo</Label>
                <Select value={entityForm.entity_type} onValueChange={v => setEntityForm(p => ({ ...p, entity_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pf">Pessoa Física</SelectItem>
                    <SelectItem value="holding">Holding</SelectItem>
                    <SelectItem value="empresa">Empresa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Descrição (opcional)</Label><Input value={entityForm.description} onChange={e => setEntityForm(p => ({ ...p, description: e.target.value }))} /></div>
            </div>
            <DialogFooter><Button onClick={handleCreateEntity} disabled={createEntity.isPending}>Criar</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Asset Dialog */}
        <Dialog open={assetDialog} onOpenChange={setAssetDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Ativo Patrimonial</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Entidade</Label>
                <Select value={assetForm.entity_id} onValueChange={v => setAssetForm(p => ({ ...p, entity_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{entities.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Tipo</Label>
                <Select value={assetForm.asset_type} onValueChange={v => setAssetForm(p => ({ ...p, asset_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conta">Conta</SelectItem>
                    <SelectItem value="investimento">Investimento</SelectItem>
                    <SelectItem value="imovel">Imóvel</SelectItem>
                    <SelectItem value="participacao">Participação</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Descrição</Label><Input value={assetForm.description} onChange={e => setAssetForm(p => ({ ...p, description: e.target.value }))} placeholder="Ex: Apartamento Centro" /></div>
              <div><Label>Valor Atual (R$)</Label><Input type="number" value={assetForm.current_value} onChange={e => setAssetForm(p => ({ ...p, current_value: e.target.value }))} /></div>
              <div><Label>Liquidez</Label>
                <Select value={assetForm.liquidity} onValueChange={v => setAssetForm(p => ({ ...p, liquidity: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="baixa">Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Data Referência</Label><Input type="date" value={assetForm.reference_date} onChange={e => setAssetForm(p => ({ ...p, reference_date: e.target.value }))} /></div>
            </div>
            <DialogFooter><Button onClick={handleCreateAsset} disabled={createAsset.isPending}>Adicionar</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Liability Dialog */}
        <Dialog open={liabilityDialog} onOpenChange={setLiabilityDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Passivo</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Entidade</Label>
                <Select value={liabilityForm.entity_id} onValueChange={v => setLiabilityForm(p => ({ ...p, entity_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{entities.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Tipo</Label>
                <Select value={liabilityForm.liability_type} onValueChange={v => setLiabilityForm(p => ({ ...p, liability_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="emprestimo">Empréstimo</SelectItem>
                    <SelectItem value="financiamento">Financiamento</SelectItem>
                    <SelectItem value="divida">Dívida</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Descrição</Label><Input value={liabilityForm.description} onChange={e => setLiabilityForm(p => ({ ...p, description: e.target.value }))} /></div>
              <div><Label>Valor Atual (R$)</Label><Input type="number" value={liabilityForm.current_value} onChange={e => setLiabilityForm(p => ({ ...p, current_value: e.target.value }))} /></div>
              <div><Label>Data Referência</Label><Input type="date" value={liabilityForm.reference_date} onChange={e => setLiabilityForm(p => ({ ...p, reference_date: e.target.value }))} /></div>
            </div>
            <DialogFooter><Button onClick={handleCreateLiability} disabled={createLiability.isPending}>Adicionar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
