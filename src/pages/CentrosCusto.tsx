import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2, FolderKanban } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useCostCenters, useDeleteCostCenter } from "@/hooks/useCostCenters";
import { CostCenterDialog } from "@/components/cost-centers/CostCenterDialog";
import { BaseRequiredAlert, useCanCreate } from "@/components/common/BaseRequiredAlert";
import { FolderKanban as FolderKanbanEmpty } from "lucide-react";

export default function CentrosCusto() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCostCenter, setSelectedCostCenter] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: costCenters, isLoading } = useCostCenters();
  const deleteCostCenter = useDeleteCostCenter();
  const { canCreate } = useCanCreate();

  if (!user) {
    navigate("/auth");
    return null;
  }

  // Show base selection required state
  if (!canCreate) {
    return (
      <AppLayout title="Centros de Custo">
        <div className="space-y-6">
          <BaseRequiredAlert action="gerenciar centros de custo" />
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <FolderKanban className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">Selecione uma base</h3>
              <p className="text-muted-foreground">
                Selecione uma base específica no menu superior para visualizar e gerenciar centros de custo.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const handleEdit = (costCenter: any) => {
    setSelectedCostCenter(costCenter);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteCostCenter.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  const activeCenters = costCenters?.filter((c) => c.is_active) || [];
  const inactiveCenters = costCenters?.filter((c) => !c.is_active) || [];

  return (
    <AppLayout title="Centros de Custo">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-lg md:text-3xl font-bold">Centros de Custo</h1>
            <p className="text-muted-foreground">Organize suas despesas por departamento ou projeto</p>
          </div>
          <Button 
            onClick={() => { setSelectedCostCenter(null); setDialogOpen(true); }}
            disabled={!canCreate}
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo Centro de Custo
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <Card className="responsive-stat-card">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-2xl font-bold">{costCenters?.length || 0}</p>
            </CardContent>
          </Card>
          <Card className="responsive-stat-card">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Ativos</p>
              <p className="text-2xl font-bold text-success">{activeCenters.length}</p>
            </CardContent>
          </Card>
          <Card className="responsive-stat-card">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Inativos</p>
              <p className="text-2xl font-bold text-muted-foreground">{inactiveCenters.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Cost Centers List */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de Centros de Custo</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-center py-8">Carregando...</p>
            ) : costCenters?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <FolderKanban className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhum centro de custo cadastrado</p>
                <Button 
                  className="mt-4" 
                  onClick={() => setDialogOpen(true)}
                  disabled={!canCreate}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Centro de Custo
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {costCenters?.map((center) => (
                  <div
                    key={center.id}
                    className="flex items-center justify-between p-3 md:p-4 rounded-lg border gap-2"
                  >
                    <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                      <div className="h-8 w-8 md:h-10 md:w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <FolderKanban className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm md:text-base truncate">{center.name}</p>
                        {center.description && (
                          <p className="text-xs md:text-sm text-muted-foreground truncate">{center.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
                      <Badge variant={center.is_active ? "default" : "secondary"}>
                        {center.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(center)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => setDeleteId(center.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <CostCenterDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        costCenter={selectedCostCenter}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir centro de custo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. As transações vinculadas perderão a referência ao centro de custo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
