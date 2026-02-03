import { Building2, ChevronDown, Users } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { useCurrentUserRole, ROLE_LABELS, AppRole } from "@/hooks/useUserRoles";

export function BaseSelector() {
  const {
    selectedOrganizationId,
    setSelectedOrganizationId,
    availableOrganizations,
    isLoading,
    canFilterByBase,
  } = useBaseFilter();
  
  const { data: userRole } = useCurrentUserRole();

  // Não mostrar se usuário é cliente (só vê sua própria base)
  if (!canFilterByBase) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-32" />
      </div>
    );
  }

  if (availableOrganizations.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-muted-foreground text-sm">
        <Building2 className="h-4 w-4" />
        <span>Nenhuma base disponível</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-muted/50 rounded-lg border">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="h-4 w-4" />
        <span className="hidden sm:inline">Visualizando:</span>
      </div>
      
      <Select
        value={selectedOrganizationId || "all"}
        onValueChange={(value) => setSelectedOrganizationId(value === "all" ? null : value)}
      >
        <SelectTrigger className="w-48 h-8 text-sm">
          <SelectValue placeholder="Selecione a base" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span>Todas as bases</span>
              <Badge variant="secondary" className="ml-2 text-xs">
                {availableOrganizations.length}
              </Badge>
            </div>
          </SelectItem>
          {availableOrganizations.map((org) => (
            <SelectItem key={org.id} value={org.id}>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                <span>{org.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {userRole && (
        <Badge variant="outline" className="text-xs hidden md:flex">
          {ROLE_LABELS[userRole as AppRole]}
        </Badge>
      )}
    </div>
  );
}
