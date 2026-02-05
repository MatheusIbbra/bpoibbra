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

// Types that create paired transactions
const PAIRED_TYPES: TransactionType[] = ["transfer", "investment", "redemption"];

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

      // Check if this is a paired type requiring two transactions
      if (PAIRED_TYPES.includes(transaction.type) && transaction.destination_account_id) {
        // Create outgoing transaction (from origin account)
        const outgoingData: TransactionInsert = {
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
          is_ignored: transaction.is_ignored || false,
        };
        
        const { data: outgoingTx, error: outError } = await supabase
          .from("transactions")
          .insert(outgoingData)
          .select()
          .single();
        
        if (outError) throw outError;

        // Create incoming transaction (to destination account)
        const incomingData: TransactionInsert = {
          description: transaction.description,
          amount: transaction.amount,
          type: transaction.type,
          date: transaction.date,
          account_id: transaction.destination_account_id,
          category_id: null,
          cost_center_id: null,
          accrual_date: transaction.accrual_date || transaction.date,
          notes: transaction.notes,
          status: transaction.status || "completed",
          user_id: user!.id,
          organization_id: organizationId,
          linked_transaction_id: outgoingTx.id,
          is_ignored: transaction.is_ignored || false,
        };
        
        const { data: incomingTx, error: inError } = await supabase
          .from("transactions")
          .insert(incomingData)
          .select()
          .single();
        
        if (inError) throw inError;

        // Update outgoing transaction with link to incoming
        await supabase
          .from("transactions")
          .update({ linked_transaction_id: incomingTx.id })
          .eq("id", outgoingTx.id);

        return outgoingTx;
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
