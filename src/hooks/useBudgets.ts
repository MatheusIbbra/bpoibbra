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
      
      // Aplicar filtro de organização
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
    mutationFn: async (budget: Omit<Budget, "id" | "user_id" | "organization_id" | "created_at" | "updated_at" | "categories" | "cost_centers">) => {
      const organizationId = getRequiredOrganizationId();
      
      if (!organizationId) {
        throw new Error("Selecione uma base antes de criar um orçamento");
      }
      
      const { data, error } = await supabase
        .from("budgets")
        .insert({
          ...budget,
          user_id: user!.id,
          organization_id: organizationId,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
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
    mutationFn: async ({ id, ...budget }: Partial<Budget> & { id: string }) => {
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
    mutationFn: async (id: string) => {
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
