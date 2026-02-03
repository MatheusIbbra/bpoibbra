import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  cpf_cnpj: string | null;
  phone: string | null;
  address: string | null;
  kam_id: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: string;
  created_at: string;
}

export interface AvailableUser {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string;
}

export function useOrganizations() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["organizations", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .order("name");

      if (error) throw error;
      return data as Organization[];
    },
    enabled: !!user,
  });
}

export function useCurrentOrganization() {
  const { data: organizations, isLoading } = useOrganizations();
  
  // For now, return the first organization
  // In a full implementation, this would be stored in context/localStorage
  const currentOrg = organizations?.[0] || null;
  
  return {
    organization: currentOrg,
    isLoading,
  };
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: { name: string; slug: string }) => {
      // Create organization
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .insert({
          name: data.name,
          slug: data.slug,
        })
        .select()
        .single();

      if (orgError) throw orgError;

      // Add current user as admin of the organization
      const { error: memberError } = await supabase
        .from("organization_members")
        .insert({
          organization_id: org.id,
          user_id: user!.id,
          role: "admin",
        });

      if (memberError) throw memberError;

      return org as Organization;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      toast.success("Organização criada com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao criar organização: " + error.message);
    },
  });
}

export interface UpdateOrganizationData {
  id: string;
  name?: string;
  cpf_cnpj?: string | null;
  phone?: string | null;
  address?: string | null;
  logo_url?: string | null;
  kam_id?: string | null;
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateOrganizationData) => {
      const { data: result, error } = await supabase
        .from("organizations")
        .update(data)
        .eq("id", id)
        .select();

      if (error) throw error;
      if (!result || result.length === 0) {
        throw new Error("Organização não encontrada ou sem permissão para editar");
      }
      return result[0] as Organization;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["organizations-with-kam"] });
      queryClient.invalidateQueries({ queryKey: ["viewable-organizations"] });
      toast.success("Organização atualizada com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar organização: " + error.message);
    },
  });
}

export function useOrganizationMembers(organizationId: string | undefined) {
  return useQuery({
    queryKey: ["organization-members", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from("organization_members")
        .select(`
          *,
          profiles!inner(full_name, avatar_url)
        `)
        .eq("organization_id", organizationId);

      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });
}

// Fetch users not already in the organization
export function useAvailableUsers(organizationId: string | undefined) {
  return useQuery({
    queryKey: ["available-users", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      // Get existing member user_ids
      const { data: existingMembers, error: membersError } = await supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", organizationId);

      if (membersError) throw membersError;

      const existingUserIds = existingMembers?.map(m => m.user_id) || [];

      // Get all profiles with their auth user info
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url");

      if (profilesError) throw profilesError;

      // Filter out existing members
      const availableProfiles = profiles?.filter(
        p => !existingUserIds.includes(p.user_id)
      ) || [];

      // Get emails from auth.users via a workaround (using user_id)
      // Since we can't directly query auth.users, we'll show user_id as fallback
      return availableProfiles.map(p => ({
        user_id: p.user_id,
        full_name: p.full_name,
        avatar_url: p.avatar_url,
        email: p.full_name || `Usuário ${p.user_id.slice(0, 8)}...`,
      })) as AvailableUser[];
    },
    enabled: !!organizationId,
  });
}

export function useAddOrganizationMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { 
      organizationId: string; 
      userId: string; 
      role: string;
    }) => {
      const { data: member, error } = await supabase
        .from("organization_members")
        .insert({
          organization_id: data.organizationId,
          user_id: data.userId,
          role: data.role as AppRole,
        })
        .select()
        .single();

      if (error) throw error;
      return member;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ["organization-members", variables.organizationId] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["available-users", variables.organizationId] 
      });
      toast.success("Membro adicionado com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao adicionar membro: " + error.message);
    },
  });
}

export function useRemoveOrganizationMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { memberId: string; organizationId: string }) => {
      const { error } = await supabase
        .from("organization_members")
        .delete()
        .eq("id", data.memberId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ["organization-members", variables.organizationId] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["available-users", variables.organizationId] 
      });
      toast.success("Membro removido com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao remover membro: " + error.message);
    },
  });
}
