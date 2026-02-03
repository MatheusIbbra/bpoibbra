import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, UserCheck, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface OrganizationWithKam {
  id: string;
  name: string;
  slug: string;
  kam_id: string | null;
  kam_name: string | null;
}

interface KamUser {
  user_id: string;
  full_name: string | null;
}

export function OrganizationKamManager() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Buscar organizações com seus KAMs
  const { data: organizations, isLoading: orgsLoading } = useQuery({
    queryKey: ["organizations-with-kam"],
    queryFn: async () => {
      const { data: orgs, error: orgsError } = await supabase
        .from("organizations")
        .select("id, name, slug, kam_id")
        .order("name");

      if (orgsError) throw orgsError;

      // Buscar nomes dos KAMs
      const kamIds = orgs?.filter(o => o.kam_id).map(o => o.kam_id) || [];
      let kamNames: Record<string, string> = {};
      
      if (kamIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", kamIds);
        
        kamNames = (profiles || []).reduce((acc, p) => {
          acc[p.user_id] = p.full_name || `Usuário ${p.user_id.slice(0, 8)}`;
          return acc;
        }, {} as Record<string, string>);
      }

      return (orgs || []).map(org => ({
        ...org,
        kam_name: org.kam_id ? kamNames[org.kam_id] || null : null,
      })) as OrganizationWithKam[];
    },
    enabled: !!user,
  });

  // Buscar usuários com perfil KAM
  const { data: kamUsers, isLoading: kamsLoading } = useQuery({
    queryKey: ["kam-users"],
    queryFn: async () => {
      // Buscar usuários com role KAM
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "kam");

      if (rolesError) throw rolesError;

      const kamUserIds = roles?.map(r => r.user_id) || [];
      
      if (kamUserIds.length === 0) return [];

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", kamUserIds);

      if (profilesError) throw profilesError;

      return profiles as KamUser[];
    },
    enabled: !!user,
  });

  // Mutation para atribuir KAM
  const assignKam = useMutation({
    mutationFn: async ({ orgId, kamId }: { orgId: string; kamId: string | null }) => {
      const { error } = await supabase
        .from("organizations")
        .update({ kam_id: kamId })
        .eq("id", orgId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations-with-kam"] });
      queryClient.invalidateQueries({ queryKey: ["viewable-organizations"] });
      toast.success("KAM atribuído com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao atribuir KAM: " + error.message);
    },
  });

  const handleKamChange = (orgId: string, kamId: string) => {
    assignKam.mutate({
      orgId,
      kamId: kamId === "none" ? null : kamId,
    });
  };

  if (orgsLoading || kamsLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Vincular Cliente (Base) ao KAM
        </CardTitle>
        <CardDescription>
          Defina qual KAM é responsável por cada cliente/organização. <strong>Todo cliente deve ter um KAM obrigatório.</strong>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {(!kamUsers || kamUsers.length === 0) && (
          <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 mb-4">
            <p className="text-sm text-warning-foreground">
              ⚠️ Nenhum usuário com perfil KAM encontrado. Atribua o perfil "KAM" a algum usuário na aba "Usuários" primeiro.
            </p>
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente (Base)</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>KAM Atual</TableHead>
              <TableHead>Alterar KAM</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {organizations?.map((org) => (
              <TableRow key={org.id} className={!org.kam_id ? "bg-destructive/5" : ""}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    {org.name}
                    {!org.kam_id && (
                      <Badge variant="destructive" className="text-xs">Sem KAM</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-mono text-xs">
                    {org.slug}
                  </Badge>
                </TableCell>
                <TableCell>
                  {org.kam_name ? (
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-success" />
                      <span>{org.kam_name}</span>
                    </div>
                  ) : (
                    <span className="text-destructive text-sm font-medium">⚠️ Não atribuído</span>
                  )}
                </TableCell>
                <TableCell>
                  <Select
                    value={org.kam_id || "none"}
                    onValueChange={(value) => handleKamChange(org.id, value)}
                    disabled={assignKam.isPending || !kamUsers || kamUsers.length === 0}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Selecionar KAM" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Não permitir "Nenhum" - KAM é obrigatório */}
                      {kamUsers?.map((kam) => (
                        <SelectItem key={kam.user_id} value={kam.user_id}>
                          {kam.full_name || `Usuário ${kam.user_id.slice(0, 8)}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}

            {(!organizations || organizations.length === 0) && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma organização encontrada</p>
                  <p className="text-sm">Crie organizações na página de Organizações</p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
