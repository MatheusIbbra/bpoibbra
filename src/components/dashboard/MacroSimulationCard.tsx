import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMacroSimulation, MacroScenario } from "@/hooks/useMacroSimulation";
import { formatCurrency } from "@/lib/formatters";
import { MaskedValue } from "@/contexts/ValuesVisibilityContext";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine } from "recharts";
import { Globe, Loader2, AlertTriangle, TrendingDown, DollarSign, Zap, Flame } from "lucide-react";

const presetIcons: Record<string, any> = {
  dollar_up: DollarSign,
  income_drop: TrendingDown,
  expense_surge: Flame,
  emergency: Zap,
  crisis: AlertTriangle,
};

export function MacroSimulationCard() {
  const { result, isSimulating, simulate, presets, clearResult } = useMacroSimulation();
  const [showCustom, setShowCustom] = useState(false);
  const [custom, setCustom] = useState<Partial<MacroScenario>>({
    currency_shock_pct: 0,
    income_change_pct: 0,
    expense_change_pct: 0,
    extraordinary_amount: 0,
    months_ahead: 12,
  });

  const handlePreset = (key: string) => {
    simulate({ ...presets[key].scenario, months_ahead: 12 });
  };

  const handleCustom = () => {
    simulate(custom);
    setShowCustom(false);
  };

  const chartData = result?.monthly_projection?.map((p) => ({
    month: `M${p.month}`,
    balance: p.balance,
  })) || [];

  const balanceDelta = result
    ? result.simulated.final_balance - result.baseline.balance
    : 0;

  const runwayDelta = result
    ? (result.simulated.runway_months > 900 ? 999 : result.simulated.runway_months) - (result.baseline.runway > 900 ? 999 : result.baseline.runway)
    : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-accent" />
            <CardTitle className="text-sm font-semibold">Simulação Macroeconômica</CardTitle>
          </div>
          {result && (
            <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={clearResult}>
              Limpar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Preset buttons */}
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(presets).map(([key, { label }]) => {
            const Icon = presetIcons[key] || Globe;
            return (
              <Button
                key={key}
                variant="outline"
                size="sm"
                className="h-7 text-[10px] px-2"
                onClick={() => handlePreset(key)}
                disabled={isSimulating}
              >
                <Icon className="h-3 w-3 mr-1" />
                {label}
              </Button>
            );
          })}
          <Button
            variant={showCustom ? "secondary" : "outline"}
            size="sm"
            className="h-7 text-[10px] px-2"
            onClick={() => setShowCustom(!showCustom)}
          >
            Personalizado
          </Button>
        </div>

        {/* Custom form */}
        {showCustom && (
          <div className="p-3 rounded-lg border space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px]">Choque cambial (%)</Label>
                <Input
                  type="number"
                  value={custom.currency_shock_pct || 0}
                  onChange={(e) => setCustom({ ...custom, currency_shock_pct: Number(e.target.value) })}
                  className="h-7 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Variação renda (%)</Label>
                <Input
                  type="number"
                  value={custom.income_change_pct || 0}
                  onChange={(e) => setCustom({ ...custom, income_change_pct: Number(e.target.value) })}
                  className="h-7 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Variação despesas (%)</Label>
                <Input
                  type="number"
                  value={custom.expense_change_pct || 0}
                  onChange={(e) => setCustom({ ...custom, expense_change_pct: Number(e.target.value) })}
                  className="h-7 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Evento extra (R$)</Label>
                <Input
                  type="number"
                  value={custom.extraordinary_amount || 0}
                  onChange={(e) => setCustom({ ...custom, extraordinary_amount: Number(e.target.value) })}
                  className="h-7 text-xs"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Horizonte: {custom.months_ahead || 12} meses</Label>
              <Slider
                value={[custom.months_ahead || 12]}
                onValueChange={([v]) => setCustom({ ...custom, months_ahead: v })}
                min={3}
                max={24}
                step={1}
              />
            </div>
            <Button onClick={handleCustom} disabled={isSimulating} size="sm" className="w-full h-7 text-xs">
              {isSimulating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Simular cenário
            </Button>
          </div>
        )}

        {/* Loading */}
        {isSimulating && !result && <Skeleton className="h-40 w-full" />}

        {/* Results */}
        {result && (
          <>
            {/* Impact summary */}
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <p className="text-[10px] text-muted-foreground">Patrimônio Final</p>
                <p className="text-sm font-bold">
                  <MaskedValue>{formatCurrency(result.simulated.final_balance)}</MaskedValue>
                </p>
                <Badge variant={balanceDelta >= 0 ? "default" : "destructive"} className="text-[9px] h-4 mt-0.5">
                  {balanceDelta >= 0 ? '+' : ''}{formatCurrency(balanceDelta)}
                </Badge>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <p className="text-[10px] text-muted-foreground">Runway</p>
                <p className="text-sm font-bold">
                  {result.simulated.runway_months > 900 ? '∞' : `${result.simulated.runway_months}m`}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  era {result.baseline.runway > 900 ? '∞' : `${result.baseline.runway}m`}
                </p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <p className="text-[10px] text-muted-foreground">Liquidez</p>
                <p className="text-sm font-bold">
                  <MaskedValue>{formatCurrency(result.simulated.liquidity_immediate)}</MaskedValue>
                </p>
                {result.simulated.currency_impact !== 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    Câmbio: {result.simulated.currency_impact > 0 ? '+' : ''}{formatCurrency(result.simulated.currency_impact)}
                  </p>
                )}
              </div>
            </div>

            {/* Projection chart */}
            {chartData.length > 0 && (
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="macroGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ fontSize: 11, borderRadius: 8 }}
                      formatter={(v: number) => [formatCurrency(v), 'Saldo Projetado']}
                    />
                    <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="3 3" />
                    <Area
                      type="monotone"
                      dataKey="balance"
                      stroke="hsl(var(--accent))"
                      fill="url(#macroGrad)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}

        {!result && !isSimulating && (
          <div className="text-center py-4 text-muted-foreground">
            <Globe className="h-6 w-6 mx-auto mb-1 opacity-30" />
            <p className="text-[10px]">Selecione um cenário para simular o impacto no seu patrimônio.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
