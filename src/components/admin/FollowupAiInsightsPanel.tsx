import { useState } from "react";
import { useFollowupIntelligence } from "@/hooks/useFollowupIntelligence";
import { useTenantPlan } from "@/hooks/useTenantPlan";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui-kit/Spinner";
import {
  Brain,
  MessageSquare,
  Clock,
  AlertTriangle,
  Zap,
  FileText,
  Lock,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Copy,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props {
  conversationId: string;
  clienteNome?: string;
}

const URGENCY_CONFIG = {
  critical: { label: "Crítica", color: "bg-destructive/20 text-destructive", icon: AlertTriangle },
  high: { label: "Alta", color: "bg-warning/20 text-warning", icon: Zap },
  medium: { label: "Média", color: "bg-info/20 text-info", icon: Clock },
  low: { label: "Baixa", color: "bg-muted text-muted-foreground", icon: Minus },
};

const SENTIMENT_CONFIG = {
  positive: { label: "Positivo", icon: ThumbsUp, color: "text-success" },
  neutral: { label: "Neutro", icon: Minus, color: "text-muted-foreground" },
  negative: { label: "Negativo", icon: ThumbsDown, color: "text-destructive" },
  unknown: { label: "Indefinido", icon: Minus, color: "text-muted-foreground" },
};

export function FollowupAiInsightsPanel({ conversationId, clienteNome }: Props) {
  const { hasFeature } = useTenantPlan();
  const hasAi = hasFeature("ai_followup");
  const { generateMessage, classifyUrgency, suggestTiming, summarize, getState } = useFollowupIntelligence();

  const msgState = getState(conversationId, "generate_message");
  const urgState = getState(conversationId, "classify_urgency");
  const timState = getState(conversationId, "suggest_timing");
  const sumState = getState(conversationId, "summarize");

  if (!hasAi) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <Lock className="h-5 w-5 text-muted-foreground shrink-0" />
          <div>
            <p className="text-sm font-medium">Inteligência de Follow-up</p>
            <p className="text-xs text-muted-foreground">
              Disponível nos planos Pro e Enterprise. Gere mensagens, classifique urgência e sugira timings com IA.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const copyMessage = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Mensagem copiada!" });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Brain className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Inteligência IA</h3>
        <Badge variant="outline" className="text-[10px]">
          <Sparkles className="h-2.5 w-2.5 mr-0.5" />
          Pro
        </Badge>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs h-8"
          disabled={msgState.loading}
          onClick={() => generateMessage(conversationId)}
        >
          {msgState.loading ? <Spinner size="sm" /> : <MessageSquare className="h-3 w-3" />}
          Gerar Mensagem
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs h-8"
          disabled={urgState.loading}
          onClick={() => classifyUrgency(conversationId)}
        >
          {urgState.loading ? <Spinner size="sm" /> : <AlertTriangle className="h-3 w-3" />}
          Urgência
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs h-8"
          disabled={timState.loading}
          onClick={() => suggestTiming(conversationId)}
        >
          {timState.loading ? <Spinner size="sm" /> : <Clock className="h-3 w-3" />}
          Melhor Horário
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs h-8"
          disabled={sumState.loading}
          onClick={() => summarize(conversationId)}
        >
          {sumState.loading ? <Spinner size="sm" /> : <FileText className="h-3 w-3" />}
          Resumo
        </Button>
      </div>

      {/* Generated Message */}
      {msgState.data && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-primary">Mensagem Sugerida</span>
              <Badge variant="outline" className="text-[10px]">
                Conf: {msgState.data.confidence}%
              </Badge>
            </div>
            <p className="text-sm leading-relaxed">{msgState.data.message}</p>
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground">{msgState.data.reasoning}</p>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 gap-1 text-[10px]"
                onClick={() => copyMessage(msgState.data.message)}
              >
                <Copy className="h-2.5 w-2.5" />
                Copiar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Urgency Classification */}
      {urgState.data && (
        <Card>
          <CardContent className="p-3 space-y-2">
            {(() => {
              const cfg = URGENCY_CONFIG[urgState.data.urgency as keyof typeof URGENCY_CONFIG] || URGENCY_CONFIG.medium;
              const Icon = cfg.icon;
              return (
                <>
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <Badge className={`${cfg.color} text-xs`}>{cfg.label} ({urgState.data.score})</Badge>
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-0.5">
                    {(urgState.data.reasons || []).map((r: string, i: number) => (
                      <li key={i}>• {r}</li>
                    ))}
                  </ul>
                  <p className="text-xs font-medium">{urgState.data.recommended_action}</p>
                </>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Timing Suggestion */}
      {timState.data && (
        <Card>
          <CardContent className="p-3 space-y-1">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-info" />
              <span className="text-xs font-medium">Melhor horário: {timState.data.best_hour}h ({timState.data.best_day_of_week})</span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Aguardar ~{timState.data.delay_minutes}min · Conf: {timState.data.confidence}%
            </p>
            <p className="text-[10px] text-muted-foreground">{timState.data.reasoning}</p>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {sumState.data && (
        <Card>
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium">Resumo da Conversa</span>
              {(() => {
                const s = SENTIMENT_CONFIG[sumState.data.client_sentiment as keyof typeof SENTIMENT_CONFIG] || SENTIMENT_CONFIG.unknown;
                const SIcon = s.icon;
                return (
                  <Badge variant="outline" className={`text-[10px] gap-0.5 ${s.color}`}>
                    <SIcon className="h-2.5 w-2.5" />
                    {s.label}
                  </Badge>
                );
              })()}
            </div>
            <p className="text-xs leading-relaxed">{sumState.data.summary}</p>

            {sumState.data.key_interests?.length > 0 && (
              <div>
                <span className="text-[10px] font-medium text-success">Interesses:</span>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {sumState.data.key_interests.map((i: string, idx: number) => (
                    <Badge key={idx} variant="outline" className="text-[10px] bg-success/10">{i}</Badge>
                  ))}
                </div>
              </div>
            )}

            {sumState.data.objections?.length > 0 && (
              <div>
                <span className="text-[10px] font-medium text-warning">Objeções:</span>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {sumState.data.objections.map((o: string, idx: number) => (
                    <Badge key={idx} variant="outline" className="text-[10px] bg-warning/10">{o}</Badge>
                  ))}
                </div>
              </div>
            )}

            {sumState.data.next_steps?.length > 0 && (
              <div>
                <span className="text-[10px] font-medium">Próximos passos:</span>
                <ul className="text-[10px] text-muted-foreground mt-0.5">
                  {sumState.data.next_steps.map((s: string, idx: number) => (
                    <li key={idx}>→ {s}</li>
                  ))}
                </ul>
              </div>
            )}

            <Badge variant="outline" className="text-[10px]">
              Potencial: {sumState.data.deal_potential === "high" ? "🟢 Alto" : sumState.data.deal_potential === "medium" ? "🟡 Médio" : "🔴 Baixo"}
            </Badge>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
