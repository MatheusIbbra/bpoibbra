import { useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useCreateCostCenter, useUpdateCostCenter, CostCenter } from "@/hooks/useCostCenters";

const costCenterSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  is_active: z.boolean(),
});

type FormData = z.infer<typeof costCenterSchema>;

interface CostCenterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  costCenter?: CostCenter | null;
}

export function CostCenterDialog({ open, onOpenChange, costCenter }: CostCenterDialogProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(costCenterSchema),
    defaultValues: {
      name: "",
      description: "",
      is_active: true,
    },
  });

  const createCostCenter = useCreateCostCenter();
  const updateCostCenter = useUpdateCostCenter();

  useEffect(() => {
    if (costCenter) {
      form.reset({
        name: costCenter.name,
        description: costCenter.description || "",
        is_active: costCenter.is_active,
      });
    } else {
      form.reset({
        name: "",
        description: "",
        is_active: true,
      });
    }
  }, [costCenter, form]);

  const onSubmit = async (data: FormData) => {
    const payload = {
      name: data.name,
      description: data.description,
      is_active: data.is_active,
    };
    
    if (costCenter) {
      await updateCostCenter.mutateAsync({ id: costCenter.id, ...payload });
    } else {
      await createCostCenter.mutateAsync(payload);
    }
    onOpenChange(false);
    form.reset();
  };

  const isLoading = createCostCenter.isPending || updateCostCenter.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{costCenter ? "Editar Centro de Custo" : "Novo Centro de Custo"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Marketing, Operações, TI" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Descrição do centro de custo..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <FormLabel className="text-base">Ativo</FormLabel>
                    <p className="text-sm text-muted-foreground">Centro de custo está ativo</p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : costCenter ? "Salvar" : "Criar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
