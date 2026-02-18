import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SunLoader } from "@/components/loading/SunLoader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  MessageSquare, ChevronDown, ChevronUp, StickyNote, User, Users,
  Sparkles, RefreshCw, Target, TrendingUp, ShieldAlert,
  Clock, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ── Types ──────────────────────────────────────────

interface WaConvBasic {
  id: string;
  cliente_nome: string | null;
  cliente_telefone: string;
  last_message_preview: string | null;
  last_message_at: string | null;
  status: string;
}

interface WaMsg {
  id: string;
  direction: "in" | "out";
  content: string | null;
  message_type: string;
  is_internal_note: boolean;
  created_at: string;
  sent_by_name?: string | null;
  sent_by_user_id: string | null;
  media_url: string | null;
}

interface ConversationSummary {
  resumo: string;
  assuntos_principais: string[];
  dores_cliente: string[];
  objecoes: string[];
  interesses: string[];
  estagio_funil: string;
  sentimento_cliente: string;
  proxima_acao_sugerida: string;
  probabilidade_fechamento: number;
  alertas: string[];
}

interface CachedSummary {
  id: string;
  summary_json: ConversationSummary;
  last_message_id: string;
  message_count: number;
  updated_at: string;
}

// ── Main Component ──────────────────────────────────

interface ProjetoChatTabProps {
  customerId: string | null;
  customerPhone: string;
}

export function ProjetoChatTab({ customerId, customerPhone }: ProjetoChatTabProps) {
  const [conversations, setConversations] = useState<WaConvBasic[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedConvId, setExpandedConvId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!customerPhone && !customerId) { setLoading(false); return; }
      try {
        const digits = customerPhone.replace(/\D/g, "");
        if (digits.length >= 8) {
          const suffix = digits.slice(-8);
          const { data } = await supabase
            .from("wa_conversations")
            .select("id, cliente_nome, cliente_telefone, last_message_preview, last_message_at, status")
            .or(`cliente_telefone.ilike.%${suffix}%,remote_jid.ilike.%${suffix}%`)
            .order("last_message_at", { ascending: false })
            .limit(10);
          const convs = (data || []) as WaConvBasic[];
          setConversations(convs);
          // Auto-expand first conversation
          if (convs.length > 0) setExpandedConvId(convs[0].id);
        }
      } catch (err) { console.error("ChatTab:", err); }
      finally { setLoading(false); }
    }
    load();
  }, [customerId, customerPhone]);

  if (loading) return <div className="flex justify-center py-12"><SunLoader style="spin" /></div>;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Conversas WhatsApp</h3>

      {conversations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-14 text-muted-foreground">
            <MessageSquare className="h-10 w-10 mb-3 opacity-30" />
            <p className="font-medium">Nenhuma conversa encontrada</p>
            <p className="text-xs mt-1">
              {customerPhone ? `Nenhuma conversa com ${customerPhone}` : "Vincule um cliente com telefone ao projeto"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {conversations.map(conv => (
            <ConversationCard
              key={conv.id}
              conversation={conv}
              isExpanded={expandedConvId === conv.id}
              onToggle={() => setExpandedConvId(prev => prev === conv.id ? null : conv.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Conversation Card with Expandable History ──────

function ConversationCard({
  conversation,
  isExpanded,
  onToggle,
}: {
  conversation: WaConvBasic;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      {/* Header - clickable to expand */}
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors"
      >
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <MessageSquare className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-foreground truncate">{conversation.cliente_nome || "Sem nome"}</p>
            <Badge variant={conversation.status === "open" ? "default" : "secondary"} className="text-[9px] h-4">
              {conversation.status === "open" ? "Aberta" : conversation.status === "pending" ? "Pendente" : "Resolvida"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{conversation.last_message_preview || "..."}</p>
        </div>
        <div className="text-right shrink-0 flex items-center gap-2">
          <div>
            <p className="text-[10px] text-muted-foreground">{conversation.cliente_telefone}</p>
            {conversation.last_message_at && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {format(new Date(conversation.last_message_at), "dd/MM/yyyy", { locale: ptBR })}
              </p>
            )}
          </div>
          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Expanded: Full message history */}
      {isExpanded && (
        <div className="border-t border-border/40">
          <ExpandedChatHistory conversationId={conversation.id} />
        </div>
      )}
    </Card>
  );
}

// ── Expanded Chat History ──────────────────────────

function ExpandedChatHistory({ conversationId }: { conversationId: string }) {
  const [messages, setMessages] = useState<WaMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [cachedSummary, setCachedSummary] = useState<CachedSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Load all messages
  useEffect(() => {
    async function loadMessages() {
      setLoading(true);
      try {
        // Load messages with sender names
        const { data, error } = await supabase
          .from("wa_messages")
          .select("id, direction, content, message_type, is_internal_note, created_at, sent_by_user_id, media_url")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true });
        if (error) throw error;

        const msgs = (data || []) as WaMsg[];

        // Resolve sender names
        const userIds = [...new Set(msgs.filter(m => m.sent_by_user_id).map(m => m.sent_by_user_id!))];
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, nome")
            .in("user_id", userIds);
          const nameMap = new Map((profiles || []).map((p: any) => [p.user_id, p.nome]));
          msgs.forEach(m => {
            if (m.sent_by_user_id) m.sent_by_name = nameMap.get(m.sent_by_user_id) || null;
          });
        }

        setMessages(msgs);
      } catch (err) { console.error("loadMessages:", err); }
      finally { setLoading(false); }
    }
    loadMessages();
  }, [conversationId]);

  // Load cached summary
  useEffect(() => {
    async function loadCachedSummary() {
      try {
        const { data } = await supabase
          .from("wa_conversation_summaries" as any)
          .select("*")
          .eq("conversation_id", conversationId)
          .maybeSingle();
        if (data) setCachedSummary(data as any);
      } catch {}
    }
    loadCachedSummary();
  }, [conversationId]);

  // Check if summary needs refresh (new messages after cached one)
  const needsRefresh = useMemo(() => {
    if (!cachedSummary || messages.length === 0) return !cachedSummary && messages.length > 0;
    // Check if there are messages after the cached last_message_id
    const lastCachedIdx = messages.findIndex(m => m.id === cachedSummary.last_message_id);
    if (lastCachedIdx === -1) return true; // cached message not found
    return lastCachedIdx < messages.length - 1; // new messages after cached
  }, [cachedSummary, messages]);

  const generateSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessão inválida");

      const { data, error } = await supabase.functions.invoke("ai-conversation-summary", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { conversation_id: conversationId, cache: true },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      // The edge function now caches and returns
      if (data?.summary) {
        const lastMsg = messages[messages.length - 1];
        const cached: CachedSummary = {
          id: data.cache_id || "temp",
          summary_json: data.summary,
          last_message_id: lastMsg?.id || "",
          message_count: messages.length,
          updated_at: new Date().toISOString(),
        };
        setCachedSummary(cached);
      }
    } catch (err: any) {
      setSummaryError(err.message || "Erro ao gerar resumo");
    } finally {
      setSummaryLoading(false);
    }
  }, [conversationId, messages]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size="md" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground text-xs">
        Nenhuma mensagem nesta conversa.
      </div>
    );
  }

  // Group messages by date
  const groupedByDate = groupMessagesByDate(messages);

  const summary = cachedSummary?.summary_json;

  return (
    <div className="flex flex-col">
      {/* Messages timeline */}
      <ScrollArea className="max-h-[500px]">
        <div className="px-4 py-3 space-y-1">
          {groupedByDate.map(({ date, msgs }) => (
            <div key={date}>
              {/* Date separator */}
              <div className="flex items-center gap-2 py-2">
                <Separator className="flex-1" />
                <span className="text-[10px] font-medium text-muted-foreground px-2 bg-card">{date}</span>
                <Separator className="flex-1" />
              </div>

              {msgs.map(msg => (
                <MessageBubble key={msg.id} msg={msg} />
              ))}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* AI Summary Section */}
      <div className="border-t border-border/40 px-4 py-3 bg-muted/10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-foreground">Resumo IA</span>
            {cachedSummary && !needsRefresh && (
              <Badge variant="outline" className="text-[9px] h-4 gap-0.5 text-success border-success/30">
                <CheckCircle2 className="h-2.5 w-2.5" />
                Atualizado
              </Badge>
            )}
            {needsRefresh && cachedSummary && (
              <Badge variant="outline" className="text-[9px] h-4 gap-0.5 text-warning border-warning/30">
                <AlertTriangle className="h-2.5 w-2.5" />
                Novas mensagens
              </Badge>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={generateSummary}
            disabled={summaryLoading}
          >
            {summaryLoading ? (
              <><Spinner size="sm" /> Gerando...</>
            ) : (
              <><RefreshCw className="h-3 w-3" /> {summary ? "Atualizar" : "Gerar resumo"}</>
            )}
          </Button>
        </div>

        {summaryError && (
          <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/20 mb-2">
            <p className="text-[11px] text-destructive">{summaryError}</p>
          </div>
        )}

        {summary && <SummaryDisplay summary={summary} updatedAt={cachedSummary?.updated_at} />}

        {!summary && !summaryLoading && (
          <p className="text-[11px] text-muted-foreground text-center py-2">
            Clique em "Gerar resumo" para criar um resumo IA desta conversa.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Message Bubble ──────────────────────────────────

function MessageBubble({ msg }: { msg: WaMsg }) {
  const isNote = msg.is_internal_note;
  const isIncoming = msg.direction === "in";
  const time = format(new Date(msg.created_at), "HH:mm", { locale: ptBR });

  if (isNote) {
    return (
      <div className="flex justify-center my-1.5">
        <div className="max-w-[85%] bg-warning/10 border border-warning/20 rounded-lg px-3 py-1.5 text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <StickyNote className="h-3 w-3 text-warning" />
            <span className="text-[9px] font-medium text-warning">Nota Interna</span>
            {msg.sent_by_name && <span className="text-[9px] text-warning/70">· {msg.sent_by_name}</span>}
          </div>
          <p className="text-[11px] text-foreground/80 whitespace-pre-wrap">{msg.content || "(sem conteúdo)"}</p>
          <p className="text-[9px] text-muted-foreground mt-0.5">{time}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex my-1", isIncoming ? "justify-start" : "justify-end")}>
      <div className={cn(
        "max-w-[75%] rounded-xl px-3 py-1.5",
        isIncoming
          ? "bg-muted/50 border border-border/30 rounded-bl-sm"
          : "bg-primary/10 border border-primary/20 rounded-br-sm"
      )}>
        {!isIncoming && msg.sent_by_name && (
          <p className="text-[9px] font-medium text-primary/70 mb-0.5">{msg.sent_by_name}</p>
        )}
        {msg.message_type === "image" && msg.media_url && (
          <img src={msg.media_url} alt="" className="max-w-full rounded-md mb-1 max-h-40 object-cover" />
        )}
        {msg.message_type === "audio" && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span>🎵</span> Áudio
          </div>
        )}
        {msg.message_type === "document" && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span>📎</span> Documento
          </div>
        )}
        <p className="text-[12px] text-foreground whitespace-pre-wrap leading-relaxed">{msg.content || ""}</p>
        <p className={cn("text-[9px] mt-0.5", isIncoming ? "text-muted-foreground" : "text-primary/60 text-right")}>{time}</p>
      </div>
    </div>
  );
}

// ── Summary Display ──────────────────────────────────

const sentimentConfig: Record<string, { color: string; label: string }> = {
  positivo: { color: "text-success", label: "😊 Positivo" },
  neutro: { color: "text-muted-foreground", label: "😐 Neutro" },
  negativo: { color: "text-destructive", label: "😟 Negativo" },
  indeciso: { color: "text-warning", label: "🤔 Indeciso" },
};

const funilLabels: Record<string, string> = {
  prospeccao: "🔍 Prospecção",
  qualificacao: "📋 Qualificação",
  proposta: "📄 Proposta",
  negociacao: "🤝 Negociação",
  fechamento: "🎉 Fechamento",
  perdido: "❌ Perdido",
};

function SummaryDisplay({ summary, updatedAt }: { summary: ConversationSummary; updatedAt?: string }) {
  return (
    <div className="space-y-2">
      {/* Resumo */}
      <div className="p-2.5 rounded-lg bg-muted/30 border border-border/20">
        <p className="text-[11px] text-foreground leading-relaxed">{summary.resumo}</p>
      </div>

      {/* Quick metrics */}
      <div className="grid grid-cols-3 gap-1.5">
        <div className="p-2 rounded-lg bg-muted/20 border border-border/20 text-center">
          <p className="text-[9px] text-muted-foreground">Funil</p>
          <p className="text-[10px] font-medium">{funilLabels[summary.estagio_funil] || summary.estagio_funil}</p>
        </div>
        <div className="p-2 rounded-lg bg-muted/20 border border-border/20 text-center">
          <p className="text-[9px] text-muted-foreground">Sentimento</p>
          <p className={cn("text-[10px] font-medium", sentimentConfig[summary.sentimento_cliente]?.color)}>
            {sentimentConfig[summary.sentimento_cliente]?.label || summary.sentimento_cliente}
          </p>
        </div>
        <div className="p-2 rounded-lg bg-muted/20 border border-border/20 text-center">
          <p className="text-[9px] text-muted-foreground">Fechamento</p>
          <div className="flex items-center justify-center gap-1">
            <TrendingUp className="h-3 w-3 text-primary" />
            <span className="text-sm font-bold text-primary">{summary.probabilidade_fechamento}%</span>
          </div>
        </div>
      </div>

      {/* Lists */}
      {summary.assuntos_principais?.length > 0 && (
        <MiniList title="💡 Assuntos" items={summary.assuntos_principais} />
      )}
      {summary.interesses?.length > 0 && (
        <MiniList title="⭐ Interesses" items={summary.interesses} />
      )}
      {summary.dores_cliente?.length > 0 && (
        <MiniList title="😰 Dores" items={summary.dores_cliente} />
      )}
      {summary.objecoes?.length > 0 && (
        <MiniList title="⚡ Objeções" items={summary.objecoes} />
      )}

      {/* Next action */}
      {summary.proxima_acao_sugerida && (
        <div className="p-2 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex items-center gap-1 mb-0.5">
            <Target className="h-3 w-3 text-primary" />
            <p className="text-[10px] text-primary font-semibold">Próxima Ação</p>
          </div>
          <p className="text-[11px] text-foreground">{summary.proxima_acao_sugerida}</p>
        </div>
      )}

      {/* Alerts */}
      {summary.alertas?.length > 0 && (
        <div className="p-2 rounded-lg bg-destructive/5 border border-destructive/20">
          <div className="flex items-center gap-1 mb-0.5">
            <ShieldAlert className="h-3 w-3 text-destructive" />
            <p className="text-[10px] text-destructive font-semibold">Alertas</p>
          </div>
          {summary.alertas.map((a, i) => (
            <p key={i} className="text-[11px] text-destructive/80">• {a}</p>
          ))}
        </div>
      )}

      {updatedAt && (
        <p className="text-[9px] text-muted-foreground text-center">
          Resumo gerado em {format(new Date(updatedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
        </p>
      )}
    </div>
  );
}

function MiniList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="p-2 rounded-lg bg-muted/20 border border-border/20">
      <p className="text-[10px] font-medium text-muted-foreground mb-0.5">{title}</p>
      {items.map((item, i) => (
        <p key={i} className="text-[11px] text-foreground">• {item}</p>
      ))}
    </div>
  );
}

// ── Utils ──────────────────────────────────────────

function groupMessagesByDate(messages: WaMsg[]) {
  const groups: { date: string; msgs: WaMsg[] }[] = [];
  let currentDate = "";
  let currentMsgs: WaMsg[] = [];

  for (const msg of messages) {
    const date = format(new Date(msg.created_at), "dd/MM/yyyy", { locale: ptBR });
    if (date !== currentDate) {
      if (currentMsgs.length > 0) groups.push({ date: currentDate, msgs: currentMsgs });
      currentDate = date;
      currentMsgs = [msg];
    } else {
      currentMsgs.push(msg);
    }
  }
  if (currentMsgs.length > 0) groups.push({ date: currentDate, msgs: currentMsgs });

  return groups;
}
