import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { callEdgeFunction } from "@/lib/supabase-helpers";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, User, Building2, Shield, Trash2, CreditCard, Landmark, ArrowLeftRight, Calendar, MapPin, Phone, Mail, FileText, Lock, Unlock, Globe } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DeleteClientDialog } from "./DeleteClientDialog";

interface ClientDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string | null;
  clientUserId: string | null;
  clientName: string | null;
  onDeleted?: () => void;
}

export function ClientDetailDialog({
  open,
  onOpenChange,
  organizationId,
  clientUserId,
  clientName,
  onDeleted,
}: ClientDetailDialogProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Fetch full client profile
  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ["client-detail-profile", clientUserId],
    queryFn: async () => {
      if (!clientUserId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", clientUserId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!clientUserId && open,
  });

  // Fetch organization details
  const { data: org, isLoading: loadingOrg } = useQuery({
    queryKey: ["client-detail-org", organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", organizationId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId && open,
  });

  // Fetch subscription
  const { data: subscription } = useQuery({
    queryKey: ["client-detail-sub", organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      const { data, error } = await supabase
        .from("organization_subscriptions")
        .select("*, plans(*)")
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId && open,
  });

  // Fetch counts
  const { data: counts } = useQuery({
    queryKey: ["client-detail-counts", organizationId],
    queryFn: async () => {
      if (!organizationId) return { accounts: 0, transactions: 0 };
      
      const [accountsRes, transactionsRes] = await Promise.all([
        supabase.from("accounts").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
        supabase.from("transactions").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
      ]);

      return {
        accounts: accountsRes.count || 0,
        transactions: transactionsRes.count || 0,
      };
    },
    enabled: !!organizationId && open,
  });

  // Fetch client email via edge function
  const { data: clientEmail } = useQuery({
    queryKey: ["client-detail-email", clientUserId],
    queryFn: async () => {
      if (!clientUserId) return null;
      const response = await callEdgeFunction("get-user-emails");
      const result = await response.json();
      return result.emails?.[clientUserId] || null;
    },
    enabled: !!clientUserId && open,
  });

  const isLoading = loadingProfile || loadingOrg;

  const InfoRow = ({ icon: Icon, label, value }: { icon: any; label: string; value: string | null | undefined }) => (
    <div className="flex items-start gap-3 py-2">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value || "—"}</p>
      </div>
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={org?.logo_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {(clientName || "C").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <span>{clientName || "Cliente"}</span>
                {org?.is_blocked && (
                  <Badge variant="destructive" className="ml-2">Bloqueado</Badge>
                )}
              </div>
            </DialogTitle>
            <DialogDescription>
              Informações completas do cliente e sua base
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Dados Pessoais */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Dados Pessoais
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                  <InfoRow icon={User} label="Nome Completo" value={profile?.full_name} />
                  <InfoRow icon={FileText} label="CPF" value={profile?.cpf} />
                  <InfoRow icon={Calendar} label="Data de Nascimento" value={profile?.birth_date ? format(new Date(profile.birth_date), "dd/MM/yyyy") : null} />
                  <InfoRow icon={Mail} label="Email" value={clientEmail} />
                  <InfoRow icon={Phone} label="Telefone" value={profile?.phone} />
                  <InfoRow icon={MapPin} label="Endereço" value={profile?.address} />
                  <InfoRow icon={Calendar} label="Cadastrado em" value={profile?.created_at ? format(new Date(profile.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : null} />
                  <InfoRow icon={Shield} label="Cadastro Completo" value={profile?.registration_completed ? "Sim ✓" : "Não ✗"} />
                </CardContent>
              </Card>

              {/* Dados da Base */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Dados da Base
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                  <InfoRow icon={Building2} label="Nome da Base" value={org?.name} />
                  <InfoRow icon={FileText} label="Slug" value={org?.slug} />
                  <InfoRow icon={Globe} label="Moeda Base" value={org?.base_currency} />
                  <InfoRow icon={CreditCard} label="Plano Ativo" value={(subscription as any)?.plans?.name || "Sem plano"} />
                  <InfoRow icon={Calendar} label="Base criada em" value={org?.created_at ? format(new Date(org.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : null} />
                  <InfoRow icon={Landmark} label="Contas Bancárias" value={String(counts?.accounts || 0)} />
                  <InfoRow icon={ArrowLeftRight} label="Transações" value={String(counts?.transactions || 0)} />
                  <InfoRow
                    icon={org?.is_blocked ? Lock : Unlock}
                    label="Status"
                    value={org?.is_blocked ? `Bloqueado${org?.blocked_reason ? ` — ${org.blocked_reason}` : ""}` : "Ativo"}
                  />
                </CardContent>
              </Card>

              <Separator />

              {/* Botão de Exclusão */}
              <div className="flex justify-end">
                <Button
                  variant="destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir Cliente
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <DeleteClientDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        organizationId={organizationId}
        clientName={profile?.full_name || clientName || ""}
        onDeleted={() => {
          setDeleteDialogOpen(false);
          onOpenChange(false);
          onDeleted?.();
        }}
      />
    </>
  );
}
