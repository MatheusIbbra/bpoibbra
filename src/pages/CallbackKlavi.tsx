import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSavePluggyItem, useSyncBankConnection } from "@/hooks/useBankConnections";
import { useAutoIgnoreTransfers } from "@/hooks/useAutoIgnoreTransfers";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CallbackKlavi() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const savePluggyItem = useSavePluggyItem();
  const syncConnection = useSyncBankConnection();
  const autoIgnoreTransfers = useAutoIgnoreTransfers();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    // Pluggy callback parameters
    const itemId = searchParams.get("itemId");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    // Get stored organization from localStorage
    const pendingOrgId = localStorage.getItem('pending_openfinance_org');
    const returnPath = localStorage.getItem('pending_openfinance_return') || '/open-finance';

    if (error) {
      setStatus("error");
      setErrorMessage(errorDescription || error || "Erro desconhecido");
      return;
    }

    if (!itemId) {
      setStatus("error");
      setErrorMessage("Parâmetros de autorização inválidos. itemId não encontrado.");
      return;
    }

    if (!pendingOrgId) {
      setStatus("error");
      setErrorMessage("Organização não encontrada. Por favor, tente novamente.");
      return;
    }

    // Save the Pluggy item and sync transactions
    savePluggyItem.mutate(
      { 
        organizationId: pendingOrgId, 
        itemId,
        connectorName: searchParams.get("connectorName") || undefined
      },
      {
        onSuccess: async (data) => {
          // Clear stored data
          localStorage.removeItem('pending_openfinance_org');
          localStorage.removeItem('pending_openfinance_return');

          // Trigger sync
          try {
            await syncConnection.mutateAsync({
              organizationId: pendingOrgId,
              itemId
            });
            // After sync, reprocess all transactions to detect internal transfers
            try {
              await autoIgnoreTransfers.mutateAsync(pendingOrgId);
            } catch (ignoreError) {
              console.warn('Auto-ignore transfers failed:', ignoreError);
            }
          } catch (syncError) {
            console.warn('Auto-sync failed, user can sync manually:', syncError);
          }

          setStatus("success");
          // Redirect after a brief delay
          setTimeout(() => {
            navigate(returnPath, { replace: true });
          }, 2000);
        },
        onError: (error) => {
          setStatus("error");
          setErrorMessage(error.message || "Falha ao salvar conexão");
        },
      }
    );
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          {status === "loading" && (
            <div className="text-center py-8">
              <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
              <h2 className="text-xl font-semibold mb-2">Conectando seu banco...</h2>
              <p className="text-muted-foreground">
                Aguarde enquanto finalizamos a conexão
              </p>
            </div>
          )}

          {status === "success" && (
            <div className="text-center py-8">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h2 className="text-xl font-semibold mb-2">Banco conectado!</h2>
              <p className="text-muted-foreground">
                Redirecionando para o painel...
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="text-center py-8">
              <XCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
              <h2 className="text-xl font-semibold mb-2">Erro na conexão</h2>
              <p className="text-muted-foreground mb-4">{errorMessage}</p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => navigate("/open-finance")}>
                  Voltar
                </Button>
                <Button onClick={() => window.location.reload()}>
                  Tentar novamente
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
