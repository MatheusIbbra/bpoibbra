import { useState, useCallback } from "react";
import { Upload, FileText, Loader2, AlertCircle, Image, FileSpreadsheet, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useAccounts } from "@/hooks/useAccounts";
import { useCreateImportBatch, useProcessImport } from "@/hooks/useImportBatches";
import { supabase } from "@/integrations/supabase/client";
import { useBaseFilter } from "@/contexts/BaseFilterContext";

interface ExtractUploaderProps {
  onSuccess?: () => void;
}

const FILE_TYPE_CONFIG = {
  pdf: { icon: FileText, label: "PDF", color: "text-red-500" },
  ofx: { icon: FileSpreadsheet, label: "OFX", color: "text-green-500" },
  csv: { icon: FileSpreadsheet, label: "CSV", color: "text-blue-500" },
  image: { icon: Image, label: "Imagem", color: "text-purple-500" },
};

export function ExtractUploader({ onSuccess }: ExtractUploaderProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const { data: accounts } = useAccounts();
  const createBatch = useCreateImportBatch();
  const processImport = useProcessImport();
  const { requiresBaseSelection, getRequiredOrganizationId } = useBaseFilter();

  // Check if user can import
  const canImport = !requiresBaseSelection && getRequiredOrganizationId() !== null;

  const getFileTypeFromExtension = (filename: string): string => {
    const extension = filename.toLowerCase().slice(filename.lastIndexOf(".") + 1);
    if (extension === "ofx" || extension === "qfx") return "ofx";
    if (extension === "csv" || extension === "txt") return "csv";
    if (extension === "pdf") return "pdf";
    if (["jpg", "jpeg", "png", "webp", "heic"].includes(extension)) return "image";
    return "";
  };

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    setError(null);
    
    if (selectedFile) {
      // Validate file type
      const validExtensions = [".ofx", ".qfx", ".csv", ".txt", ".pdf", ".jpg", ".jpeg", ".png", ".webp"];
      const extension = selectedFile.name.toLowerCase().slice(selectedFile.name.lastIndexOf("."));
      
      if (!validExtensions.includes(extension)) {
        setError("Tipo de arquivo não suportado. Use arquivos OFX, CSV, PDF ou imagens (JPG, PNG).");
        return;
      }
      
      // Validate file size (20MB max)
      if (selectedFile.size > 20 * 1024 * 1024) {
        setError("Arquivo muito grande. Tamanho máximo: 20MB.");
        return;
      }
      
      setFile(selectedFile);
      setFileType(getFileTypeFromExtension(selectedFile.name));
    }
  }, []);

  const handleUpload = async () => {
    if (!file || !selectedAccountId) {
      setError("Selecione uma conta e um arquivo para importar.");
      return;
    }

    // Get the selected account to use its organization_id
    const selectedAccount = accounts?.find(acc => acc.id === selectedAccountId);
    if (!selectedAccount) {
      setError("Conta não encontrada.");
      return;
    }

    // IMPORTANT: Use the account's organization_id, not the filter context
    // This ensures transactions are imported to the correct client's base
    const accountOrganizationId = selectedAccount.organization_id;
    if (!accountOrganizationId) {
      setError("A conta selecionada não está vinculada a uma organização.");
      return;
    }

    setUploading(true);
    setProgress(10);
    setError(null);

    try {
      const detectedFileType = fileType || getFileTypeFromExtension(file.name);
      
      if (!detectedFileType) {
        throw new Error("Tipo de arquivo não reconhecido.");
      }

      // Sanitize file name - remove special characters and spaces
      const sanitizedFileName = file.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove accents
        .replace(/[^a-zA-Z0-9._-]/g, "_") // Replace special chars with underscore
        .replace(/_+/g, "_"); // Replace multiple underscores with single

      // Generate file path using account's organization
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filePath = `${accountOrganizationId}/${selectedAccountId}/${timestamp}_${sanitizedFileName}`;

      setProgress(20);

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("extratos")
        .upload(filePath, file);

      if (uploadError) throw new Error("Erro ao fazer upload: " + uploadError.message);

      setProgress(40);

      // Create import batch using the account's organization
      const batch = await createBatch.mutateAsync({
        organizationId: accountOrganizationId,
        accountId: selectedAccountId,
        fileName: file.name,
        filePath,
        fileType: detectedFileType === "image" ? "pdf" : detectedFileType, // Treat images like PDFs (AI will parse)
        fileSize: file.size,
      });

      setProgress(50);

      // Process based on file type - use account's organization
      if (detectedFileType === "pdf" || detectedFileType === "image") {
        // Send file path for AI parsing
        await processImport.mutateAsync({
          batchId: batch.id,
          organizationId: accountOrganizationId,
          accountId: selectedAccountId,
          filePath,
          fileType: detectedFileType === "image" ? "pdf" : "pdf", // Images processed same as PDF
        });
      } else {
        // Read file content for text-based formats (OFX, CSV)
        const fileContent = await file.text();
        setProgress(60);

        await processImport.mutateAsync({
          batchId: batch.id,
          organizationId: accountOrganizationId,
          accountId: selectedAccountId,
          fileContent,
          fileType: detectedFileType as "ofx" | "csv" | "pdf",
        });
      }

      setProgress(100);

      // Reset form
      setFile(null);
      setFileType("");
      setSelectedAccountId("");
      
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao processar importação");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      const fakeEvent = {
        target: { files: [droppedFile] }
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleFileChange(fakeEvent);
    }
  };

  if (!accounts || accounts.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Você precisa ter pelo menos uma conta bancária cadastrada para importar extratos.
        </AlertDescription>
      </Alert>
    );
  }

  if (requiresBaseSelection) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Selecione uma base específica no menu superior para importar extratos. 
          Isso garante que as transações sejam importadas na organização correta.
        </AlertDescription>
      </Alert>
    );
  }

  const FileIcon = fileType ? FILE_TYPE_CONFIG[fileType as keyof typeof FILE_TYPE_CONFIG]?.icon || File : Upload;
  const fileColor = fileType ? FILE_TYPE_CONFIG[fileType as keyof typeof FILE_TYPE_CONFIG]?.color || "" : "";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Importar Extrato Bancário
        </CardTitle>
        <CardDescription>
          Faça upload de arquivos OFX, CSV, PDF ou imagens para importar transações
        </CardDescription>
        <div className="flex flex-wrap gap-2 pt-2">
          <Badge variant="secondary" className="text-xs">
            <FileSpreadsheet className="h-3 w-3 mr-1" />
            OFX/QFX
          </Badge>
          <Badge variant="secondary" className="text-xs">
            <FileSpreadsheet className="h-3 w-3 mr-1" />
            CSV
          </Badge>
          <Badge variant="secondary" className="text-xs">
            <FileText className="h-3 w-3 mr-1" />
            PDF
          </Badge>
          <Badge variant="secondary" className="text-xs">
            <Image className="h-3 w-3 mr-1" />
            Imagens
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label>Conta Bancária</Label>
          <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a conta" />
            </SelectTrigger>
            <SelectContent>
              {accounts?.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name} {account.bank_name && `- ${account.bank_name}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div
          className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => document.getElementById("file-upload")?.click()}
        >
          <input
            id="file-upload"
            type="file"
            accept=".ofx,.qfx,.csv,.txt,.pdf,.jpg,.jpeg,.png,.webp"
            onChange={handleFileChange}
            className="hidden"
          />
          
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <FileIcon className={`h-8 w-8 ${fileColor || "text-primary"}`} />
              <div className="text-left">
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB • {FILE_TYPE_CONFIG[fileType as keyof typeof FILE_TYPE_CONFIG]?.label || "Arquivo"}
                </p>
              </div>
            </div>
          ) : (
            <>
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                Arraste um arquivo aqui ou clique para selecionar
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                OFX, CSV, PDF ou imagens • Tamanho máximo: 20MB
              </p>
            </>
          )}
        </div>

        {uploading && (
          <div className="space-y-2">
            <Progress value={progress} />
            <p className="text-sm text-muted-foreground text-center">
              {progress < 40 && "Fazendo upload..."}
              {progress >= 40 && progress < 60 && "Criando lote de importação..."}
              {progress >= 60 && progress < 100 && "Processando transações com IA..."}
              {progress === 100 && "Concluído!"}
            </p>
          </div>
        )}

        <Button
          onClick={handleUpload}
          disabled={!file || !selectedAccountId || uploading}
          className="w-full"
        >
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Importar Extrato
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
