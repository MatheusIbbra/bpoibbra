import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  kam_id: string | null;
  logo_url: string | null;
}

type AppRole = "admin" | "supervisor" | "fa" | "kam" | "cliente";

interface BaseFilterContextType {
  selectedOrganizationId: string | null;
  setSelectedOrganizationId: (id: string | null) => void;
  availableOrganizations: Organization[];
  viewableOrganizationIds: string[];
  isLoading: boolean;
  canFilterByBase: boolean;
  selectedOrganization: Organization | null;
  userRole: AppRole | null;
  getOrganizationFilter: () => { type: 'single' | 'multiple' | 'none'; ids: string[] };
  // Security: require base selection for creation operations
  requiresBaseSelection: boolean;
  getRequiredOrganizationId: () => string | null;
}

const BaseFilterContext = createContext<BaseFilterContextType | undefined>(undefined);

export function BaseFilterProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);
  const [availableOrganizations, setAvailableOrganizations] = useState<Organization[]>([]);
  const [viewableOrganizationIds, setViewableOrganizationIds] = useState<string[]>([]);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Perfis que podem filtrar por base
  const canFilterByBase = userRole === "admin" || userRole === "supervisor" || userRole === "fa" || userRole === "kam";

  useEffect(() => {
    async function loadData() {
      // Se auth ainda carregando ou não tem usuário, finaliza loading
      if (authLoading) return;
      
      if (!user) {
        setIsLoading(false);
        setAvailableOrganizations([]);
        setViewableOrganizationIds([]);
        setUserRole(null);
        return;
      }

      setIsLoading(true);
      
      try {
        // 1. Buscar role do usuário
        const { data: roleData, error: roleError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();

        if (roleError) {
          console.error("Error fetching user role:", roleError);
        }
        
        const role = (roleData?.role as AppRole) || null;
        setUserRole(role);

        // 2. Buscar organizações visualizáveis
        const { data: viewableIds, error: viewableError } = await supabase.rpc(
          "get_viewable_organizations",
          { _user_id: user.id }
        );

        if (viewableError) {
          console.error("Error fetching viewable organizations:", viewableError);
          setViewableOrganizationIds([]);
          setAvailableOrganizations([]);
          setIsLoading(false);
          return;
        }

        const orgIds = (viewableIds as string[]) || [];
        setViewableOrganizationIds(orgIds);

        if (orgIds.length === 0) {
          setAvailableOrganizations([]);
          setIsLoading(false);
          return;
        }

        // 3. Buscar detalhes das organizações
        const { data: orgsData, error: orgsError } = await supabase
          .from("organizations")
          .select("id, name, slug, kam_id, logo_url")
          .in("id", orgIds)
          .order("name");

        if (orgsError) {
          console.error("Error fetching organizations:", orgsError);
          setAvailableOrganizations([]);
        } else {
          setAvailableOrganizations(orgsData || []);
          
          // Se só tem uma organização, seleciona automaticamente
          if (orgsData && orgsData.length === 1) {
            setSelectedOrganizationId(orgsData[0].id);
          }
        }
      } catch (error) {
        console.error("Error loading base filter data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [user, authLoading]);

  const selectedOrganization = availableOrganizations.find(
    org => org.id === selectedOrganizationId
  ) || null;

  // Helper para construir filtro de organização nas queries
  const getOrganizationFilter = (): { type: 'single' | 'multiple' | 'none'; ids: string[] } => {
    if (selectedOrganizationId) {
      return { type: 'single', ids: [selectedOrganizationId] };
    }
    
    if (viewableOrganizationIds.length > 0) {
      return { type: 'multiple', ids: viewableOrganizationIds };
    }
    
    return { type: 'none', ids: [] };
  };

  // Security: users who can filter need to select a base to create items
  // Clients only have one org, so they don't need to select
  const requiresBaseSelection = canFilterByBase && availableOrganizations.length > 1 && !selectedOrganizationId;
  
  // Get required organization ID for creation - returns null if base selection is required but not selected
  const getRequiredOrganizationId = (): string | null => {
    // If user has selected a specific organization, use it
    if (selectedOrganizationId) {
      return selectedOrganizationId;
    }
    
    // If user only has one organization available (typical for clients), use it
    if (availableOrganizations.length === 1) {
      return availableOrganizations[0].id;
    }
    
    // Multiple organizations available but none selected - return null (creation not allowed)
    return null;
  };

  return (
    <BaseFilterContext.Provider
      value={{
        selectedOrganizationId,
        setSelectedOrganizationId,
        availableOrganizations,
        viewableOrganizationIds,
        isLoading: authLoading || isLoading,
        canFilterByBase,
        selectedOrganization,
        userRole,
        getOrganizationFilter,
        requiresBaseSelection,
        getRequiredOrganizationId,
      }}
    >
      {children}
    </BaseFilterContext.Provider>
  );
}

export function useBaseFilter() {
  const context = useContext(BaseFilterContext);
  if (context === undefined) {
    throw new Error("useBaseFilter must be used within a BaseFilterProvider");
  }
  return context;
}
