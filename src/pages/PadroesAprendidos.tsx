import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Brain, 
  Shield, 
  Loader2, 
  Trash2, 
  Search,
  Building2,
  Tag,
  FolderKanban,
  Calendar,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  BarChart3
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppLayout } from "@/components/layout/AppLayout";
import { useIsAdmin } from "@/hooks/useUserRoles";
import { useAllTransactionPatterns, useDeleteTransactionPattern } from "@/hooks/useTransactionPatternsAdmin";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/lib/formatters";

function AccessDenied() {
  const navigate = useNavigate();
  
  return (
    <AppLayout title="Padrões Aprendidos">
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center">
          <Shield className="h-10 w-10 text-destructive" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">Acesso Restrito</h2>
          <p className="text-muted-foreground max-w-md">
            Você não tem permissão para acessar esta página. 
            Apenas administradores podem visualizar os padrões aprendidos.
          </p>
        </div>
        <Button onClick={() => navigate("/")} size="lg">
          Voltar ao Início
        </Button>
      </div>
    </AppLayout>
  );
}

export default function PadroesAprendidos() {
  const navigate = useNavigate();
  const { isAdmin, isLoading: checkingAdmin } = useIsAdmin();
  const { data: patterns, isLoading: loadingPatterns } = useAllTransactionPatterns();
  const deletePattern = useDeleteTransactionPattern();

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [orgFilter, setOrgFilter] = useState<string>("all");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  if (checkingAdmin) {
    return (
      <AppLayout title="Padrões Aprendidos">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!isAdmin) {
    return <AccessDenied />;
  }

  // Get unique organizations for filter
  const uniqueOrgs = patterns 
    ? [...new Set(patterns.map(p => p.organization_name).filter(Boolean))]
    : [];

  // Filter patterns
  const filteredPatterns = patterns?.filter(pattern => {
    const matchesSearch = !searchQuery || 
      pattern.normalized_description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pattern.category_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pattern.organization_name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = typeFilter === "all" || pattern.transaction_type === typeFilter;
    const matchesOrg = orgFilter === "all" || pattern.organization_name === orgFilter;

    return matchesSearch && matchesType && matchesOrg;
  }) || [];

  const handleDelete = (patternId: string) => {
    deletePattern.mutate(patternId);
    setDeleteConfirm(null);
  };

  const getConfidenceColor = (confidence: number | null) => {
    if (!confidence) return "text-muted-foreground";
    if (confidence >= 0.85) return "text-primary";
    if (confidence >= 0.7) return "text-warning";
    return "text-muted-foreground";
  };

  const getConfidenceBadge = (confidence: number | null) => {
    if (!confidence) return <Badge variant="outline">N/A</Badge>;
    if (confidence >= 0.85) return <Badge className="bg-primary/10 text-primary border-primary/20">{(confidence * 100).toFixed(0)}%</Badge>;
    if (confidence >= 0.7) return <Badge className="bg-warning/10 text-warning border-warning/20">{(confidence * 100).toFixed(0)}%</Badge>;
    return <Badge variant="outline">{(confidence * 100).toFixed(0)}%</Badge>;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "income":
        return <TrendingUp className="h-4 w-4 text-primary" />;
      case "expense":
        return <TrendingDown className="h-4 w-4 text-destructive" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "income":
        return "Receita";
      case "expense":
        return "Despesa";
      case "investment":
        return "Investimento";
      case "redemption":
        return "Resgate";
      default:
        return type;
    }
  };

  // Stats
  const totalPatterns = patterns?.length || 0;
  const highConfidencePatterns = patterns?.filter(p => (p.confidence || 0) >= 0.85).length || 0;
  const totalOccurrences = patterns?.reduce((sum, p) => sum + (p.occurrences || 0), 0) || 0;

  return (
    <AppLayout title="Padrões Aprendidos">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Brain className="h-7 w-7 text-primary" />
              Padrões Aprendidos
            </h1>
            <p className="text-muted-foreground">
              Visualize e gerencie os padrões de classificação aprendidos pelo sistema
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between py-2 px-3 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">Total de Padrões</CardTitle>
              <Brain className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="py-2 px-3">
              <div className="text-lg font-bold">{totalPatterns}</div>
              <p className="text-[10px] text-muted-foreground hidden sm:block">
                Padrões únicos aprendidos
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between py-2 px-3 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">Alta Confiança</CardTitle>
              <BarChart3 className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent className="py-2 px-3">
              <div className="text-lg font-bold text-primary">{highConfidencePatterns}</div>
              <p className="text-[10px] text-muted-foreground hidden sm:block">
                Padrões com ≥85% confiança
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between py-2 px-3 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">Total de Ocorrências</CardTitle>
              <Tag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="py-2 px-3">
              <div className="text-lg font-bold">{totalOccurrences}</div>
              <p className="text-[10px] text-muted-foreground hidden sm:block">
                Transações classificadas
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Table */}
        <Card>
          <CardHeader className="border-b bg-muted/30">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Histórico de Aprendizado</CardTitle>
                <CardDescription>
                  {filteredPatterns.length} padrões encontrados
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar descrição..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-48"
                  />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="income">Receita</SelectItem>
                    <SelectItem value="expense">Despesa</SelectItem>
                    <SelectItem value="investment">Investimento</SelectItem>
                    <SelectItem value="redemption">Resgate</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={orgFilter} onValueChange={setOrgFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Organização" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Bases</SelectItem>
                    {uniqueOrgs.map(org => (
                      <SelectItem key={org} value={org || ""}>{org}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loadingPatterns ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredPatterns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Brain className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">Nenhum padrão encontrado</p>
                <p className="text-sm">
                  {searchQuery || typeFilter !== "all" || orgFilter !== "all"
                    ? "Tente ajustar os filtros"
                    : "O sistema aprenderá conforme transações forem validadas"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="min-w-[200px]">Descrição Normalizada</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Centro de Custo</TableHead>
                      <TableHead className="min-w-[140px]">Organização</TableHead>
                      <TableHead className="text-right">Valor Médio</TableHead>
                      <TableHead className="text-center">Ocorrências</TableHead>
                      <TableHead className="text-center">Confiança</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead>Último Uso</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPatterns.map((pattern) => (
                      <TableRow key={pattern.id} className="group">
                        <TableCell>
                          <div className="max-w-[250px]">
                            <p className="font-mono text-xs truncate" title={pattern.normalized_description}>
                              {pattern.normalized_description}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {getTypeIcon(pattern.transaction_type)}
                            <span className="text-sm">{getTypeLabel(pattern.transaction_type)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {pattern.category_name ? (
                            <div className="flex items-center gap-1.5">
                              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-sm">{pattern.category_name}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {pattern.cost_center_name ? (
                            <div className="flex items-center gap-1.5">
                              <FolderKanban className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-sm">{pattern.cost_center_name}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm truncate max-w-[120px]" title={pattern.organization_name || ""}>
                              {pattern.organization_name || "—"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {pattern.avg_amount ? formatCurrency(pattern.avg_amount) : "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="font-mono">
                            {pattern.occurrences || 0}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {getConfidenceBadge(pattern.confidence)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" />
                            {format(new Date(pattern.created_at), "dd/MM/yy", { locale: ptBR })}
                          </div>
                        </TableCell>
                        <TableCell>
                          {pattern.last_used_at ? (
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Calendar className="h-3.5 w-3.5" />
                              {format(new Date(pattern.last_used_at), "dd/MM/yy", { locale: ptBR })}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => setDeleteConfirm(pattern.id)}
                            title="Excluir padrão"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={() => setDeleteConfirm(null)}
        title="Excluir Padrão Aprendido"
        description="Tem certeza que deseja excluir este padrão? Esta ação não pode ser desfeita. O sistema poderá reaprender este padrão com novas validações."
        confirmLabel="Excluir Padrão"
        typeToConfirm="CONFIRMAR"
        typeToConfirmHint='Digite "CONFIRMAR" para excluir este padrão'
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
      />
    </AppLayout>
  );
}
