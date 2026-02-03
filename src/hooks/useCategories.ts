import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { toast } from "sonner";
import { Database } from "@/integrations/supabase/types";

type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type CategoryInsert = Database["public"]["Tables"]["categories"]["Insert"];
type CategoryUpdate = Database["public"]["Tables"]["categories"]["Update"];

export type CategoryType = "income" | "expense" | "investment" | "redemption";

export interface Category extends CategoryRow {
  children?: Category[];
}

export function useCategories(type?: CategoryType | CategoryType[]) {
  const { user } = useAuth();
  const { getOrganizationFilter } = useBaseFilter();
  const orgFilter = getOrganizationFilter();
  
  return useQuery({
    queryKey: ["categories", user?.id, orgFilter.type, orgFilter.ids, type],
    queryFn: async () => {
      let query = supabase
        .from("categories")
        .select("*")
        .order("name");
      
      // Aplicar filtro de organização
      if (orgFilter.type === 'single') {
        query = query.eq("organization_id", orgFilter.ids[0]);
      } else if (orgFilter.type === 'multiple' && orgFilter.ids.length > 0) {
        query = query.in("organization_id", orgFilter.ids);
      }
      
      if (type) {
        if (Array.isArray(type)) {
          query = query.in("type", type);
        } else {
          query = query.eq("type", type);
        }
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return (data || []) as Category[];
    },
    enabled: !!user,
  });
}

export function useCategoriesHierarchy(type?: CategoryType | CategoryType[]) {
  const { user } = useAuth();
  const { getOrganizationFilter } = useBaseFilter();
  const orgFilter = getOrganizationFilter();
  
  return useQuery({
    queryKey: ["categories-hierarchy", user?.id, orgFilter.type, orgFilter.ids, type],
    queryFn: async () => {
      let query = supabase
        .from("categories")
        .select("*")
        .order("name");
      
      // Aplicar filtro de organização
      if (orgFilter.type === 'single') {
        query = query.eq("organization_id", orgFilter.ids[0]);
      } else if (orgFilter.type === 'multiple' && orgFilter.ids.length > 0) {
        query = query.in("organization_id", orgFilter.ids);
      }
      
      if (type) {
        if (Array.isArray(type)) {
          query = query.in("type", type);
        } else {
          query = query.eq("type", type);
        }
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      const categories = (data || []) as Category[];
      
      // Build hierarchy
      const parentCategories = categories.filter(c => !c.parent_id);
      const childCategories = categories.filter(c => c.parent_id);
      
      parentCategories.forEach(parent => {
        parent.children = childCategories.filter(c => c.parent_id === parent.id);
      });
      
      return parentCategories;
    },
    enabled: !!user,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { getRequiredOrganizationId } = useBaseFilter();

  return useMutation({
    mutationFn: async (category: {
      name: string;
      type: CategoryType;
      icon?: string;
      color?: string;
      parent_id?: string | null;
      description?: string | null;
      dre_group?: string | null;
    }) => {
      const organizationId = getRequiredOrganizationId();
      
      if (!organizationId) {
        throw new Error("Selecione uma base antes de criar uma categoria");
      }
      
      // Validate: if parent_id is set, it must be a child category
      if (category.parent_id) {
        const { data: parent } = await supabase
          .from("categories")
          .select("id, parent_id")
          .eq("id", category.parent_id)
          .single();
        
        if (parent?.parent_id) {
          throw new Error("Não é possível criar subcategoria de uma subcategoria");
        }
      }
      
      const insertData: CategoryInsert = {
        ...category,
        user_id: user!.id,
        organization_id: organizationId,
      };
      
      const { data, error } = await supabase
        .from("categories")
        .insert(insertData)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories-hierarchy"] });
      toast.success("Categoria criada com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao criar categoria: " + error.message);
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...category }: { id: string } & Partial<{
      name: string;
      type: CategoryType;
      icon: string;
      color: string;
      parent_id: string | null;
      description: string | null;
      dre_group: string | null;
    }>) => {
      // Validate: if parent_id is set, it must be a valid parent
      if (category.parent_id) {
        const { data: parent } = await supabase
          .from("categories")
          .select("id, parent_id")
          .eq("id", category.parent_id)
          .single();
        
        if (parent?.parent_id) {
          throw new Error("Não é possível vincular a uma subcategoria");
        }
      }
      
      const updateData: CategoryUpdate = category;
      
      const { data, error } = await supabase
        .from("categories")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories-hierarchy"] });
      toast.success("Categoria atualizada!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar categoria: " + error.message);
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories-hierarchy"] });
      toast.success("Categoria excluída!");
    },
    onError: (error) => {
      toast.error("Erro ao excluir categoria: " + error.message);
    },
  });
}
