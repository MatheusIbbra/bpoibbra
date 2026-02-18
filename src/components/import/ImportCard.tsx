import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useAccounts } from "@/hooks/useAccounts";
import { useCreateTransaction } from "@/hooks/useTransactions";
import { useCreateFileImport } from "@/hooks/useFileImports";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { Upload, FileSpreadsheet, Loader2, CheckCircle, AlertCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { handleSupabaseError } from "@/lib/error-handler";
import Papa from "papaparse";

interface ImportCardProps {
  className?: string;
}

interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
}

export function ImportCard({ className }: ImportCardProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<{
    success: number;
    failed: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: accounts, isLoading: accountsLoading } = useAccounts();
  const createTransaction = useCreateTransaction();
  const createFileImport = useCreateFileImport();
  const { requiresBaseSelection } = useBaseFilter();

  const activeAccounts = accounts?.filter((a) => a.status === "active") || [];

  const parseCSV = (file: File): Promise<ParsedTransaction[]> => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const transactions: ParsedTransaction[] = [];
          
          results.data.forEach((row: any) => {
            // Try to detect columns - common patterns
            const dateFields = ["data", "date", "dt", "Data", "DATE", "Data Lançamento", "Data Movimentação"];
            const descFields = ["descricao", "description", "desc", "Descrição", "Descricao", "Histórico", "historico", "Lancamento"];
            const amountFields = ["valor", "amount", "value", "Valor", "VALOR", "Quantia"];
            
            let date = "";
            let description = "";
            let amount = 0;

            // Find date
            for (const field of dateFields) {
              if (row[field]) {
                date = row[field];
                break;
              }
            }

            // Find description
            for (const field of descFields) {
              if (row[field]) {
                description = row[field];
                break;
              }
            }

            // Find amount
            for (const field of amountFields) {
              if (row[field]) {
                // Handle Brazilian number format (1.234,56)
                let amountStr = String(row[field])
                  .replace(/[R$\s]/g, "")
                  .replace(/\./g, "")
                  .replace(",", ".");
                amount = parseFloat(amountStr);
                break;
              }
            }

            // Parse date - try common formats
            let parsedDate = "";
            if (date) {
              // DD/MM/YYYY or DD-MM-YYYY
              const brMatch = date.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
              if (brMatch) {
                parsedDate = `${brMatch[3]}-${brMatch[2].padStart(2, "0")}-${brMatch[1].padStart(2, "0")}`;
              } else {
                // YYYY-MM-DD
                const isoMatch = date.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
                if (isoMatch) {
                  parsedDate = `${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`;
                }
              }
            }

            if (parsedDate && description && !isNaN(amount) && amount !== 0) {
              transactions.push({
                date: parsedDate,
                description: description.trim(),
                amount: Math.abs(amount),
                type: amount >= 0 ? "income" : "expense",
              });
            }
          });

          resolve(transactions);
        },
        error: (error) => {
          reject(error);
        },
      });
    });
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedAccountId) return;

    setIsImporting(true);
    setProgress(0);
    setImportResult(null);

    try {
      // Parse file
      const transactions = await parseCSV(file);

      if (transactions.length === 0) {
        toast.error("Nenhuma transação válida encontrada no arquivo");
        setIsImporting(false);
        return;
      }

      // Create file import record
      const fileImport = await createFileImport.mutateAsync({
        file_name: file.name,
        account_id: selectedAccountId,
        total_rows: transactions.length,
        status: "processing",
      });

      // Import transactions
      let success = 0;
      let failed = 0;

      for (let i = 0; i < transactions.length; i++) {
        try {
          await createTransaction.mutateAsync({
            description: transactions[i].description,
            amount: transactions[i].amount,
            date: transactions[i].date,
            type: transactions[i].type,
            account_id: selectedAccountId,
          });
          success++;
        } catch (error) {
          handleSupabaseError(error, "importar transação");
          failed++;
        }

        setProgress(Math.round(((i + 1) / transactions.length) * 100));
      }

      setImportResult({ success, failed });
      toast.success(`${success} transações importadas com sucesso!`);

      if (failed > 0) {
        toast.warning(`${failed} transações falharam ao importar`);
      }
    } catch (error) {
      handleSupabaseError(error, "importar arquivo");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSelectFile = () => {
    if (!selectedAccountId) {
      toast.error("Selecione uma conta primeiro");
      return;
    }
    fileInputRef.current?.click();
  };

  // Block import when "Todas as bases" is selected
  if (requiresBaseSelection) {
    return (
      <Card className={cn("", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Extrato
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className="border-warning bg-warning/10">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <AlertDescription className="ml-2 text-sm">
              Selecione uma base específica no seletor acima para importar extratos.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileSpreadsheet className="h-5 w-5" />
          Importar Extrato
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>1. Selecione a Conta</Label>
          <Select
            value={selectedAccountId}
            onValueChange={setSelectedAccountId}
            disabled={isImporting}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Selecione uma conta..." />
            </SelectTrigger>
            <SelectContent>
              {accountsLoading ? (
                <SelectItem value="loading" disabled>
                  Carregando...
                </SelectItem>
              ) : activeAccounts.length === 0 ? (
                <SelectItem value="none" disabled>
                  Nenhuma conta ativa
                </SelectItem>
              ) : (
                activeAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name} ({account.bank_name})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>2. Selecione o Arquivo</Label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt"
            onChange={handleFileChange}
            className="hidden"
          />
          <Button
            variant="outline"
            className="w-full mt-1 gap-2"
            onClick={handleSelectFile}
            disabled={!selectedAccountId || isImporting}
          >
            {isImporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {isImporting ? "Importando..." : "Selecionar Arquivo CSV"}
          </Button>
          <p className="text-xs text-muted-foreground mt-1">
            Formatos aceitos: CSV com colunas Data, Descrição, Valor
          </p>
        </div>

        {isImporting && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-center text-muted-foreground">
              Importando... {progress}%
            </p>
          </div>
        )}

        {importResult && (
          <div className="rounded-lg border p-4 space-y-2">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm font-medium">
                {importResult.success} transações importadas
              </span>
            </div>
            {importResult.failed > 0 && (
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {importResult.failed} transações falharam
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
