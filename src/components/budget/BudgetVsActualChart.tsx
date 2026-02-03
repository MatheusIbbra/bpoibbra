import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBudgetAnalysis } from "@/hooks/useBudgetAnalysis";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";
import { Loader2 } from "lucide-react";
import { forwardRef } from "react";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

interface TooltipPayloadItem {
  color: string;
  name: string;
  value: number;
  dataKey: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

const CustomTooltipContent = forwardRef<HTMLDivElement, CustomTooltipProps>(
  ({ active, payload, label }, ref) => {
    if (active && payload && payload.length) {
      const budgetItem = payload.find((p) => p.dataKey === "budget_amount");
      const actualItem = payload.find((p) => p.dataKey === "actual_amount");
      const variance = (budgetItem?.value || 0) - (actualItem?.value || 0);

      return (
        <div ref={ref} className="rounded-lg border bg-card p-3 shadow-lg min-w-[180px]">
          <p className="font-medium text-card-foreground mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
          <div className="border-t mt-2 pt-2">
            <p className={`text-sm font-medium ${variance >= 0 ? "text-success" : "text-destructive"}`}>
              {variance >= 0 ? "Saldo: " : "Excedido: "}
              {formatCurrency(Math.abs(variance))}
            </p>
          </div>
        </div>
      );
    }
    return null;
  }
);

CustomTooltipContent.displayName = "CustomTooltipContent";

interface BudgetVsActualChartProps {
  month?: number;
  year?: number;
}

export function BudgetVsActualChart({ month, year }: BudgetVsActualChartProps) {
  const { data, isLoading } = useBudgetAnalysis(month, year);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Planejado vs Realizado</CardTitle>
        </CardHeader>
        <CardContent className="flex h-[350px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Planejado vs Realizado</CardTitle>
        </CardHeader>
        <CardContent className="flex h-[350px] items-center justify-center">
          <p className="text-muted-foreground">Nenhum orçamento definido para o período</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.items.map((item) => ({
    name: item.category_name.length > 12 
      ? item.category_name.substring(0, 12) + "..." 
      : item.category_name,
    fullName: item.category_name,
    budget_amount: item.budget_amount,
    actual_amount: item.actual_amount,
    status: item.status,
    color: item.category_color,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Planejado vs Realizado</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            barCategoryGap="20%"
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="name"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              interval={0}
              angle={-15}
              textAnchor="end"
              height={60}
            />
            <YAxis
              tickFormatter={(value) => formatCurrency(value)}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              width={90}
            />
            <Tooltip content={<CustomTooltipContent />} />
            <Legend
              wrapperStyle={{ paddingTop: "10px" }}
              formatter={(value) => (
                <span className="text-foreground text-sm">{value}</span>
              )}
            />
            <Bar
              dataKey="budget_amount"
              name="Planejado"
              fill="hsl(var(--primary))"
              radius={[4, 4, 0, 0]}
            />
            <Bar dataKey="actual_amount" name="Realizado" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    entry.status === "over"
                      ? "hsl(var(--destructive))"
                      : entry.status === "warning"
                      ? "hsl(var(--warning))"
                      : "hsl(var(--success))"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
