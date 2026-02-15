import { useState } from "react";
import { Search, Filter, MessageCircle, Instagram, Phone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface SolarZapConversation {
  id: string;
  nome: string;
  telefone: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  channel: "whatsapp" | "instagram" | "phone";
  status: "online" | "offline";
  avatarUrl?: string;
  assignedTo?: string;
}

interface Props {
  conversations: SolarZapConversation[];
  selectedId: string | null;
  onSelect: (conv: SolarZapConversation) => void;
  loading?: boolean;
}

type FilterType = "todos" | "meus" | "nao_lidos";

const CHANNEL_ICON = {
  whatsapp: MessageCircle,
  instagram: Instagram,
  phone: Phone,
};

const CHANNEL_COLOR = {
  whatsapp: "bg-success/10 text-success",
  instagram: "bg-info/10 text-info",
  phone: "bg-muted text-muted-foreground",
};

export function SolarZapConversationList({ conversations, selectedId, onSelect, loading }: Props) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("todos");

  const filtered = conversations.filter((c) => {
    if (search && !c.nome.toLowerCase().includes(search.toLowerCase()) && !c.telefone.includes(search)) return false;
    if (filter === "nao_lidos" && c.unreadCount === 0) return false;
    return true;
  });

  const filters: { key: FilterType; label: string }[] = [
    { key: "todos", label: "Todos" },
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
            onChange={(e) => setSearch(e.target.value)}
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
              onClick={() => setFilter(f.key)}
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
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <MessageCircle className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">Nenhuma conversa encontrada</p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {filtered.map((conv) => {
              const ChannelIcon = CHANNEL_ICON[conv.channel];
              const isSelected = selectedId === conv.id;
              return (
                <button
                  key={conv.id}
                  onClick={() => onSelect(conv)}
                  className={cn(
                    "w-full flex items-start gap-2.5 p-3 text-left transition-colors duration-150",
                    isSelected
                      ? "bg-primary/5 border-l-2 border-primary"
                      : "hover:bg-muted/50 border-l-2 border-transparent"
                  )}
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="text-xs font-medium bg-muted">
                        {conv.nome.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {conv.status === "online" && (
                      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-success border-2 border-card" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-sm font-medium text-foreground truncate">{conv.nome}</span>
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                        {conv.lastMessageAt}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{conv.lastMessage}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge variant="outline" className={cn("h-4 px-1 text-[9px] gap-0.5", CHANNEL_COLOR[conv.channel])}>
                        <ChannelIcon className="h-2.5 w-2.5" />
                        {conv.channel === "whatsapp" ? "WA" : conv.channel === "instagram" ? "IG" : "Tel"}
                      </Badge>
                      {conv.unreadCount > 0 && (
                        <Badge className="h-4 min-w-4 px-1 text-[9px] bg-primary text-primary-foreground">
                          {conv.unreadCount}
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
