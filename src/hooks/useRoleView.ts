import { useCurrentUserRole, type AppRole } from "./useUserRoles";

const ASSESSOR_ROLES: AppRole[] = ["admin", "supervisor", "fa", "projetista", "kam"];
const CLIENT_ROLES: AppRole[] = ["cliente"];

export function useRoleView() {
  const { data: role, isLoading } = useCurrentUserRole();

  const isAssessor = !!role && ASSESSOR_ROLES.includes(role);
  const isClient = !role || CLIENT_ROLES.includes(role);

  return {
    role,
    isLoading,
    isAssessor,
    isClient,
    /** Assessor: dados completos, métricas técnicas, histórico comparativo */
    showDetailedMetrics: isAssessor,
    /** Assessor: comentários internos em transações */
    showInternalComments: isAssessor,
    /** Assessor: histórico comparativo entre períodos */
    showComparativeHistory: isAssessor,
    /** Cliente: linguagem executiva simplificada */
    useSimplifiedLanguage: isClient,
    /** Cliente: alertas claros sem jargão técnico */
    useSimplifiedAlerts: isClient,
  };
}
