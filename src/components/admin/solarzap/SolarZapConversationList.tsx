import { MessageCircle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { WaConversation } from "@/hooks/useWaInbox";
import { ChatListItem } from "./ChatListItem";

interface Props {
  conversations: WaConversation[];
  selectedId: string | null;
  onSelect: (conv: WaConversation) => void;
  loading?: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  filter: string;
  onFilterChange: (val: string) => void;
}

type FilterType = "all" | "meus" | "nao_lidos";

export function SolarZapConversationList({
  conversations, selectedId, onSelect, loading,
  search, onSearchChange, filter, onFilterChange,
}: Props) {
  const filters: { key: FilterType; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "meus", label: "Meus" },
    { key: "nao_lidos", label: "Não Lidos" },
  ];

  return (
    <div className="flex flex-col h-full border-r border-border/50 bg-card">
      {/* Header */}
      <div className="p-3 border-b border-border/50 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">SolarZap</h2>
          <Badge variant="outline" className="font-mono text-[10px]">
            {conversations.length}
          </Badge>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar contato..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-1">
          {filters.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={filter === f.key ? "default" : "ghost"}
              className="h-7 text-xs px-2.5 flex-1"
              onClick={() => onFilterChange(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Conversation List */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-3 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-2.5">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <MessageCircle className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">Nenhuma conversa encontrada</p>
          </div>
        ) : (
          <div>
            {conversations.map((conv) => (
              <ChatListItem
                key={conv.id}
                conversation={conv}
                isSelected={selectedId === conv.id}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
