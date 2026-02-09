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
  external_account_id: string | null;
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

// Get Pluggy connect token for the widget
export function usePluggyConnectToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ organizationId }: { organizationId: string }) => {
      const { data, error } = await supabase.functions.invoke('pluggy-connect', {
        body: { organization_id: organizationId }
      });

      if (error) throw error;
      return data as { accessToken: string };
    },
    onError: (error) => {
      toast.error("Erro ao obter token Pluggy: " + error.message);
    },
  });
}

// Open Pluggy Connect widget
export function useOpenPluggyConnect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ organizationId }: { organizationId: string }) => {
      // Get the connect token from the edge function
      const { data, error } = await supabase.functions.invoke('pluggy-connect', {
        body: { organization_id: organizationId }
      });

      if (error) throw error;
      
      // Store the organization context for when user returns
      localStorage.setItem('pending_openfinance_org', organizationId);
      localStorage.setItem('pending_openfinance_return', window.location.pathname);
      
      return data as { accessToken: string };
    },
    onSuccess: (data) => {
      // The component will handle opening the Pluggy Connect widget
      toast.info("Token obtido. Abrindo widget de conexão...");
    },
    onError: (error) => {
      toast.error("Erro ao iniciar conexão: " + error.message);
    },
  });
}

// Legacy aliases for backward compatibility
export function useOpenWhiteLabelConnection() {
  return useOpenPluggyConnect();
}

export function useWhiteLabelUrl() {
  return useQuery({
    queryKey: ["pluggy-info"],
    queryFn: async () => {
      return { url: null }; // No longer used - Pluggy uses widget
    },
    staleTime: Infinity,
  });
}

export function useInitiateKlaviConnection() {
  return useOpenPluggyConnect();
}

export function useExchangeKlaviToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ code, state }: { code: string; state: string }) => {
      // Legacy - no longer used for Pluggy
      throw new Error("Klavi não está mais ativo. Use Pluggy.");
    },
    onError: (error) => {
      toast.error("Erro: " + error.message);
    },
  });
}

export function useSyncBankConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      bankConnectionId,
      organizationId,
      itemId,
      fromDate, 
      toDate 
    }: { 
      bankConnectionId?: string;
      organizationId?: string;
      itemId?: string;
      fromDate?: string; 
      toDate?: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error("Você precisa estar logado");
      }

      const { data, error } = await supabase.functions.invoke('pluggy-sync', {
        body: { 
          bank_connection_id: bankConnectionId,
          organization_id: organizationId,
          item_id: itemId,
          from_date: fromDate,
          to_date: toDate
        }
      });

      if (error) throw error;
      return data as { success: boolean; imported: number; skipped: number; total: number; connection_id?: string };
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
      // 1. Delete all transactions linked to this bank connection
      const { error: txError } = await supabase
        .from('transactions')
        .delete()
        .eq('bank_connection_id', bankConnectionId);
      
      if (txError) {
        console.error('Failed to delete transactions:', txError);
        throw new Error('Erro ao excluir movimentações vinculadas');
      }

      // 2. Get accounts linked to this connection (via organization + bank_name)
      const { data: connection } = await supabase
        .from('bank_connections')
        .select('organization_id, provider_name')
        .eq('id', bankConnectionId)
        .single();

      if (connection) {
        // Delete accounts that were created by this connection
        const { error: accError } = await supabase
          .from('accounts')
          .delete()
          .eq('organization_id', connection.organization_id)
          .eq('bank_name', connection.provider_name || '');

        if (accError) {
          console.warn('Failed to delete linked accounts:', accError);
        }
      }

      // 3. Delete the bank connection itself
      const { error } = await supabase
        .from('bank_connections')
        .delete()
        .eq('id', bankConnectionId);

      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-connections"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Banco desconectado e dados removidos com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao desconectar: " + error.message);
    },
  });
}

// Save Pluggy item after connection completes
export function useSavePluggyItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      organizationId, 
      itemId, 
      connectorName 
    }: { 
      organizationId: string; 
      itemId: string;
      connectorName?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("Você precisa estar logado");
      }

      // Check if connection already exists for this item
      const { data: existing } = await supabase
        .from('bank_connections')
        .select('id')
        .eq('external_account_id', itemId)
        .eq('provider', 'pluggy')
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('bank_connections')
          .update({
            status: 'active',
            sync_error: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);

        if (error) throw error;
        return { connection_id: existing.id };
      }

      // Create new connection
      const { data, error } = await supabase
        .from('bank_connections')
        .insert({
          organization_id: organizationId,
          user_id: user.id,
          provider: 'pluggy',
          provider_name: connectorName || 'Open Finance (Pluggy)',
          external_account_id: itemId,
          status: 'active'
        })
        .select('id')
        .single();

      if (error) throw error;
      return { connection_id: data.id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-connections"] });
      toast.success("Banco conectado com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao salvar conexão: " + error.message);
    },
  });
}
