import { useState } from "react";
import { 
  Users, 
  User, 
  Mail, 
  Loader2, 
  Plus, 
  Pencil, 
  Trash2,
  Building2,
  Lock,
  Unlock,
  Crown,
  Eye,
  Briefcase,
  Search,
  Settings
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AppRole, ROLE_LABELS, UserWithRole } from "@/hooks/useUserRoles";
import { EditUserAccessDialog } from "./EditUserAccessDialog";

const ROLE_ICONS: Record<AppRole, React.ReactNode> = {
  admin: <Crown className="h-4 w-4" />,
  supervisor: <Eye className="h-4 w-4" />,
  fa: <Briefcase className="h-4 w-4" />,
  kam: <Building2 className="h-4 w-4" />,
  cliente: <User className="h-4 w-4" />,
};

const ROLE_COLORS: Record<AppRole, string> = {
  admin: "bg-primary/10 text-primary border-primary/20",
  supervisor: "bg-purple-500/10 text-purple-600 border-purple-200",
  fa: "bg-blue-500/10 text-blue-600 border-blue-200",
  kam: "bg-green-500/10 text-green-600 border-green-200",
  cliente: "bg-orange-500/10 text-orange-600 border-orange-200",
};

export interface UserWithProfile extends UserWithRole {
  is_blocked?: boolean;
  blocked_reason?: string | null;
}

interface UsersByRoleTabProps {
  role: AppRole;
  users: UserWithProfile[];
  userEmails: Record<string, string>;
  currentUserId?: string;
  isLoading: boolean;
  kamUsers?: { user_id: string; full_name: string | null }[];
  organizations?: { id: string; name: string; kam_id: string | null }[];
  onInviteUser: () => void;
  onEditHierarchy: (user: { id: string; full_name: string | null; role: AppRole | null; supervisor_id: string | null }) => void;
  onDeleteUser: (user: { id: string; full_name: string | null; email: string; role: AppRole | null }) => void;
  onToggleBlock?: (orgId: string, block: boolean, reason?: string) => void;
  onAssignKam?: (orgId: string, kamId: string | null) => void;
  onChangeRole: (userId: string, newRole: string) => void;
  isChangingRole?: boolean;
  onRefresh?: () => void;
}

export function UsersByRoleTab({
  role,
  users,
  userEmails,
  currentUserId,
  isLoading,
  kamUsers = [],
  organizations = [],
  onInviteUser,
  onEditHierarchy,
  onDeleteUser,
  onToggleBlock,
  onAssignKam,
  onChangeRole,
  isChangingRole,
  onRefresh,
}: UsersByRoleTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingUser, setEditingUser] = useState<{
    id: string;
    full_name: string | null;
    email: string;
    role: AppRole | null;
    is_blocked?: boolean;
    blocked_reason?: string | null;
  } | null>(null);
  
  const filteredUsers = users.filter(u => {
    const name = u.full_name?.toLowerCase() || "";
    const email = (userEmails[u.id] || "").toLowerCase();
    const query = searchQuery.toLowerCase();
    return name.includes(query) || email.includes(query);
  });

  const getInitial = (name: string | null): string => {
    if (!name) return "U";
    return name.trim().charAt(0).toUpperCase();
  };

  const isClientRole = role === "cliente";

  // For clients, get their organization info
  const getClientOrganization = (userId: string) => {
    return organizations.find(org => {
      // This is a simplified approach - in reality, you'd need to check organization_members
      return true; // For now, we'll show all client-related info
    });
  };

  const getRoleDescription = () => {
    switch (role) {
      case "cliente":
        return "Gerencie clientes, bloqueio de acesso e vinculação a KAM";
      case "kam":
        return "Key Account Managers responsáveis pelo relacionamento com clientes";
      case "fa":
        return "Analistas Financeiros responsáveis por classificação de transações";
      case "supervisor":
        return "Supervisores que validam classificações e acompanham qualidade";
      case "admin":
        return "Administradores com acesso completo ao sistema";
      default:
        return "Usuários do sistema";
    }
  };

  const canEditHierarchy = (userRole: AppRole | null) => {
    if (!userRole) return false;
    return userRole === "fa" || userRole === "kam";
  };

  const canDelete = (userRole: AppRole | null) => {
    return userRole !== "cliente"; // Clientes não podem ser excluídos
  };

  return (
    <Card>
      <CardHeader className="border-b bg-muted/30">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              {ROLE_ICONS[role]}
              {ROLE_LABELS[role]}
            </CardTitle>
            <CardDescription>
              {filteredUsers.length} {filteredUsers.length === 1 ? "usuário" : "usuários"} • {getRoleDescription()}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-48"
              />
            </div>
            <Button onClick={onInviteUser} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Convidar</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="min-w-[200px]">Usuário</TableHead>
                  <TableHead className="min-w-[200px]">Email</TableHead>
                  <TableHead className="hidden md:table-cell">Cadastrado em</TableHead>
                  <TableHead>Status</TableHead>
                  {!isClientRole && role !== "admin" && (
                    <TableHead>Alterar Perfil</TableHead>
                  )}
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((userItem) => {
                  const email = userEmails[userItem.id] || "";
                  const isCurrentUser = userItem.id === currentUserId;
                  const userBlocked = userItem.is_blocked || false;
                  
                  return (
                    <TableRow key={userItem.id} className="group">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className={`text-sm ${ROLE_COLORS[role]}`}>
                              {getInitial(userItem.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium truncate">
                              {userItem.full_name || "Sem nome"}
                              {isCurrentUser && (
                                <Badge variant="outline" className="ml-2 text-xs">Você</Badge>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono hidden sm:block">
                              {userItem.id.slice(0, 8)}...
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm min-w-0">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="font-mono text-xs truncate">{email || "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden md:table-cell">
                        {format(new Date(userItem.created_at), "dd 'de' MMM, yyyy", { locale: ptBR })}
                      </TableCell>

                      <TableCell>
                        {userBlocked ? (
                          <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                            <Lock className="h-3 w-3" />
                            Bloqueado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="flex items-center gap-1 w-fit text-primary border-primary/30">
                            <Unlock className="h-3 w-3" />
                            Ativo
                          </Badge>
                        )}
                      </TableCell>

                      {!isClientRole && role !== "admin" && (
                        <TableCell>
                          <Select
                            value={userItem.role || "none"}
                            onValueChange={(value) => onChangeRole(userItem.id, value)}
                            disabled={isChangingRole || isCurrentUser}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="Selecionar perfil" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">
                                <span className="text-muted-foreground">Sem perfil</span>
                              </SelectItem>
                              {(["admin", "supervisor", "fa", "kam", "cliente"] as AppRole[]).map((r) => (
                                <SelectItem key={r} value={r}>
                                  <div className="flex items-center gap-2">
                                    {ROLE_ICONS[r]}
                                    {ROLE_LABELS[r]}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      )}

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Edit Access Button - for all roles */}
                          {!isCurrentUser && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingUser({
                                id: userItem.id,
                                full_name: userItem.full_name,
                                email: email,
                                role: userItem.role,
                                is_blocked: userItem.is_blocked,
                                blocked_reason: userItem.blocked_reason,
                              })}
                              title="Editar acesso"
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                          )}
                          
                          {canEditHierarchy(userItem.role) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onEditHierarchy({
                                id: userItem.id,
                                full_name: userItem.full_name,
                                role: userItem.role,
                                supervisor_id: null,
                              })}
                              title="Editar hierarquia"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          
                          {!isCurrentUser && canDelete(userItem.role) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => onDeleteUser({
                                id: userItem.id,
                                full_name: userItem.full_name,
                                email: email,
                                role: userItem.role,
                              })}
                              title="Excluir usuário"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}

                          {isClientRole && (
                            <span className="text-xs text-muted-foreground ml-2 hidden lg:inline">
                              Base permanente
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={!isClientRole && role !== "admin" ? 6 : 5} className="text-center py-16 text-muted-foreground">
                      <div className="flex flex-col items-center">
                        {ROLE_ICONS[role]}
                        <p className="font-medium mt-4">
                          {searchQuery ? "Nenhum usuário encontrado" : `Nenhum ${ROLE_LABELS[role]} cadastrado`}
                        </p>
                        <p className="text-sm">
                          {searchQuery ? "Tente outro termo de busca" : "Convide usuários para começar"}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Edit User Access Dialog */}
        <EditUserAccessDialog
          open={!!editingUser}
          onOpenChange={(open) => !open && setEditingUser(null)}
          user={editingUser}
          onSuccess={() => {
            setEditingUser(null);
            onRefresh?.();
          }}
        />
      </CardContent>
    </Card>
  );
}
