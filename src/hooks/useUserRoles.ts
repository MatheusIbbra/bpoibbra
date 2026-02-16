import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Database } from "@/integrations/supabase/types";

type UserRoleRow = Database["public"]["Tables"]["user_roles"]["Row"];

export type AppRole = "admin" | "supervisor" | "fa" | "kam" | "projetista" | "cliente";

export interface UserRole extends UserRoleRow {}

export interface UserWithRole {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  role: AppRole | null;
  role_id: string | null;
  is_blocked?: boolean;
  blocked_reason?: string | null;
}

// Role hierarchy - higher index = more permissions
const ROLE_HIERARCHY: AppRole[] = ["cliente", "kam", "fa", "projetista", "supervisor", "admin"];

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrador",
  supervisor: "Supervisor",
  projetista: "Projetista",
  fa: "Analista Financeiro (FA)",
  kam: "Key Account Manager (KAM)",
  cliente: "Cliente",
};

export const ROLE_DESCRIPTIONS: Record<AppRole, string[]> = {
  admin: [
    "Gestão completa do sistema",
    "Acesso irrestrito a todas as Bases",
    "Criação de organizações e usuários",
    "Configurações globais",
  ],
  supervisor: [
    "Supervisiona múltiplos clientes",
    "Acesso às Bases vinculadas",
    "Valida classificações",
    "Acompanha qualidade",
  ],
  projetista: [
    "Acesso às Bases vinculadas",
    "Mesmas permissões do FA",
    "Classifica movimentações",
    "Analisa extratos",
  ],
  fa: [
    "Classifica movimentações",
    "Acesso às Bases vinculadas",
    "Analisa extratos",
    "Aprova/rejeita sugestões IA",
  ],
  kam: [
    "Relacionamento com cliente",
    "Acesso às Bases vinculadas",
    "Visualiza relatórios",
    "Acompanha metas/orçamento",
  ],
  cliente: [
    "Visualiza seus dados",
    "Altera dados financeiros",
    "Aprova/rejeita sugestões IA",
    "Classifica transações",
  ],
};

export function useCurrentUserRole() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["current-user-role", user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from("user_roles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data?.role as AppRole | null;
    },
    enabled: !!user,
  });
}

export function useHasPermission(requiredRole: AppRole) {
  const { data: currentRole, isLoading } = useCurrentUserRole();
  
  if (isLoading || !currentRole) return { hasPermission: false, isLoading };
  
  const currentIndex = ROLE_HIERARCHY.indexOf(currentRole);
  const requiredIndex = ROLE_HIERARCHY.indexOf(requiredRole);
  
  return {
    hasPermission: currentIndex >= requiredIndex,
    isLoading,
  };
}

export function useIsAdmin() {
  const { data: role, isLoading } = useCurrentUserRole();
  return {
    isAdmin: role === "admin",
    isLoading,
  };
}

export function useCanManageUsers() {
  const { data: role, isLoading } = useCurrentUserRole();
  return {
    canManage: role === "admin" || role === "supervisor",
    isLoading,
  };
}

export function useCanClassify() {
  const { data: role, isLoading } = useCurrentUserRole();
  return {
    canClassify: role === "admin" || role === "supervisor" || role === "fa" || role === "projetista" || role === "cliente",
    isLoading,
  };
}

export function useCanEditFinancials() {
  const { data: role, isLoading } = useCurrentUserRole();
  return {
    canEdit: role === "admin" || role === "supervisor" || role === "fa" || role === "projetista" || role === "cliente",
    isLoading,
  };
}

export function useCanViewReports() {
  const { data: role, isLoading } = useCurrentUserRole();
  return {
    canView: role !== null, // All roles can view reports
    isLoading,
  };
}

export function useAllUsersWithRoles() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["all-users-with-roles"],
    queryFn: async () => {
      // First get all profiles including blocking info
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name, created_at, is_blocked, blocked_reason")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Then get all roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("*");

      if (rolesError) throw rolesError;

      // Map profiles with their roles
      const usersWithRoles: UserWithRole[] = (profiles || []).map(profile => {
        const userRole = roles?.find(r => r.user_id === profile.user_id);
        return {
          id: profile.user_id,
          email: "",
          full_name: profile.full_name,
          created_at: profile.created_at,
          role: (userRole?.role as AppRole) || null,
          role_id: userRole?.id || null,
          is_blocked: profile.is_blocked || false,
          blocked_reason: profile.blocked_reason,
        };
      });

      return usersWithRoles;
    },
    enabled: !!user,
  });
}

export function useAssignRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      // First check if user already has a role
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existingRole) {
        // Update existing role - cast to any to bypass type check until types regenerate
        const { data, error } = await supabase
          .from("user_roles")
          .update({ role: role as any })
          .eq("id", existingRole.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Insert new role - cast to any to bypass type check until types regenerate
        const { data, error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: role as any })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-users-with-roles"] });
      queryClient.invalidateQueries({ queryKey: ["current-user-role"] });
      toast.success("Permissão atualizada com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar permissão: " + error.message);
    },
  });
}

export function useRemoveRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("id", roleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-users-with-roles"] });
      queryClient.invalidateQueries({ queryKey: ["current-user-role"] });
      toast.success("Permissão removida!");
    },
    onError: (error) => {
      toast.error("Erro ao remover permissão: " + error.message);
    },
  });
}
