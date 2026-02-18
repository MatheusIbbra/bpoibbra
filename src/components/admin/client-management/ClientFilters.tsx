import { Search, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ClientFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onAddClick: () => void;
}

export function ClientFilters({ searchQuery, onSearchChange, onAddClick }: ClientFiltersProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar cliente ou KAM..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 w-48"
        />
      </div>
      <Button onClick={onAddClick} size="sm">
        <Plus className="h-4 w-4 sm:mr-2" />
        <span className="hidden sm:inline">Adicionar</span>
      </Button>
    </div>
  );
}
