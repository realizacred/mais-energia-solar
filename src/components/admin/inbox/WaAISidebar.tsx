import { useState, useCallback } from "react";
import {
  Sparkles, Send, Copy, RefreshCw, Loader2, X, MessageCircle,
  Clock, AlertTriangle, CheckCircle2, FileText, Brain, Zap,
  ClipboardList, TrendingUp, ShieldAlert, Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { WaConversation } from "@/hooks/useWaInbox";

interface WaAISidebarProps {
  conversation: WaConversation;
  onClose: () => void;
  onUseSuggestion: (text: string) => void;
}

type TabType = "suggest" | "explainer" | "followup" | "summary";

interface FollowupPlan {
  urgency: string;
  recommended_action: string;
  suggested_message: string;
  reasoning: string;
  wait_hours: number;
  followup_type: string;
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

export function WaAISidebar({ conversation, onClose, onUseSuggestion }: WaAISidebarProps) {
  const [activeTab, setActiveTab] = useState<TabType>("suggest");
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [followupPlan, setFollowupPlan] = useState<FollowupPlan | null>(null);
  const [conversationSummary, setConversationSummary] = useState<ConversationSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editedSuggestion, setEditedSuggestion] = useState<string | null>(null);
  const { toast } = useToast();

  const getAuthHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Sessão inválida");
    return { Authorization: `Bearer ${session.access_token}` };
  }, []);

  const handleSuggest = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuggestion(null);
    setEditedSuggestion(null);
    try {
      const headers = await getAuthHeaders();
      const { data, error: fnError } = await supabase.functions.invoke("ai-suggest-message", {
        headers,
        body: { conversation_id: conversation.id },
      });
      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);
      setSuggestion(data.suggestion);
      setEditedSuggestion(data.suggestion);
    } catch (err: any) {
      setError(err.message || "Erro ao gerar sugestão");
    } finally {
      setLoading(false);
    }
  }, [conversation.id, getAuthHeaders]);

  const handleExplainer = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuggestion(null);
    setEditedSuggestion(null);
    try {
      if (!conversation.lead_id) {
        setError("Nenhum lead vinculado a esta conversa. Vincule primeiro.");
        setLoading(false);
        return;
      }
      const { data: propostas } = await (supabase as any)
        .from("propostas")
        .select("id")
        .eq("lead_id", conversation.lead_id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (!propostas || propostas.length === 0) {
        setError("Nenhuma proposta encontrada para este lead.");
        setLoading(false);
        return;
      }

      const headers = await getAuthHeaders();
      const { data, error: fnError } = await supabase.functions.invoke("ai-proposal-explainer", {
        headers,
        body: {
          proposal_id: propostas[0].id,
          conversation_id: conversation.id,
          format: "short",
        },
      });
      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);
      setSuggestion(data.suggestion);
      setEditedSuggestion(data.suggestion);
    } catch (err: any) {
      setError(err.message || "Erro ao gerar explicação");
    } finally {
      setLoading(false);
    }
  }, [conversation.id, conversation.lead_id, getAuthHeaders]);

  const handleFollowup = useCallback(async () => {
    setLoading(true);
    setError(null);
    setFollowupPlan(null);
    setSuggestion(null);
    setEditedSuggestion(null);
    try {
      const headers = await getAuthHeaders();
      const { data, error: fnError } = await supabase.functions.invoke("ai-followup-planner", {
        headers,
        body: { conversation_id: conversation.id },
      });
      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);
      setFollowupPlan(data.plan);
      setSuggestion(data.plan?.suggested_message || null);
      setEditedSuggestion(data.plan?.suggested_message || null);
    } catch (err: any) {
      setError(err.message || "Erro ao planejar follow-up");
    } finally {
      setLoading(false);
    }
  }, [conversation.id, getAuthHeaders]);

  const handleSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    setConversationSummary(null);
    setSuggestion(null);
    setEditedSuggestion(null);
    try {
      const headers = await getAuthHeaders();
      const { data, error: fnError } = await supabase.functions.invoke("ai-conversation-summary", {
        headers,
        body: { conversation_id: conversation.id },
      });
      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);
      setConversationSummary(data.summary);
    } catch (err: any) {
      setError(err.message || "Erro ao gerar resumo");
    } finally {
      setLoading(false);
    }
  }, [conversation.id, getAuthHeaders]);

  const handleGenerate = useCallback(() => {
    if (activeTab === "suggest") handleSuggest();
    else if (activeTab === "explainer") handleExplainer();
    else if (activeTab === "followup") handleFollowup();
    else handleSummary();
  }, [activeTab, handleSuggest, handleExplainer, handleFollowup, handleSummary]);

  const handleCopy = useCallback(() => {
    const text = editedSuggestion || suggestion;
    if (text) {
      navigator.clipboard.writeText(text);
      toast({ title: "Copiado!", description: "Sugestão copiada para a área de transferência" });
    }
  }, [editedSuggestion, suggestion, toast]);

  const handleUse = useCallback(() => {
    const text = editedSuggestion || suggestion;
    if (text) {
      onUseSuggestion(text);
      toast({ title: "✨ Mensagem inserida", description: "Revise e envie quando quiser" });
    }
  }, [editedSuggestion, suggestion, onUseSuggestion, toast]);

  const urgencyConfig: Record<string, { color: string; icon: typeof AlertTriangle; label: string }> = {
    high: { color: "text-destructive", icon: AlertTriangle, label: "Alta" },
    medium: { color: "text-warning", icon: Clock, label: "Média" },
    low: { color: "text-success", icon: CheckCircle2, label: "Baixa" },
  };

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

  const tabs: { key: TabType; label: string; icon: typeof Sparkles; description: string }[] = [
    { key: "suggest", label: "Sugestão", icon: MessageCircle, description: "Gerar resposta contextual" },
    { key: "explainer", label: "Proposta", icon: FileText, description: "Explicar proposta ao cliente" },
    { key: "followup", label: "Follow-up", icon: Brain, description: "Planejar follow-up inteligente" },
    { key: "summary", label: "Resumo", icon: ClipboardList, description: "Resumo estratégico da conversa" },
  ];

  return (
    <div className="w-80 border-l border-border/40 bg-card/50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/40">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </div>
          <h3 className="text-xs font-semibold text-foreground">Assistente IA</h3>
        </div>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Tabs */}
      <div className="px-2 pt-2 pb-1 flex gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              setSuggestion(null);
              setEditedSuggestion(null);
              setFollowupPlan(null);
              setConversationSummary(null);
              setError(null);
            }}
            className={`flex-1 flex flex-col items-center gap-0.5 px-1.5 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-primary/10 text-primary border border-primary/20"
                : "text-muted-foreground hover:bg-muted/50 border border-transparent"
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {/* Tab description */}
          <p className="text-[10px] text-muted-foreground">
            {tabs.find((t) => t.key === activeTab)?.description}
          </p>

          {/* Generate button */}
          <Button
            onClick={handleGenerate}
            disabled={loading}
            size="sm"
            className="w-full h-8 text-xs gap-1.5"
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Zap className="h-3.5 w-3.5" />
                {(suggestion || conversationSummary) ? "Regerar" : "Gerar"} {tabs.find((t) => t.key === activeTab)?.label}
              </>
            )}
          </Button>

          {/* Error */}
          {error && (
            <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-[11px] text-destructive font-medium">{error}</p>
            </div>
          )}

          {/* ── SUMMARY TAB RESULT ── */}
          {conversationSummary && activeTab === "summary" && (
            <div className="space-y-2.5">
              {/* Resumo */}
              <div className="p-2.5 rounded-lg bg-muted/30 border border-border/20">
                <p className="text-[10px] text-muted-foreground font-medium mb-1">📝 Resumo</p>
                <p className="text-[11px] text-foreground leading-relaxed">{conversationSummary.resumo}</p>
              </div>

              {/* Métricas rápidas */}
              <div className="grid grid-cols-2 gap-1.5">
                <div className="p-2 rounded-lg bg-muted/20 border border-border/20 text-center">
                  <p className="text-[9px] text-muted-foreground">Funil</p>
                  <p className="text-[11px] font-medium">{funilLabels[conversationSummary.estagio_funil] || conversationSummary.estagio_funil}</p>
                </div>
                <div className="p-2 rounded-lg bg-muted/20 border border-border/20 text-center">
                  <p className="text-[9px] text-muted-foreground">Sentimento</p>
                  <p className={`text-[11px] font-medium ${sentimentConfig[conversationSummary.sentimento_cliente]?.color || ""}`}>
                    {sentimentConfig[conversationSummary.sentimento_cliente]?.label || conversationSummary.sentimento_cliente}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-muted/20 border border-border/20 text-center col-span-2">
                  <p className="text-[9px] text-muted-foreground">Probabilidade de Fechamento</p>
                  <div className="flex items-center justify-center gap-1.5 mt-0.5">
                    <TrendingUp className="h-3 w-3 text-primary" />
                    <span className="text-sm font-bold text-primary">{conversationSummary.probabilidade_fechamento}%</span>
                  </div>
                </div>
              </div>

              {/* Lists */}
              {conversationSummary.assuntos_principais.length > 0 && (
                <SummaryList title="💡 Assuntos Principais" items={conversationSummary.assuntos_principais} />
              )}
              {conversationSummary.interesses.length > 0 && (
                <SummaryList title="⭐ Interesses" items={conversationSummary.interesses} />
              )}
              {conversationSummary.dores_cliente.length > 0 && (
                <SummaryList title="😰 Dores do Cliente" items={conversationSummary.dores_cliente} />
              )}
              {conversationSummary.objecoes.length > 0 && (
                <SummaryList title="⚡ Objeções" items={conversationSummary.objecoes} color="text-warning" />
              )}

              {/* Próxima ação */}
              {conversationSummary.proxima_acao_sugerida && (
                <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Target className="h-3 w-3 text-primary" />
                    <p className="text-[10px] text-primary font-semibold">Próxima Ação</p>
                  </div>
                  <p className="text-[11px] text-foreground">{conversationSummary.proxima_acao_sugerida}</p>
                </div>
              )}

              {/* Alertas */}
              {conversationSummary.alertas && conversationSummary.alertas.length > 0 && (
                <div className="p-2.5 rounded-lg bg-destructive/5 border border-destructive/20">
                  <div className="flex items-center gap-1.5 mb-1">
                    <ShieldAlert className="h-3 w-3 text-destructive" />
                    <p className="text-[10px] text-destructive font-semibold">Alertas</p>
                  </div>
                  {conversationSummary.alertas.map((a, i) => (
                    <p key={i} className="text-[11px] text-destructive/80">• {a}</p>
                  ))}
                </div>
              )}

              <p className="text-[9px] text-muted-foreground text-center">
                ⚠️ Resumo gerado por IA. Pode conter imprecisões.
              </p>
            </div>
          )}

          {/* Follow-up plan header */}
          {followupPlan && activeTab === "followup" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {(() => {
                  const config = urgencyConfig[followupPlan.urgency] || urgencyConfig.medium;
                  const Icon = config.icon;
                  return (
                    <>
                      <Icon className={`h-4 w-4 ${config.color}`} />
                      <Badge variant="outline" className={`text-[9px] ${config.color}`}>
                        Urgência: {config.label}
                      </Badge>
                    </>
                  );
                })()}
                <Badge variant="outline" className="text-[9px]">
                  <Clock className="h-2.5 w-2.5 mr-0.5" />
                  {followupPlan.wait_hours}h
                </Badge>
              </div>
              
              <div className="p-2 rounded-lg bg-muted/30">
                <p className="text-[10px] text-muted-foreground font-medium mb-0.5">Ação recomendada:</p>
                <p className="text-[11px] text-foreground">{followupPlan.recommended_action}</p>
              </div>

              <div className="p-2 rounded-lg bg-muted/30">
                <p className="text-[10px] text-muted-foreground font-medium mb-0.5">Raciocínio:</p>
                <p className="text-[11px] text-muted-foreground">{followupPlan.reasoning}</p>
              </div>

              <Separator className="bg-border/30" />
            </div>
          )}

          {/* Suggestion text (for suggest/explainer/followup tabs) */}
          {suggestion && activeTab !== "summary" && (
            <div className="space-y-2">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                Mensagem sugerida
              </p>
              
              <Textarea
                value={editedSuggestion || ""}
                onChange={(e) => setEditedSuggestion(e.target.value)}
                className="min-h-[120px] text-xs leading-relaxed resize-y bg-muted/20 border-border/30"
              />

              {/* Actions */}
              <div className="flex gap-1.5">
                <Button
                  onClick={handleUse}
                  size="sm"
                  className="flex-1 h-7 text-xs gap-1"
                >
                  <Send className="h-3 w-3" />
                  Usar no Composer
                </Button>
                <Button
                  onClick={handleCopy}
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                >
                  <Copy className="h-3 w-3" />
                </Button>
                <Button
                  onClick={handleGenerate}
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  disabled={loading}
                >
                  <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                </Button>
              </div>

              <p className="text-[9px] text-muted-foreground text-center">
                ⚠️ Revise antes de enviar. A IA pode cometer erros.
              </p>
            </div>
          )}

          {/* Empty state */}
          {!suggestion && !loading && !error && !conversationSummary && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center mb-3">
                <Sparkles className="h-5 w-5 text-primary/50" />
              </div>
              <p className="text-xs text-muted-foreground">
                Clique em "Gerar" para receber uma {activeTab === "summary" ? "análise" : "sugestão"} da IA baseada no contexto da conversa.
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// Small helper component for summary lists
function SummaryList({ title, items, color }: { title: string; items: string[]; color?: string }) {
  return (
    <div className="p-2 rounded-lg bg-muted/20 border border-border/20">
      <p className="text-[10px] text-muted-foreground font-medium mb-1">{title}</p>
      {items.map((item, i) => (
        <p key={i} className={`text-[11px] ${color || "text-foreground"}`}>• {item}</p>
      ))}
    </div>
  );
}
