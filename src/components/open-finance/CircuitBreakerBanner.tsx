import { useCircuitBreaker } from "@/hooks/useCircuitBreaker";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function CircuitBreakerBanner() {
  const { data: openCircuits } = useCircuitBreaker();

  if (!openCircuits || openCircuits.length === 0) return null;

  const providers = openCircuits.map(cb => {
    const openedAt = cb.opened_at ? new Date(cb.opened_at).getTime() : Date.now();
    const retryAt = openedAt + 10 * 60 * 1000;
    const minutesLeft = Math.max(0, Math.ceil((retryAt - Date.now()) / 60000));
    const providerName = cb.provider === "pluggy" ? "Pluggy" : cb.provider === "klavi" ? "Klavi" : cb.provider;
    return { providerName, minutesLeft };
  });

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="flex items-center gap-2 text-sm">
        <span>
          Sincronização bancária temporariamente indisponível ({providers.map(p => p.providerName).join(", ")}).
          {" "}Retentativa automática em {Math.max(...providers.map(p => p.minutesLeft))} minutos.
        </span>
        <RefreshCw className="h-3.5 w-3.5 animate-spin opacity-50" />
      </AlertDescription>
    </Alert>
  );
}
