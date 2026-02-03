import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface UserHierarchy {
  id: string;
  user_id: string;
  supervisor_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserWithHierarchy {
  user_id: string;
  full_name: string | null;
  role: string | null;
  supervisor_id: string | null;
  supervisor_name: string | null;
}

export function useUserHierarchy() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user-hierarchy"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_hierarchy")
        .select("*");

      if (error) throw error;
      return data as UserHierarchy[];
    },
    enabled: !!user,
  });
}

export function useUsersWithHierarchy() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["users-with-hierarchy"],
    queryFn: async () => {
      // Get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name");

      if (profilesError) throw profilesError;

      // Get all roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Get hierarchy
      const { data: hierarchy, error: hierarchyError } = await supabase
        .from("user_hierarchy")
        .select("user_id, supervisor_id");

      if (hierarchyError) throw hierarchyError;

      // Map everything together
      const usersWithHierarchy: UserWithHierarchy[] = (profiles || []).map(profile => {
        const userRole = roles?.find(r => r.user_id === profile.user_id);
        const userHierarchy = hierarchy?.find(h => h.user_id === profile.user_id);
        const supervisorProfile = profiles?.find(p => p.user_id === userHierarchy?.supervisor_id);

        return {
          user_id: profile.user_id,
          full_name: profile.full_name,
          role: userRole?.role || null,
          supervisor_id: userHierarchy?.supervisor_id || null,
          supervisor_name: supervisorProfile?.full_name || null,
        };
      });

      return usersWithHierarchy;
    },
    enabled: !!user,
  });
}

export function useSetSupervisor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, supervisorId }: { userId: string; supervisorId: string | null }) => {
      // Check if hierarchy entry exists
      const { data: existing } = await supabase
        .from("user_hierarchy")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { data, error } = await supabase
          .from("user_hierarchy")
          .update({ supervisor_id: supervisorId })
          .eq("id", existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Insert new
        const { data, error } = await supabase
          .from("user_hierarchy")
          .insert({ user_id: userId, supervisor_id: supervisorId })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-hierarchy"] });
      queryClient.invalidateQueries({ queryKey: ["users-with-hierarchy"] });
      toast.success("Supervisor atualizado com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar supervisor: " + error.message);
    },
  });
}

export function useSubordinates() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["subordinates", user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Use RPC to call the get_subordinates function
      const { data, error } = await supabase.rpc("get_subordinates", {
        _user_id: user.id,
      });

      if (error) throw error;
      return data as string[];
    },
    enabled: !!user,
  });
}

export function useViewableOrganizations() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["viewable-organizations", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase.rpc("get_viewable_organizations", {
        _user_id: user.id,
      });

      if (error) throw error;
      return data as string[];
    },
    enabled: !!user,
  });
}
