import { createContext, useContext, useState, useCallback, useMemo, ReactNode, useEffect } from "react";
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

// ── State context (re-renders when data changes) ──
interface BaseFilterStateContextType {
  selectedOrganizationId: string | null;
  availableOrganizations: Organization[];
  viewableOrganizationIds: string[];
  isLoading: boolean;
  canFilterByBase: boolean;
  selectedOrganization: Organization | null;
  userRole: AppRole | null;
  requiresBaseSelection: boolean;
}

// ── Actions context (stable references, never triggers re-render) ──
interface BaseFilterActionsContextType {
  setSelectedOrganizationId: (id: string | null) => void;
  getOrganizationFilter: () => { type: 'single' | 'multiple' | 'none'; ids: string[] };
  getRequiredOrganizationId: () => string | null;
  refreshOrganizations: () => void;
}

// Combined type for backward compatibility
interface BaseFilterContextType extends BaseFilterStateContextType, BaseFilterActionsContextType {}

const BaseFilterStateContext = createContext<BaseFilterStateContextType | undefined>(undefined);
const BaseFilterActionsContext = createContext<BaseFilterActionsContextType | undefined>(undefined);

export function BaseFilterProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);
  const [availableOrganizations, setAvailableOrganizations] = useState<Organization[]>([]);
  const [viewableOrganizationIds, setViewableOrganizationIds] = useState<string[]>([]);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refreshOrganizations = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  const canFilterByBase = userRole === "admin" || userRole === "supervisor" || userRole === "fa" || userRole === "kam";

  useEffect(() => {
    async function loadData() {
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
  }, [user, authLoading, refreshKey]);

  const selectedOrganization = useMemo(
    () => availableOrganizations.find(org => org.id === selectedOrganizationId) || null,
    [availableOrganizations, selectedOrganizationId]
  );

  const requiresBaseSelection = canFilterByBase && availableOrganizations.length > 1 && !selectedOrganizationId;

  // ── Memoized state value ──
  const stateValue = useMemo<BaseFilterStateContextType>(() => ({
    selectedOrganizationId,
    availableOrganizations,
    viewableOrganizationIds,
    isLoading: authLoading || isLoading,
    canFilterByBase,
    selectedOrganization,
    userRole,
    requiresBaseSelection,
  }), [
    selectedOrganizationId,
    availableOrganizations,
    viewableOrganizationIds,
    authLoading,
    isLoading,
    canFilterByBase,
    selectedOrganization,
    userRole,
    requiresBaseSelection,
  ]);

  // ── Stable actions (useCallback ensures referential stability) ──
  const getOrganizationFilter = useCallback((): { type: 'single' | 'multiple' | 'none'; ids: string[] } => {
    if (selectedOrganizationId) {
      return { type: 'single', ids: [selectedOrganizationId] };
    }
    if (viewableOrganizationIds.length > 0) {
      return { type: 'multiple', ids: viewableOrganizationIds };
    }
    return { type: 'none', ids: [] };
  }, [selectedOrganizationId, viewableOrganizationIds]);

  const getRequiredOrganizationId = useCallback((): string | null => {
    if (selectedOrganizationId) return selectedOrganizationId;
    if (availableOrganizations.length === 1) return availableOrganizations[0].id;
    return null;
  }, [selectedOrganizationId, availableOrganizations]);

  const actionsValue = useMemo<BaseFilterActionsContextType>(() => ({
    setSelectedOrganizationId,
    getOrganizationFilter,
    getRequiredOrganizationId,
    refreshOrganizations,
  }), [getOrganizationFilter, getRequiredOrganizationId, refreshOrganizations]);

  return (
    <BaseFilterStateContext.Provider value={stateValue}>
      <BaseFilterActionsContext.Provider value={actionsValue}>
        {children}
      </BaseFilterActionsContext.Provider>
    </BaseFilterStateContext.Provider>
  );
}

/** Read only state values — re-renders when filter state changes */
export function useBaseFilterState() {
  const context = useContext(BaseFilterStateContext);
  if (context === undefined) {
    throw new Error("useBaseFilterState must be used within a BaseFilterProvider");
  }
  return context;
}

/** Read only actions — stable references, won't cause re-renders */
export function useBaseFilterActions() {
  const context = useContext(BaseFilterActionsContext);
  if (context === undefined) {
    throw new Error("useBaseFilterActions must be used within a BaseFilterProvider");
  }
  return context;
}

/**
 * Backward-compatible hook — returns both state and actions.
 * Prefer useBaseFilterState or useBaseFilterActions for better performance.
 */
export function useBaseFilter(): BaseFilterContextType {
  const state = useBaseFilterState();
  const actions = useBaseFilterActions();
  return { ...state, ...actions };
}
