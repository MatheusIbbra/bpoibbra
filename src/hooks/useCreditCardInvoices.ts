import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { format, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface CreditCardInvoiceRecord {
  id: string;
  account_id: string;
  organization_id: string;
  reference_month: number;
  reference_year: number;
  closing_date: string | null;
  due_date: string | null;
  total_purchases: number;
  total_paid: number;
  status: "open" | "partial" | "paid" | "overdue";
  created_at: string;
  updated_at: string;
  // computed
  balance: number;
  label: string;
}

/**
 * Busca ou cria a fatura de um cartão para um ciclo (mês/ano).
 * Retorna a fatura com balanço calculado corretamente:
 *   - total_purchases: despesas por competência (não impacta caixa)
 *   - total_paid: pagamentos realizados (impacta caixa)
 *   - balance: saldo pendente = purchases - paid
 */
export function useCreditCardInvoices(accountId?: string) {
  const { user } = useAuth();
  const { getOrganizationFilter } = useBaseFilter();
  const orgFilter = getOrganizationFilter();
  const queryClient = useQueryClient();

  // Fetch last 6 months of invoices for this account
  const query = useQuery({
    queryKey: ["credit-card-invoices", accountId, user?.id],
    queryFn: async (): Promise<CreditCardInvoiceRecord[]> => {
      if (!accountId) return [];

      const now = new Date();
      const sixMonthsAgo = subMonths(startOfMonth(now), 5);

      const { data, error } = await supabase
        .from("credit_card_invoices")
        .select("*")
        .eq("account_id", accountId)
        .gte("reference_year", sixMonthsAgo.getFullYear())
        .order("reference_year", { ascending: false })
        .order("reference_month", { ascending: false });

      if (error) throw error;

      return (data || [])
        .filter((inv) => {
          // Filter to last 6 months
          const invDate = new Date(inv.reference_year, inv.reference_month - 1, 1);
          return invDate >= sixMonthsAgo;
        })
        .map((inv) => {
          const refDate = new Date(inv.reference_year, inv.reference_month - 1, 1);
          const rawLabel = format(refDate, "MMMM yyyy", { locale: ptBR });
          const label = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);
          const balance = Math.max(0, inv.total_purchases - inv.total_paid);
          return {
            ...inv,
            total_purchases: Number(inv.total_purchases),
            total_paid: Number(inv.total_paid),
            balance,
            label,
            status: inv.status as CreditCardInvoiceRecord["status"],
          };
        });
    },
    enabled: !!user && !!accountId,
  });

  /**
   * Ensure invoice exists for current month, creating it if needed.
   * This is called when a credit card transaction is recorded.
   */
  const ensureInvoice = useMutation({
    mutationFn: async ({
      account_id,
      organization_id,
      reference_month,
      reference_year,
      closing_date,
      due_date,
    }: {
      account_id: string;
      organization_id: string;
      reference_month: number;
      reference_year: number;
      closing_date?: string;
      due_date?: string;
    }) => {
      const { data: existing } = await supabase
        .from("credit_card_invoices")
        .select("id")
        .eq("account_id", account_id)
        .eq("reference_month", reference_month)
        .eq("reference_year", reference_year)
        .maybeSingle();

      if (existing) return existing.id;

      const { data: created, error } = await supabase
        .from("credit_card_invoices")
        .insert({
          account_id,
          organization_id,
          reference_month,
          reference_year,
          closing_date: closing_date || null,
          due_date: due_date || null,
          total_purchases: 0,
          total_paid: 0,
          status: "open",
        })
        .select("id")
        .single();

      if (error) throw error;
      return created.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credit-card-invoices", accountId] });
    },
  });

  /**
   * Record a payment against an invoice.
   * This reduces the invoice balance and updates the status.
   * The corresponding cash transaction should have is_invoice_payment = true.
   */
  const recalcInvoice = useMutation({
    mutationFn: async (invoiceId: string) => {
      const { error } = await supabase.rpc("recalc_invoice_totals", {
        p_invoice_id: invoiceId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credit-card-invoices", accountId] });
      queryClient.invalidateQueries({ queryKey: ["credit-card-advanced-summary"] });
    },
  });

  return { ...query, ensureInvoice, recalcInvoice };
}

/**
 * Fetch invoices for ALL credit card accounts in the current org context.
 * Used for dashboard summaries and consolidated views.
 */
export function useAllCreditCardInvoices() {
  const { user } = useAuth();
  const { getOrganizationFilter } = useBaseFilter();
  const orgFilter = getOrganizationFilter();

  return useQuery({
    queryKey: ["all-credit-card-invoices", user?.id, orgFilter.type, orgFilter.ids],
    queryFn: async () => {
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      let q = supabase
        .from("credit_card_invoices")
        .select("*, accounts!inner(id, name, bank_name, organization_id)")
        .eq("reference_month", currentMonth)
        .eq("reference_year", currentYear);

      if (orgFilter.type === "single") {
        q = q.eq("organization_id", orgFilter.ids[0]);
      } else if (orgFilter.type === "multiple" && orgFilter.ids.length > 0) {
        q = q.in("organization_id", orgFilter.ids);
      }

      const { data, error } = await q;
      if (error) throw error;

      return (data || []).map((inv) => ({
        ...inv,
        total_purchases: Number(inv.total_purchases),
        total_paid: Number(inv.total_paid),
        balance: Math.max(0, Number(inv.total_purchases) - Number(inv.total_paid)),
        status: inv.status as CreditCardInvoiceRecord["status"],
      }));
    },
    enabled: !!user,
  });
}
