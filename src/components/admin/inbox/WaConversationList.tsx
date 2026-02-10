import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Search,
  MessageCircle,
  User,
  Users,
  Clock,
  CheckCircle2,
  Smartphone,
  Link2,
  Tag,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { WaConversation, WaTag } from "@/hooks/useWaInbox";
import type { WaInstance } from "@/hooks/useWaInstances";

const statusConfig: Record<string, { label: string; color: string; dotColor: string; icon: typeof MessageCircle }> = {
  open: { label: "Aberta", color: "bg-success/15 text-success border-success/30", dotColor: "bg-success", icon: MessageCircle },
  pending: { label: "Pendente", color: "bg-warning/15 text-warning border-warning/30", dotColor: "bg-warning", icon: Clock },
  resolved: { label: "Resolvida", color: "bg-muted text-muted-foreground border-border", dotColor: "bg-muted-foreground", icon: CheckCircle2 },
};

interface WaConversationListProps {
  conversations: WaConversation[];
  loading: boolean;
  selectedId?: string;
  onSelect: (conv: WaConversation) => void;
  search: string;
  onSearchChange: (v: string) => void;
  filterStatus: string;
  onFilterStatusChange: (v: string) => void;
  filterAssigned: string;
  onFilterAssignedChange: (v: string) => void;
  filterInstance: string;
  onFilterInstanceChange: (v: string) => void;
  filterTag: string;
  onFilterTagChange: (v: string) => void;
  vendedores: { id: string; nome: string; user_id: string | null }[];
  instances: WaInstance[];
  tags: WaTag[];
}

export function WaConversationList({
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
  filterInstance,
  onFilterInstanceChange,
  filterTag,
  onFilterTagChange,
  vendedores,
  instances,
  tags,
}: WaConversationListProps) {
  return (
    <div className="flex flex-col h-full border-r border-border/30 bg-card/50">
      {/* Search & Filters */}
      <div className="p-3 border-b border-border/30 space-y-2 bg-card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conversa..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9 text-sm bg-muted/30 border-border/30 focus:bg-background"
          />
        </div>
        <div className="flex gap-1.5">
          <Select value={filterStatus} onValueChange={onFilterStatusChange}>
            <SelectTrigger className="h-7 text-[11px] flex-1 border-border/30">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="open">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-success" />
                  Abertas
                </span>
              </SelectItem>
              <SelectItem value="pending">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                  Pendentes
                </span>
              </SelectItem>
              <SelectItem value="resolved">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                  Resolvidas
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterAssigned} onValueChange={onFilterAssignedChange}>
            <SelectTrigger className="h-7 text-[11px] flex-1 border-border/30">
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
        {instances.length > 1 && (
          <Select value={filterInstance} onValueChange={onFilterInstanceChange}>
            <SelectTrigger className="h-7 text-[11px] border-border/30">
              <Smartphone className="h-3 w-3 mr-1.5" />
              <SelectValue placeholder="Instância" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as instâncias</SelectItem>
              {instances.map((inst) => (
                <SelectItem key={inst.id} value={inst.id}>
                  {inst.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {tags.length > 0 && (
          <Select value={filterTag} onValueChange={onFilterTagChange}>
            <SelectTrigger className="h-7 text-[11px] border-border/30">
              <Tag className="h-3 w-3 mr-1.5" />
              <SelectValue placeholder="Tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as tags</SelectItem>
              {tags.map((tag) => (
                <SelectItem key={tag.id} value={tag.id}>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                    {tag.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Conversations */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-2 space-y-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg">
                <Skeleton className="h-11 w-11 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <MessageCircle className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Nenhuma conversa</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Ajuste os filtros ou aguarde novas mensagens.</p>
          </div>
        ) : (
          <div className="p-1.5 space-y-0.5">
            {conversations.map((conv) => {
              const isSelected = conv.id === selectedId;
              const st = statusConfig[conv.status] || statusConfig.open;
              const hasUnread = conv.unread_count > 0;

              return (
                <button
                  key={conv.id}
                  onClick={() => onSelect(conv)}
                  className={`w-full text-left p-3 rounded-xl transition-all duration-200
                    ${isSelected
                      ? "bg-primary/8 ring-1 ring-primary/20 shadow-sm"
                      : "hover:bg-muted/40"
                    }
                    ${hasUnread && !isSelected ? "bg-primary/4" : ""}
                  `}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar with status indicator */}
                    <div className="relative shrink-0">
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                        ${hasUnread ? "bg-primary/12 text-primary ring-2 ring-primary/20" : "bg-muted/60 text-muted-foreground"}`}
                      >
                        {conv.profile_picture_url ? (
                          <img src={conv.profile_picture_url} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : conv.is_group ? (
                          <Users className="h-4 w-4" />
                        ) : conv.cliente_nome ? (
                          conv.cliente_nome.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()
                        ) : (
                          <User className="h-4 w-4" />
                        )}
                      </div>
                      {/* Status dot */}
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-card ${st.dotColor}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Name + time */}
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`text-sm truncate ${hasUnread ? "font-bold text-foreground" : "font-medium text-foreground/80"}`}>
                          {conv.cliente_nome || conv.cliente_telefone}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          {hasUnread && (
                            <span className="flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-1">
                              {conv.unread_count}
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            {conv.last_message_at && formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: false, locale: ptBR })}
                          </span>
                        </div>
                      </div>

                      {/* Message preview with type icon */}
                      <p className={`text-xs truncate mb-1.5 ${hasUnread ? "text-foreground/80 font-medium" : "text-muted-foreground"}`}>
                        {conv.last_message_preview
                          ? conv.last_message_preview.startsWith("[Nota interna]")
                            ? "📝 Nota interna"
                            : conv.last_message_preview
                          : "Sem mensagens"}
                      </p>

                      {/* Metadata badges */}
                      <div className="flex items-center gap-1 flex-wrap">
                        {conv.vendedor_nome && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 gap-0.5 bg-accent/30 border-accent/20 text-accent-foreground/80">
                            <User className="h-2.5 w-2.5" />
                            {conv.vendedor_nome}
                          </Badge>
                        )}
                        {conv.lead_nome && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 gap-0.5 bg-primary/5 border-primary/20 text-primary/80">
                            <Link2 className="h-2.5 w-2.5" />
                            {conv.lead_nome}
                          </Badge>
                        )}
                        {instances.length > 1 && conv.instance_name && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 gap-0.5 border-border/50">
                            <Smartphone className="h-2.5 w-2.5" />
                            {conv.instance_name}
                          </Badge>
                        )}
                        {conv.tags?.map((ct) => (
                          <Badge
                            key={ct.id}
                            variant="outline"
                            className="text-[9px] px-1.5 py-0"
                            style={{
                              borderColor: ct.tag?.color ? ct.tag.color + "60" : undefined,
                              color: ct.tag?.color,
                              backgroundColor: ct.tag?.color ? ct.tag.color + "10" : undefined,
                            }}
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
        <p className="text-[10px] text-muted-foreground font-medium">{conversations.length} conversas</p>
      </div>
    </div>
  );
}
