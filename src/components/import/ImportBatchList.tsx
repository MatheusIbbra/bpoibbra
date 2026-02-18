import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  FileText, 
  Trash2, 
  ChevronDown, 
  ChevronRight, 
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useImportBatches, useDeleteImportBatch, useClassifyTransactions, ImportBatch } from "@/hooks/useImportBatches";
import { supabase } from "@/integrations/supabase/client";

const statusConfig: Record<string, { label: string; icon: React.ReactNode; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", icon: <Clock className="h-3 w-3" />, variant: "secondary" },
  processing: { label: "Processando", icon: <Loader2 className="h-3 w-3 animate-spin" />, variant: "outline" },
  awaiting_validation: { label: "Aguardando Validação", icon: <AlertTriangle className="h-3 w-3" />, variant: "default" },
  completed: { label: "Concluído", icon: <CheckCircle2 className="h-3 w-3" />, variant: "secondary" },
  failed: { label: "Falhou", icon: <XCircle className="h-3 w-3" />, variant: "destructive" },
  cancelled: { label: "Cancelado", icon: <XCircle className="h-3 w-3" />, variant: "outline" },
};

export function ImportBatchList() {
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const [deleteBatchId, setDeleteBatchId] = useState<string | null>(null);
  const [deleteBatchName, setDeleteBatchName] = useState("");
  const [deleteBatchCount, setDeleteBatchCount] = useState(0);
  
  const { data: batches, isLoading } = useImportBatches();
  const deleteBatch = useDeleteImportBatch();
  const classifyTransactions = useClassifyTransactions();

  const handleClassify = async (batch: ImportBatch) => {
    // Get transaction IDs for this batch directly from supabase
    const { data: transactions } = await supabase
      .from("transactions")
      .select("id")
      .eq("import_batch_id", batch.id)
      .eq("validation_status", "pending_validation");
    
    if (transactions && transactions.length > 0) {
      await classifyTransactions.mutateAsync({
        transactionIds: transactions.map(t => t.id),
        organizationId: batch.organization_id,
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!batches || batches.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhuma importação realizada ainda</p>
          <p className="text-sm text-muted-foreground">
            Use o formulário acima para importar seu primeiro extrato
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de Importações</CardTitle>
        <CardDescription>
          Acompanhe suas importações e gerencie transações pendentes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {batches.map((batch) => {
          const status = statusConfig[batch.status] || statusConfig.pending;
          const isExpanded = expandedBatch === batch.id;

          return (
            <Collapsible
              key={batch.id}
              open={isExpanded}
              onOpenChange={() => setExpandedBatch(isExpanded ? null : batch.id)}
            >
              <div className="border rounded-lg p-4">
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <FileText className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">{batch.file_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {batch.accounts?.name} • {format(new Date(batch.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={status.variant} className="flex items-center gap-1">
                        {status.icon}
                        {status.label}
                      </Badge>
                    </div>
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent className="mt-4 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Total de Transações</p>
                      <p className="font-semibold">{batch.total_transactions}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Importadas</p>
                      <p className="font-semibold text-primary">{batch.imported_count}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Duplicatas</p>
                      <p className="font-semibold text-accent-foreground">{batch.duplicate_count}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Erros</p>
                      <p className="font-semibold text-destructive">{batch.error_count}</p>
                    </div>
                  </div>

                  {batch.period_start && batch.period_end && (
                    <div className="text-sm">
                      <p className="text-muted-foreground">Período</p>
                      <p>
                        {format(new Date(batch.period_start), "dd/MM/yyyy", { locale: ptBR })} - {" "}
                        {format(new Date(batch.period_end), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  )}

                  {batch.error_message && (
                    <div className="p-3 bg-destructive/10 rounded-lg text-sm text-destructive">
                      {batch.error_message}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    {batch.status === "awaiting_validation" && (
                      <Button 
                        size="sm" 
                        onClick={() => handleClassify(batch)}
                        disabled={classifyTransactions.isPending}
                      >
                        <Sparkles className="mr-2 h-4 w-4" />
                        Classificar com IA
                      </Button>
                    )}
                    
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        setDeleteBatchId(batch.id);
                        setDeleteBatchName(batch.file_name);
                        setDeleteBatchCount(batch.imported_count || 0);
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Excluir Lote
                    </Button>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </CardContent>
      <ConfirmDialog
        open={!!deleteBatchId}
        onOpenChange={() => setDeleteBatchId(null)}
        title="Excluir lote de importação?"
        description={
          <>
            Isso excluirá permanentemente o lote <strong>{deleteBatchName}</strong> e todas as{" "}
            <strong>{deleteBatchCount}</strong> transações importadas. Esta ação não pode ser desfeita.
          </>
        }
        confirmLabel="Excluir Lote"
        onConfirm={() => {
          if (deleteBatchId) {
            deleteBatch.mutate(deleteBatchId);
            setDeleteBatchId(null);
          }
        }}
      />
    </Card>
  );
}
