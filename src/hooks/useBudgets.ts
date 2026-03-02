import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { toast } from "sonner";

export interface Budget {
  id: string;
  user_id: string;
  organization_id: string | null;
  category_id: string;
  cost_center_id: string | null;
  amount: number;
  month: number;
  year: number;
  recurring_group_id: string | null;
  created_at: string;
  updated_at: string;
  categories?: {
    id: string;
    name: string;
    icon: string;
    color: string;
  } | null;
  cost_centers?: {
    id: string;
    name: string;
  } | null;
}

export function useBudgets(month?: number, year?: number) {
  const { user } = useAuth();
  const { getOrganizationFilter } = useBaseFilter();
  const orgFilter = getOrganizationFilter();
  const currentDate = new Date();
  const targetMonth = month ?? currentDate.getMonth() + 1;
  const targetYear = year ?? currentDate.getFullYear();
  
  return useQuery({
    queryKey: ["budgets", user?.id, orgFilter.type, orgFilter.ids, targetMonth, targetYear],
    queryFn: async () => {
      let query = supabase
        .from("budgets")
        .select(`
          *,
          categories (
            id,
            name,
            icon,
            color
          ),
          cost_centers (
            id,
            name
          )
        `)
        .eq("month", targetMonth)
        .eq("year", targetYear);
      
      if (orgFilter.type === 'single') {
        query = query.eq("organization_id", orgFilter.ids[0]);
      } else if (orgFilter.type === 'multiple' && orgFilter.ids.length > 0) {
        query = query.in("organization_id", orgFilter.ids);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as Budget[];
    },
    enabled: !!user,
  });
}

export function useCreateBudget() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { getRequiredOrganizationId } = useBaseFilter();

  return useMutation({
    mutationFn: async (budget: {
      category_id: string;
      amount: number;
      month: number;
      year: number;
      cost_center_id: string | null;
      is_recurring?: boolean;
    }) => {
      const organizationId = getRequiredOrganizationId();
      if (!organizationId) throw new Error("Selecione uma base antes de criar um orçamento");

      const { is_recurring, ...budgetData } = budget;
      
      if (is_recurring) {
        // Create for all months from selected month to December, and if < 12 months, also next year
        const groupId = crypto.randomUUID();
        const rows: any[] = [];
        
        // From selected month to Dec of selected year
        for (let m = budget.month; m <= 12; m++) {
          rows.push({
            ...budgetData,
            month: m,
            year: budget.year,
            user_id: user!.id,
            organization_id: organizationId,
            recurring_group_id: groupId,
          });
        }
        
        const { data, error } = await supabase
          .from("budgets")
          .insert(rows)
          .select();
        
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("budgets")
          .insert({
            ...budgetData,
            user_id: user!.id,
            organization_id: organizationId,
            recurring_group_id: null,
          })
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      toast.success("Orçamento criado com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao criar orçamento: " + error.message);
    },
  });
}

export function useUpdateBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updateFuture, ...budget }: Partial<Budget> & { id: string; updateFuture?: boolean }) => {
      if (updateFuture && budget.amount !== undefined) {
        // First get the current budget to find group info
        const { data: current, error: fetchErr } = await supabase
          .from("budgets")
          .select("recurring_group_id, month, year")
          .eq("id", id)
          .single();
        
        if (fetchErr) throw fetchErr;
        
        if (current?.recurring_group_id) {
          // Update this and all future months in the same group
          const { error } = await supabase
            .from("budgets")
            .update({ amount: budget.amount })
            .eq("recurring_group_id", current.recurring_group_id)
            .or(`year.gt.${current.year},and(year.eq.${current.year},month.gte.${current.month})`);
          
          if (error) throw error;
          return { id };
        }
      }
      
      // Simple single update
      const { data, error } = await supabase
        .from("budgets")
        .update(budget)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      toast.success("Orçamento atualizado!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar orçamento: " + error.message);
    },
  });
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, deleteFuture }: { id: string; deleteFuture?: boolean }) => {
      if (deleteFuture) {
        const { data: current, error: fetchErr } = await supabase
          .from("budgets")
          .select("recurring_group_id, month, year")
          .eq("id", id)
          .single();
        
        if (fetchErr) throw fetchErr;
        
        if (current?.recurring_group_id) {
          const { error } = await supabase
            .from("budgets")
            .delete()
            .eq("recurring_group_id", current.recurring_group_id)
            .or(`year.gt.${current.year},and(year.eq.${current.year},month.gte.${current.month})`);
          
          if (error) throw error;
          return;
        }
      }
      
      const { error } = await supabase
        .from("budgets")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      toast.success("Orçamento excluído!");
    },
    onError: (error) => {
      toast.error("Erro ao excluir orçamento: " + error.message);
    },
  });
}