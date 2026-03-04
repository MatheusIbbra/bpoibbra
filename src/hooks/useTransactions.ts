import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { toast } from "sonner";
import { Database } from "@/integrations/supabase/types";

type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];
type TransactionInsert = Database["public"]["Tables"]["transactions"]["Insert"];
type TransactionUpdate = Database["public"]["Tables"]["transactions"]["Update"];

export type TransactionType = "income" | "expense" | "transfer" | "investment" | "redemption";
export type TransactionStatus = "pending" | "completed" | "cancelled";

export interface Transaction extends Omit<TransactionRow, 'amount'> {
  amount: number;
  categories?: {
    id: string;
    name: string;
    icon: string;
    color: string;
  } | null;
  accounts?: {
    id: string;
    name: string;
    bank_name: string;
  } | null;
  cost_centers?: {
    id: string;
    name: string;
  } | null;
}

interface TransactionFilters {
  type?: TransactionType;
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  accountId?: string;
  costCenterId?: string;
  status?: TransactionStatus;
  search?: string;
}

export function useTransactions(filters?: TransactionFilters) {
  const { user } = useAuth();
  const { getOrganizationFilter } = useBaseFilter();
  const orgFilter = getOrganizationFilter();
  
  return useQuery({
    queryKey: ["transactions", user?.id, orgFilter.type, orgFilter.ids, filters],
    queryFn: async () => {
      let query = supabase
        .from("transactions")
        .select(`
          *,
          categories (
            id,
            name,
            icon,
            color
          ),
          accounts (
            id,
            name,
            bank_name
          ),
          cost_centers (
            id,
            name
          )
        `)
        .order("date", { ascending: false });
      
      // Aplicar filtro de organização
      if (orgFilter.type === 'single') {
        query = query.eq("organization_id", orgFilter.ids[0]);
      } else if (orgFilter.type === 'multiple' && orgFilter.ids.length > 0) {
        query = query.in("organization_id", orgFilter.ids);
      }
      
      if (filters?.type) {
        query = query.eq("type", filters.type);
      }
      
      if (filters?.startDate) {
        query = query.gte("date", filters.startDate);
      }
      
      if (filters?.endDate) {
        query = query.lte("date", filters.endDate);
      }
      
      if (filters?.categoryId) {
        query = query.eq("category_id", filters.categoryId);
      }
      
      if (filters?.accountId) {
        query = query.eq("account_id", filters.accountId);
      }
      
      if (filters?.costCenterId) {
        query = query.eq("cost_center_id", filters.costCenterId);
      }
      
      if (filters?.status) {
        query = query.eq("status", filters.status);
      }
      
      if (filters?.search) {
        query = query.ilike("description", `%${filters.search}%`);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return (data || []).map(t => ({
        ...t,
        amount: Number(t.amount),
      })) as Transaction[];
    },
    enabled: !!user,
  });
}

interface CreateTransactionInput {
  description?: string;
  amount: number;
  type: TransactionType;
  date: string;
  account_id: string;
  destination_account_id?: string;
  category_id?: string | null;
  cost_center_id?: string | null;
  financial_type?: string | null;
  accrual_date?: string | null;
  notes?: string | null;
  status?: TransactionStatus;
  is_ignored?: boolean;
  linked_existing_id?: string;
  // New fields
  paid_amount?: number | null;
  payment_method?: string | null;
  due_date?: string | null;
  payment_date?: string | null;
}

// Types that create paired transactions (investment/redemption only — transfers use the transfers table)
const PAIRED_TYPES: TransactionType[] = ["investment", "redemption"];

/**
 * Paired transaction logic for investment/redemption:
 *
 *  INVESTMENT (Aporte): money leaves origin account → arrives at destination (investment) account
 *    Primary   (visible in reports): type=investment,  account=origin,      validation_status=pending_validation
 *    Secondary (balance correction): type=redemption,  account=destination, validation_status=rejected
 *      → DB formula: redemption=+amount → destination balance increases ✓
 *      → Reports filter out validation_status=rejected → excluded from P&L ✓
 *
 *  REDEMPTION (Resgate): money leaves investment account → arrives at destination (checking) account
 *    Primary   (visible in reports): type=redemption, account=destination,  validation_status=pending_validation
 *    Secondary (balance correction): type=investment, account=origin,       validation_status=rejected
 *      → DB formula: investment=-amount → origin (investment) balance decreases ✓
 *      → Reports filter out validation_status=rejected → excluded from P&L ✓
 */
function buildPairedTransactions(
  transaction: CreateTransactionInput,
  userId: string,
  organizationId: string,
): { primary: TransactionInsert; secondary: TransactionInsert } {
  const base = {
    description: transaction.description,
    amount: transaction.amount,
    date: transaction.date,
    category_id: null,
    cost_center_id: null,
    accrual_date: transaction.accrual_date || transaction.date,
    notes: transaction.notes,
    status: (transaction.status || "completed") as "pending" | "completed" | "cancelled",
    user_id: userId,
    organization_id: organizationId,
    is_ignored: transaction.is_ignored || false,
  };

  if (transaction.type === "investment") {
    // Aporte: origin account is debited (investment type), destination is credited (redemption type)
    const primary: TransactionInsert = {
      ...base,
      type: "investment",
      account_id: transaction.account_id,
      validation_status: "pending_validation",
    };
    const secondary: TransactionInsert = {
      ...base,
      type: "redemption",
      account_id: transaction.destination_account_id!,
      validation_status: "rejected", // hidden from reports, affects balance
    };
    return { primary, secondary };
  } else {
    // Resgate: origin (investment) account is debited (investment type), destination (checking) is credited (redemption type)
    const primary: TransactionInsert = {
      ...base,
      type: "redemption",
      account_id: transaction.destination_account_id!,
      validation_status: "pending_validation",
    };
    const secondary: TransactionInsert = {
      ...base,
      type: "investment",
      account_id: transaction.account_id,
      validation_status: "rejected", // hidden from reports, affects balance
    };
    return { primary, secondary };
  }
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { getRequiredOrganizationId } = useBaseFilter();

  return useMutation({
    mutationFn: async (transaction: CreateTransactionInput) => {
      const organizationId = getRequiredOrganizationId();
      
      if (!organizationId) {
        throw new Error("Selecione uma base antes de criar uma transação");
      }

      // If linking to an existing transaction, just update it
      if (transaction.linked_existing_id) {
        const { data: existingTx } = await supabase
          .from("transactions")
          .select("id")
          .eq("id", transaction.linked_existing_id)
          .single();
        
        if (existingTx) {
          // Create the new transaction linked to the existing one
          const insertData: TransactionInsert = {
            description: transaction.description,
            amount: transaction.amount,
            type: transaction.type,
            date: transaction.date,
            account_id: transaction.account_id,
            category_id: null,
            cost_center_id: null,
            accrual_date: transaction.accrual_date || transaction.date,
            notes: transaction.notes,
            status: transaction.status || "completed",
            user_id: user!.id,
            organization_id: organizationId,
            linked_transaction_id: transaction.linked_existing_id,
            is_ignored: transaction.is_ignored || false,
          };
          
          const { data: newTx, error } = await supabase
            .from("transactions")
            .insert(insertData)
            .select()
            .single();
          
          if (error) throw error;

          // Update the existing transaction to link back
          await supabase
            .from("transactions")
            .update({ linked_transaction_id: newTx.id })
            .eq("id", transaction.linked_existing_id);

          return newTx;
        }
      }

      // Check if this is a paired type (investment/redemption) requiring two transactions
      if (PAIRED_TYPES.includes(transaction.type) && transaction.destination_account_id) {
        const { primary: primaryData, secondary: secondaryData } = buildPairedTransactions(
          transaction,
          user!.id,
          organizationId,
        );

        // Insert primary transaction first
        const { data: primaryTx, error: primaryError } = await supabase
          .from("transactions")
          .insert(primaryData)
          .select()
          .single();
        
        if (primaryError) throw primaryError;

        // Insert secondary (balance-correction) transaction linked to primary
        const { data: secondaryTx, error: secondaryError } = await supabase
          .from("transactions")
          .insert({ ...secondaryData, linked_transaction_id: primaryTx.id })
          .select()
          .single();
        
        if (secondaryError) throw secondaryError;

        // Link primary back to secondary
        await supabase
          .from("transactions")
          .update({ linked_transaction_id: secondaryTx.id })
          .eq("id", primaryTx.id);

        return primaryTx;
      }
      
      // Regular single transaction
      const insertData: TransactionInsert = {
        description: transaction.description,
        amount: transaction.amount,
        type: transaction.type,
        date: transaction.date,
        account_id: transaction.account_id,
        category_id: transaction.category_id || null,
        cost_center_id: transaction.cost_center_id || null,
        accrual_date: transaction.accrual_date || transaction.date,
        notes: transaction.notes,
        status: transaction.status || "completed",
        user_id: user!.id,
        organization_id: organizationId,
        is_ignored: transaction.is_ignored || false,
      };
      
      const { data, error } = await supabase
        .from("transactions")
        .insert(insertData)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Transação criada com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao criar transação: " + error.message);
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...transaction }: { id: string } & Partial<CreateTransactionInput>) => {
      // Remove fields that don't exist in the transactions table
      const { destination_account_id, linked_existing_id, ...validFields } = transaction;
      
      const updateData: TransactionUpdate = validFields;
      
      const { data, error } = await supabase
        .from("transactions")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["pending-transactions-count"] });
      toast.success("Transação atualizada!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar transação: " + error.message);
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Fetch the transaction to check for a linked pair
      const { data: tx } = await supabase
        .from("transactions")
        .select("id, linked_transaction_id")
        .eq("id", id)
        .single();

      const linkedId = tx?.linked_transaction_id;

      // If this transaction has a linked pair (investment/redemption secondary),
      // verify the linked tx also points back to this one (true pair) and delete both
      if (linkedId) {
        const { data: linkedTx } = await supabase
          .from("transactions")
          .select("id, linked_transaction_id, validation_status")
          .eq("id", linkedId)
          .single();

        if (linkedTx?.linked_transaction_id === id) {
          // True bidirectional pair — delete the secondary side first
          await supabase.from("transactions").delete().eq("id", linkedId);
        }
      }

      // Delete the primary transaction
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Transação excluída!");
    },
    onError: (error) => {
      toast.error("Erro ao excluir transação: " + error.message);
    },
  });
}
