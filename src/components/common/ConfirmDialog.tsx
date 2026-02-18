import { useState, useCallback } from "react";
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
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
  /** When set, user must type this exact string to enable confirm button */
  typeToConfirm?: string;
  /** Hint shown above the input for type-to-confirm */
  typeToConfirmHint?: string;
  variant?: "destructive" | "warning";
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  onConfirm,
  isLoading = false,
  typeToConfirm,
  typeToConfirmHint,
  variant = "destructive",
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState("");

  const canConfirm = typeToConfirm
    ? typed.trim().toUpperCase() === typeToConfirm.trim().toUpperCase()
    : true;

  const handleOpenChange = useCallback(
    (value: boolean) => {
      if (!value) setTyped("");
      onOpenChange(value);
    },
    [onOpenChange]
  );

  const handleConfirm = async () => {
    await onConfirm();
    setTyped("");
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {variant === "destructive" && (
              <AlertTriangle className="h-5 w-5 text-destructive" />
            )}
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">{description}</div>

              {typeToConfirm && (
                <div className="space-y-2 pt-1">
                  <Label className="text-sm text-muted-foreground">
                    {typeToConfirmHint ||
                      `Digite "${typeToConfirm}" para confirmar`}
                  </Label>
                  <div className="bg-muted p-2 rounded text-center">
                    <span className="font-semibold text-foreground text-sm">
                      {typeToConfirm}
                    </span>
                  </div>
                  <Input
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    placeholder={`Digite "${typeToConfirm}"`}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>{cancelLabel}</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!canConfirm || isLoading}
          >
            {isLoading && (
              <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            )}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
