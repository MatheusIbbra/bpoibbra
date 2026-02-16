import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, GitBranch } from "lucide-react";
import { useUsersWithHierarchy, useSetSupervisor } from "@/hooks/useUserHierarchy";
import { ROLE_LABELS, AppRole } from "@/hooks/useUserRoles";

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  supervisor: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  fa: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  kam: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  cliente: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
};

// Define quem pode supervisionar quem - seguindo a hierarquia obrigatória
// Admin → Supervisor → Projetista → FA → KAM
const SUPERVISION_RULES: Record<string, string[]> = {
  admin: [], // Admin não tem supervisor
  supervisor: ["admin"], // Supervisor pode ser supervisionado por Admin
  projetista: ["supervisor", "admin"], // Projetista supervisionado por Supervisor (ou Admin)
  fa: ["projetista", "supervisor", "admin"], // FA supervisionado por Projetista (ou níveis acima)
  kam: ["fa", "projetista", "supervisor", "admin"], // KAM supervisionado por FA (ou níveis acima)
  cliente: [], // Cliente não usa hierarquia - usa kam_id da organização
};

export function HierarchyManager() {
  const { data: users, isLoading } = useUsersWithHierarchy();
  const setSupervisor = useSetSupervisor();

  const handleSupervisorChange = (userId: string, supervisorId: string) => {
    setSupervisor.mutate({
      userId,
      supervisorId: supervisorId === "none" ? null : supervisorId,
    });
  };

  // Get potential supervisors for a user based on their role
  const getPotentialSupervisors = (userRole: string | null) => {
    if (!userRole || !users) return [];
    
    const allowedRoles = SUPERVISION_RULES[userRole] || [];
    return users.filter(u => u.role && allowedRoles.includes(u.role));
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Filtrar apenas usuários que usam hierarquia (não clientes)
  const usersWithHierarchy = users?.filter(u => u.role && u.role !== "cliente") || [];

  // Verificar usuários com vínculos obrigatórios faltando
  const getMissingLink = (userRole: string | null, hasSupervisor: boolean) => {
    if (!userRole) return null;
    if (userRole === "projetista" && !hasSupervisor) return "Projetista deve ter um Supervisor";
    if (userRole === "fa" && !hasSupervisor) return "FA deve ter um Projetista ou Supervisor";
    if (userRole === "kam" && !hasSupervisor) return "KAM deve ter um FA";
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="h-5 w-5" />
          Hierarquia de Supervisão
        </CardTitle>
        <CardDescription>
          Defina quem supervisiona cada usuário. Hierarquia: Admin → Supervisor → Projetista → FA → KAM.
          <br />
          <strong>Clientes são vinculados via KAM da organização na aba "Clientes".</strong>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>Supervisor Atual</TableHead>
              <TableHead>Alterar Supervisor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usersWithHierarchy.map((user) => {
              const potentialSupervisors = getPotentialSupervisors(user.role);
              const isAdmin = user.role === "admin";
              const isSupervisor = user.role === "supervisor";
              const missingLink = getMissingLink(user.role, !!user.supervisor_id);

              return (
                <TableRow key={user.user_id} className={missingLink ? "bg-destructive/5" : ""}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      {user.full_name || `Usuário ${user.user_id.slice(0, 8)}...`}
                      {missingLink && (
                        <span className="text-xs text-destructive font-normal">⚠️</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {user.role ? (
                      <Badge className={ROLE_COLORS[user.role] || ""}>
                        {ROLE_LABELS[user.role as AppRole] || user.role}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Sem perfil</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {user.supervisor_name ? (
                      <span className="text-sm">{user.supervisor_name}</span>
                    ) : (
                      <span className={`text-sm ${missingLink ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                        {isAdmin ? "N/A (Admin)" : isSupervisor ? "Opcional" : missingLink || "Nenhum"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {isAdmin ? (
                      <span className="text-muted-foreground text-sm">
                        Admin não possui supervisor
                      </span>
                    ) : potentialSupervisors.length === 0 ? (
                      <span className="text-muted-foreground text-sm">
                        Defina um perfil primeiro
                      </span>
                    ) : (
                      <Select
                        value={user.supervisor_id || "none"}
                        onValueChange={(value) => handleSupervisorChange(user.user_id, value)}
                        disabled={setSupervisor.isPending}
                      >
                        <SelectTrigger className={`w-48 ${missingLink ? "border-destructive" : ""}`}>
                          <SelectValue placeholder="Selecionar supervisor" />
                        </SelectTrigger>
                        <SelectContent>
                          {isSupervisor && <SelectItem value="none">Nenhum</SelectItem>}
                          {potentialSupervisors.map((supervisor) => (
                            <SelectItem key={supervisor.user_id} value={supervisor.user_id}>
                              {supervisor.full_name || `Usuário ${supervisor.user_id.slice(0, 8)}`}
                              {supervisor.role && ` (${ROLE_LABELS[supervisor.role as AppRole] || supervisor.role})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {usersWithHierarchy.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum usuário com perfil de hierarquia encontrado</p>
            <p className="text-sm">Crie usuários com perfil Supervisor, FA ou KAM</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
