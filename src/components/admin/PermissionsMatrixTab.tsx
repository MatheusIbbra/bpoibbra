import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Info,
  CheckCircle2,
  XCircle,
  Crown,
  Eye,
  User,
  Briefcase,
  Building2,
} from "lucide-react";
import { AppRole, ROLE_LABELS } from "@/hooks/useUserRoles";

const ROLE_ICONS: Record<AppRole, React.ReactNode> = {
  admin: <Crown className="h-4 w-4" />,
  supervisor: <Eye className="h-4 w-4" />,
  fa: <Briefcase className="h-4 w-4" />,
  kam: <Building2 className="h-4 w-4" />,
  projetista: <Briefcase className="h-4 w-4" />,
  cliente: <User className="h-4 w-4" />,
};

const ROLE_COLORS: Record<AppRole, string> = {
  admin: "bg-primary/10 text-primary border-primary/20",
  supervisor: "bg-purple-500/10 text-purple-600 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400",
  fa: "bg-blue-500/10 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400",
  kam: "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400",
  projetista: "bg-cyan-500/10 text-cyan-600 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-400",
  cliente: "bg-orange-500/10 text-orange-600 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400",
};

const ALL_ROLES: AppRole[] = ["admin", "supervisor", "fa", "kam", "projetista", "cliente"];

const PERMISSIONS_MATRIX = [
  { feature: "Configurações Globais", admin: true, supervisor: false, fa: false, kam: false, projetista: false, cliente: false },
  { feature: "Criar Organizações", admin: true, supervisor: false, fa: false, kam: false, projetista: false, cliente: false },
  { feature: "Gerenciar Usuários", admin: true, supervisor: true, fa: false, kam: false, projetista: false, cliente: false },
  { feature: "Validar Final IA", admin: true, supervisor: true, fa: false, kam: false, projetista: false, cliente: false },
  { feature: "Classificar Transações", admin: true, supervisor: true, fa: true, kam: true, projetista: true, cliente: true },
  { feature: "Aprovar/Rejeitar IA", admin: true, supervisor: true, fa: true, kam: true, projetista: true, cliente: true },
  { feature: "Alterar Dados Financeiros", admin: true, supervisor: true, fa: true, kam: true, projetista: true, cliente: true },
  { feature: "Visualizar Relatórios", admin: true, supervisor: true, fa: true, kam: true, projetista: true, cliente: true },
  { feature: "Acompanhar Metas", admin: true, supervisor: true, fa: true, kam: true, projetista: true, cliente: true },
  { feature: "Upload de Extratos", admin: true, supervisor: true, fa: true, kam: true, projetista: true, cliente: true },
];

export function PermissionsMatrixTab() {
  return (
    <Card>
      <CardHeader className="border-b bg-muted/30">
        <CardTitle className="flex items-center gap-2">
          <Info className="h-5 w-5" />
          Matriz de Permissões
        </CardTitle>
        <CardDescription>
          Visão geral das permissões por perfil de acesso
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-[250px] font-semibold">Funcionalidade</TableHead>
                {ALL_ROLES.map((role) => (
                  <TableHead key={role} className="text-center w-[80px]">
                    <div className="flex flex-col items-center gap-1">
                      <div className={`h-6 w-6 rounded-md flex items-center justify-center ${ROLE_COLORS[role]}`}>
                        {ROLE_ICONS[role]}
                      </div>
                      <span className="text-[10px] font-medium">{ROLE_LABELS[role].split(" ")[0]}</span>
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {PERMISSIONS_MATRIX.map((row, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium text-xs">{row.feature}</TableCell>
                  {ALL_ROLES.map((role) => (
                    <TableCell key={role} className="text-center">
                      {row[role] ? (
                        <CheckCircle2 className="h-4 w-4 text-primary mx-auto" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground/30 mx-auto" />
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
