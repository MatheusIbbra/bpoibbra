import { useState } from "react";
import { Loader2, UserPlus, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAddOrganizationMember, useAvailableUsers } from "@/hooks/useOrganizations";
import { ROLE_LABELS, AppRole } from "@/hooks/useUserRoles";
import { cn } from "@/lib/utils";

interface AddMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  organizationName: string;
}

const ASSIGNABLE_ROLES: AppRole[] = ["supervisor", "fa", "kam", "cliente"];

export function AddMemberDialog({
  open,
  onOpenChange,
  organizationId,
  organizationName,
}: AddMemberDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<AppRole>("cliente");
  
  const { data: availableUsers, isLoading: loadingUsers } = useAvailableUsers(organizationId);
  const addMember = useAddOrganizationMember();

  const filteredUsers = availableUsers?.filter(user => 
    user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const selectedUser = availableUsers?.find(u => u.user_id === selectedUserId);

  const handleSubmit = async () => {
    if (!selectedUserId || !selectedRole) return;

    await addMember.mutateAsync({
      organizationId,
      userId: selectedUserId,
      role: selectedRole,
    });

    // Reset and close
    setSelectedUserId(null);
    setSelectedRole("cliente");
    setSearchQuery("");
    onOpenChange(false);
  };

  const handleClose = () => {
    setSelectedUserId(null);
    setSelectedRole("cliente");
    setSearchQuery("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Adicionar Membro
          </DialogTitle>
          <DialogDescription>
            Adicione um usuário à organização <strong>{organizationName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* User Selection */}
          <div className="space-y-2">
            <Label>Selecionar Usuário</Label>
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Selected User Preview */}
            {selectedUser && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={selectedUser.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {selectedUser.full_name?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{selectedUser.full_name || "Sem nome"}</p>
                  <p className="text-sm text-muted-foreground truncate">{selectedUser.email}</p>
                </div>
                <Badge variant="secondary">Selecionado</Badge>
              </div>
            )}

            {/* User List */}
            <ScrollArea className="h-48 border rounded-lg">
              {loadingUsers ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-4">
                  <p className="text-sm text-muted-foreground">
                    {searchQuery 
                      ? "Nenhum usuário encontrado" 
                      : "Todos os usuários já são membros"}
                  </p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {filteredUsers.map((user) => (
                    <button
                      key={user.user_id}
                      onClick={() => setSelectedUserId(user.user_id)}
                      className={cn(
                        "w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left",
                        selectedUserId === user.user_id
                          ? "bg-primary/10 border border-primary/30"
                          : "hover:bg-muted"
                      )}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {user.full_name?.charAt(0) || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {user.full_name || "Sem nome"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {user.email}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Role Selection */}
          <div className="space-y-2">
            <Label htmlFor="role">Função na Organização</Label>
            <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma função" />
              </SelectTrigger>
              <SelectContent>
                {ASSIGNABLE_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    <div className="flex items-center gap-2">
                      <span>{ROLE_LABELS[role]}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Define o nível de acesso do usuário nesta organização
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!selectedUserId || addMember.isPending}
          >
            {addMember.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Adicionar Membro
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
