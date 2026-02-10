import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Clock, AlertTriangle, CheckCircle2, MessageCircle, Filter,
  User, Bell, ExternalLink, Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard } from "@/components/ui-kit";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

// ─── Types ──────────────────────────────────────────────────
type FollowupQueueItem = {
  id: string;
  status: string;
  tentativa: number;
  scheduled_at: string;
  sent_at: string | null;
  responded_at: string | null;
  assigned_to: string | null;
  mensagem_enviada: string | null;
  conversation_id: string;
  created_at: string;
  rule: {
    nome: string;
    cenario: string;
    prioridade: string;
    prazo_minutos: number;
  } | null;
};

type ConversationInfo = {
  id: string;
  cliente_nome: string | null;
  cliente_telefone: string | null;
  status: string;
  last_message_at: string | null;
};

type MessagePreview = {
  id: string;
  content: string | null;
  direction: string;
  created_at: string;
  message_type: string | null;
};

// ─── Constants ──────────────────────────────────────────────
const STATUS_CONFIG = {
  pendente: { label: "Pendente", icon: Clock, color: "bg-warning/10 text-warning border-warning/30" },
  enviado: { label: "Enviado", icon: MessageCircle, color: "bg-info/10 text-info border-info/30" },
  respondido: { label: "Respondido", icon: CheckCircle2, color: "bg-success/10 text-success border-success/30" },
  falhou: { label: "Falhou", icon: AlertTriangle, color: "bg-destructive/10 text-destructive border-destructive/30" },
} as const;

const PRIORITY_BADGE = {
  urgente: "bg-destructive/15 text-destructive border-destructive/30",
  alta: "bg-warning/15 text-warning border-warning/30",
  media: "bg-info/15 text-info border-info/30",
  baixa: "bg-muted text-muted-foreground border-border",
} as const;

// ─── Component ──────────────────────────────────────────────
export function WaFollowupQueuePage() {
  const [statusFilter, setStatusFilter] = useState("pendente");
  const [vendedorFilter, setVendedorFilter] = useState("all");
  const [selectedItem, setSelectedItem] = useState<FollowupQueueItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // ─── Data Queries ───────────────────────────────────────
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["wa-followup-queue-page", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("wa_followup_queue")
        .select(`
          id, status, tentativa, scheduled_at, sent_at, responded_at,
          assigned_to, mensagem_enviada, conversation_id, created_at,
          rule:wa_followup_rules(nome, cenario, prioridade, prazo_minutos)
        `)
        .order("scheduled_at", { ascending: true })
        .limit(100);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as FollowupQueueItem[];
    },
    staleTime: 15_000,
  });

  const { data: vendedores = [] } = useQuery({
    queryKey: ["wa-followup-vendedores-page"],
    queryFn: async () => {
      const { data } = await supabase.from("vendedores").select("id, nome, user_id").eq("ativo", true);
      return data || [];
    },
    staleTime: 60_000,
  });

  const conversationIds = [...new Set(items.map((f) => f.conversation_id).filter(Boolean))];
  const { data: conversations = [] } = useQuery({
    queryKey: ["wa-followup-convs-page", conversationIds],
    queryFn: async () => {
      if (conversationIds.length === 0) return [];
      const { data } = await supabase
        .from("wa_conversations")
        .select("id, cliente_nome, cliente_telefone, status, last_message_at")
        .in("id", conversationIds);
      return (data || []) as ConversationInfo[];
    },
    enabled: conversationIds.length > 0,
    staleTime: 30_000,
  });

  const convsMap = useMemo(
    () => Object.fromEntries(conversations.map((c) => [c.id, c])),
    [conversations]
  );

  const vendedoresMap = useMemo(
    () => Object.fromEntries(
      vendedores.filter((v) => v.user_id).map((v) => [v.user_id!, v])
    ),
    [vendedores]
  );

  // Filter by vendedor
  const filteredItems = useMemo(() => {
    if (vendedorFilter === "all") return items;
    if (vendedorFilter === "unassigned") return items.filter((i) => !i.assigned_to);
    return items.filter((i) => i.assigned_to === vendedorFilter);
  }, [items, vendedorFilter]);

  // Stats
  const stats = useMemo(() => ({
    pendentes: items.filter((i) => i.status === "pendente").length,
    urgentes: items.filter((i) => i.rule?.prioridade === "urgente" || i.rule?.prioridade === "alta").length,
    enviados: items.filter((i) => i.status === "enviado").length,
    respondidos: items.filter((i) => i.status === "respondido").length,
  }), [items]);

  // ─── Drawer: conversation messages ─────────────────────
  const { data: drawerMessages = [], isLoading: loadingMessages } = useQuery({
    queryKey: ["followup-drawer-messages", selectedItem?.conversation_id],
    queryFn: async () => {
      if (!selectedItem?.conversation_id) return [];
      const { data } = await supabase
        .from("wa_messages")
        .select("id, content, direction, created_at, message_type")
        .eq("conversation_id", selectedItem.conversation_id)
        .order("created_at", { ascending: false })
        .limit(30);
      return ((data || []) as MessagePreview[]).reverse();
    },
    enabled: !!selectedItem?.conversation_id && drawerOpen,
  });

  const handleOpenDrawer = (item: FollowupQueueItem) => {
    setSelectedItem(item);
    setDrawerOpen(true);
  };

  const getVendedorName = (userId: string | null) => {
    if (!userId) return "Não atribuído";
    return vendedoresMap[userId]?.nome || "Desconhecido";
  };

  const drawerConv = selectedItem ? convsMap[selectedItem.conversation_id] : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fila de Follow-ups WhatsApp"
        description="Gerencie e acompanhe todos os follow-ups de conversas WhatsApp"
        icon={Bell}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Pendentes" value={stats.pendentes} icon={Clock} color="warning" />
        <StatCard label="Urgentes" value={stats.urgentes} icon={AlertTriangle} color={stats.urgentes > 0 ? "destructive" : "muted"} />
        <StatCard label="Enviados" value={stats.enviados} icon={MessageCircle} color="info" />
        <StatCard label="Respondidos" value={stats.respondidos} icon={CheckCircle2} color="success" />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filtros:</span>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pendente">Pendentes</SelectItem>
                <SelectItem value="enviado">Enviados</SelectItem>
                <SelectItem value="respondido">Respondidos</SelectItem>
                <SelectItem value="falhou">Falhou</SelectItem>
              </SelectContent>
            </Select>
            <Select value={vendedorFilter} onValueChange={setVendedorFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Vendedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos vendedores</SelectItem>
                <SelectItem value="unassigned">Não atribuídos</SelectItem>
                {vendedores.filter((v) => v.user_id).map((v) => (
                  <SelectItem key={v.user_id!} value={v.user_id!}>
                    {v.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="outline" className="ml-auto">
              {filteredItems.length} resultado{filteredItems.length !== 1 ? "s" : ""}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="w-12 h-12 mx-auto text-success/50 mb-3" />
            <p className="text-muted-foreground">Nenhum follow-up encontrado.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Contato</th>
                    <th className="text-left p-3 font-medium hidden md:table-cell">Regra / Cenário</th>
                    <th className="text-left p-3 font-medium">Prioridade</th>
                    <th className="text-left p-3 font-medium hidden lg:table-cell">Responsável</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium hidden sm:table-cell">Agendado</th>
                    <th className="text-right p-3 font-medium">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const conv = convsMap[item.conversation_id];
                    const statusCfg = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pendente;
                    const StatusIcon = statusCfg.icon;
                    const priorityClass = PRIORITY_BADGE[(item.rule?.prioridade as keyof typeof PRIORITY_BADGE)] || PRIORITY_BADGE.media;

                    return (
                      <tr
                        key={item.id}
                        className="border-b last:border-b-0 hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => handleOpenDrawer(item)}
                      >
                        <td className="p-3">
                          <div className="font-medium">{conv?.cliente_nome || "Desconhecido"}</div>
                          <div className="text-xs text-muted-foreground">{conv?.cliente_telefone || "—"}</div>
                        </td>
                        <td className="p-3 hidden md:table-cell">
                          <div className="font-medium">{item.rule?.nome || "—"}</div>
                          <div className="text-xs text-muted-foreground capitalize">{item.rule?.cenario?.replace(/_/g, " ") || "—"}</div>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className={priorityClass}>
                            {item.rule?.prioridade || "média"}
                          </Badge>
                        </td>
                        <td className="p-3 hidden lg:table-cell">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-xs">{getVendedorName(item.assigned_to)}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className={statusCfg.color}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusCfg.label}
                          </Badge>
                        </td>
                        <td className="p-3 hidden sm:table-cell">
                          <div className="text-xs">
                            {formatDistanceToNow(new Date(item.scheduled_at), { addSuffix: true, locale: ptBR })}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(item.scheduled_at), "dd/MM HH:mm")}
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDrawer(item);
                            }}
                          >
                            <MessageCircle className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Conversation Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
          <SheetHeader className="p-4 border-b bg-muted/30">
            <SheetTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-primary" />
                <div>
                  <div className="text-sm font-semibold">{drawerConv?.cliente_nome || "Conversa"}</div>
                  <div className="text-xs text-muted-foreground font-normal">{drawerConv?.cliente_telefone}</div>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  window.open(`/admin/inbox?conv=${selectedItem?.conversation_id}`, "_blank");
                }}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Abrir no Inbox
              </Button>
            </SheetTitle>
          </SheetHeader>

          {/* Follow-up Details */}
          {selectedItem && (
            <div className="p-4 border-b bg-card space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={STATUS_CONFIG[selectedItem.status as keyof typeof STATUS_CONFIG]?.color || ""}>
                  {STATUS_CONFIG[selectedItem.status as keyof typeof STATUS_CONFIG]?.label || selectedItem.status}
                </Badge>
                {selectedItem.rule && (
                  <Badge variant="outline" className={PRIORITY_BADGE[(selectedItem.rule.prioridade as keyof typeof PRIORITY_BADGE)] || ""}>
                    {selectedItem.rule.prioridade}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  Tentativa #{selectedItem.tentativa}
                </span>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <div><strong>Regra:</strong> {selectedItem.rule?.nome || "—"}</div>
                <div><strong>Cenário:</strong> {selectedItem.rule?.cenario?.replace(/_/g, " ") || "—"}</div>
                <div><strong>Responsável:</strong> {getVendedorName(selectedItem.assigned_to)}</div>
                <div><strong>SLA:</strong> {selectedItem.rule?.prazo_minutos ? `${selectedItem.rule.prazo_minutos} min` : "—"}</div>
              </div>
            </div>
          )}

          {/* Messages */}
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-2">
              {loadingMessages ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : drawerMessages.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-8">Sem mensagens recentes</p>
              ) : (
                drawerMessages.map((msg) => {
                  const isOutgoing = msg.direction === "outgoing";
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isOutgoing ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                          isOutgoing
                            ? "bg-primary/10 text-foreground"
                            : "bg-muted text-foreground"
                        }`}
                      >
                        {msg.message_type && msg.message_type !== "text" && !msg.content && (
                          <span className="text-xs italic text-muted-foreground">📎 Mídia</span>
                        )}
                        {msg.content && <p className="whitespace-pre-wrap break-words">{msg.content}</p>}
                        <div className="text-[10px] text-muted-foreground mt-1 text-right">
                          {format(new Date(msg.created_at), "HH:mm")}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default WaFollowupQueuePage;
