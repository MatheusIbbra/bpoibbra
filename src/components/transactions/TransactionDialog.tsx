import { useState, useEffect, useMemo } from "react";
import { z } from "zod";
import { handleSupabaseError } from "@/lib/error-handler";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon, Loader2, Link2, EyeOff, Check, ChevronsUpDown } from "lucide-react";
import { TransactionComments } from "@/components/transactions/TransactionComments";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useCategories, CategoryType } from "@/hooks/useCategories";
import { useAccounts } from "@/hooks/useAccounts";
import { useCostCenters } from "@/hooks/useCostCenters";
import { useTransactions, useCreateTransaction, useUpdateTransaction, Transaction, TransactionType } from "@/hooks/useTransactions";
import { cn } from "@/lib/utils";
import { formatCurrency, parseLocalDate } from "@/lib/formatters";

const transactionSchema = z.object({
  description: z.string().min(1, "Descrição é obrigatória"),
  amount: z.number().positive("Valor deve ser positivo"),
  paid_amount: z.number().optional(),
  type: z.enum(["income", "expense", "transfer", "investment", "redemption"]),
  category_id: z.string().optional(),
  account_id: z.string().min(1, "Conta é obrigatória"),
  destination_account_id: z.string().optional(),
  cost_center_id: z.string().optional(),
  financial_type: z.string().optional(),
  date: z.date(),
  accrual_date: z.date().optional(),
  due_date: z.date().optional(),
  payment_date: z.date().optional(),
  payment_method: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["pending", "completed", "cancelled"]).optional(),
  is_ignored: z.boolean().optional(),
  linked_existing_id: z.string().optional(),
});

type FormData = z.infer<typeof transactionSchema>;

interface TransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: Transaction | null;
  defaultType?: TransactionType;
  onSaved?: (newType?: string) => void;
}

// Types that don't require category/cost center
const TRANSFER_TYPES = ["transfer", "investment", "redemption"];

export function TransactionDialog({
  open,
  onOpenChange,
  transaction,
  defaultType = "transfer",
  onSaved,
}: TransactionDialogProps) {
  const [showLinkOption, setShowLinkOption] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      description: "",
      amount: 0,
      paid_amount: undefined,
      type: defaultType,
      category_id: undefined,
      account_id: undefined,
      destination_account_id: undefined,
      cost_center_id: undefined,
      financial_type: undefined,
      date: new Date(),
      accrual_date: undefined,
      due_date: undefined,
      payment_date: undefined,
      payment_method: undefined,
      notes: "",
      status: "completed",
      is_ignored: false,
      linked_existing_id: undefined,
    },
  });

  const type = form.watch("type");
  const isTransferType = TRANSFER_TYPES.includes(type);
  const accountId = form.watch("account_id");
  
  // Map type to category filter
  const getCategoryType = (): CategoryType | CategoryType[] | undefined => {
    switch (type) {
      case "income": return "income";
      case "expense": return "expense";
      case "investment": return "investment";
      case "redemption": return "redemption";
      default: return undefined;
    }
  };
  
  const { data: allCategoriesOfType } = useCategories(getCategoryType());
  
  // Filter to only show child categories (those with parent_id) for transaction creation
  const categories = allCategoriesOfType?.filter(cat => cat.parent_id !== null) || [];
  const { data: accounts } = useAccounts();
  const { data: costCenters } = useCostCenters();
  const { data: allTransactions } = useTransactions();
  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransaction();

  const activeAccounts = accounts?.filter((a) => a.status === "active") || [];
  const activeCostCenters = costCenters?.filter((c) => c.is_active) || [];

  // Get unlinked transactions that can be linked to (for transfer/investment/redemption)
  const linkableTransactions = allTransactions?.filter(t => 
    t.id !== transaction?.id &&
    !t.linked_transaction_id &&
    TRANSFER_TYPES.includes(t.type) &&
    t.account_id !== accountId
  ) || [];

  // Clear category and cost center when switching to transfer types
  useEffect(() => {
    if (isTransferType) {
      form.setValue("category_id", undefined);
      form.setValue("cost_center_id", undefined);
    }
    // Reset link option when type changes
    setShowLinkOption(false);
    form.setValue("linked_existing_id", undefined);
  }, [isTransferType, form, type]);

  useEffect(() => {
    if (transaction) {
      form.reset({
        description: transaction.description || "",
        amount: Number(transaction.amount),
        paid_amount: transaction.paid_amount ? Number(transaction.paid_amount) : undefined,
        type: transaction.type as TransactionType,
        category_id: transaction.category_id || undefined,
        account_id: transaction.account_id,
        destination_account_id: undefined,
        cost_center_id: transaction.cost_center_id || undefined,
        financial_type: (transaction as any).financial_type || undefined,
        date: parseLocalDate(transaction.date),
        accrual_date: transaction.accrual_date ? parseLocalDate(transaction.accrual_date) : undefined,
        due_date: transaction.due_date ? parseLocalDate(transaction.due_date) : undefined,
        payment_date: transaction.payment_date ? parseLocalDate(transaction.payment_date) : undefined,
        payment_method: transaction.payment_method || undefined,
        notes: transaction.notes || "",
        status: transaction.status,
        is_ignored: transaction.is_ignored || false,
        linked_existing_id: undefined,
      });
    } else {
      form.reset({
        description: "",
        amount: 0,
        paid_amount: undefined,
        type: defaultType,
        category_id: undefined,
        account_id: undefined,
        destination_account_id: undefined,
        cost_center_id: undefined,
        financial_type: undefined,
        date: new Date(),
        accrual_date: undefined,
        due_date: undefined,
        payment_date: undefined,
        payment_method: undefined,
        notes: "",
        status: "completed",
        is_ignored: false,
        linked_existing_id: undefined,
      });
    }
    setShowLinkOption(false);
  }, [transaction, defaultType, form]);

  const onSubmit = async (data: FormData) => {
    try {
      const payload = {
        description: data.description,
        amount: data.amount,
        paid_amount: data.paid_amount || null,
        type: data.type as TransactionType,
        category_id: isTransferType ? null : (data.category_id || null),
        account_id: data.account_id,
        destination_account_id: data.destination_account_id,
        cost_center_id: isTransferType ? null : (data.cost_center_id || null),
        financial_type: isTransferType ? null : (categories?.find(c => c.id === data.category_id)?.expense_classification || null),
        date: format(data.date, "yyyy-MM-dd"),
        accrual_date: data.accrual_date ? format(data.accrual_date, "yyyy-MM-dd") : format(data.date, "yyyy-MM-dd"),
        due_date: data.due_date ? format(data.due_date, "yyyy-MM-dd") : null,
        payment_date: data.payment_date ? format(data.payment_date, "yyyy-MM-dd") : null,
        payment_method: data.payment_method || null,
        notes: data.notes || null,
        status: data.status || "completed",
        is_ignored: data.is_ignored || false,
        linked_existing_id: data.linked_existing_id,
      };
      
      if (transaction) {
        await updateTransaction.mutateAsync({ id: transaction.id, ...payload });
      } else {
        await createTransaction.mutateAsync(payload);
      }
      
      onOpenChange(false);
      form.reset();
      
      // Notify parent about the saved type for redirection
      if (onSaved) {
        onSaved(data.type);
      }
    } catch (error: any) {
      handleSupabaseError(error, "salvar transação");
    }
  };

  const isLoading = createTransaction.isPending || updateTransaction.isPending;

  const getAccountLabel = () => {
    if (type === "transfer") return "Conta de Origem (débito)";
    if (type === "investment") return "Conta de Origem (débito)";
    if (type === "redemption") return "Conta de Origem (débito)";
    return "Conta Bancária";
  };

  const showDestinationAccount = isTransferType && !showLinkOption;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto [&_input]:bg-white [&_input]:dark:bg-muted [&_textarea]:bg-white [&_textarea]:dark:bg-muted">
        <DialogHeader>
          <DialogTitle>
            {transaction ? "Editar Transação" : "Nova Transação"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-white dark:bg-muted">
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="income">Receita</SelectItem>
                        <SelectItem value="expense">Despesa</SelectItem>
                        <SelectItem value="transfer">Transferência entre contas</SelectItem>
                        <SelectItem value="investment">Aplicação</SelectItem>
                        <SelectItem value="redemption">Resgate</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor (R$)</FormLabel>
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

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Salário" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className={cn("grid gap-4", showDestinationAccount ? "grid-cols-2" : "grid-cols-1")}>
              <FormField
                control={form.control}
                name="account_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{getAccountLabel()}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-white dark:bg-muted">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {activeAccounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.name} ({acc.bank_name})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {showDestinationAccount && (
                <FormField
                  control={form.control}
                  name="destination_account_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Conta de Destino (crédito)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-white dark:bg-muted">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {activeAccounts
                            .filter((acc) => acc.id !== form.watch("account_id"))
                            .map((acc) => (
                              <SelectItem key={acc.id} value={acc.id}>
                                {acc.name} ({acc.bank_name})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Link to existing transaction option - only for transfer types */}
            {isTransferType && !transaction && (
              <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="link-option"
                    checked={showLinkOption}
                    onCheckedChange={(checked) => {
                      setShowLinkOption(checked === true);
                      if (!checked) {
                        form.setValue("linked_existing_id", undefined);
                      }
                    }}
                  />
                  <label htmlFor="link-option" className="text-sm font-medium flex items-center gap-2 cursor-pointer">
                    <Link2 className="h-4 w-4" />
                    Vincular a lançamento existente
                  </label>
                </div>

                {showLinkOption && (
                  <FormField
                    control={form.control}
                    name="linked_existing_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Selecionar lançamento</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-white dark:bg-muted">
                              <SelectValue placeholder="Selecione um lançamento..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {linkableTransactions.length === 0 ? (
                              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                                Nenhum lançamento disponível para vincular
                              </div>
                            ) : (
                              linkableTransactions.map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                  <div className="flex flex-col">
                                    <span>{t.description}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {formatCurrency(Number(t.amount))} • {format(parseLocalDate(t.date), "dd/MM/yyyy")}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Vincule esta transação a um lançamento existente para criar o par de entrada/saída.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            )}

            {/* Category and Cost Center - only for income/expense */}
            {!isTransferType && (
              <>
                <FormField
                  control={form.control}
                  name="category_id"
                  render={({ field }) => {
                    const selectedCat = categories?.find(c => c.id === field.value);
                    return (
                      <FormItem className="flex flex-col">
                        <FormLabel>Categoria</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  "w-full justify-between bg-white dark:bg-muted font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {selectedCat ? selectedCat.name : "Buscar categoria..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent 
                            className="w-[--radix-popover-trigger-width] p-0" 
                            align="start"
                            onWheel={(e) => e.stopPropagation()}
                          >
                            <Command filter={(value, search) => {
                              const cat = categories?.find(c => c.id === value);
                              if (!cat) return 0;
                              return cat.name.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
                            }}>
                              <CommandInput placeholder="Digitar para buscar..." />
                              <CommandList className="max-h-[200px] overflow-y-auto">
                                <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
                                <CommandGroup>
                                  {categories?.map((cat) => (
                                    <CommandItem
                                      key={cat.id}
                                      value={cat.id}
                                      onSelect={(val) => {
                                        field.onChange(val);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          field.value === cat.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {cat.name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />

                <FormField
                  control={form.control}
                  name="cost_center_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Centro de Custo</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-white dark:bg-muted">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {activeCostCenters.map((cc) => (
                            <SelectItem key={cc.id} value={cc.id}>
                              {cc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

              </>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data Caixa</FormLabel>
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

              <FormField
                control={form.control}
                name="accrual_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data Competência</FormLabel>
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
                              <span>Igual caixa</span>
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
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Observações opcionais..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Ignore option */}
            <FormField
              control={form.control}
              name="is_ignored"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="flex items-center gap-2 cursor-pointer">
                      <EyeOff className="h-4 w-4" />
                      Ignorar esta movimentação
                    </FormLabel>
                    <FormDescription>
                      Movimentações ignoradas não serão contabilizadas nos relatórios e saldos.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            {/* Comentários - só em edição */}
            {transaction && (
              <TransactionComments transactionId={transaction.id} />
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {transaction ? "Salvar" : "Criar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
