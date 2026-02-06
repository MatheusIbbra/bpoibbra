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
  Plus,
  X
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppRole, ROLE_LABELS } from "@/hooks/useUserRoles";

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

  // Base access state
  const [userOrgs, setUserOrgs] = useState<UserOrg[]>([]);
  const [allOrgs, setAllOrgs] = useState<{ id: string; name: string }[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [addingOrg, setAddingOrg] = useState(false);
  const [removingOrgId, setRemovingOrgId] = useState<string | null>(null);
  const [selectedOrgToAdd, setSelectedOrgToAdd] = useState("");
  const [orgSearchQuery, setOrgSearchQuery] = useState("");

  useEffect(() => {
    if (user) {
      setEmail(user.email || "");
      setIsBlocked(user.is_blocked || false);
      setBlockedReason(user.blocked_reason || "");
    }
  }, [user]);

  // Fetch user's organizations and all organizations when dialog opens
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

  const handleAddOrg = async () => {
    if (!user || !selectedOrgToAdd) return;
    setAddingOrg(true);
    try {
      const { error } = await supabase
        .from("organization_members")
        .insert({
          user_id: user.id,
          organization_id: selectedOrgToAdd,
          role: (user.role as AppRole) || "user"
        });
      if (error) throw error;
      toast.success("Base adicionada com sucesso!");
      setSelectedOrgToAdd("");
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
  };

  const handleRemoveOrg = async (orgMemberId: string) => {
    setRemovingOrgId(orgMemberId);
    try {
      const { error } = await supabase
        .from("organization_members")
        .delete()
        .eq("id", orgMemberId);
      if (error) throw error;
      toast.success("Acesso à base removido!");
      fetchUserOrgs();
    } catch (error: any) {
      toast.error("Erro ao remover base: " + error.message);
    } finally {
      setRemovingOrgId(null);
    }
  };

  const availableOrgs = allOrgs.filter(o => !userOrgs.some(uo => uo.id === o.id));
  const filteredAvailableOrgs = availableOrgs.filter(o => 
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
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to update email');
      }

      toast.success("Email atualizado com sucesso!");
      onSuccess();
    } catch (error: unknown) {
      console.error("Error updating email:", error);
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
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to send reset email');
      }

      toast.success("Email de redefinição de senha enviado!");
    } catch (error: unknown) {
      console.error("Error resetting password:", error);
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
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to toggle block status');
      }

      setIsBlocked(newBlockedState);
      toast.success(newBlockedState ? "Usuário bloqueado!" : "Usuário desbloqueado!");
      onSuccess();
      onOpenChange(false);
    } catch (error: unknown) {
      console.error("Error toggling block:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro ao alterar status de bloqueio";
      toast.error(errorMessage);
    } finally {
      setIsTogglingBlock(false);
    }
  };

  if (!user) return null;

  const isClientRole = user.role === "cliente";
  const showBaseAccess = !isClientRole; // Bases for internal users only

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Editar Acesso
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* User Info */}
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{user.full_name || "Sem nome"}</p>
              <p className="text-sm text-muted-foreground truncate">{user.email}</p>
            </div>
            {user.role && (
              <Badge variant="outline">{ROLE_LABELS[user.role]}</Badge>
            )}
          </div>

          {/* Bases de Acesso Section - Only for internal users */}
          {showBaseAccess && (
            <>
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Bases de Acesso
                </Label>
                <p className="text-xs text-muted-foreground">
                  Configure quais bases (clientes) este usuário pode acessar.
                </p>

                {/* Current bases */}
                {loadingOrgs ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : userOrgs.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground border border-dashed rounded-lg">
                    <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhuma base vinculada</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {userOrgs.map((org) => (
                      <div
                        key={org.id}
                        className="flex items-center justify-between p-2 border rounded-lg bg-card"
                      >
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{org.name}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveOrg(org.org_member_id)}
                          disabled={removingOrgId === org.org_member_id}
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          {removingOrgId === org.org_member_id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <X className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add new base */}
                {availableOrgs.length > 0 && (
                  <div className="space-y-2">
                    <div className="relative">
                      <Input
                        placeholder="Pesquisar base pelo nome..."
                        value={orgSearchQuery}
                        onChange={(e) => setOrgSearchQuery(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Select
                        value={selectedOrgToAdd}
                        onValueChange={setSelectedOrgToAdd}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Selecionar base..." />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredAvailableOrgs.map((org) => (
                            <SelectItem key={org.id} value={org.id}>
                              {org.name}
                            </SelectItem>
                          ))}
                          {filteredAvailableOrgs.length === 0 && (
                            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                              Nenhuma base encontrada
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        onClick={handleAddOrg}
                        disabled={!selectedOrgToAdd || addingOrg}
                      >
                        {addingOrg ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <Separator />
            </>
          )}

          {/* Email Section */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email
            </Label>
            <div className="flex gap-2">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
              />
              <Button 
                onClick={handleUpdateEmail} 
                disabled={isUpdatingEmail || email === user.email}
                size="sm"
              >
                {isUpdatingEmail ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Salvar"
                )}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Password Reset Section */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              Senha
            </Label>
            <Button 
              variant="outline" 
              onClick={handleResetPassword}
              disabled={isResettingPassword}
              className="w-full"
            >
              {isResettingPassword ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Enviar Email de Redefinição
            </Button>
            <p className="text-xs text-muted-foreground">
              Um email será enviado para {user.email} com instruções para redefinir a senha.
            </p>
          </div>

          <Separator />

          {/* Block Access Section */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              {isBlocked ? <Lock className="h-4 w-4 text-destructive" /> : <Unlock className="h-4 w-4 text-primary" />}
              Bloquear Acesso do Usuário
            </Label>
            
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">
                  {isBlocked ? "Acesso Bloqueado" : "Acesso Liberado"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isBlocked 
                    ? "O usuário não conseguirá fazer login" 
                    : "O usuário pode acessar o sistema normalmente"}
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
                />
                <Button 
                  variant="destructive" 
                  onClick={handleToggleBlock}
                  disabled={isTogglingBlock}
                  className="w-full"
                >
                  {isTogglingBlock ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Lock className="h-4 w-4 mr-2" />
                  )}
                  {user.is_blocked ? "Desbloquear Usuário" : "Confirmar Bloqueio"}
                </Button>
              </div>
            )}

            {!isBlocked && user.is_blocked && (
              <Button 
                variant="outline" 
                onClick={handleToggleBlock}
                disabled={isTogglingBlock}
                className="w-full text-primary border-primary"
              >
                {isTogglingBlock ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Unlock className="h-4 w-4 mr-2" />
                )}
                Desbloquear Usuário
              </Button>
            )}

            {isClientRole && (
              <div className="flex items-start gap-2 p-3 bg-accent border border-border rounded-lg">
                <AlertTriangle className="h-4 w-4 text-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">Atenção:</strong> Bloquear o acesso do cliente NÃO bloqueia a base dele. 
                  O KAM e FA continuarão tendo acesso aos dados. Para bloquear a base, 
                  use a opção de bloqueio na aba "Gerenciar Clientes".
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
