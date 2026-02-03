import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useBaseFilter } from "@/contexts/BaseFilterContext";

interface BaseRequiredAlertProps {
  action?: string;
}

export function BaseRequiredAlert({ action = "criar itens" }: BaseRequiredAlertProps) {
  const { requiresBaseSelection } = useBaseFilter();

  if (!requiresBaseSelection) {
    return null;
  }

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Base não selecionada</AlertTitle>
      <AlertDescription>
        Selecione uma base específica no menu superior para {action}. 
        Isso garante que os dados sejam criados na organização correta.
      </AlertDescription>
    </Alert>
  );
}

export function useCanCreate() {
  const { requiresBaseSelection, getRequiredOrganizationId } = useBaseFilter();
  
  return {
    canCreate: !requiresBaseSelection && getRequiredOrganizationId() !== null,
    requiresBaseSelection,
  };
}
