import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateTransaction } from "@/hooks/useTransactions";
import { useAccounts } from "@/hooks/useAccounts";
import { useCreateFileImport } from "@/hooks/useFileImports";
import { Upload, FileText, Loader2, Check, AlertCircle, X } from "lucide-react";
import Papa from "papaparse";
import { toast } from "sonner";
import { handleSupabaseError } from "@/lib/error-handler";

interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  selected: boolean;
}

const DATE_FORMATS = [
  { value: "dd/MM/yyyy", label: "DD/MM/AAAA (31/12/2024)" },
  { value: "yyyy-MM-dd", label: "AAAA-MM-DD (2024-12-31)" },
  { value: "MM/dd/yyyy", label: "MM/DD/AAAA (12/31/2024)" },
];

const BANKS = [
  "Nubank",
  "Itaú",
  "Bradesco",
  "Santander",
  "Banco do Brasil",
  "Caixa Econômica",
  "Inter",
  "C6 Bank",
  "BTG Pactual",
  "XP Investimentos",
  "Outros",
];

interface ImportExtractDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ImportExtractDialog({ open: externalOpen, onOpenChange: externalOnOpenChange }: ImportExtractDialogProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = externalOnOpenChange || setInternalOpen;
  
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedTransaction[]>([]);
  const [dateFormat, setDateFormat] = useState("dd/MM/yyyy");
  const [dateColumn, setDateColumn] = useState("");
  const [descColumn, setDescColumn] = useState("");
  const [amountColumn, setAmountColumn] = useState("");
  const [columns, setColumns] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  
  // Pre-filtering fields
  const [bankName, setBankName] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createTransaction = useCreateTransaction();
  const createFileImport = useCreateFileImport();
  const { data: accounts } = useAccounts();

  const activeAccounts = accounts?.filter((a) => a.status === "active") || [];

  const parseDate = (dateStr: string, format: string): string => {
    if (!dateStr) return "";
    
    const cleanDate = dateStr.trim();
    
    try {
      if (format === "dd/MM/yyyy") {
        const [day, month, year] = cleanDate.split("/");
        return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      } else if (format === "yyyy-MM-dd") {
        return cleanDate;
      } else if (format === "MM/dd/yyyy") {
        const [month, day, year] = cleanDate.split("/");
        return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      }
    } catch {
      return "";
    }
    return "";
  };

  const parseAmount = (amountStr: string): { amount: number; type: "income" | "expense" } => {
    if (!amountStr) return { amount: 0, type: "expense" };
    
    const cleanStr = amountStr.replace(/[R$\s]/g, "").replace(",", ".");
    const amount = parseFloat(cleanStr);
    
    if (isNaN(amount)) return { amount: 0, type: "expense" };
    
    return {
      amount: Math.abs(amount),
      type: amount >= 0 ? "income" : "expense",
    };
  };

  const handleProceedToUpload = () => {
    if (!bankName) {
      toast.error("Selecione o banco");
      return;
    }
    setShowUpload(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setIsParsing(true);

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.meta.fields) {
          setColumns(results.meta.fields);
          const fields = results.meta.fields.map((f) => f.toLowerCase());
          
          const dateCol = results.meta.fields.find((f, i) => 
            ["data", "date", "dt", "data_lancamento"].includes(fields[i])
          );
          const descCol = results.meta.fields.find((f, i) => 
            ["descricao", "description", "desc", "historico", "lancamento"].includes(fields[i])
          );
          const amountCol = results.meta.fields.find((f, i) => 
            ["valor", "amount", "value", "vlr"].includes(fields[i])
          );

          if (dateCol) setDateColumn(dateCol);
          if (descCol) setDescColumn(descCol);
          if (amountCol) setAmountColumn(amountCol);
        }
        setIsParsing(false);
      },
      error: () => {
        toast.error("Erro ao ler o arquivo CSV");
        setIsParsing(false);
      },
    });
  };

  const handleProcessFile = () => {
    if (!file || !dateColumn || !descColumn || !amountColumn) {
      toast.error("Selecione todas as colunas necessárias");
      return;
    }

    setIsParsing(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const transactions: ParsedTransaction[] = results.data
          .filter((row: any) => row[dateColumn] && row[descColumn] && row[amountColumn])
          .map((row: any) => {
            const { amount, type } = parseAmount(row[amountColumn]);
            return {
              date: parseDate(row[dateColumn], dateFormat),
              description: row[descColumn].trim(),
              amount,
              type,
              selected: true,
            };
          })
          .filter((tx) => tx.date && tx.amount > 0);

        setParsedData(transactions);
        setIsParsing(false);

        if (transactions.length === 0) {
          toast.error("Nenhuma transação válida encontrada no arquivo");
        }
      },
      error: () => {
        toast.error("Erro ao processar o arquivo");
        setIsParsing(false);
      },
    });
  };

  const toggleTransaction = (index: number) => {
    setParsedData((prev) =>
      prev.map((tx, i) => (i === index ? { ...tx, selected: !tx.selected } : tx))
    );
  };

  const handleImport = async () => {
    const selectedTransactions = parsedData.filter((tx) => tx.selected);
    if (selectedTransactions.length === 0) {
      toast.error("Selecione pelo menos uma transação para importar");
      return;
    }

    if (!selectedAccountId) {
      toast.error("Selecione uma conta bancária");
      return;
    }

    setIsImporting(true);

    try {
      // Create file import record first
      await createFileImport.mutateAsync({
        file_name: file?.name || "importacao",
        account_id: selectedAccountId,
        total_rows: selectedTransactions.length,
        status: "processing",
      });

      // Import transactions
      for (const tx of selectedTransactions) {
        await createTransaction.mutateAsync({
          date: tx.date,
          description: tx.description,
          amount: tx.amount,
          type: tx.type,
          account_id: selectedAccountId,
          status: "pending",
        });
      }

      toast.success(`${selectedTransactions.length} transações importadas com sucesso!`);
      setOpen(false);
      resetState();
    } catch (error) {
      handleSupabaseError(error, "importar transações");
    } finally {
      setIsImporting(false);
    }
  };

  const resetState = () => {
    setFile(null);
    setParsedData([]);
    setColumns([]);
    setDateColumn("");
    setDescColumn("");
    setAmountColumn("");
    setBankName("");
    setSelectedAccountId("");
    setShowUpload(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const selectedCount = parsedData.filter((tx) => tx.selected).length;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) resetState(); }}>
      {externalOpen === undefined && (
        <DialogTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Upload className="h-4 w-4" />
            Importar Extrato
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Extrato Bancário</DialogTitle>
          <DialogDescription>
            Importe transações a partir de um arquivo CSV do seu banco
          </DialogDescription>
        </DialogHeader>

        {!showUpload ? (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Antes de importar, selecione a origem e a conta
              </AlertDescription>
            </Alert>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Banco / Instituição *</Label>
                <Select value={bankName} onValueChange={setBankName}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o banco..." />
                  </SelectTrigger>
                  <SelectContent>
                    {BANKS.map((bank) => (
                      <SelectItem key={bank} value={bank}>
                        {bank}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Conta Bancária *</Label>
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Vincular a uma conta..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activeAccounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.name} ({acc.bank_name})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={handleProceedToUpload} className="w-full" disabled={!bankName || !selectedAccountId}>
              Continuar para Upload
            </Button>
          </div>
        ) : parsedData.length === 0 ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary">{bankName}</Badge>
              {selectedAccountId && (
                <Badge variant="outline">
                  {activeAccounts.find((a) => a.id === selectedAccountId)?.name}
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={() => setShowUpload(false)}>
                Alterar
              </Button>
            </div>

            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8">
              <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="mb-2 text-sm text-muted-foreground">
                Selecione um arquivo CSV do seu extrato bancário
              </p>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="max-w-xs"
              />
            </div>

            {file && columns.length > 0 && (
              <>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Arquivo carregado: {file.name} ({columns.length} colunas encontradas)
                  </AlertDescription>
                </Alert>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Formato da Data</Label>
                    <Select value={dateFormat} onValueChange={setDateFormat}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DATE_FORMATS.map((format) => (
                          <SelectItem key={format.value} value={format.value}>
                            {format.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Coluna de Data</Label>
                    <Select value={dateColumn} onValueChange={setDateColumn}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map((col) => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Coluna de Descrição</Label>
                    <Select value={descColumn} onValueChange={setDescColumn}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map((col) => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Coluna de Valor</Label>
                    <Select value={amountColumn} onValueChange={setAmountColumn}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map((col) => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  onClick={handleProcessFile}
                  disabled={!dateColumn || !descColumn || !amountColumn || isParsing}
                  className="w-full"
                >
                  {isParsing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  Processar Arquivo
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {selectedCount} de {parsedData.length} transações selecionadas
              </p>
              <Button variant="outline" size="sm" onClick={() => setParsedData([])}>
                <X className="mr-2 h-4 w-4" />
                Voltar
              </Button>
            </div>

            <ScrollArea className="h-[300px] rounded-lg border">
              <div className="p-4 space-y-2">
                {parsedData.map((tx, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      tx.selected ? "bg-primary/5 border-primary" : "bg-muted/30"
                    }`}
                    onClick={() => toggleTransaction(index)}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={tx.selected}
                        onChange={() => {}}
                        className="h-4 w-4"
                      />
                      <div>
                        <p className="font-medium text-sm">{tx.description}</p>
                        <p className="text-xs text-muted-foreground">{tx.date}</p>
                      </div>
                    </div>
                    <Badge variant={tx.type === "income" ? "default" : "destructive"}>
                      {tx.type === "income" ? "+" : "-"} {formatCurrency(tx.amount)}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <Button onClick={handleImport} disabled={isImporting || selectedCount === 0} className="w-full">
              {isImporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Importar {selectedCount} Transações
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
