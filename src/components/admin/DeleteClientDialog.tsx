import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Trash2, AlertTriangle } from "lucide-react";

interface DeleteClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string | null;
  clientName: string;
  onDeleted?: () => void;
}

export function DeleteClientDialog({
  open,
  onOpenChange,
  organizationId,
  clientName,
  onDeleted,
}: DeleteClientDialogProps) {
  const [confirmedName, setConfirmedName] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();
  const { refreshOrganizations, selectedOrganizationId, setSelectedOrganizationId } = useBaseFilter();

  const nameMatches = confirmedName.trim() === clientName.trim() && clientName.trim().length > 0;

  const handleDelete = async () => {
    if (!nameMatches || !organizationId) return;

    setIsDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `https://umqehhhpedwqdfjmdjqv.supabase.co/functions/v1/delete-client`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            organizationId,
            confirmedName: confirmedName.trim(),
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro ao excluir cliente");
      }

      queryClient.invalidateQueries({ queryKey: ["client-organizations-full"] });
      queryClient.invalidateQueries({ queryKey: ["all-users-with-roles"] });
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["viewable-organizations"] });

      // If the deleted org was selected in the header, clear selection
      if (selectedOrganizationId === organizationId) {
        setSelectedOrganizationId(null);
      }

      // Refresh the base selector in the header
      refreshOrganizations();

      toast.success("Cliente excluído permanentemente.");
      setConfirmedName("");
      onDeleted?.();
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir cliente");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => {
      if (!o) setConfirmedName("");
      onOpenChange(o);
    }}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Excluir Cliente Permanentemente
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <Alert variant="destructive" className="border-destructive/50 bg-destructive/5">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Esta ação é irreversível.</strong> Todos os dados do cliente serão excluídos permanentemente, incluindo transações, contas, categorias e regras.
                </AlertDescription>
              </Alert>

              <p className="text-sm">
                Para confirmar a exclusão permanente, digite o nome completo do cliente exatamente como está cadastrado:
              </p>

              <div className="bg-muted p-3 rounded-lg text-center">
                <p className="font-semibold text-foreground text-base">{clientName}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-name">Nome completo do cliente</Label>
                <Input
                  id="confirm-name"
                  value={confirmedName}
                  onChange={(e) => setConfirmedName(e.target.value)}
                  placeholder="Digite o nome exato do cliente"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!nameMatches || isDeleting}
          >
            {isDeleting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Confirmar Exclusão Permanente
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
