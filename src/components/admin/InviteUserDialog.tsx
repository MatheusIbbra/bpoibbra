import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Mail, UserPlus, Loader2, Copy, Check, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AppRole, ROLE_LABELS } from "@/hooks/useUserRoles";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const inviteSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  fullName: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  role: z.string().min(1, "Selecione um perfil"),
  supervisorId: z.string().optional(), // Para FA: seleciona Supervisor
  faId: z.string().optional(), // Para KAM: seleciona FA
  kamId: z.string().optional(), // Para Cliente: seleciona KAM
});

type InviteFormData = z.infer<typeof inviteSchema>;

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ALL_ROLES: AppRole[] = ["admin", "supervisor", "fa", "kam", "cliente"];

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

export function InviteUserDialog({ open, onOpenChange }: InviteUserDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [createdUser, setCreatedUser] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  // Buscar usuários de cada nível
  const { data: supervisorUsers, isLoading: loadingSupervisors } = useUsersByRole("supervisor");
  const { data: faUsers, isLoading: loadingFAs } = useUsersByRole("fa");
  const { data: kamUsers, isLoading: loadingKams } = useUsersByRole("kam");
  
  // Também incluir admins como supervisores possíveis
  const { data: adminUsers } = useUsersByRole("admin");

  const form = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: "",
      password: "",
      fullName: "",
      role: "cliente",
      supervisorId: "",
      faId: "",
      kamId: "",
    },
  });

  const selectedRole = form.watch("role");

  // Resetar campos quando mudar de role
  useEffect(() => {
    form.setValue("supervisorId", "");
    form.setValue("faId", "");
    form.setValue("kamId", "");
  }, [selectedRole, form]);

  // Determinar qual seleção é obrigatória
  const needsSupervisor = selectedRole === "fa";
  const needsFA = selectedRole === "kam";
  const needsKam = selectedRole === "cliente";

  // Combinar admins e supervisors para FA
  const possibleSupervisors = [
    ...(adminUsers || []),
    ...(supervisorUsers || []),
  ];

  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    form.setValue("password", password);
  };

  const onSubmit = async (data: InviteFormData) => {
    // Validações obrigatórias
    if (needsSupervisor && !data.supervisorId) {
      toast.error("Selecione o Supervisor responsável pelo FA");
      return;
    }
    if (needsFA && !data.faId) {
      toast.error("Selecione o FA responsável pelo KAM");
      return;
    }
    if (needsKam && !data.kamId) {
      toast.error("Selecione o KAM responsável pelo Cliente");
      return;
    }

    setIsLoading(true);
    try {
      // Criar usuário via Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.fullName,
          },
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        // Atualizar o role
        const { error: roleError } = await supabase
          .from("user_roles")
          .update({ role: data.role as any })
          .eq("user_id", authData.user.id);

        if (roleError) {
          console.error("Error updating role:", roleError);
        }

        // Criar hierarquia baseada no role
        if (data.role === "fa" && data.supervisorId) {
          // FA -> Supervisor (Supervisor supervisiona o FA)
          await supabase
            .from("user_hierarchy")
            .upsert({ 
              user_id: authData.user.id, 
              supervisor_id: data.supervisorId 
            }, { 
              onConflict: "user_id" 
            });
        }

        if (data.role === "kam" && data.faId) {
          // KAM -> FA (FA supervisiona o KAM)
          await supabase
            .from("user_hierarchy")
            .upsert({ 
              user_id: authData.user.id, 
              supervisor_id: data.faId 
            }, { 
              onConflict: "user_id" 
            });
        }

        // Se for cliente, atualizar a organização com o KAM
        if (data.role === "cliente" && data.kamId) {
          // Aguardar o trigger criar a organização
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Buscar a organização do cliente
          const { data: membership } = await supabase
            .from("organization_members")
            .select("organization_id")
            .eq("user_id", authData.user.id)
            .maybeSingle();

          if (membership?.organization_id) {
            // Atualizar o kam_id da organização
            await supabase
              .from("organizations")
              .update({ kam_id: data.kamId })
              .eq("id", membership.organization_id);
          }
        }

        // Invalidar queries
        queryClient.invalidateQueries({ queryKey: ["organizations"] });
        queryClient.invalidateQueries({ queryKey: ["viewable-organizations"] });
        queryClient.invalidateQueries({ queryKey: ["users-with-hierarchy"] });
        queryClient.invalidateQueries({ queryKey: ["all-users-with-roles"] });
      }

      setCreatedUser({ email: data.email, password: data.password });
      toast.success("Usuário criado com sucesso!");
    } catch (error: any) {
      if (error.message?.includes("already registered")) {
        toast.error("Este email já está cadastrado");
      } else {
        toast.error("Erro ao criar usuário: " + error.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const copyCredentials = () => {
    if (createdUser) {
      navigator.clipboard.writeText(
        `Email: ${createdUser.email}\nSenha: ${createdUser.password}`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Credenciais copiadas!");
    }
  };

  const handleClose = () => {
    form.reset();
    setCreatedUser(null);
    setCopied(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Convidar Novo Usuário
          </DialogTitle>
          <DialogDescription>
            Crie uma conta para um novo usuário do sistema
          </DialogDescription>
        </DialogHeader>

        {createdUser ? (
          <div className="space-y-4">
            <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
              <p className="text-sm font-medium text-success mb-2">
                ✓ Usuário criado com sucesso!
              </p>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Email:</span>{" "}
                  <span className="font-mono">{createdUser.email}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Senha:</span>{" "}
                  <span className="font-mono">{createdUser.password}</span>
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={copyCredentials} variant="outline" className="flex-1">
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar Credenciais
                  </>
                )}
              </Button>
              <Button onClick={handleClose} className="flex-1">
                Fechar
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome Completo</Label>
              <Input
                id="fullName"
                placeholder="João Silva"
                {...form.register("fullName")}
              />
              {form.formState.errors.fullName && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.fullName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="usuario@empresa.com"
                  className="pl-10"
                  {...form.register("email")}
                />
              </div>
              {form.formState.errors.email && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha Inicial</Label>
              <div className="flex gap-2">
                <Input
                  id="password"
                  type="text"
                  placeholder="Senha inicial"
                  {...form.register("password")}
                />
                <Button type="button" variant="outline" onClick={generatePassword}>
                  Gerar
                </Button>
              </div>
              {form.formState.errors.password && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Perfil de Acesso</Label>
              <Select
                value={form.watch("role")}
                onValueChange={(value) => form.setValue("role", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um perfil" />
                </SelectTrigger>
                <SelectContent>
                  {ALL_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.role && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.role.message}
                </p>
              )}
            </div>

            {/* FA: Selecionar Supervisor obrigatório */}
            {needsSupervisor && (
              <div className="space-y-2 p-3 bg-accent/10 rounded-lg border border-accent/20">
                <Label htmlFor="supervisorId" className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-accent" />
                  Supervisor Responsável *
                </Label>
                <Select
                  value={form.watch("supervisorId")}
                  onValueChange={(value) => form.setValue("supervisorId", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingSupervisors ? "Carregando..." : "Selecione um Supervisor"} />
                  </SelectTrigger>
                  <SelectContent>
                    {possibleSupervisors?.map((user) => (
                      <SelectItem key={user.user_id} value={user.user_id}>
                        {user.full_name || `Usuário ${user.user_id.slice(0, 8)}`}
                      </SelectItem>
                    ))}
                    {possibleSupervisors.length === 0 && !loadingSupervisors && (
                      <div className="p-2 text-sm text-muted-foreground text-center">
                        Nenhum Supervisor cadastrado
                      </div>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  O Supervisor terá acesso a todos os clientes gerenciados pelos KAMs deste FA
                </p>
              </div>
            )}

            {/* KAM: Selecionar FA obrigatório */}
            {needsFA && (
              <div className="space-y-2 p-3 bg-info/10 rounded-lg border border-info/20">
                <Label htmlFor="faId" className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-info" />
                  FA Responsável *
                </Label>
                <Select
                  value={form.watch("faId")}
                  onValueChange={(value) => form.setValue("faId", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingFAs ? "Carregando..." : "Selecione um FA"} />
                  </SelectTrigger>
                  <SelectContent>
                    {faUsers?.map((user) => (
                      <SelectItem key={user.user_id} value={user.user_id}>
                        {user.full_name || `FA ${user.user_id.slice(0, 8)}`}
                      </SelectItem>
                    ))}
                    {(!faUsers || faUsers.length === 0) && !loadingFAs && (
                      <div className="p-2 text-sm text-muted-foreground text-center">
                        Nenhum FA cadastrado. Crie um FA primeiro.
                      </div>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  O FA terá acesso a todos os clientes deste KAM
                </p>
              </div>
            )}

            {/* Cliente: Selecionar KAM obrigatório */}
            {needsKam && (
              <div className="space-y-2 p-3 bg-success/10 rounded-lg border border-success/20">
                <Label htmlFor="kamId" className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-success" />
                  KAM Responsável *
                </Label>
                <Select
                  value={form.watch("kamId")}
                  onValueChange={(value) => form.setValue("kamId", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingKams ? "Carregando..." : "Selecione um KAM"} />
                  </SelectTrigger>
                  <SelectContent>
                    {kamUsers?.map((user) => (
                      <SelectItem key={user.user_id} value={user.user_id}>
                        {user.full_name || `KAM ${user.user_id.slice(0, 8)}`}
                      </SelectItem>
                    ))}
                    {(!kamUsers || kamUsers.length === 0) && !loadingKams && (
                      <div className="p-2 text-sm text-muted-foreground text-center">
                        Nenhum KAM cadastrado. Crie um KAM primeiro.
                      </div>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  O KAM será o responsável direto por este cliente
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading} className="flex-1">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Criar Usuário
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
