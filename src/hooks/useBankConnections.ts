import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { toast } from "sonner";

export interface BankConnection {
  id: string;
  organization_id: string;
  user_id: string;
  provider: string;
  provider_name: string | null;
  external_consent_id: string | null;
  status: string;
  last_sync_at: string | null;
  sync_error: string | null;
  token_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useBankConnections() {
  const { user } = useAuth();
  const { getOrganizationFilter } = useBaseFilter();
  const orgFilter = getOrganizationFilter();

  return useQuery({
    queryKey: ["bank-connections", user?.id, orgFilter.type, orgFilter.ids],
    queryFn: async () => {
      let query = supabase
        .from("bank_connections")
        .select("*")
        .order("created_at", { ascending: false });

      if (orgFilter.type === 'single') {
        query = query.eq("organization_id", orgFilter.ids[0]);
      } else if (orgFilter.type === 'multiple' && orgFilter.ids.length > 0) {
        query = query.in("organization_id", orgFilter.ids);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as BankConnection[];
    },
    enabled: !!user,
  });
}

export function useInitiateKlaviConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ organizationId, redirectPath }: { organizationId: string; redirectPath?: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error("Você precisa estar logado para conectar um banco");
      }

      const { data, error } = await supabase.functions.invoke('klavi-authorize', {
        body: { 
          organization_id: organizationId,
          redirect_path: redirectPath || '/open-finance'
        }
      });

      if (error) throw error;
      return data as { authorization_url: string; state: string };
    },
    onError: (error) => {
      toast.error("Erro ao iniciar conexão: " + error.message);
    },
  });
}

export function useExchangeKlaviToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ code, state }: { code: string; state: string }) => {
      const { data, error } = await supabase.functions.invoke('klavi-exchange-token', {
        body: { code, state }
      });

      if (error) throw error;
      return data as { 
        success: boolean; 
        connection_id: string; 
        provider_name: string;
        redirect_path: string;
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-connections"] });
      toast.success("Banco conectado com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao conectar banco: " + error.message);
    },
  });
}

export function useSyncBankConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      bankConnectionId, 
      fromDate, 
      toDate 
    }: { 
      bankConnectionId: string; 
      fromDate?: string; 
      toDate?: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error("Você precisa estar logado");
      }

      const { data, error } = await supabase.functions.invoke('klavi-sync', {
        body: { 
          bank_connection_id: bankConnectionId,
          from_date: fromDate,
          to_date: toDate
        }
      });

      if (error) throw error;
      return data as { success: boolean; imported: number; skipped: number; total: number };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["bank-connections"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success(`Sincronização concluída: ${data.imported} transações importadas`);
    },
    onError: (error) => {
      toast.error("Erro na sincronização: " + error.message);
    },
  });
}

export function useDisconnectBank() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bankConnectionId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error("Você precisa estar logado");
      }

      const { data, error } = await supabase.functions.invoke('klavi-disconnect', {
        body: { bank_connection_id: bankConnectionId }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-connections"] });
      toast.success("Banco desconectado com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao desconectar: " + error.message);
    },
  });
}
