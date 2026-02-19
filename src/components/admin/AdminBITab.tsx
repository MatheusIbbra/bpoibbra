import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, Users, TrendingUp, MapPin, Link2, Activity } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ["#6366f1", "#f43f5e", "#f59e0b", "#22c55e", "#06b6d4", "#8b5cf6", "#ec4899", "#3b82f6"];

export function AdminBITab() {
  // Top merchants by volume
  const { data: topMerchants, isLoading: loadingMerchants } = useQuery({
    queryKey: ["admin-bi-merchants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("description, amount")
        .eq("type", "expense")
        .eq("is_ignored", false)
        .order("created_at", { ascending: false })
        .limit(2000);

      if (error) throw error;

      const merchantMap = new Map<string, { total: number; count: number }>();
      data?.forEach(tx => {
        const name = (tx.description || "Desconhecido").slice(0, 40).toUpperCase().trim();
        const existing = merchantMap.get(name) || { total: 0, count: 0 };
        existing.total += Number(tx.amount);
        existing.count += 1;
        merchantMap.set(name, existing);
      });

      return Array.from(merchantMap.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);
    },
  });

  // Organization stats
  const { data: orgStats, isLoading: loadingOrgs } = useQuery({
    queryKey: ["admin-bi-orgs"],
    queryFn: async () => {
      const { data: orgs, error } = await supabase
        .from("organizations")
        .select("id, name, created_at");
      if (error) throw error;

      const { data: subs } = await supabase
        .from("organization_subscriptions")
        .select("organization_id, plan_id, status, plans(name)");

      const { data: txCounts } = await supabase
        .from("transactions")
        .select("organization_id")
        .limit(5000);

      const txByOrg = new Map<string, number>();
      txCounts?.forEach(t => {
        txByOrg.set(t.organization_id, (txByOrg.get(t.organization_id) || 0) + 1);
      });

      return orgs?.map(org => ({
        ...org,
        subscription: subs?.find(s => s.organization_id === org.id),
        txCount: txByOrg.get(org.id) || 0,
      })).sort((a, b) => b.txCount - a.txCount).slice(0, 10) || [];
    },
  });

  // Category distribution across all clients
  const { data: categoryDist, isLoading: loadingCategories } = useQuery({
    queryKey: ["admin-bi-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("categories(name), amount, type")
        .eq("type", "expense")
        .eq("is_ignored", false)
        .not("category_id", "is", null)
        .limit(3000);

      if (error) throw error;

      const catMap = new Map<string, number>();
      data?.forEach(tx => {
        const catName = (tx.categories as any)?.name || "Sem categoria";
        catMap.set(catName, (catMap.get(catName) || 0) + Number(tx.amount));
      });

      return Array.from(catMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);
    },
  });

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <BarChart3 className="h-4 w-4" />
        Business Intelligence Estratégico
      </h2>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {/* Top Merchants */}
        <Card>
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              Maiores Volumes de Compra
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {loadingMerchants ? <Skeleton className="h-40 w-full" /> : (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topMerchants} layout="vertical" margin={{ left: 0, right: 10 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Category distribution */}
        <Card>
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-muted-foreground" />
              Distribuição Global de Despesas
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {loadingCategories ? <Skeleton className="h-40 w-full" /> : (
              <div className="flex items-start gap-4">
                <div className="h-40 w-40 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categoryDist} cx="50%" cy="50%" innerRadius={30} outerRadius={60} paddingAngle={2} dataKey="value" strokeWidth={0}>
                        {categoryDist?.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1 flex-1">
                  {categoryDist?.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px]">
                      <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="truncate flex-1">{item.name}</span>
                      <span className="font-medium tabular-nums">{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Client engagement ranking */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              Indicadores por Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {loadingOrgs ? <Skeleton className="h-32 w-full" /> : (
              <div className="space-y-2">
                {orgStats?.map((org, i) => (
                  <div key={org.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/40 transition-colors">
                    <span className="text-xs font-bold text-muted-foreground w-5 text-right">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{org.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {org.subscription ? (org.subscription as any).plans?.name || "—" : "Sem plano"}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] tabular-nums">{org.txCount} mov</Badge>
                    <Badge variant={org.subscription?.status === "active" ? "default" : "secondary"} className="text-[10px]">
                      {org.subscription?.status === "active" ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                ))}
                {(!orgStats || orgStats.length === 0) && (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhum dado disponível</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
