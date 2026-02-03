import { useState, useMemo, useRef, useEffect } from "react";
import { Building2, Search, ChevronDown, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { useIsMobile } from "@/hooks/use-mobile";

export function BaseSelectorEnhanced() {
  const { 
    selectedOrganizationId, 
    setSelectedOrganizationId, 
    availableOrganizations, 
    isLoading,
    canFilterByBase 
  } = useBaseFilter();
  
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  // Focus input when popover opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const filteredOrgs = useMemo(() => {
    if (!availableOrganizations) return [];
    if (!searchQuery.trim()) return availableOrganizations;
    
    const query = searchQuery.toLowerCase();
    return availableOrganizations.filter(org => 
      org.name.toLowerCase().includes(query) ||
      org.slug.toLowerCase().includes(query)
    );
  }, [availableOrganizations, searchQuery]);

  const selectedOrg = useMemo(() => 
    availableOrganizations?.find(org => org.id === selectedOrganizationId),
    [availableOrganizations, selectedOrganizationId]
  );

  if (!canFilterByBase || isLoading) {
    return null;
  }

  const handleSelect = (orgId: string | null) => {
    setSelectedOrganizationId(orgId);
    setSearchQuery("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "justify-between",
            isMobile ? "w-auto min-w-[120px] max-w-[180px] px-2" : "w-[280px]"
          )}
          size={isMobile ? "sm" : "default"}
        >
          <div className="flex items-center gap-2 truncate">
            {selectedOrg ? (
              <>
                <Avatar className={cn("shrink-0", isMobile ? "h-4 w-4" : "h-5 w-5")}>
                  <AvatarImage src={selectedOrg.logo_url || undefined} />
                  <AvatarFallback className="text-xs bg-primary/10">
                    {selectedOrg.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate text-xs md:text-sm">{selectedOrg.name}</span>
              </>
            ) : (
              <>
                <Building2 className={cn("text-muted-foreground shrink-0", isMobile ? "h-3 w-3" : "h-4 w-4")} />
                <span className="text-muted-foreground truncate text-xs md:text-sm">
                  {isMobile ? "Todas" : "Todas as bases"}
                </span>
              </>
            )}
          </div>
          <ChevronDown className={cn("shrink-0 opacity-50", isMobile ? "ml-1 h-3 w-3" : "ml-2 h-4 w-4")} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("p-0", isMobile ? "w-[280px]" : "w-[320px]")} align="start">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              placeholder="Buscar base pelo nome..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        
        <ScrollArea className="h-[300px]">
          <div className="p-2">
            {/* All bases option */}
            <button
              onClick={() => handleSelect(null)}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors",
                !selectedOrganizationId 
                  ? "bg-primary/10 text-primary" 
                  : "hover:bg-muted"
              )}
            >
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                <Building2 className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="font-medium">Todas as bases</div>
                <div className="text-xs text-muted-foreground">
                  Ver dados de todas as organizações
                </div>
              </div>
              {!selectedOrganizationId && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </button>

            {/* Divider */}
            <div className="my-2 border-t" />

            {/* Organizations list */}
            {filteredOrgs.length > 0 ? (
              <div className="space-y-1">
                {filteredOrgs.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => handleSelect(org.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors",
                      selectedOrganizationId === org.id 
                        ? "bg-primary/10 text-primary" 
                        : "hover:bg-muted"
                    )}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={org.logo_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-sm">
                        {org.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{org.name}</div>
                      <div className="text-xs text-muted-foreground font-mono truncate">
                        {org.slug}
                      </div>
                    </div>
                    {selectedOrganizationId === org.id && (
                      <Check className="h-4 w-4 text-primary shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            ) : searchQuery ? (
              <div className="text-center py-6 text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Nenhuma base encontrada</p>
                <p className="text-xs">Tente outro termo de busca</p>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                Nenhuma organização disponível
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer with count */}
        <div className="p-2 border-t bg-muted/50">
          <div className="text-xs text-muted-foreground text-center">
            {filteredOrgs.length} de {availableOrganizations?.length || 0} organizações
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
