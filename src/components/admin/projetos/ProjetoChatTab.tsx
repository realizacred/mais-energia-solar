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
  media_mime_type: string | null;
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
          .select("id, direction, content, message_type, is_internal_note, created_at, sent_by_user_id, media_url, media_mime_type")
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
          .select("id, conversation_id, summary, key_points, sentiment, topics, generated_at, model_used")
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
        {/* Image */}
        {msg.message_type === "image" && msg.media_url && (
          <a href={msg.media_url} target="_blank" rel="noopener noreferrer">
            <img src={msg.media_url} alt="" className="max-w-full rounded-lg mb-1 max-h-48 object-cover hover:opacity-90 transition-opacity" />
          </a>
        )}

        {/* Audio — full player like WaInbox */}
        {msg.message_type === "audio" && (
          msg.media_url ? (
            <audio controls preload="metadata" className="max-w-[260px] h-10">
              <source src={msg.media_url} type={msg.media_mime_type || "audio/ogg"} />
              Seu navegador não suporta áudio.
            </audio>
          ) : (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span>🎵</span> Mensagem de áudio (mídia indisponível)
            </div>
          )
        )}

        {/* Video */}
        {msg.message_type === "video" && (
          msg.media_url ? (
            <video controls preload="metadata" className="max-w-full rounded-lg mb-1 max-h-48">
              <source src={msg.media_url} type={msg.media_mime_type || "video/mp4"} />
            </video>
          ) : (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span>🎬</span> Vídeo indisponível
            </div>
          )
        )}

        {/* Document — clickable link with filename */}
        {msg.message_type === "document" && (
          msg.media_url ? (
            <a
              href={msg.media_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/30 hover:bg-muted/50 transition-colors"
            >
              <span className="text-base">📄</span>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-foreground truncate">{msg.content || "Documento"}</p>
                <p className="text-[9px] text-muted-foreground">Clique para abrir</p>
              </div>
            </a>
          ) : (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span>📄</span> Documento indisponível
            </div>
          )
        )}

        {/* Sticker */}
        {msg.message_type === "sticker" && msg.media_url && (
          <img src={msg.media_url} alt="Sticker" className="max-w-[120px] max-h-[120px] object-contain" />
        )}

        {/* Location */}
        {msg.message_type === "location" && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span>📍</span> Localização
          </div>
        )}

        {/* Text content — only for text type or types not handled above */}
        {(msg.message_type === "text" || !["audio", "document", "sticker", "location", "image", "video", "gif"].includes(msg.message_type)) && msg.content && (
          <p className="text-[12px] text-foreground whitespace-pre-wrap leading-relaxed">{msg.content}</p>
        )}
        {/* Caption for media */}
        {["image", "video"].includes(msg.message_type) && msg.content && (
          <p className="text-[11px] text-foreground/80 whitespace-pre-wrap mt-0.5">{msg.content}</p>
        )}

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
  const prob = summary.probabilidade_fechamento || 0;
  const probColor = prob >= 70 ? "text-success" : prob >= 40 ? "text-warning" : "text-destructive";
  const probBg = prob >= 70 ? "bg-success/10 border-success/20" : prob >= 40 ? "bg-warning/10 border-warning/20" : "bg-destructive/10 border-destructive/20";

  return (
    <div className="space-y-3">
      {/* ── Hero Card: Resumo + Probabilidade ── */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-3 space-y-2">
          <p className="text-xs text-foreground leading-relaxed">{summary.resumo}</p>
          <div className="flex items-center gap-3 pt-1">
            <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold", probBg, probColor)}>
              <TrendingUp className="h-3.5 w-3.5" />
              {prob}% fechamento
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs">{funilLabels[summary.estagio_funil] || summary.estagio_funil}</span>
            </div>
            <div className={cn("text-xs font-medium", sentimentConfig[summary.sentimento_cliente]?.color)}>
              {sentimentConfig[summary.sentimento_cliente]?.label || summary.sentimento_cliente}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Grid de Insights ── */}
      <div className="grid grid-cols-2 gap-2">
        {summary.assuntos_principais?.length > 0 && (
          <InsightCard icon="💡" title="Assuntos" items={summary.assuntos_principais} />
        )}
        {summary.interesses?.length > 0 && (
          <InsightCard icon="⭐" title="Interesses" items={summary.interesses} />
        )}
        {summary.dores_cliente?.length > 0 && (
          <InsightCard icon="😰" title="Dores do cliente" items={summary.dores_cliente} variant="warning" />
        )}
        {summary.objecoes?.length > 0 && (
          <InsightCard icon="⚡" title="Objeções" items={summary.objecoes} variant="warning" />
        )}
      </div>

      {/* ── Próxima Ação (destaque) ── */}
      {summary.proxima_acao_sugerida && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-3">
            <div className="flex items-start gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                <Target className="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-primary uppercase tracking-wide">Próxima ação sugerida</p>
                <p className="text-xs text-foreground mt-0.5">{summary.proxima_acao_sugerida}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Alertas ── */}
      {summary.alertas?.length > 0 && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
              <p className="text-[10px] font-bold text-destructive uppercase tracking-wide">Alertas</p>
            </div>
            <div className="space-y-1">
              {summary.alertas.map((a, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <AlertTriangle className="h-3 w-3 text-destructive/60 mt-0.5 shrink-0" />
                  <p className="text-xs text-destructive/90">{a}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {updatedAt && (
        <p className="text-[9px] text-muted-foreground text-center">
          Resumo gerado em {format(new Date(updatedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
        </p>
      )}
    </div>
  );
}

function InsightCard({ icon, title, items, variant }: { icon: string; title: string; items: string[]; variant?: "warning" }) {
  return (
    <Card className={cn(
      variant === "warning" ? "border-warning/20 bg-warning/5" : "border-border/30"
    )}>
      <CardContent className="p-2.5">
        <p className="text-[10px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
          <span>{icon}</span> {title}
        </p>
        <div className="space-y-0.5">
          {items.map((item, i) => (
            <p key={i} className="text-[11px] text-foreground flex items-start gap-1">
              <span className="text-muted-foreground/50 mt-px">•</span>
              {item}
            </p>
          ))}
        </div>
      </CardContent>
    </Card>
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
