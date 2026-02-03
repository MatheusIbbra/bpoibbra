import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Building2, 
  Lock, 
  Unlock, 
  Search,
  MoreVertical,
  AlertTriangle,
  CheckCircle,
  Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useOrganizations, Organization } from "@/hooks/useOrganizations";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ExtendedOrganization extends Organization {
  is_blocked?: boolean;
  blocked_at?: string | null;
  blocked_reason?: string | null;
}

export function OrganizationBlockManager() {
  const [searchQuery, setSearchQuery] = useState("");
  const [blockDialog, setBlockDialog] = useState<{ open: boolean; org: ExtendedOrganization | null; action: "block" | "unblock" }>({
    open: false,
    org: null,
    action: "block"
  });
  const [blockReason, setBlockReason] = useState("");
  
  const queryClient = useQueryClient();
  const { data: organizations, isLoading } = useOrganizations();

  const toggleBlockMutation = useMutation({
    mutationFn: async ({ orgId, block, reason }: { orgId: string; block: boolean; reason?: string }) => {
      const updateData: any = {
        is_blocked: block,
        blocked_at: block ? new Date().toISOString() : null,
        blocked_reason: block ? reason : null,
      };

      const { error } = await supabase
        .from("organizations")
        .update(updateData)
        .eq("id", orgId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      toast.success(variables.block ? "Organização bloqueada!" : "Organização desbloqueada!");
      setBlockDialog({ open: false, org: null, action: "block" });
      setBlockReason("");
    },
    onError: (error) => {
      toast.error("Erro: " + error.message);
    },
  });

  const filteredOrgs = (organizations as ExtendedOrganization[] | undefined)?.filter(org =>
    org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    org.slug.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const handleBlock = (org: ExtendedOrganization) => {
    setBlockDialog({ open: true, org, action: "block" });
  };

  const handleUnblock = (org: ExtendedOrganization) => {
    setBlockDialog({ open: true, org, action: "unblock" });
  };

  const confirmAction = () => {
    if (!blockDialog.org) return;

    toggleBlockMutation.mutate({
      orgId: blockDialog.org.id,
      block: blockDialog.action === "block",
      reason: blockDialog.action === "block" ? blockReason : undefined,
    });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Gerenciar Bloqueio de Organizações
          </CardTitle>
          <CardDescription>
            Bloqueie ou desbloqueie o acesso de organizações ao sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar organização pelo nome..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Organizations List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-2">
              {filteredOrgs.map((org) => (
                <div
                  key={org.id}
                  className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                    org.is_blocked 
                      ? "bg-destructive/5 border-destructive/20" 
                      : "bg-card hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={org.logo_url || undefined} />
                      <AvatarFallback className={org.is_blocked ? "bg-destructive/10" : "bg-primary/10"}>
                        {org.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{org.name}</span>
                        {org.is_blocked ? (
                          <Badge variant="destructive" className="flex items-center gap-1">
                            <Lock className="h-3 w-3" />
                            Bloqueada
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="flex items-center gap-1 text-green-600 border-green-200">
                            <CheckCircle className="h-3 w-3" />
                            Ativa
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground font-mono">{org.slug}</p>
                      {org.is_blocked && org.blocked_reason && (
                        <p className="text-xs text-destructive mt-1">
                          Motivo: {org.blocked_reason}
                        </p>
                      )}
                      {org.is_blocked && org.blocked_at && (
                        <p className="text-xs text-muted-foreground">
                          Bloqueada em: {format(new Date(org.blocked_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </p>
                      )}
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {org.is_blocked ? (
                        <DropdownMenuItem onClick={() => handleUnblock(org)}>
                          <Unlock className="mr-2 h-4 w-4 text-green-600" />
                          Desbloquear
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => handleBlock(org)} className="text-destructive">
                          <Lock className="mr-2 h-4 w-4" />
                          Bloquear
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}

              {filteredOrgs.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  {searchQuery ? "Nenhuma organização encontrada" : "Nenhuma organização cadastrada"}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Block/Unblock Dialog */}
      <Dialog open={blockDialog.open} onOpenChange={(open) => {
        if (!open) {
          setBlockDialog({ open: false, org: null, action: "block" });
          setBlockReason("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {blockDialog.action === "block" ? (
                <>
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Bloquear Organização
                </>
              ) : (
                <>
                  <Unlock className="h-5 w-5 text-green-600" />
                  Desbloquear Organização
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {blockDialog.action === "block" 
                ? `Tem certeza que deseja bloquear "${blockDialog.org?.name}"? Os usuários desta organização não poderão acessar o sistema.`
                : `Deseja desbloquear "${blockDialog.org?.name}"? Os usuários poderão voltar a acessar o sistema.`
              }
            </DialogDescription>
          </DialogHeader>

          {blockDialog.action === "block" && (
            <div className="space-y-2">
              <Label htmlFor="block-reason">Motivo do bloqueio (opcional)</Label>
              <Textarea
                id="block-reason"
                placeholder="Ex: Inadimplência, Solicitação do cliente..."
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                rows={3}
              />
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBlockDialog({ open: false, org: null, action: "block" })}
            >
              Cancelar
            </Button>
            <Button
              variant={blockDialog.action === "block" ? "destructive" : "default"}
              onClick={confirmAction}
              disabled={toggleBlockMutation.isPending}
            >
              {toggleBlockMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : blockDialog.action === "block" ? (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Bloquear
                </>
              ) : (
                <>
                  <Unlock className="mr-2 h-4 w-4" />
                  Desbloquear
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
