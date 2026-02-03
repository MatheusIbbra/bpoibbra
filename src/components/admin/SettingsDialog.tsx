import { useState } from "react";
import { Settings, Bell, Shield, Database, Mail, Save, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState({
    // Notificações
    emailNotifications: true,
    budgetAlerts: true,
    importNotifications: true,
    weeklyReports: false,
    
    // Segurança
    twoFactorAuth: false,
    sessionTimeout: true,
    auditLog: true,
    
    // Sistema
    autoClassification: true,
    darkModeDefault: false,
    compactView: false,
  });

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Simular salvamento - em produção, salvaria no banco
      await new Promise(resolve => setTimeout(resolve, 500));
      toast.success("Configurações salvas com sucesso!");
      onOpenChange(false);
    } catch (error) {
      toast.error("Erro ao salvar configurações");
    } finally {
      setIsLoading(false);
    }
  };

  const updateSetting = (key: keyof typeof settings, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurações do Sistema
          </DialogTitle>
          <DialogDescription>
            Gerencie as configurações globais do sistema
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="notifications" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Notificações</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Segurança</span>
            </TabsTrigger>
            <TabsTrigger value="system" className="gap-2">
              <Database className="h-4 w-4" />
              <span className="hidden sm:inline">Sistema</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notifications" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="emailNotifications">Notificações por Email</Label>
                <p className="text-xs text-muted-foreground">
                  Receber atualizações importantes por email
                </p>
              </div>
              <Switch
                id="emailNotifications"
                checked={settings.emailNotifications}
                onCheckedChange={(checked) => updateSetting("emailNotifications", checked)}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="budgetAlerts">Alertas de Orçamento</Label>
                <p className="text-xs text-muted-foreground">
                  Notificar quando orçamento atingir limites
                </p>
              </div>
              <Switch
                id="budgetAlerts"
                checked={settings.budgetAlerts}
                onCheckedChange={(checked) => updateSetting("budgetAlerts", checked)}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="importNotifications">Notificações de Importação</Label>
                <p className="text-xs text-muted-foreground">
                  Avisar quando importações forem concluídas
                </p>
              </div>
              <Switch
                id="importNotifications"
                checked={settings.importNotifications}
                onCheckedChange={(checked) => updateSetting("importNotifications", checked)}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="weeklyReports">Relatórios Semanais</Label>
                <p className="text-xs text-muted-foreground">
                  Enviar resumo semanal por email
                </p>
              </div>
              <Switch
                id="weeklyReports"
                checked={settings.weeklyReports}
                onCheckedChange={(checked) => updateSetting("weeklyReports", checked)}
              />
            </div>
          </TabsContent>

          <TabsContent value="security" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="twoFactorAuth">Autenticação 2 Fatores</Label>
                <p className="text-xs text-muted-foreground">
                  Exigir 2FA para todos os usuários
                </p>
              </div>
              <Switch
                id="twoFactorAuth"
                checked={settings.twoFactorAuth}
                onCheckedChange={(checked) => updateSetting("twoFactorAuth", checked)}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="sessionTimeout">Timeout de Sessão</Label>
                <p className="text-xs text-muted-foreground">
                  Encerrar sessão após 30 min de inatividade
                </p>
              </div>
              <Switch
                id="sessionTimeout"
                checked={settings.sessionTimeout}
                onCheckedChange={(checked) => updateSetting("sessionTimeout", checked)}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="auditLog">Log de Auditoria</Label>
                <p className="text-xs text-muted-foreground">
                  Registrar todas as ações do sistema
                </p>
              </div>
              <Switch
                id="auditLog"
                checked={settings.auditLog}
                onCheckedChange={(checked) => updateSetting("auditLog", checked)}
              />
            </div>
          </TabsContent>

          <TabsContent value="system" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="autoClassification">Classificação Automática IA</Label>
                <p className="text-xs text-muted-foreground">
                  Classificar transações importadas automaticamente
                </p>
              </div>
              <Switch
                id="autoClassification"
                checked={settings.autoClassification}
                onCheckedChange={(checked) => updateSetting("autoClassification", checked)}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="darkModeDefault">Modo Escuro Padrão</Label>
                <p className="text-xs text-muted-foreground">
                  Iniciar em modo escuro para novos usuários
                </p>
              </div>
              <Switch
                id="darkModeDefault"
                checked={settings.darkModeDefault}
                onCheckedChange={(checked) => updateSetting("darkModeDefault", checked)}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="compactView">Visualização Compacta</Label>
                <p className="text-xs text-muted-foreground">
                  Usar layout compacto nas tabelas
                </p>
              </div>
              <Switch
                id="compactView"
                checked={settings.compactView}
                onCheckedChange={(checked) => updateSetting("compactView", checked)}
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Salvar
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
