import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { toast } from "sonner";
import { Database } from "@/integrations/supabase/types";

type AccountRow = Database["public"]["Tables"]["accounts"]["Row"];
type AccountInsert = Database["public"]["Tables"]["accounts"]["Insert"];
type AccountUpdate = Database["public"]["Tables"]["accounts"]["Update"];

export type AccountType = "checking" | "savings" | "investment" | "credit_card" | "cash";
export type AccountStatus = "active" | "inactive";

export interface Account extends Omit<AccountRow, 'initial_balance' | 'current_balance' | 'start_date' | 'official_balance' | 'last_official_balance_at'> {
  initial_balance: number;
  current_balance: number;
  official_balance?: number | null;
  last_official_balance_at?: string | null;
  start_date?: string | null;
}

export function useAccounts() {
  const { user } = useAuth();
  const { getOrganizationFilter } = useBaseFilter();
  const orgFilter = getOrganizationFilter();

  return useQuery({
    queryKey: ["accounts", user?.id, orgFilter.type, orgFilter.ids],
    queryFn: async () => {
      let query = supabase
        .from("accounts")
        .select("*")
        .order("name");

      if (orgFilter.type === 'single') {
        query = query.eq("organization_id", orgFilter.ids[0]);
      } else if (orgFilter.type === 'multiple' && orgFilter.ids.length > 0) {
        query = query.in("organization_id", orgFilter.ids);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Calculate current balance for each account
      const accountsWithBalance = await Promise.all(
        (data || []).map(async (account) => {
          const officialBalance = (account as any).official_balance;
          const lastOfficialAt = (account as any).last_official_balance_at;
          
          // PRIORITY: Use official_balance from Open Finance API if available
          if (officialBalance !== null && officialBalance !== undefined) {
            return {
              ...account,
              initial_balance: Number(account.initial_balance) || 0,
              current_balance: Number(officialBalance),
              official_balance: Number(officialBalance),
              last_official_balance_at: lastOfficialAt,
            } as Account;
          }
          
          // FALLBACK: Calculate balance for manual accounts
          const { data: balanceData } = await supabase
            .rpc("calculate_account_balance", { account_uuid: account.id });
          
          const balance = Number(balanceData) || Number(account.initial_balance) || 0;
          return {
            ...account,
            initial_balance: Number(account.initial_balance) || 0,
            current_balance: balance,
            official_balance: null,
            last_official_balance_at: null,
          } as Account;
        })
      );
      
      return accountsWithBalance;
    },
    enabled: !!user,
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { getRequiredOrganizationId, requiresBaseSelection } = useBaseFilter();

  return useMutation({
    mutationFn: async (account: {
      name: string;
      bank_name?: string;
      account_type: AccountType;
      initial_balance?: number;
      start_date?: string;
      status?: AccountStatus;
      color?: string;
    }) => {
      const organizationId = getRequiredOrganizationId();
      
      if (!organizationId) {
        throw new Error("Selecione uma base antes de criar uma conta");
      }
      
      const insertData: AccountInsert = {
        ...account,
        user_id: user!.id,
        organization_id: organizationId,
      };
      
      const { data, error } = await supabase
        .from("accounts")
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Conta criada com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao criar conta: " + error.message);
    },
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...account }: { id: string } & Partial<{
      name: string;
      bank_name: string;
      account_type: AccountType;
      initial_balance: number;
      start_date: string;
      status: AccountStatus;
      color: string;
    }>) => {
      const updateData: AccountUpdate = account;
      
      const { data, error } = await supabase
        .from("accounts")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Conta atualizada!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar conta: " + error.message);
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Conta excluída!");
    },
    onError: (error) => {
      toast.error("Erro ao excluir conta: " + error.message);
    },
  });
}
