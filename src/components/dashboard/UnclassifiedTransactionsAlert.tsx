import { useNavigate } from "react-router-dom";
import { useTransactions } from "@/hooks/useTransactions";
import { useCurrentUserRole } from "@/hooks/useUserRoles";
import { useMemo } from "react";
import { parseLocalDate } from "@/lib/formatters";
import { Tag } from "lucide-react";

export function UnclassifiedTransactionsAlert() {
  const navigate = useNavigate();
  const { data: role, isLoading: roleLoading } = useCurrentUserRole();
  const { data: transactions, isLoading: txLoading } = useTransactions({});

  const unclassifiedCount = useMemo(() => {
    if (!transactions) return 0;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    return transactions.filter((t) => {
      if (t.is_ignored) return false;
      if (t.type === "transfer" || t.type === "investment" || t.type === "redemption") return false;
      const d = parseLocalDate(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear && !t.category_id;
    }).length;
  }, [transactions]);

  // Show only while loading or for non-cliente roles
  if (roleLoading || txLoading) return null;
  // Hide for assessor/admin roles — only show for clientes
  if (role && role !== "cliente") return null;
  // Hide if no unclassified transactions
  if (unclassifiedCount === 0) return null;

  return (
    <button
      onClick={() => navigate("/relatorios?tab=movimentacoes&filter=sem-categoria")}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-warning/30 bg-warning/5 hover:bg-warning/10 transition-colors text-left group"
    >
      <div className="h-8 w-8 rounded-lg bg-warning/15 flex items-center justify-center shrink-0">
        <Tag className="h-4 w-4 text-warning" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground">
          {unclassifiedCount} {unclassifiedCount === 1 ? "transação sem categoria" : "transações sem categoria"} neste mês
        </p>
        <p className="text-[10px] text-muted-foreground">
          Toque para classificar
        </p>
      </div>
      <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">→</span>
    </button>
  );
}
