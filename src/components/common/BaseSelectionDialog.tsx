import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";
import { useBaseFilter } from "@/contexts/BaseFilterContext";

interface BaseSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBaseSelected: (organizationId: string) => void;
  title?: string;
  description?: string;
}

export function BaseSelectionDialog({
  open,
  onOpenChange,
  onBaseSelected,
  title = "Seleção de Base Obrigatória",
  description = "Para executar esta ação, é necessário selecionar uma base específica.",
}: BaseSelectionDialogProps) {
  const { availableOrganizations } = useBaseFilter();
  const [selectedBase, setSelectedBase] = useState<string>("");

  const handleConfirm = () => {
    if (selectedBase) {
      onBaseSelected(selectedBase);
      onOpenChange(false);
      setSelectedBase("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Select value={selectedBase} onValueChange={setSelectedBase}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma base..." />
            </SelectTrigger>
            <SelectContent>
              {availableOrganizations?.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedBase}>
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
