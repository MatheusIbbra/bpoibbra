import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Shield, 
  Users, 
  UserCheck, 
  Loader2, 
  User, 
  Briefcase, 
  Building2, 
  Info,
  Crown,
  Eye,
  CheckCircle2,
  XCircle,
  Plus,
  Settings,
  History,
  FileText,
  Trash2,
  Edit,
  GitBranch,
  Pencil,
  Mail,
  Lock,
  Unlock
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HierarchyManager } from "@/components/admin/HierarchyManager";
import { InviteUserDialog } from "@/components/admin/InviteUserDialog";
import { SettingsDialog } from "@/components/admin/SettingsDialog";
import { ClientManagementTab } from "@/components/admin/ClientManagementTab";
import { EditUserHierarchyDialog } from "@/components/admin/EditUserHierarchyDialog";
import { DeleteUserDialog } from "@/components/admin/DeleteUserDialog";
import { EditUserAccessDialog } from "@/components/admin/EditUserAccessDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AppLayout } from "@/components/layout/AppLayout";
import { 
  useIsAdmin, 
  useAllUsersWithRoles, 
  useAssignRole, 
  useRemoveRole, 
  AppRole,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
} from "@/hooks/useUserRoles";
import { useUserEmails } from "@/hooks/useUserEmails";
import { useAuth } from "@/contexts/AuthContext";
import { useAllAuditLogs, AuditLogEntry } from "@/hooks/useAuditLog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search } from "lucide-react";

const ROLE_ICONS: Record<AppRole, React.ReactNode> = {
  admin: <Crown className="h-4 w-4" />,
  supervisor: <Eye className="h-4 w-4" />,
  fa: <Briefcase className="h-4 w-4" />,
  kam: <Building2 className="h-4 w-4" />,
  projetista: <Briefcase className="h-4 w-4" />,
  cliente: <User className="h-4 w-4" />,
};

const ROLE_COLORS: Record<AppRole, string> = {
  admin: "bg-primary/10 text-primary border-primary/20",
  supervisor: "bg-purple-500/10 text-purple-600 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400",
  fa: "bg-blue-500/10 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400",
  kam: "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400",
  projetista: "bg-cyan-500/10 text-cyan-600 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-400",
  cliente: "bg-orange-500/10 text-orange-600 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400",
};

const ALL_ROLES: AppRole[] = ["admin", "supervisor", "fa", "kam", "projetista", "cliente"];

const PERMISSIONS_MATRIX = [
  { feature: "Configurações Globais", admin: true, supervisor: false, fa: false, kam: false, projetista: false, cliente: false },
  { feature: "Criar Organizações", admin: true, supervisor: false, fa: false, kam: false, projetista: false, cliente: false },
  { feature: "Gerenciar Usuários", admin: true, supervisor: true, fa: false, kam: false, projetista: false, cliente: false },
  { feature: "Validar Final IA", admin: true, supervisor: true, fa: false, kam: false, projetista: false, cliente: false },
  { feature: "Classificar Transações", admin: true, supervisor: true, fa: true, kam: false, projetista: true, cliente: false },
  { feature: "Aprovar/Rejeitar IA", admin: true, supervisor: true, fa: true, kam: false, projetista: true, cliente: false },
  { feature: "Alterar Dados Financeiros", admin: true, supervisor: true, fa: true, kam: false, projetista: true, cliente: false },
  { feature: "Visualizar Relatórios", admin: true, supervisor: true, fa: true, kam: true, projetista: true, cliente: true },
  { feature: "Acompanhar Metas", admin: true, supervisor: true, fa: true, kam: true, projetista: true, cliente: true },
  { feature: "Upload de Extratos", admin: true, supervisor: true, fa: true, kam: true, projetista: true, cliente: true },
];

function AccessDenied() {
  const navigate = useNavigate();
  
  return (
    <AppLayout title="Gerenciar Acessos">
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center">
          <Shield className="h-10 w-10 text-destructive" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">Acesso Restrito</h2>
          <p className="text-muted-foreground max-w-md">
            Você não tem permissão para acessar esta página. 
            Entre em contato com um administrador para solicitar acesso.
          </p>
        </div>
        <Button onClick={() => navigate("/")} size="lg">
          Voltar ao Início
        </Button>
      </div>
    </AppLayout>
  );
}

export default function Admin() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, isLoading: checkingAdmin } = useIsAdmin();
  const { data: users, isLoading: loadingUsers, refetch: refetchUsers } = useAllUsersWithRoles();
  const { data: userEmails } = useUserEmails();
  const { data: auditLogs, isLoading: loadingAudit } = useAllAuditLogs(100);
  const assignRole = useAssignRole();
  const removeRole = useRemoveRole();

  const [selectedRoleDetail, setSelectedRoleDetail] = useState<AppRole | null>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [editUserHierarchy, setEditUserHierarchy] = useState<{
    id: string;
    full_name: string | null;
    role: AppRole | null;
    supervisor_id: string | null;
  } | null>(null);
  const [deleteUser, setDeleteUser] = useState<{
    id: string;
    full_name: string | null;
    email: string;
    role: AppRole | null;
  } | null>(null);
  const [editUserAccess, setEditUserAccess] = useState<{
    id: string;
    full_name: string | null;
    email: string;
    role: AppRole | null;
    is_blocked?: boolean;
    blocked_reason?: string | null;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  if (checkingAdmin) {
    return (
      <AppLayout title="Gerenciar Acessos">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!isAdmin) {
    return <AccessDenied />;
  }

  const handleRoleChange = (userId: string, role: string) => {
    if (role === "none") {
      const userItem = users?.find(u => u.id === userId);
      if (userItem?.role_id) {
        removeRole.mutate(userItem.role_id);
      }
    } else {
      assignRole.mutate({ userId, role: role as AppRole });
    }
  };

  const getRoleCount = (role: AppRole) => users?.filter(u => u.role === role).length || 0;

  const getUsersByRole = (role: AppRole) => {
    if (!users) return [];
    return users.filter(u => u.role === role).filter(u => {
      if (!searchQuery) return true;
      const name = u.full_name?.toLowerCase() || "";
      const email = (userEmails?.[u.id] || "").toLowerCase();
      const query = searchQuery.toLowerCase();
      return name.includes(query) || email.includes(query);
    });
  };

  const getInitial = (name: string | null): string => {
    if (!name) return "U";
    return name.trim().charAt(0).toUpperCase();
  };

  const canEditHierarchy = (role: AppRole | null) => {
    return role === "fa" || role === "kam";
  };

  const canDeleteUser = (role: AppRole | null) => {
    return role !== "cliente"; // Clients cannot be deleted, only blocked
  };

  // Role-based user table component
  const UserRoleTable = ({ role }: { role: AppRole }) => {
    const roleUsers = getUsersByRole(role);
    const isClient = role === "cliente";

    return (
      <Card>
        <CardHeader className="border-b bg-muted/30">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${ROLE_COLORS[role]}`}>
                  {ROLE_ICONS[role]}
                </div>
                {ROLE_LABELS[role]}
              </CardTitle>
              <CardDescription>
                {roleUsers.length} {roleUsers.length === 1 ? "usuário" : "usuários"}
                {isClient && " • Clientes só podem ser bloqueados, nunca excluídos"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-40 sm:w-48"
                />
              </div>
              <Button onClick={() => setInviteDialogOpen(true)} size="sm">
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Convidar</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingUsers ? (
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
                    {role !== "cliente" && (
                      <TableHead>Alterar Perfil</TableHead>
                    )}
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roleUsers.map((userItem) => {
                    const email = userEmails?.[userItem.id] || "";
                    const isCurrentUser = userItem.id === user?.id;
                    
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
                            <span className="font-mono text-xs truncate max-w-[180px]">{email || "—"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden md:table-cell">
                          {format(new Date(userItem.created_at), "dd 'de' MMM, yyyy", { locale: ptBR })}
                        </TableCell>
                        
                        <TableCell>
                          {userItem.is_blocked ? (
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

                        {role !== "cliente" && (
                          <TableCell>
                            <Select
                              value={userItem.role || "none"}
                              onValueChange={(value) => handleRoleChange(userItem.id, value)}
                              disabled={assignRole.isPending || removeRole.isPending || isCurrentUser}
                            >
                              <SelectTrigger className="w-36 sm:w-44">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">
                                  <span className="text-muted-foreground">Sem perfil</span>
                                </SelectItem>
                                {ALL_ROLES.map((r) => (
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
                            {/* Edit Access Button */}
                            {!isCurrentUser && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditUserAccess({
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
                                onClick={() => setEditUserHierarchy({
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
                            
                            {!isCurrentUser && canDeleteUser(userItem.role) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setDeleteUser({
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

                            {isClient && (
                              <Badge variant="outline" className="text-xs hidden lg:flex">
                                Base permanente
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {roleUsers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={role !== "admin" && role !== "cliente" ? 6 : 5} className="text-center py-16 text-muted-foreground">
                        <div className={`h-12 w-12 rounded-xl mx-auto mb-4 flex items-center justify-center ${ROLE_COLORS[role]} opacity-50`}>
                          {ROLE_ICONS[role]}
                        </div>
                        <p className="font-medium">
                          {searchQuery ? "Nenhum usuário encontrado" : `Nenhum ${ROLE_LABELS[role]} cadastrado`}
                        </p>
                        <p className="text-sm">
                          {searchQuery ? "Tente outro termo de busca" : "Convide usuários para começar"}
                        </p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <AppLayout title="Gerenciar Acessos">
      <div className="space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
              <Shield className="h-6 w-6 sm:h-7 sm:w-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Administração</h1>
              <p className="text-muted-foreground text-sm sm:text-base">Gerencie acessos e permissões do sistema</p>
            </div>
          </div>
          <Button variant="outline" className="self-start sm:self-auto" onClick={() => setSettingsDialogOpen(true)}>
            <Settings className="mr-2 h-4 w-4" />
            Configurações
          </Button>
        </div>

        {/* Dialogs */}
        <InviteUserDialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen} />
        <SettingsDialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen} />
        <EditUserHierarchyDialog 
          open={!!editUserHierarchy} 
          onOpenChange={(open) => !open && setEditUserHierarchy(null)}
          user={editUserHierarchy}
        />
        <DeleteUserDialog
          open={!!deleteUser}
          onOpenChange={(open) => !open && setDeleteUser(null)}
          user={deleteUser}
        />
        <EditUserAccessDialog
          open={!!editUserAccess}
          onOpenChange={(open) => !open && setEditUserAccess(null)}
          user={editUserAccess}
          onSuccess={() => {
            setEditUserAccess(null);
            refetchUsers();
          }}
        />

        {/* Stats Cards */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {ALL_ROLES.map((role) => (
            <Card
              key={role}
              className={`cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 ${
                selectedRoleDetail === role ? "ring-2 ring-primary shadow-lg" : ""
              }`}
              onClick={() => setSelectedRoleDetail(selectedRoleDetail === role ? null : role)}
            >
              <CardContent className="pt-4 sm:pt-6 pb-4">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-xl flex items-center justify-center ${ROLE_COLORS[role]}`}>
                    {ROLE_ICONS[role]}
                  </div>
                  <span className="text-2xl sm:text-3xl font-bold">{getRoleCount(role)}</span>
                </div>
                <h3 className="font-semibold text-xs sm:text-sm truncate">{ROLE_LABELS[role]}</h3>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1 hidden sm:block">
                  {ROLE_DESCRIPTIONS[role][0]}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Role Details Dialog */}
        <Dialog open={!!selectedRoleDetail} onOpenChange={() => setSelectedRoleDetail(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                {selectedRoleDetail && (
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${ROLE_COLORS[selectedRoleDetail]}`}>
                    {ROLE_ICONS[selectedRoleDetail]}
                  </div>
                )}
                <span>{selectedRoleDetail && ROLE_LABELS[selectedRoleDetail]}</span>
              </DialogTitle>
              <DialogDescription>
                Permissões e responsabilidades deste perfil
              </DialogDescription>
            </DialogHeader>
            {selectedRoleDetail && (
              <div className="space-y-3 mt-4">
                {ROLE_DESCRIPTIONS[selectedRoleDetail].map((desc, i) => (
                  <div 
                    key={i} 
                    className={`flex items-start gap-3 p-3 rounded-lg ${
                      desc.startsWith("⛔") 
                        ? "bg-destructive/5 border border-destructive/20" 
                        : "bg-primary/5 border border-primary/20"
                    }`}
                  >
                    {desc.startsWith("⛔") ? (
                      <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    )}
                    <span className="text-sm">{desc.replace("⛔ ", "")}</span>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Main Content Tabs - Organized by Role */}
        <Tabs defaultValue="cliente" className="space-y-6">
          <TabsList className="bg-muted/50 flex-wrap h-auto gap-1 p-1 w-full justify-start overflow-x-auto">
            <TabsTrigger value="cliente" className="gap-1.5 text-xs sm:text-sm">
              <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>Clientes</span>
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{getRoleCount("cliente")}</Badge>
            </TabsTrigger>
            <TabsTrigger value="usuarios" className="gap-1.5 text-xs sm:text-sm">
              <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>Usuários</span>
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {getRoleCount("kam") + getRoleCount("fa") + getRoleCount("supervisor") + getRoleCount("projetista")}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="admin" className="gap-1.5 text-xs sm:text-sm">
              <Crown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>Admin</span>
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{getRoleCount("admin")}</Badge>
            </TabsTrigger>
            <TabsTrigger value="permissions" className="gap-1.5 text-xs sm:text-sm">
              <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Permissões</span>
              <span className="sm:hidden">Perm</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-1.5 text-xs sm:text-sm">
              <History className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Auditoria</span>
              <span className="sm:hidden">Aud</span>
            </TabsTrigger>
          </TabsList>

          {/* Client Tab - Special management */}
          <TabsContent value="cliente">
            <ClientManagementTab />
          </TabsContent>

          {/* Usuários Tab - Combined KAM, FA, Supervisor, Projetista */}
          <TabsContent value="usuarios">
            <Card>
              <CardHeader className="border-b bg-muted/30">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Usuários do Sistema
                    </CardTitle>
                    <CardDescription>
                      KAMs, FAs, Supervisores e Projetistas
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 w-40 sm:w-48"
                      />
                    </div>
                    <Button onClick={() => setInviteDialogOpen(true)} size="sm">
                      <Plus className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Convidar</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loadingUsers ? (
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
                          <TableHead>Alterar Perfil</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users
                          ?.filter(u => ["kam", "fa", "supervisor", "projetista"].includes(u.role || ""))
                          .filter(u => {
                            if (!searchQuery) return true;
                            const name = u.full_name?.toLowerCase() || "";
                            const email = (userEmails?.[u.id] || "").toLowerCase();
                            const query = searchQuery.toLowerCase();
                            return name.includes(query) || email.includes(query);
                          })
                          .map((userItem) => {
                            const email = userEmails?.[userItem.id] || "";
                            const isCurrentUser = userItem.id === user?.id;
                            const userRole = userItem.role as AppRole;
                            
                            return (
                              <TableRow key={userItem.id} className="group">
                                <TableCell>
                                  <div className="flex items-center gap-3">
                                    <Avatar className="h-9 w-9">
                                      <AvatarFallback className={`text-sm ${ROLE_COLORS[userRole]}`}>
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
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1.5 text-sm min-w-0">
                                    <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <span className="font-mono text-xs truncate max-w-[180px]">{email || "—"}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Select
                                    value={userItem.role || "none"}
                                    onValueChange={(value) => handleRoleChange(userItem.id, value)}
                                    disabled={assignRole.isPending || removeRole.isPending || userItem.id === user?.id}
                                  >
                                    <SelectTrigger className="w-40">
                                      <SelectValue placeholder="Selecionar" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">
                                        <span className="text-muted-foreground">Sem perfil</span>
                                      </SelectItem>
                                      {ALL_ROLES.map((r) => (
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
                                <TableCell>
                                  {userItem.is_blocked ? (
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
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    {!isCurrentUser && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setEditUserAccess({
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
                                    {!isCurrentUser && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                        onClick={() => setDeleteUser({
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
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        {users?.filter(u => ["kam", "fa", "supervisor", "projetista"].includes(u.role || "")).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-16 text-muted-foreground">
                              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                              <p className="font-medium">Nenhum usuário cadastrado</p>
                              <p className="text-sm">Convide usuários para começar</p>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Admin Tab */}
          <TabsContent value="admin">
            <UserRoleTable role="admin" />
          </TabsContent>

          {/* Permissions Matrix Tab */}
          <TabsContent value="permissions">
            <Card>
              <CardHeader className="border-b bg-muted/30">
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  Matriz de Permissões
                </CardTitle>
                <CardDescription>
                  Visão geral das permissões por perfil de acesso
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead className="w-[250px] font-semibold">Funcionalidade</TableHead>
                        {ALL_ROLES.map((role) => (
                          <TableHead key={role} className="text-center w-[80px]">
                            <div className="flex flex-col items-center gap-1">
                              <div className={`h-6 w-6 rounded-md flex items-center justify-center ${ROLE_COLORS[role]}`}>
                                {ROLE_ICONS[role]}
                              </div>
                              <span className="text-[10px] font-medium">{ROLE_LABELS[role].split(" ")[0]}</span>
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {PERMISSIONS_MATRIX.map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium text-xs">{row.feature}</TableCell>
                          <TableCell className="text-center">
                            {row.admin ? (
                              <CheckCircle2 className="h-4 w-4 text-primary mx-auto" />
                            ) : (
                              <XCircle className="h-4 w-4 text-muted-foreground/30 mx-auto" />
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {row.supervisor ? (
                              <CheckCircle2 className="h-4 w-4 text-primary mx-auto" />
                            ) : (
                              <XCircle className="h-4 w-4 text-muted-foreground/30 mx-auto" />
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {row.fa ? (
                              <CheckCircle2 className="h-4 w-4 text-primary mx-auto" />
                            ) : (
                              <XCircle className="h-4 w-4 text-muted-foreground/30 mx-auto" />
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {row.kam ? (
                              <CheckCircle2 className="h-4 w-4 text-primary mx-auto" />
                            ) : (
                              <XCircle className="h-4 w-4 text-muted-foreground/30 mx-auto" />
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {row.projetista ? (
                              <CheckCircle2 className="h-4 w-4 text-primary mx-auto" />
                            ) : (
                              <XCircle className="h-4 w-4 text-muted-foreground/30 mx-auto" />
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {row.cliente ? (
                              <CheckCircle2 className="h-4 w-4 text-primary mx-auto" />
                            ) : (
                              <XCircle className="h-4 w-4 text-muted-foreground/30 mx-auto" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Log Tab */}
          <TabsContent value="audit">
            <AuditLogTab logs={auditLogs || []} loading={loadingAudit} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

// Audit Log Component
function AuditLogTab({ logs, loading }: { logs: AuditLogEntry[]; loading: boolean }) {
  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case "create":
      case "insert":
        return <Plus className="h-4 w-4 text-primary" />;
      case "update":
      case "edit":
        return <Edit className="h-4 w-4 text-blue-500" />;
      case "delete":
      case "remove":
        return <Trash2 className="h-4 w-4 text-destructive" />;
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action.toLowerCase()) {
      case "create":
      case "insert":
        return "bg-primary/10 text-primary border-primary/20";
      case "update":
      case "edit":
        return "bg-blue-500/10 text-blue-600 border-blue-200";
      case "delete":
      case "remove":
        return "bg-destructive/10 text-destructive border-destructive/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const formatTableName = (name: string) => {
    const translations: Record<string, string> = {
      transactions: "Transações",
      accounts: "Contas",
      categories: "Categorias",
      cost_centers: "Centros de Custo",
      budgets: "Orçamentos",
      transfers: "Transferências",
      organizations: "Organizações",
      user_roles: "Permissões",
      profiles: "Perfis",
      import_batches: "Importações",
    };
    return translations[name] || name;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="border-b bg-muted/30">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Log de Auditoria
            </CardTitle>
            <CardDescription>
              Histórico de ações realizadas no sistema
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <History className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="font-medium">Nenhuma atividade registrada</p>
            <p className="text-sm text-muted-foreground">
              Ações dos usuários aparecerão aqui
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 hover:bg-muted/30 transition-colors">
                <div className={`mt-1 h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${getActionColor(log.action)}`}>
                  {getActionIcon(log.action)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">
                      {log.user_name || "Sistema"}
                    </span>
                    <Badge variant="outline" className={`text-xs ${getActionColor(log.action)}`}>
                      {log.action}
                    </Badge>
                    <span className="text-muted-foreground text-xs sm:text-sm">em</span>
                    <Badge variant="secondary" className="text-xs">
                      {formatTableName(log.table_name)}
                    </Badge>
                    {log.org_name && (
                      <>
                        <span className="text-muted-foreground hidden sm:inline">•</span>
                        <span className="text-xs text-muted-foreground hidden sm:inline">{log.org_name}</span>
                      </>
                    )}
                  </div>
                  {log.record_id && (
                    <p className="text-xs text-muted-foreground mt-1 font-mono">
                      ID: {log.record_id.slice(0, 8)}...
                    </p>
                  )}
                  {(log.old_values || log.new_values) && (
                    <div className="mt-2 text-xs space-y-1 hidden sm:block">
                      {log.old_values && Object.keys(log.old_values).length > 0 && (
                        <div className="flex items-start gap-2">
                          <span className="text-destructive font-medium shrink-0">Antes:</span>
                          <code className="text-muted-foreground bg-muted px-1.5 py-0.5 rounded break-all">
                            {JSON.stringify(log.old_values).slice(0, 80)}
                            {JSON.stringify(log.old_values).length > 80 && "..."}
                          </code>
                        </div>
                      )}
                      {log.new_values && Object.keys(log.new_values).length > 0 && (
                        <div className="flex items-start gap-2">
                          <span className="text-primary font-medium shrink-0">Depois:</span>
                          <code className="text-muted-foreground bg-muted px-1.5 py-0.5 rounded break-all">
                            {JSON.stringify(log.new_values).slice(0, 80)}
                            {JSON.stringify(log.new_values).length > 80 && "..."}
                          </code>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground shrink-0">
                  {format(new Date(log.created_at), "dd/MM HH:mm", { locale: ptBR })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
