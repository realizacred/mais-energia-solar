import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface HeaderSearchProps {
  className?: string;
}

export function HeaderSearch({ className }: HeaderSearchProps) {
  return (
    <div className={cn("relative hidden md:block", className)}>
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
      <Input
        placeholder="Buscar..."
        className="h-8 w-48 lg:w-56 pl-8 text-xs rounded-md bg-muted/50 border-border/40 focus-visible:ring-1"
      />
    </div>
  );
}
