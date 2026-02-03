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
  Mail, 
  KeyRound, 
  Lock, 
  Unlock, 
  Loader2, 
  AlertTriangle,
  User,
  Send
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

  useEffect(() => {
    if (user) {
      setEmail(user.email || "");
      setIsBlocked(user.is_blocked || false);
      setBlockedReason(user.blocked_reason || "");
    }
  }, [user]);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
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
