import { Bell, BellOff, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { toast } from "sonner";

export function PushNotificationSettings() {
  const { isSupported, isSubscribed, isLoading, subscribe, unsubscribe } = usePushNotifications();

  if (!isSupported) return null;

  const handleToggle = async () => {
    if (isSubscribed) {
      const ok = await unsubscribe();
      if (ok) toast.success("Notificações desativadas");
      else toast.error("Erro ao desativar notificações");
    } else {
      const ok = await subscribe();
      if (ok) toast.success("Notificações ativadas!");
      else toast.error("Não foi possível ativar notificações. Verifique as permissões do navegador.");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isSubscribed ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
          Notificações Push
        </CardTitle>
        <CardDescription>
          Receba alertas sobre anomalias, sincronizações e vencimentos
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <Label htmlFor="push-toggle" className="flex-1">
            {isSubscribed ? "Notificações ativadas" : "Ativar notificações"}
          </Label>
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <Switch
              id="push-toggle"
              checked={isSubscribed}
              onCheckedChange={handleToggle}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
