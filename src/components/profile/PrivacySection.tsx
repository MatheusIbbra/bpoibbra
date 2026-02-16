import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useConsentLogs } from "@/hooks/useConsentLogs";
import { useDataExport } from "@/hooks/useDataExport";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Shield, Download, FileText, Clock, CheckCircle, AlertCircle, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function PrivacySection() {
  const { user } = useAuth();
  const { consents, recordConsent, hasConsent } = useConsentLogs();
  const { requests, requestExport } = useDataExport();

  const handleConsentToggle = (type: "marketing" | "data_processing", value: boolean) => {
    recordConsent.mutate({ consentType: type, consentGiven: value });
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" />Pronto</Badge>;
      case "processing":
        return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Processando</Badge>;
      case "failed":
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Falhou</Badge>;
      default:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Consentimentos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Privacidade e Consentimentos
          </CardTitle>
          <CardDescription>
            Gerencie suas preferências de privacidade conforme a LGPD (Lei Geral de Proteção de Dados)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Termos de Uso</Label>
              <p className="text-xs text-muted-foreground">Aceito ao criar a conta</p>
            </div>
            <Badge variant="default">Aceito</Badge>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Política de Privacidade</Label>
              <p className="text-xs text-muted-foreground">Processamento dos seus dados pessoais</p>
            </div>
            <Badge variant="default">Aceito</Badge>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Comunicações de Marketing</Label>
              <p className="text-xs text-muted-foreground">Receber novidades e ofertas por e-mail</p>
            </div>
            <Switch
              checked={hasConsent("marketing")}
              onCheckedChange={(v) => handleConsentToggle("marketing", v)}
              disabled={recordConsent.isPending}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Processamento Analítico</Label>
              <p className="text-xs text-muted-foreground">Uso dos seus dados para insights personalizados</p>
            </div>
            <Switch
              checked={hasConsent("data_processing")}
              onCheckedChange={(v) => handleConsentToggle("data_processing", v)}
              disabled={recordConsent.isPending}
            />
          </div>
        </CardContent>
      </Card>

      {/* Exportação de Dados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Exportação de Dados (LGPD Art. 18)
          </CardTitle>
          <CardDescription>
            Solicite uma cópia completa dos seus dados pessoais
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => requestExport.mutate("full")}
              disabled={requestExport.isPending}
            >
              <FileText className="h-4 w-4 mr-2" />
              Exportação Completa
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => requestExport.mutate("transactions")}
              disabled={requestExport.isPending}
            >
              Apenas Transações
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => requestExport.mutate("profile")}
              disabled={requestExport.isPending}
            >
              Apenas Perfil
            </Button>
          </div>

          {requests.length > 0 && (
            <div className="space-y-2 mt-4">
              <Label className="text-sm font-medium">Solicitações Recentes</Label>
              {requests.map((req) => (
                <div key={req.id} className="flex items-center justify-between p-2 rounded border bg-muted/30">
                  <div className="text-sm">
                    <span className="capitalize">{req.export_type === "full" ? "Completa" : req.export_type === "transactions" ? "Transações" : "Perfil"}</span>
                    <span className="text-muted-foreground ml-2">
                      {format(new Date(req.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  {statusBadge(req.status)}
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground mt-2">
            Política de retenção: seus dados são mantidos por 60 meses após inativação da conta, conforme regulamentação financeira vigente.
          </p>
        </CardContent>
      </Card>

      {/* Exclusão de Dados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Exclusão de Dados (LGPD Art. 18, VI)
          </CardTitle>
          <CardDescription>
            Solicite a exclusão definitiva dos seus dados pessoais
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Ao solicitar a exclusão, todos os seus dados pessoais serão removidos permanentemente. 
            Esta ação é irreversível e pode levar até 15 dias úteis para ser processada.
          </p>
          <Button
            variant="destructive"
            size="sm"
            onClick={async () => {
              if (!user) return;
              const confirmed = window.confirm("Tem certeza que deseja solicitar a exclusão de todos os seus dados? Esta ação é irreversível.");
              if (!confirmed) return;
              try {
                const { error } = await supabase.from("data_deletion_requests").insert({
                  user_id: user.id,
                  reason: "Solicitação do titular via perfil",
                });
                if (error) throw error;
                toast.success("Solicitação de exclusão registrada. Você será notificado sobre o andamento.");
              } catch (err: any) {
                toast.error("Erro ao solicitar exclusão: " + err.message);
              }
            }}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Solicitar Exclusão de Dados
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
