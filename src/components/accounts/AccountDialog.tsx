import { useState, useEffect } from "react";
import { z } from "zod";
import { handleSupabaseError } from "@/lib/error-handler";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCreateAccount, useUpdateAccount, Account, AccountType, AccountStatus } from "@/hooks/useAccounts";
import { cn } from "@/lib/utils";

const CURRENCIES = [
  { value: "BRL", label: "Real (BRL)", flag: "🇧🇷" },
  { value: "USD", label: "Dólar (USD)", flag: "🇺🇸" },
  { value: "EUR", label: "Euro (EUR)", flag: "🇪🇺" },
  { value: "GBP", label: "Libra (GBP)", flag: "🇬🇧" },
  { value: "CHF", label: "Franco Suíço (CHF)", flag: "🇨🇭" },
];

const accountSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  bank_name: z.string().min(1, "Banco é obrigatório"),
  account_type: z.enum(["checking", "savings", "investment", "credit_card", "cash"]),
  currency_code: z.string().default("BRL"),
  initial_balance: z.number(),
  start_date: z.date().optional(),
  status: z.enum(["active", "inactive"]),
  color: z.string().optional(),
});

type FormData = z.infer<typeof accountSchema>;

interface AccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: Account | null;
}

const ACCOUNT_TYPES = [
  { value: "checking", label: "Conta Corrente" },
  { value: "savings", label: "Poupança" },
  { value: "investment", label: "Investimento" },
  { value: "credit_card", label: "Cartão de Crédito" },
  { value: "cash", label: "Dinheiro" },
];

const ACCOUNT_STATUS = [
  { value: "active", label: "Ativa" },
  { value: "inactive", label: "Inativa" },
];

const COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
];

export function AccountDialog({ open, onOpenChange, account }: AccountDialogProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: "",
      bank_name: "",
      account_type: "checking",
      currency_code: "BRL",
      initial_balance: 0,
      start_date: new Date(),
      status: "active",
      color: "#3b82f6",
    },
  });

  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();

  useEffect(() => {
    if (account) {
      form.reset({
        name: account.name,
        bank_name: account.bank_name || "",
        account_type: account.account_type as AccountType,
        currency_code: (account as any).currency_code || "BRL",
        initial_balance: Number(account.initial_balance),
        start_date: account.start_date ? new Date(account.start_date) : new Date(),
        status: account.status as AccountStatus,
        color: account.color || "#3b82f6",
      });
    } else {
      form.reset({
        name: "",
        bank_name: "",
        account_type: "checking",
        currency_code: "BRL",
        initial_balance: 0,
        start_date: new Date(),
        status: "active",
        color: "#3b82f6",
      });
    }
  }, [account, form]);

  const onSubmit = async (data: FormData) => {
    try {
      const payload = {
        name: data.name,
        bank_name: data.bank_name,
        account_type: data.account_type as AccountType,
        currency_code: data.currency_code,
        initial_balance: data.initial_balance,
        start_date: data.start_date ? format(data.start_date, "yyyy-MM-dd") : undefined,
        status: data.status as AccountStatus,
        color: data.color || "#3b82f6",
      };
      
      if (account) {
        await updateAccount.mutateAsync({ id: account.id, ...payload });
      } else {
        await createAccount.mutateAsync(payload);
      }
      onOpenChange(false);
      form.reset();
    } catch (error: any) {
      // Handle unique constraint specifically for duplicate account name
      if (error?.code === "23505") {
        handleSupabaseError({ ...error, message: "Já existe uma conta com este nome nesta base." }, "salvar conta");
      } else {
        handleSupabaseError(error, "salvar conta");
      }
    }
  };

  const isLoading = createAccount.isPending || updateAccount.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{account ? "Editar Conta" : "Nova Conta Bancária"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Conta</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Conta Principal" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bank_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Banco / Instituição</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Nubank, Itaú, Bradesco" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="account_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Conta</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ACCOUNT_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="currency_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Moeda</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a moeda" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CURRENCIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.flag} {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="initial_balance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Saldo Inicial</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">

              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data de Início</FormLabel>
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
                              <span>Selecione</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          locale={ptBR}
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ACCOUNT_STATUS.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cor</FormLabel>
                  <div className="flex gap-2 flex-wrap">
                    {COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          field.value === color ? "border-foreground scale-110" : "border-transparent"
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => field.onChange(color)}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : account ? "Salvar" : "Criar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
