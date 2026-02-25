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

  if (roleLoading || txLoading) return null;
  if (role && role !== "cliente") return null;
  if (unclassifiedCount === 0) return null;

  return (
    <div className="border-t pt-3">
      <button
        onClick={() => navigate("/movimentacoes?filter=sem-categoria")}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border border-warning/25 bg-warning/8 hover:bg-warning/15 transition-colors text-left group"
      >
        <Tag className="h-3.5 w-3.5 text-warning shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium text-foreground leading-tight">
            {unclassifiedCount} {unclassifiedCount === 1 ? "transação sem categoria" : "transações sem categoria"} este mês
          </p>
        </div>
        <span className="text-[10px] text-muted-foreground group-hover:text-foreground transition-colors shrink-0">Classificar →</span>
      </button>
    </div>
  );
}
