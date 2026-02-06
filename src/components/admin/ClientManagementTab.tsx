import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { InviteUserDialog } from "./InviteUserDialog";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { 
  Building2, 
  Loader2, 
  Search,
  Lock,
  Unlock,
  UserCheck,
  AlertTriangle,
  CheckCircle,
  Edit,
  Phone,
  MapPin,
  FileText,
  Upload,
  Image as ImageIcon,
  X,
  Save,
  Plus,
  Mail,
  KeyRound,
  Send
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCpfCnpj, formatPhone } from "@/lib/formatters";

interface ClientOrganization {
  id: string;
  name: string;
  slug: string;
  cpf_cnpj: string | null;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
  is_blocked: boolean;
  blocked_reason: string | null;
  blocked_at: string | null;
  kam_id: string | null;
  kam_name: string | null;
  client_user_id: string | null;
  client_name: string | null;
  client_email: string | null;
}

interface KamUser {
  user_id: string;
  full_name: string | null;
}

// Dialog para editar organização e acesso do cliente
function EditOrganizationDialog({ 
  open, 
  onOpenChange,
  organization,
  kamUsers,
  loadingKams,
  onRefresh
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  organization: ClientOrganization | null;
  onRefresh?: () => void;
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: "",
    cpf_cnpj: "",
    phone: "",
    address: "",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Client access management state
  const [clientEmail, setClientEmail] = useState("");
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Fetch client email when organization changes
  useEffect(() => {
    const fetchClientEmail = async () => {
      if (organization?.client_user_id) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const response = await fetch(
            `https://umqehhhpedwqdfjmdjqv.supabase.co/functions/v1/get-user-emails`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token}`,
              },
            }
          );
          const result = await response.json();
          if (result.emails && result.emails[organization.client_user_id]) {
            setClientEmail(result.emails[organization.client_user_id]);
          }
        } catch (error) {
          console.error("Error fetching client email:", error);
        }
      }
    };

    if (organization) {
      setFormData({
        name: organization.name || "",
        cpf_cnpj: organization.cpf_cnpj || "",
        phone: organization.phone || "",
        address: organization.address || "",
      });
      setLogoPreview(organization.logo_url);
      setLogoFile(null);
      fetchClientEmail();
    }
  }, [organization]);

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("A imagem deve ter no máximo 2MB");
        return;
      }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile || !organization) return organization?.logo_url || null;
    
    setIsUploadingLogo(true);
    try {
      const fileExt = logoFile.name.split(".").pop();
      const filePath = `${organization.id}/logo.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("organization-logos")
        .upload(filePath, logoFile, { upsert: true });
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from("organization-logos")
        .getPublicUrl(filePath);
      
      return publicUrl;
    } catch (error: any) {
      console.error("Error uploading logo:", error);
      toast.error("Erro ao fazer upload do logo");
      return organization?.logo_url || null;
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !organization) {
      toast.error("Preencha o nome");
      return;
    }

    setIsSaving(true);

    try {
      let logoUrl = organization.logo_url;
      if (logoFile) {
        logoUrl = await uploadLogo();
      } else if (logoPreview === null && organization.logo_url) {
        logoUrl = null;
      }

      const { data: result, error } = await supabase
        .from("organizations")
        .update({
          name: formData.name.trim(),
          cpf_cnpj: formData.cpf_cnpj.trim() || null,
          phone: formData.phone.trim() || null,
          address: formData.address.trim() || null,
          logo_url: logoUrl,
        })
        .eq("id", organization.id)
        .select();

      if (error) throw error;
      if (!result || result.length === 0) {
        throw new Error("Organização não encontrada ou sem permissão para editar");
      }

      queryClient.invalidateQueries({ queryKey: ["client-organizations-full"] });
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["organizations-with-kam"] });
      queryClient.invalidateQueries({ queryKey: ["viewable-organizations"] });
      
      toast.success("Organização atualizada com sucesso!");
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Erro ao atualizar organização: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCpfCnpjChange = (value: string) => {
    setFormData(prev => ({ ...prev, cpf_cnpj: formatCpfCnpj(value) }));
  };

  const handlePhoneChange = (value: string) => {
    setFormData(prev => ({ ...prev, phone: formatPhone(value) }));
  };

  // Client access management functions
  const handleUpdateEmail = async () => {
    if (!organization?.client_user_id || !clientEmail.trim()) return;

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
            userId: organization.client_user_id,
            email: clientEmail.trim(),
          }),
        }
      );

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to update email');
      }

      toast.success("Email do cliente atualizado com sucesso!");
      onRefresh?.();
    } catch (error: unknown) {
      console.error("Error updating email:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro ao atualizar email";
      toast.error(errorMessage);
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  const handleResetPassword = async () => {
    if (!organization?.client_user_id) return;

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
            userId: organization.client_user_id,
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

  

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Editar Base do Cliente
          </DialogTitle>
          <DialogDescription>
            Atualize as informações da base/organização
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Logo Upload */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              Logo da Organização
            </Label>
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={logoPreview || undefined} />
                <AvatarFallback className="bg-primary/10 text-xl">
                  {formData.name.charAt(0).toUpperCase() || "O"}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoSelect}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {logoPreview ? "Alterar" : "Upload"}
                </Button>
                {logoPreview && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={removeLogo}
                    className="text-destructive"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Remover
                  </Button>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Formatos: JPG, PNG. Tamanho máximo: 2MB
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-name">Nome da Base</Label>
            <Input
              id="edit-name"
              placeholder="Ex: Empresa XYZ Ltda"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>

          
          <div className="space-y-2">
            <Label htmlFor="edit-cpf" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              CPF/CNPJ
            </Label>
            <Input
              id="edit-cpf"
              placeholder="00.000.000/0000-00 ou 000.000.000-00"
              value={formData.cpf_cnpj}
              onChange={(e) => handleCpfCnpjChange(e.target.value)}
              maxLength={18}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-phone" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Telefone
            </Label>
            <Input
              id="edit-phone"
              placeholder="(00) 00000-0000"
              value={formData.phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              maxLength={15}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-address" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Endereço
            </Label>
            <Textarea
              id="edit-address"
              placeholder="Rua, número, bairro, cidade - UF"
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              rows={2}
            />
          </div>
          
          <div className="space-y-2">
            <Label>Identificador (slug)</Label>
            <Input
              value={organization?.slug || ""}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              O slug não pode ser alterado
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving || isUploadingLogo}>
              {(isSaving || isUploadingLogo) ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar Base
                </>
              )}
            </Button>
          </DialogFooter>
        </form>

        {/* Separator between organization data and client access */}
        {organization?.client_user_id && (
          <>
            <Separator className="my-4" />
            
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Acesso do Cliente
              </h3>
              
              {/* Client Info */}
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{organization.client_name || "Cliente"}</p>
                  <p className="text-sm text-muted-foreground truncate">{clientEmail || "Carregando email..."}</p>
                </div>
              </div>

              {/* Email Section */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email do Cliente
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="email@exemplo.com"
                  />
                  <Button 
                    onClick={handleUpdateEmail} 
                    disabled={isUpdatingEmail || !clientEmail.trim()}
                    size="sm"
                    type="button"
                  >
                    {isUpdatingEmail ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Salvar"
                    )}
                  </Button>
                </div>
              </div>

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
                  type="button"
                >
                  {isResettingPassword ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Enviar Email de Redefinição
                </Button>
                <p className="text-xs text-muted-foreground">
                  Um email será enviado para {clientEmail || "o cliente"} com instruções para redefinir a senha.
                </p>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ClientManagementTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [blockDialog, setBlockDialog] = useState<{ 
    open: boolean; 
    org: ClientOrganization | null; 
    action: "block" | "unblock" 
  }>({
    open: false,
    org: null,
    action: "block"
  });
  const [blockReason, setBlockReason] = useState("");
  const [editOrg, setEditOrg] = useState<ClientOrganization | null>(null);

  // Fetch client organizations with their details
  const { data: clientOrgs, isLoading } = useQuery({
    queryKey: ["client-organizations-full"],
    queryFn: async () => {
      const { data: clientMembers, error: membersError } = await supabase
        .from("organization_members")
        .select("organization_id, user_id, role")
        .eq("role", "cliente");

      if (membersError) throw membersError;

      if (!clientMembers || clientMembers.length === 0) {
        return [];
      }

      const clientOrgIds = clientMembers.map(m => m.organization_id);
      
      const { data: orgs, error: orgsError } = await supabase
        .from("organizations")
        .select("id, name, slug, cpf_cnpj, phone, address, logo_url, is_blocked, blocked_reason, blocked_at, kam_id")
        .in("id", clientOrgIds)
        .order("name");

      if (orgsError) throw orgsError;

      const allUserIds = new Set<string>();
      clientMembers.forEach(m => allUserIds.add(m.user_id));
      orgs?.forEach(o => o.kam_id && allUserIds.add(o.kam_id));

      let profilesMap: Record<string, string> = {};
      if (allUserIds.size > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", Array.from(allUserIds));
        
        profiles?.forEach(p => {
          profilesMap[p.user_id] = p.full_name || "";
        });
      }

      return (orgs || []).map(org => {
        const clientMember = clientMembers.find(m => m.organization_id === org.id);
        return {
          ...org,
          is_blocked: org.is_blocked || false,
          kam_name: org.kam_id ? profilesMap[org.kam_id] || null : null,
          client_user_id: clientMember?.user_id || null,
          client_name: clientMember ? profilesMap[clientMember.user_id] || null : null,
          client_email: null,
        } as ClientOrganization;
      });
    },
    enabled: !!user,
  });


  // Block/Unblock mutation
  const toggleBlockMutation = useMutation({
    mutationFn: async ({ orgId, block, reason }: { orgId: string; block: boolean; reason?: string }) => {
      const { error } = await supabase
        .from("organizations")
        .update({
          is_blocked: block,
          blocked_at: block ? new Date().toISOString() : null,
          blocked_reason: block ? reason : null,
        })
        .eq("id", orgId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["client-organizations-full"] });
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      toast.success(variables.block ? "Base bloqueada! Acesso suspenso." : "Base desbloqueada! Acesso restaurado.");
      setBlockDialog({ open: false, org: null, action: "block" });
      setBlockReason("");
    },
    onError: (error) => {
      toast.error("Erro: " + error.message);
    },
  });


  const getInitials = (name: string | null): string => {
    if (!name) return "C";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return parts[0].charAt(0).toUpperCase();
  };

  return (
    <>
      <Card>
        <CardHeader className="border-b bg-muted/30">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Clientes (Bases)
              </CardTitle>
              <CardDescription>
                {filteredOrgs.length} {filteredOrgs.length === 1 ? "base" : "bases"} • Gerencie bloqueio, edição e vinculação a KAM. <strong>Bases nunca são excluídas.</strong>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente ou KAM..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-48"
                />
              </div>
              <Button onClick={() => setInviteDialogOpen(true)} size="sm">
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Adicionar</span>
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
            <>
              
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="min-w-[200px]">Base (Organização)</TableHead>
                      <TableHead className="min-w-[120px]">Status</TableHead>
                      <TableHead className="text-right min-w-[200px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrgs.map((org) => (
                      <TableRow 
                        key={org.id} 
                        className={org.is_blocked ? "bg-destructive/5" : !org.kam_id ? "bg-warning/5" : ""}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={org.logo_url || undefined} />
                              <AvatarFallback className="bg-primary/10 text-primary text-sm">
                                {getInitials(org.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium truncate">{org.name}</p>
                                {!org.kam_id && !org.is_blocked && (
                                  <Badge variant="outline" className="text-warning border-warning/50 text-xs">
                                    Sem KAM
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground font-mono">{org.slug}</p>
                              {org.cpf_cnpj && (
                                <p className="text-xs text-muted-foreground">{org.cpf_cnpj}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {org.is_blocked ? (
                            <div>
                              <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                                <Lock className="h-3 w-3" />
                                Bloqueada
                              </Badge>
                              {org.blocked_at && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {format(new Date(org.blocked_at), "dd/MM/yyyy", { locale: ptBR })}
                                </p>
                              )}
                            </div>
                          ) : (
                            <Badge variant="outline" className="flex items-center gap-1 w-fit text-green-600 border-green-200">
                              <CheckCircle className="h-3 w-3" />
                              Ativa
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditOrg(org)}
                            >
                              <Edit className="mr-1 h-4 w-4" />
                              Editar
                            </Button>
                            {org.is_blocked ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleUnblock(org)}
                                className="text-green-600 border-green-200 hover:bg-green-50"
                              >
                                <Unlock className="mr-1 h-4 w-4" />
                                Desbloquear
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleBlock(org)}
                                className="text-destructive border-destructive/50 hover:bg-destructive/10"
                              >
                                <Lock className="mr-1 h-4 w-4" />
                                Bloquear
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}

                    {filteredOrgs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-16 text-muted-foreground">
                          <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p className="font-medium">
                            {searchQuery ? "Nenhuma base encontrada" : "Nenhuma base cadastrada"}
                          </p>
                          <p className="text-sm">
                            {searchQuery ? "Tente outro termo de busca" : "Bases são criadas quando clientes são cadastrados"}
                          </p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Block/Unblock Dialog */}
      <Dialog 
        open={blockDialog.open} 
        onOpenChange={(open) => {
          if (!open) {
            setBlockDialog({ open: false, org: null, action: "block" });
            setBlockReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {blockDialog.action === "block" ? (
                <>
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Bloquear Base
                </>
              ) : (
                <>
                  <Unlock className="h-5 w-5 text-green-600" />
                  Desbloquear Base
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {blockDialog.action === "block" 
                ? `Tem certeza que deseja bloquear "${blockDialog.org?.name}"? O acesso será suspenso, mas nenhum dado será excluído.`
                : `Deseja desbloquear "${blockDialog.org?.name}"? O acesso será restaurado conforme a hierarquia.`
              }
            </DialogDescription>
          </DialogHeader>

          {blockDialog.action === "block" && (
            <div className="space-y-2">
              <Label htmlFor="block-reason">Motivo do bloqueio (opcional)</Label>
              <Textarea
                id="block-reason"
                placeholder="Ex: Inadimplência, solicitação do cliente..."
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                rows={3}
              />
            </div>
          )}

          {blockDialog.action === "unblock" && blockDialog.org?.blocked_reason && (
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm font-medium">Motivo do bloqueio anterior:</p>
              <p className="text-sm text-muted-foreground">{blockDialog.org.blocked_reason}</p>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBlockDialog({ open: false, org: null, action: "block" })}
            >
              Cancelar
            </Button>
            <Button
              variant={blockDialog.action === "block" ? "destructive" : "default"}
              onClick={confirmBlockAction}
              disabled={toggleBlockMutation.isPending}
            >
              {toggleBlockMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : blockDialog.action === "block" ? (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Confirmar Bloqueio
                </>
              ) : (
                <>
                  <Unlock className="mr-2 h-4 w-4" />
                  Confirmar Desbloqueio
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Organization Dialog */}
      <EditOrganizationDialog
        open={!!editOrg}
        onOpenChange={(open) => !open && setEditOrg(null)}
        organization={editOrg}
        onRefresh={() => queryClient.invalidateQueries({ queryKey: ["client-organizations-full"] })}
      />

      {/* Invite User Dialog */}
      <InviteUserDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
      />
    </>
  );
}