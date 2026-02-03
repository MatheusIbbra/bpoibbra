import { useState } from "react";
import { Trash2, Loader2, AlertTriangle, Users, Shield, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AppRole, ROLE_LABELS } from "@/hooks/useUserRoles";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface UserToDelete {
  id: string;
  full_name: string | null;
  email: string;
  role: AppRole | null;
}

interface DeleteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserToDelete | null;
}

// Hook para buscar usuários do mesmo role
function useUsersByRole(role: AppRole | null, excludeUserId?: string) {
  return useQuery({
    queryKey: ["users-by-role-for-replacement", role, excludeUserId],
    queryFn: async () => {
      if (!role) return [];
      
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", role);

      if (rolesError) throw rolesError;
      if (!roles || roles.length === 0) return [];

      const userIds = roles.map(r => r.user_id).filter(id => id !== excludeUserId);
      if (userIds.length === 0) return [];

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      if (profilesError) throw profilesError;
      return profiles || [];
    },
    enabled: !!role && role !== "cliente", // Clients can't be deleted
  });
}

export function DeleteUserDialog({ open, onOpenChange, user }: DeleteUserDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [replacementUserId, setReplacementUserId] = useState<string>("");
  const queryClient = useQueryClient();

  // Get users of same role for replacement
  const { data: replacementUsers, isLoading: loadingReplacements } = useUsersByRole(
    user?.role || null,
    user?.id
  );

  if (!user) return null;

  const isClient = user.role === "cliente";
  const needsReplacement = user.role && user.role !== "admin" && user.role !== "cliente";

  const getReassignmentInfo = () => {
    switch (user.role) {
      case "supervisor":
        return "Todos os FAs supervisionados por este usuário serão transferidos para o substituto.";
      case "fa":
        return "Todos os KAMs supervisionados por este usuário serão transferidos para o substituto.";
      case "kam":
        return "Todos os clientes (bases) deste KAM serão transferidos para o substituto.";
      default:
        return "";
    }
  };

  const handleDelete = async () => {
    if (needsReplacement && !replacementUserId) {
      toast.error("Selecione um usuário substituto");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { 
          userIdToDelete: user.id, 
          replacementUserId: needsReplacement ? replacementUserId : null 
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["all-users-with-roles"] });
      queryClient.invalidateQueries({ queryKey: ["users-with-hierarchy"] });
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["viewable-organizations"] });

      toast.success("Usuário excluído e vínculos transferidos com sucesso!");
      onOpenChange(false);
      setReplacementUserId("");
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir usuário");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => {
      if (!o) setReplacementUserId("");
      onOpenChange(o);
    }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Excluir Usuário
          </DialogTitle>
          <DialogDescription>
            {user.full_name || user.email} - {user.role ? ROLE_LABELS[user.role] : "Sem perfil"}
          </DialogDescription>
        </DialogHeader>

        {isClient ? (
          <Alert variant="destructive">
            <Shield className="h-4 w-4" />
            <AlertTitle>Ação não permitida</AlertTitle>
            <AlertDescription>
              <p className="mt-2">
                <strong>Clientes não podem ser excluídos.</strong> A base do cliente é permanente.
              </p>
              <p className="mt-2">
                Para suspender o acesso, use a funcionalidade de <strong>Bloqueio de Organização</strong> na aba correspondente.
              </p>
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            <Alert variant="destructive" className="border-destructive/50 bg-destructive/5">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Atenção!</AlertTitle>
              <AlertDescription>
                Esta ação é <strong>irreversível</strong>. O usuário será permanentemente excluído do sistema.
              </AlertDescription>
            </Alert>

            {needsReplacement && (
              <div className="space-y-3 p-4 bg-warning/10 border border-warning/20 rounded-lg">
                <div className="flex items-center gap-2 text-warning font-medium">
                  <Users className="h-4 w-4" />
                  Reatribuição Obrigatória
                </div>
                
                <p className="text-sm text-muted-foreground">
                  {getReassignmentInfo()}
                </p>

                <div className="flex items-center gap-2 text-sm bg-background p-2 rounded">
                  <span className="font-medium">{user.full_name || user.email}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Novo responsável</span>
                </div>

                <div className="space-y-2">
                  <Label>Selecione o {ROLE_LABELS[user.role!]} substituto *</Label>
                  <Select
                    value={replacementUserId}
                    onValueChange={setReplacementUserId}
                    disabled={loadingReplacements}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={
                        loadingReplacements ? "Carregando..." : "Selecione um substituto"
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {replacementUsers?.map((u) => (
                        <SelectItem key={u.user_id} value={u.user_id}>
                          {u.full_name || `Usuário ${u.user_id.slice(0, 8)}`}
                        </SelectItem>
                      ))}
                      {(!replacementUsers || replacementUsers.length === 0) && !loadingReplacements && (
                        <div className="p-2 text-sm text-muted-foreground text-center">
                          Nenhum {ROLE_LABELS[user.role!]} disponível para substituição
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {user.role === "admin" && (
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  Administradores podem ser excluídos sem reatribuição, pois não possuem subordinados diretos na hierarquia.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {!isClient && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isLoading || (needsReplacement && !replacementUserId)}
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Excluir Usuário
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
