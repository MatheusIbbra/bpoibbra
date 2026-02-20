import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon, Loader2, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAccounts } from "@/hooks/useAccounts";
import { useCreateTransfer } from "@/hooks/useTransfers";
import { cn } from "@/lib/utils";

const transferSchema = z.object({
  origin_account_id: z.string().min(1, "Selecione a conta de origem"),
  destination_account_id: z.string().min(1, "Selecione a conta de destino"),
  amount: z.number().positive("Valor deve ser positivo"),
  transfer_date: z.date(),
  description: z.string().optional(),
}).refine((data) => data.origin_account_id !== data.destination_account_id, {
  message: "Conta de origem e destino devem ser diferentes",
  path: ["destination_account_id"],
});

type FormData = z.infer<typeof transferSchema>;

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransferDialog({ open, onOpenChange }: TransferDialogProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      origin_account_id: "",
      destination_account_id: "",
      amount: 0,
      transfer_date: new Date(),
      description: "",
    },
  });

  const { data: accounts } = useAccounts();
  const createTransfer = useCreateTransfer();

  const activeAccounts = accounts?.filter((a) => a.status === "active") || [];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const onSubmit = async (data: FormData) => {
    await createTransfer.mutateAsync({
      origin_account_id: data.origin_account_id,
      destination_account_id: data.destination_account_id,
      amount: data.amount,
      transfer_date: format(data.transfer_date, "yyyy-MM-dd"),
      description: data.description,
    });
    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Transferência</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex items-center gap-2">
              <FormField
                control={form.control}
                name="origin_account_id"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Conta Origem</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {activeAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            <div className="flex flex-col">
                              <span>{account.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {account.bank_name} • {formatCurrency(account.current_balance || 0)}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <ArrowRight className="h-5 w-5 mt-6 text-muted-foreground" />

              <FormField
                control={form.control}
                name="destination_account_id"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Conta Destino</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {activeAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            <div className="flex flex-col">
                              <span>{account.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {account.bank_name} • {formatCurrency(account.current_balance || 0)}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor (R$)</FormLabel>
                  <FormControl>
                    <CurrencyInput
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="transfer_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Data</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "dd/MM/yyyy", { locale: ptBR })
                          ) : (
                            <span>Selecione uma data</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição (opcional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Ex: Transferência para reserva" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={createTransfer.isPending}>
                {createTransfer.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Transferir"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
