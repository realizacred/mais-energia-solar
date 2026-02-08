import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Search,
  MessageCircle,
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
  Filter,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { Conversation } from "@/hooks/useWhatsAppInbox";

const statusConfig: Record<string, { label: string; color: string; icon: typeof MessageCircle }> = {
  open: { label: "Aberta", color: "bg-success text-success-foreground", icon: MessageCircle },
  pending: { label: "Pendente", color: "bg-warning text-warning-foreground", icon: Clock },
  resolved: { label: "Resolvida", color: "bg-muted text-muted-foreground", icon: CheckCircle2 },
};

interface ConversationListProps {
  conversations: Conversation[];
  loading: boolean;
  selectedId?: string;
  onSelect: (conv: Conversation) => void;
  search: string;
  onSearchChange: (v: string) => void;
  filterStatus: string;
  onFilterStatusChange: (v: string) => void;
  filterAssigned: string;
  onFilterAssignedChange: (v: string) => void;
  vendedores: { id: string; nome: string; user_id: string | null }[];
}

export function ConversationList({
  conversations,
  loading,
  selectedId,
  onSelect,
  search,
  onSearchChange,
  filterStatus,
  onFilterStatusChange,
  filterAssigned,
  onFilterAssignedChange,
  vendedores,
}: ConversationListProps) {
  return (
    <div className="flex flex-col h-full border-r border-border/40">
      {/* Search & Filters */}
      <div className="p-3 border-b border-border/40 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conversa..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <Select value={filterStatus} onValueChange={onFilterStatusChange}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="open">Abertas</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="resolved">Resolvidas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterAssigned} onValueChange={onFilterAssignedChange}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue placeholder="Atribuído" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="unassigned">Sem atribuição</SelectItem>
              {vendedores.map((v) => (
                <SelectItem key={v.id} value={v.user_id || v.id}>
                  {v.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Conversations */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-3 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 p-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <MessageCircle className="h-8 w-8 text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Nenhuma conversa</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Ajuste os filtros ou aguarde novas mensagens.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {conversations.map((conv) => {
              const isSelected = conv.id === selectedId;
              const st = statusConfig[conv.status] || statusConfig.open;
              const hasUnread = conv.unread_count > 0;

              return (
                <button
                  key={conv.id}
                  onClick={() => onSelect(conv)}
                  className={`w-full text-left p-3 transition-all duration-150 hover:bg-muted/50
                    ${isSelected ? "bg-primary/5 border-l-2 border-primary" : "border-l-2 border-transparent"}
                    ${hasUnread ? "bg-primary/3" : ""}
                  `}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ${hasUnread ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {conv.cliente_nome
                        ? conv.cliente_nome.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()
                        : <User className="h-4 w-4" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`text-sm truncate ${hasUnread ? "font-bold text-foreground" : "font-medium text-foreground/80"}`}>
                          {conv.cliente_nome || conv.cliente_telefone}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                          {conv.last_message_at && formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: false, locale: ptBR })}
                        </span>
                      </div>

                      <p className={`text-xs truncate ${hasUnread ? "text-foreground/90 font-medium" : "text-muted-foreground"}`}>
                        {conv.last_message_preview || "Sem mensagens"}
                      </p>

                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <Badge className={`${st.color} text-[9px] px-1.5 py-0`}>{st.label}</Badge>
                        {hasUnread && (
                          <Badge className="bg-primary text-primary-foreground text-[9px] px-1.5 py-0 min-w-[18px] text-center">
                            {conv.unread_count}
                          </Badge>
                        )}
                        {conv.tags?.map((ct) => (
                          <Badge
                            key={ct.id}
                            variant="outline"
                            className="text-[9px] px-1 py-0"
                            style={{ borderColor: ct.tag?.color, color: ct.tag?.color }}
                          >
                            {ct.tag?.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Footer count */}
      <div className="p-2 border-t border-border/40 text-center">
        <p className="text-[10px] text-muted-foreground">{conversations.length} conversas</p>
      </div>
    </div>
  );
}
