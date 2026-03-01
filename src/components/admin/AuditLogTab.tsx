import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Plus,
  Edit,
  Trash2,
  Lock,
  Unlock,
  FileText,
  History,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AuditLogEntry } from "@/hooks/useAuditLog";

export function AuditLogTab({ logs, loading }: { logs: AuditLogEntry[]; loading: boolean }) {
  const [actionFilter, setActionFilter] = useState("__all__");
  const [userFilter, setUserFilter] = useState("__all__");
  const [tableFilter, setTableFilter] = useState("__all__");

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case "create":
      case "insert":
      case "import_complete":
        return <Plus className="h-4 w-4 text-primary" />;
      case "update":
      case "edit":
      case "update_hierarchy":
      case "change_role":
        return <Edit className="h-4 w-4 text-blue-500" />;
      case "delete":
      case "remove":
      case "delete_client":
      case "delete_import_batch":
        return <Trash2 className="h-4 w-4 text-destructive" />;
      case "block_user":
      case "block_organization":
        return <Lock className="h-4 w-4 text-destructive" />;
      case "unblock_user":
      case "unblock_organization":
        return <Unlock className="h-4 w-4 text-green-600" />;
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActionColor = (action: string) => {
    if (action.includes("block") && !action.includes("unblock")) return "bg-destructive/10 text-destructive border-destructive/20";
    if (action.includes("unblock")) return "bg-green-500/10 text-green-600 border-green-200";
    if (action.includes("delete")) return "bg-destructive/10 text-destructive border-destructive/20";
    switch (action.toLowerCase()) {
      case "create":
      case "insert":
      case "import_complete":
        return "bg-primary/10 text-primary border-primary/20";
      case "update":
      case "edit":
      case "update_hierarchy":
      case "change_role":
        return "bg-blue-500/10 text-blue-600 border-blue-200";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const formatTableName = (name: string) => {
    const translations: Record<string, string> = {
      transactions: "Transações",
      accounts: "Contas",
      categories: "Categorias",
      cost_centers: "Centros de Custo",
      budgets: "Orçamentos",
      transfers: "Transferências",
      organizations: "Organizações",
      user_roles: "Permissões",
      profiles: "Perfis",
      import_batches: "Importações",
      user_hierarchy: "Hierarquia",
      reconciliation_rules: "Regras Conciliação",
    };
    return translations[name] || name;
  };

  const uniqueActions = [...new Set(logs.map(l => l.action))].sort();
  const uniqueTables = [...new Set(logs.map(l => l.table_name))].sort();
  const uniqueUsers = [...new Set(logs.map(l => l.user_name).filter(Boolean))].sort();

  const filteredLogs = logs.filter(log => {
    if (actionFilter && actionFilter !== "__all__" && log.action !== actionFilter) return false;
    if (tableFilter && tableFilter !== "__all__" && log.table_name !== tableFilter) return false;
    if (userFilter && userFilter !== "__all__" && log.user_name !== userFilter) return false;
    return true;
  });

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="border-b bg-muted/30">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Log de Auditoria
              </CardTitle>
              <CardDescription>
                {filteredLogs.length} de {logs.length} eventos
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue placeholder="Ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas ações</SelectItem>
                {uniqueActions.map(a => (
                  <SelectItem key={a} value={a} className="text-xs">{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={tableFilter} onValueChange={setTableFilter}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue placeholder="Tabela" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas tabelas</SelectItem>
                {uniqueTables.map(t => (
                  <SelectItem key={t} value={t} className="text-xs">{formatTableName(t)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue placeholder="Usuário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos usuários</SelectItem>
                {uniqueUsers.map(u => (
                  <SelectItem key={u!} value={u!} className="text-xs">{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(actionFilter && actionFilter !== "__all__" || tableFilter && tableFilter !== "__all__" || userFilter && userFilter !== "__all__") && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => { setActionFilter("__all__"); setTableFilter("__all__"); setUserFilter("__all__"); }}
              >
                Limpar filtros
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <History className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="font-medium">Nenhuma atividade registrada</p>
            <p className="text-sm text-muted-foreground">
              {logs.length > 0 ? "Tente ajustar os filtros" : "Ações dos usuários aparecerão aqui"}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 hover:bg-muted/30 transition-colors">
                <div className={`mt-1 h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${getActionColor(log.action)}`}>
                  {getActionIcon(log.action)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">
                      {log.user_name || "Sistema"}
                    </span>
                    <Badge variant="outline" className={`text-xs ${getActionColor(log.action)}`}>
                      {log.action}
                    </Badge>
                    <span className="text-muted-foreground text-xs sm:text-sm">em</span>
                    <Badge variant="secondary" className="text-xs">
                      {formatTableName(log.table_name)}
                    </Badge>
                    {log.org_name && (
                      <>
                        <span className="text-muted-foreground hidden sm:inline">•</span>
                        <span className="text-xs text-muted-foreground hidden sm:inline">{log.org_name}</span>
                      </>
                    )}
                  </div>
                  {log.record_id && (
                    <p className="text-xs text-muted-foreground mt-1 font-mono">
                      ID: {log.record_id.slice(0, 8)}...
                    </p>
                  )}
                  {(log.old_values || log.new_values) && (
                    <div className="mt-2 text-xs space-y-1 hidden sm:block">
                      {log.old_values && Object.keys(log.old_values).length > 0 && (
                        <div className="flex items-start gap-2">
                          <span className="text-destructive font-medium shrink-0">Antes:</span>
                          <code className="text-muted-foreground bg-muted px-1.5 py-0.5 rounded break-all">
                            {JSON.stringify(log.old_values).slice(0, 80)}
                            {JSON.stringify(log.old_values).length > 80 && "..."}
                          </code>
                        </div>
                      )}
                      {log.new_values && Object.keys(log.new_values).length > 0 && (
                        <div className="flex items-start gap-2">
                          <span className="text-primary font-medium shrink-0">Depois:</span>
                          <code className="text-muted-foreground bg-muted px-1.5 py-0.5 rounded break-all">
                            {JSON.stringify(log.new_values).slice(0, 80)}
                            {JSON.stringify(log.new_values).length > 80 && "..."}
                          </code>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground shrink-0">
                  {format(new Date(log.created_at), "dd/MM HH:mm", { locale: ptBR })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
