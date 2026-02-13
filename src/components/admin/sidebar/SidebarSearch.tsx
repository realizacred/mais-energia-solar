import React, { useState, useMemo, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSidebar } from "@/components/ui/sidebar";
import { useNavConfig } from "@/hooks/useNavConfig";
import { useMenuAccess } from "@/hooks/useMenuAccess";
import type { MenuItem, SidebarSection } from "./sidebarConfig";

interface SearchResult {
  item: MenuItem;
  section: SidebarSection;
}

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function SidebarSearch() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Use dynamic nav config filtered by permissions
  const { sections: navSections } = useNavConfig();
  const filteredSections = useMenuAccess(navSections);

  const results = useMemo<SearchResult[]>(() => {
    if (!query.trim()) return [];
    const q = normalize(query.trim());
    const matches: SearchResult[] = [];

    for (const section of filteredSections) {
      for (const item of section.items) {
        const haystack = normalize(
          [item.title, item.description || "", ...(item.keywords || [])].join(" ")
        );
        if (haystack.includes(q)) {
          matches.push({ item, section });
        }
      }
    }
    return matches.slice(0, 8);
  }, [query, filteredSections]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (collapsed) return null;

  return (
    <div ref={containerRef} className="relative px-3 pb-1">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar no menu..."
          className="w-full h-8 pl-8 pr-7 text-[12px] rounded-lg border border-border/20 bg-muted/20 
            placeholder:text-muted-foreground/40 text-foreground
            focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/30
            transition-all"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setOpen(false); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute left-3 right-3 top-full mt-1 z-50 rounded-lg border border-border/30 bg-popover shadow-lg overflow-hidden">
          {results.map(({ item, section }) => (
            <button
              key={item.id}
              onClick={() => {
                navigate(`/admin/${item.id}`);
                setQuery("");
                setOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-accent/50 transition-colors"
            >
              <item.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-medium text-foreground truncate">{item.title}</p>
                {item.description && (
                  <p className="text-[10px] text-muted-foreground/60 truncate">{item.description}</p>
                )}
              </div>
              <span className="text-[9px] text-muted-foreground/40 shrink-0 uppercase tracking-wider">
                {section.label}
              </span>
            </button>
          ))}
        </div>
      )}

      {open && query.trim() && results.length === 0 && (
        <div className="absolute left-3 right-3 top-full mt-1 z-50 rounded-lg border border-border/30 bg-popover shadow-lg p-3">
          <p className="text-[11px] text-muted-foreground/60 text-center">Nenhum resultado</p>
        </div>
      )}
    </div>
  );
}
