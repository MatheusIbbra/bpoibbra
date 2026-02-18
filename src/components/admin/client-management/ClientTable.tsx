import { Lock, Unlock, Edit, User, UserCheck, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ClientOrganization {
  id: string;
  name: string;
  slug: string;
  cpf_cnpj: string | null;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
  is_blocked: boolean;
  blocked_reason: string | null;
  blocked_at: string | null;
  kam_id: string | null;
  kam_name: string | null;
  client_user_id: string | null;
  client_name: string | null;
  client_email: string | null;
  is_ibbra_client: boolean;
}

interface ClientTableProps {
  organizations: ClientOrganization[];
  searchQuery: string;
  onDetail: (org: ClientOrganization) => void;
  onEdit: (org: ClientOrganization) => void;
  onBlock: (org: ClientOrganization) => void;
  onUnblock: (org: ClientOrganization) => void;
}

function getInitials(name: string | null): string {
  if (!name) return "C";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }
  return parts[0].charAt(0).toUpperCase();
}

export function ClientTable({ organizations, searchQuery, onDetail, onEdit, onBlock, onUnblock }: ClientTableProps) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="min-w-[200px]">Base (Organização)</TableHead>
            <TableHead className="min-w-[120px]">Status</TableHead>
            <TableHead className="text-right min-w-[200px]">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {organizations.map((org) => (
            <TableRow key={org.id} className={org.is_blocked ? "bg-destructive/5" : ""}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={org.logo_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {getInitials(org.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{org.name}</p>
                      {org.is_ibbra_client ? (
                        <Badge variant="outline" className="text-primary border-primary/50 text-xs">
                          <UserCheck className="h-3 w-3 mr-1" />
                          Cliente IBBRA
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground border-muted text-xs">
                          Cadastro Externo
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">{org.slug}</p>
                    {org.cpf_cnpj && (
                      <p className="text-xs text-muted-foreground">{org.cpf_cnpj}</p>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                {org.is_blocked ? (
                  <div>
                    <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                      <Lock className="h-3 w-3" />
                      Bloqueada
                    </Badge>
                    {org.blocked_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(org.blocked_at), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    )}
                  </div>
                ) : (
                  <Badge variant="outline" className="flex items-center gap-1 w-fit text-green-600 border-green-200">
                    <CheckCircle className="h-3 w-3" />
                    Ativa
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => onDetail(org)} title="Ver detalhes">
                    <User className="mr-1 h-4 w-4" />
                    Detalhes
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onEdit(org)}>
                    <Edit className="mr-1 h-4 w-4" />
                    Editar
                  </Button>
                  {org.is_blocked ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onUnblock(org)}
                      className="text-green-600 border-green-200 hover:bg-green-50"
                    >
                      <Unlock className="mr-1 h-4 w-4" />
                      Desbloquear
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onBlock(org)}
                      className="text-destructive border-destructive/50 hover:bg-destructive/10"
                    >
                      <Lock className="mr-1 h-4 w-4" />
                      Bloquear
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}

          {organizations.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="text-center py-16 text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">
                  {searchQuery ? "Nenhuma base encontrada" : "Nenhuma base cadastrada"}
                </p>
                <p className="text-sm">
                  {searchQuery ? "Tente outro termo de busca" : "Bases são criadas quando clientes são cadastrados"}
                </p>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
