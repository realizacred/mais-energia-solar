import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useState, useCallback } from "react";

interface HeaderSearchProps {
  className?: string;
}

function openGlobalSearch(term?: string) {
  window.dispatchEvent(
    new CustomEvent("global-search:open", { detail: { term } })
  );
}

export function HeaderSearch({ className }: HeaderSearchProps) {
  const [value, setValue] = useState("");

  const handleOpen = useCallback(() => openGlobalSearch(value), [value]);

  return (
    <div className={cn("relative hidden md:block", className)}>
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
      <Input
        placeholder="Buscar..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={handleOpen}
        onClick={handleOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleOpen();
          }
        }}
        className="h-8 w-48 lg:w-56 pl-8 text-xs rounded-md bg-muted/50 border-border/40 focus-visible:ring-1"
      />
    </div>
  );
}
