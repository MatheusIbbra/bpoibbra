import { useState, useEffect } from "react";
import { Edit, Users, Loader2, Building2, Save, AlertTriangle } from "lucide-react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AppRole, ROLE_LABELS } from "@/hooks/useUserRoles";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface UserToEdit {
  id: string;
  full_name: string | null;
  role: AppRole | null;
  supervisor_id: string | null;
}

interface EditUserHierarchyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserToEdit | null;
}

// Hook para buscar usuários por role
function useUsersByRole(role: AppRole | null) {
  return useQuery({
    queryKey: ["users-by-role", role],
    queryFn: async () => {
      if (!role) return [];
      
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", role);

      if (rolesError) throw rolesError;
      if (!roles || roles.length === 0) return [];

      const userIds = roles.map(r => r.user_id);

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      if (profilesError) throw profilesError;
      return profiles || [];
    },
    enabled: !!role,
  });
}

export function EditUserHierarchyDialog({ open, onOpenChange, user }: EditUserHierarchyDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string>("");
  const queryClient = useQueryClient();

  // Buscar usuários de cada nível
  const { data: supervisorUsers } = useUsersByRole("supervisor");
  const { data: faUsers } = useUsersByRole("fa");
  const { data: adminUsers } = useUsersByRole("admin");

  // Reset quando usuário mudar
  useEffect(() => {
    if (user) {
      setSelectedSupervisorId(user.supervisor_id || "");
    }
  }, [user]);

  if (!user) return null;

  // Determinar quem pode ser supervisor baseado no role
  const getPossibleSupervisors = () => {
    switch (user.role) {
      case "fa":
        // FA pode ter Admin ou Supervisor
        return [...(adminUsers || []), ...(supervisorUsers || [])];
      case "kam":
        // KAM pode ter Admin, Supervisor ou FA
        return [...(adminUsers || []), ...(supervisorUsers || []), ...(faUsers || [])];
      default:
        return [];
    }
  };

  const possibleSupervisors = getPossibleSupervisors().filter(s => s.user_id !== user.id);

  const handleSave = async () => {
    // Validar obrigatoriedade
    if ((user.role === "fa" || user.role === "kam") && !selectedSupervisorId) {
      toast.error(`${user.role === "fa" ? "FA" : "KAM"} deve ter um supervisor obrigatório`);
      return;
    }

    setIsLoading(true);
    try {
      // Atualizar hierarquia
      const { data: existing } = await supabase
        .from("user_hierarchy")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("user_hierarchy")
          .update({ supervisor_id: selectedSupervisorId || null })
          .eq("id", existing.id);
      } else if (selectedSupervisorId) {
        await supabase
          .from("user_hierarchy")
          .insert({ user_id: user.id, supervisor_id: selectedSupervisorId });
      }

      // Invalidar queries para atualizar acessos
      queryClient.invalidateQueries({ queryKey: ["users-with-hierarchy"] });
      queryClient.invalidateQueries({ queryKey: ["viewable-organizations"] });
      queryClient.invalidateQueries({ queryKey: ["all-users-with-roles"] });

      toast.success("Hierarquia atualizada! Os acessos foram recalculados automaticamente.");
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Erro ao atualizar hierarquia: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getSupervisorLabel = () => {
    switch (user.role) {
      case "fa":
        return "Supervisor Responsável";
      case "kam":
        return "FA Responsável";
      default:
        return "Supervisor";
    }
  };

  const showHierarchyEdit = user.role === "fa" || user.role === "kam";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Editar Hierarquia
          </DialogTitle>
          <DialogDescription>
            {user.full_name || "Usuário"} - {user.role ? ROLE_LABELS[user.role] : "Sem perfil"}
          </DialogDescription>
        </DialogHeader>

        {!showHierarchyEdit ? (
          <div className="py-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {user.role === "admin" 
                  ? "Administradores não possuem supervisor na hierarquia."
                  : user.role === "supervisor"
                  ? "Supervisores são supervisionados apenas por Admins e não precisam de vínculo obrigatório."
                  : user.role === "cliente"
                  ? "Clientes são vinculados via KAM da organização. Edite a organização para alterar o KAM."
                  : "Este usuário não possui um perfil definido."}
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <div className="space-y-4">
            <Alert variant="default" className="bg-warning/10 border-warning/20">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <AlertDescription className="text-sm">
                <strong>Atenção:</strong> Alterar a hierarquia irá recalcular automaticamente todos os acessos. 
                O supervisor anterior perderá acesso aos clientes deste usuário.
              </AlertDescription>
            </Alert>

            <div className="space-y-2 p-3 bg-muted/50 rounded-lg border">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                {getSupervisorLabel()} *
              </Label>
              <Select
                value={selectedSupervisorId}
                onValueChange={setSelectedSupervisorId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {possibleSupervisors.map((sup) => (
                    <SelectItem key={sup.user_id} value={sup.user_id}>
                      {sup.full_name || `Usuário ${sup.user_id.slice(0, 8)}`}
                    </SelectItem>
                  ))}
                  {possibleSupervisors.length === 0 && (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      Nenhum supervisor disponível
                    </div>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {user.role === "fa" 
                  ? "O Supervisor terá acesso a todos os clientes dos KAMs que este FA gerencia."
                  : "O FA terá acesso a todos os clientes deste KAM."}
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {showHierarchyEdit && (
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Salvar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
