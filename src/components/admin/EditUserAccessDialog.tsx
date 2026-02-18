import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Mail, 
  KeyRound, 
  Lock, 
  Unlock, 
  Loader2, 
  AlertTriangle,
  User,
  Send,
  Building2,
  X,
  Search,
  Shield,
  Crown,
  Eye,
  Briefcase,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { AppRole, ROLE_LABELS } from "@/hooks/useUserRoles";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";

const ROLE_ICONS: Record<AppRole, React.ReactNode> = {
  admin: <Crown className="h-3.5 w-3.5" />,
  supervisor: <Eye className="h-3.5 w-3.5" />,
  fa: <Briefcase className="h-3.5 w-3.5" />,
  kam: <Building2 className="h-3.5 w-3.5" />,
  projetista: <Briefcase className="h-3.5 w-3.5" />,
  cliente: <User className="h-3.5 w-3.5" />,
};

interface UserToEdit {
  id: string;
  full_name: string | null;
  email: string;
  role: AppRole | null;
  is_blocked?: boolean;
  blocked_reason?: string | null;
}

interface UserOrg {
  id: string;
  name: string;
  org_member_id: string;
}

interface EditUserAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserToEdit | null;
  onSuccess: () => void;
}

export function EditUserAccessDialog({
  open,
  onOpenChange,
  user,
  onSuccess,
}: EditUserAccessDialogProps) {
  const [email, setEmail] = useState("");
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedReason, setBlockedReason] = useState("");
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isTogglingBlock, setIsTogglingBlock] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [isChangingRole, setIsChangingRole] = useState(false);

  // Base access state
  const [userOrgs, setUserOrgs] = useState<UserOrg[]>([]);
  const [allOrgs, setAllOrgs] = useState<{ id: string; name: string }[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [addingOrg, setAddingOrg] = useState(false);
  const [removingOrgId, setRemovingOrgId] = useState<string | null>(null);
  const [orgSearchQuery, setOrgSearchQuery] = useState("");

  useEffect(() => {
    if (user) {
      setEmail(user.email || "");
      setIsBlocked(user.is_blocked || false);
      setBlockedReason(user.blocked_reason || "");
      setSelectedRole(user.role || "");
    }
  }, [user]);

  useEffect(() => {
    if (user && open) {
      fetchUserOrgs();
      fetchAllOrgs();
    }
  }, [user?.id, open]);

  const fetchUserOrgs = async () => {
    if (!user) return;
    setLoadingOrgs(true);
    try {
      const { data: members } = await supabase
        .from("organization_members")
        .select("id, organization_id")
        .eq("user_id", user.id);

      if (members && members.length > 0) {
        const orgIds = members.map(m => m.organization_id);
        const { data: orgs } = await supabase
          .from("organizations")
          .select("id, name")
          .in("id", orgIds)
          .order("name");

        setUserOrgs((orgs || []).map(o => ({
          ...o,
          org_member_id: members.find(m => m.organization_id === o.id)!.id
        })));
      } else {
        setUserOrgs([]);
      }
    } catch (error) {
      console.error("Error fetching user orgs:", error);
    } finally {
      setLoadingOrgs(false);
    }
  };

  const fetchAllOrgs = async () => {
    try {
      const { data } = await supabase
        .from("organizations")
        .select("id, name")
        .order("name");
      setAllOrgs(data || []);
    } catch (error) {
      console.error("Error fetching all orgs:", error);
    }
  };

  const handleToggleOrg = async (orgId: string, isLinked: boolean) => {
    if (!user) return;

    if (isLinked) {
      // Remove
      const userOrg = userOrgs.find(o => o.id === orgId);
      if (!userOrg) return;
      setRemovingOrgId(orgId);
      try {
        const { error } = await supabase
          .from("organization_members")
          .delete()
          .eq("id", userOrg.org_member_id);
        if (error) throw error;
        toast.success("Acesso à base removido!");
        fetchUserOrgs();
      } catch (error: any) {
        toast.error("Erro ao remover base: " + error.message);
      } finally {
        setRemovingOrgId(null);
      }
    } else {
      // Add
      setAddingOrg(true);
      try {
        const { error } = await supabase
          .from("organization_members")
          .insert({
            user_id: user.id,
            organization_id: orgId,
            role: (user.role as AppRole) || "user"
          });
        if (error) throw error;
        toast.success("Base adicionada com sucesso!");
        fetchUserOrgs();
      } catch (error: any) {
        if (error.code === '23505') {
          toast.error("Usuário já tem acesso a esta base");
        } else {
          toast.error("Erro ao adicionar base: " + error.message);
        }
      } finally {
        setAddingOrg(false);
      }
    }
  };

  const filteredOrgs = allOrgs.filter(o =>
    !orgSearchQuery || o.name.toLowerCase().includes(orgSearchQuery.toLowerCase())
  );

  const handleUpdateEmail = async () => {
    if (!user || !email.trim()) return;
    setIsUpdatingEmail(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `https://umqehhhpedwqdfjmdjqv.supabase.co/functions/v1/manage-user-access`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            action: 'update_email',
            userId: user.id,
            email: email.trim(),
          }),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to update email');
      toast.success("Email atualizado com sucesso!");
      onSuccess();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro ao atualizar email";
      toast.error(errorMessage);
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  const handleResetPassword = async () => {
    if (!user) return;
    setIsResettingPassword(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `https://umqehhhpedwqdfjmdjqv.supabase.co/functions/v1/manage-user-access`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            action: 'reset_password',
            userId: user.id,
          }),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to send reset email');
      toast.success("Email de redefinição de senha enviado!");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro ao enviar email de redefinição";
      toast.error(errorMessage);
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleToggleBlock = async () => {
    if (!user) return;
    const newBlockedState = !user.is_blocked;
    setIsTogglingBlock(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `https://umqehhhpedwqdfjmdjqv.supabase.co/functions/v1/manage-user-access`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            action: 'toggle_block',
            userId: user.id,
            blocked: newBlockedState,
            blockedReason: newBlockedState ? blockedReason : null,
          }),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to toggle block status');
      setIsBlocked(newBlockedState);
      await logAudit(
        newBlockedState ? "block_user" : "unblock_user",
        "profiles",
        user.id,
        { is_blocked: !newBlockedState },
        { is_blocked: newBlockedState, blocked_reason: newBlockedState ? blockedReason : null }
      );
      toast.success(newBlockedState ? "Usuário bloqueado!" : "Usuário desbloqueado!");
      onSuccess();
      onOpenChange(false);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro ao alterar status de bloqueio";
      toast.error(errorMessage);
    } finally {
      setIsTogglingBlock(false);
    }
  };

  const handleChangeRole = async () => {
    if (!user || !selectedRole || selectedRole === user.role) return;
    setIsChangingRole(true);
    try {
      if (selectedRole === "none") {
        // Remove role
        const { data: existingRole } = await supabase
          .from("user_roles")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (existingRole) {
          const { error } = await supabase
            .from("user_roles")
            .delete()
            .eq("id", existingRole.id);
          if (error) throw error;
        }
      } else {
        const { data: existingRole } = await supabase
          .from("user_roles")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (existingRole) {
          const { error } = await supabase
            .from("user_roles")
            .update({ role: selectedRole as any })
            .eq("id", existingRole.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("user_roles")
            .insert({ user_id: user.id, role: selectedRole as any });
          if (error) throw error;
        }
      }
      await logAudit("change_role", "user_roles", user.id, { role: user.role }, { role: selectedRole });
      toast.success("Perfil atualizado com sucesso!");
      onSuccess();
    } catch (error: any) {
      toast.error("Erro ao alterar perfil: " + error.message);
    } finally {
      setIsChangingRole(false);
    }
  };

  if (!user) return null;

  const isClientRole = user.role === "cliente";
  const showBaseAccess = !isClientRole;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            Editar Acesso
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* User Info - Compact */}
          <div className="flex items-center gap-3 p-2.5 bg-muted/50 rounded-lg">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{user.full_name || "Sem nome"}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
            {user.role && (
              <Badge variant="outline" className="text-xs shrink-0">{ROLE_LABELS[user.role]}</Badge>
            )}
          </div>

          {/* Role Change Section */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-xs font-medium">
              <Shield className="h-3.5 w-3.5" />
              Perfil de Acesso
            </Label>
            <div className="flex gap-2">
              <Select value={selectedRole || "none"} onValueChange={setSelectedRole}>
                <SelectTrigger className="flex-1 h-9 text-sm">
                  <SelectValue placeholder="Selecionar perfil" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-muted-foreground">Sem perfil</span>
                  </SelectItem>
                  {(["admin", "supervisor", "fa", "kam", "projetista", "cliente"] as AppRole[]).map((r) => (
                    <SelectItem key={r} value={r}>
                      <div className="flex items-center gap-2">
                        {ROLE_ICONS[r]}
                        {ROLE_LABELS[r]}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="h-9"
                onClick={handleChangeRole}
                disabled={isChangingRole || selectedRole === (user.role || "none")}
              >
                {isChangingRole ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Bases de Acesso Section */}
          {showBaseAccess && (
            <>
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-xs font-medium">
                  <Building2 className="h-3.5 w-3.5" />
                  Bases de Acesso
                  <Badge variant="secondary" className="text-[10px] ml-1">
                    {userOrgs.length} vinculada{userOrgs.length !== 1 ? "s" : ""}
                  </Badge>
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Usuário só acessa bases vinculadas. Sem base = sem acesso.
                </p>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar base..."
                    value={orgSearchQuery}
                    onChange={(e) => setOrgSearchQuery(e.target.value)}
                    className="pl-8 h-8 text-sm"
                  />
                </div>

                {/* Organization list with checkboxes */}
                {loadingOrgs ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <ScrollArea className="h-[180px] rounded-md border">
                    <div className="p-1.5 space-y-0.5">
                      {filteredOrgs.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">
                          Nenhuma base encontrada
                        </p>
                      ) : (
                        filteredOrgs.map((org) => {
                          const isLinked = userOrgs.some(uo => uo.id === org.id);
                          const isProcessing = removingOrgId === org.id || (addingOrg && !isLinked);
                          return (
                            <label
                              key={org.id}
                              className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                            >
                              <Checkbox
                                checked={isLinked}
                                onCheckedChange={() => handleToggleOrg(org.id, isLinked)}
                                disabled={isProcessing}
                                className="h-4 w-4"
                              />
                              <span className="text-sm flex-1 truncate">{org.name}</span>
                              {isLinked && (
                                <Badge variant="outline" className="text-[10px] h-4 px-1 shrink-0">
                                  Vinculada
                                </Badge>
                              )}
                            </label>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                )}
              </div>

              <Separator />
            </>
          )}

          {/* Email Section - Compact */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-xs font-medium">
              <Mail className="h-3.5 w-3.5" />
              Email
            </Label>
            <div className="flex gap-2">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className="h-8 text-sm"
              />
              <Button 
                onClick={handleUpdateEmail} 
                disabled={isUpdatingEmail || email === user.email}
                size="sm"
                className="h-8"
              >
                {isUpdatingEmail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Salvar"}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Password Reset - Compact */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-xs font-medium">
              <KeyRound className="h-3.5 w-3.5" />
              Senha
            </Label>
            <Button 
              variant="outline" 
              onClick={handleResetPassword}
              disabled={isResettingPassword}
              className="w-full h-8 text-sm"
              size="sm"
            >
              {isResettingPassword ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
              ) : (
                <Send className="h-3.5 w-3.5 mr-2" />
              )}
              Enviar Email de Redefinição
            </Button>
          </div>

          <Separator />

          {/* Block Access Section - Compact */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-xs font-medium">
              {isBlocked ? <Lock className="h-3.5 w-3.5 text-destructive" /> : <Unlock className="h-3.5 w-3.5 text-primary" />}
              Bloquear Acesso
            </Label>
            
            <div className="flex items-center justify-between p-2.5 border rounded-lg">
              <div className="space-y-0.5">
                <p className="text-xs font-medium">
                  {isBlocked ? "Acesso Bloqueado" : "Acesso Liberado"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {isBlocked ? "Não conseguirá fazer login" : "Acesso normal"}
                </p>
              </div>
              <Switch
                checked={isBlocked}
                onCheckedChange={(checked) => setIsBlocked(checked)}
                disabled={isTogglingBlock}
              />
            </div>

            {isBlocked && (
              <div className="space-y-2">
                <Textarea
                  value={blockedReason}
                  onChange={(e) => setBlockedReason(e.target.value)}
                  placeholder="Motivo do bloqueio (ex: Inadimplência)"
                  rows={2}
                  className="text-sm"
                />
                <Button 
                  variant="destructive" 
                  onClick={handleToggleBlock}
                  disabled={isTogglingBlock}
                  className="w-full h-8 text-sm"
                  size="sm"
                >
                  {isTogglingBlock ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                  ) : (
                    <Lock className="h-3.5 w-3.5 mr-2" />
                  )}
                  {user.is_blocked ? "Desbloquear" : "Confirmar Bloqueio"}
                </Button>
              </div>
            )}

            {!isBlocked && user.is_blocked && (
              <Button 
                variant="outline" 
                onClick={handleToggleBlock}
                disabled={isTogglingBlock}
                className="w-full h-8 text-sm text-primary border-primary"
                size="sm"
              >
                {isTogglingBlock ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                ) : (
                  <Unlock className="h-3.5 w-3.5 mr-2" />
                )}
                Desbloquear Usuário
              </Button>
            )}

            {isClientRole && (
              <div className="flex items-start gap-2 p-2 bg-accent border border-border rounded-lg">
                <AlertTriangle className="h-3.5 w-3.5 text-foreground shrink-0 mt-0.5" />
                <p className="text-[11px] text-muted-foreground">
                  <strong className="text-foreground">Atenção:</strong> Bloquear acesso do cliente NÃO bloqueia a base. 
                  KAM e FA continuam com acesso.
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
