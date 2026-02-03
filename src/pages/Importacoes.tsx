import { AppLayout } from "@/components/layout/AppLayout";
import { ExtractUploader } from "@/components/import/ExtractUploader";
import { ImportBatchList } from "@/components/import/ImportBatchList";
import { Card, CardContent } from "@/components/ui/card";
import { FileUp } from "lucide-react";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { BaseRequiredAlert } from "@/components/common/BaseRequiredAlert";

export default function Importacoes() {
  const { requiresBaseSelection } = useBaseFilter();

  // Show base selection required state
  if (requiresBaseSelection) {
    return (
      <AppLayout title="Importação de Extratos">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Importação de Extratos</h1>
            <p className="text-muted-foreground">
              Importe extratos bancários e deixe a IA classificar suas transações
            </p>
          </div>
          <BaseRequiredAlert action="importar extratos" />
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <FileUp className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">Selecione uma base</h3>
              <p className="text-muted-foreground">
                Selecione uma base específica no menu superior para visualizar e importar extratos.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Importação de Extratos">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Importação de Extratos</h1>
          <p className="text-muted-foreground">
            Importe extratos bancários e deixe a IA classificar suas transações
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <ExtractUploader />
          <div className="lg:col-span-2">
            <ImportBatchList />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
