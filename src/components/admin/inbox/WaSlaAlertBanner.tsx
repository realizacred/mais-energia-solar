import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  Bell,
  BellRing,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { SlaAlert } from "@/hooks/useWaSlaAlerts";

const TIPO_CONFIG: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  atendente_sem_resposta: {
    label: "Aguardando resposta",
    icon: Clock,
    color: "text-warning",
  },
  cliente_sem_resposta: {
    label: "Cliente sem retorno",
    icon: Bell,
    color: "text-info",
  },
  proposta_sem_retorno: {
    label: "Proposta sem retorno",
    icon: AlertTriangle,
    color: "text-destructive",
  },
  conversa_esquecida: {
    label: "Conversa esquecida",
    icon: BellRing,
    color: "text-destructive",
  },
};

interface WaSlaAlertBannerProps {
  alerts: SlaAlert[];
  onOpenConversation: (conversationId: string) => void;
  onAcknowledge: (alertId: string) => void;
  onAcknowledgeAll: () => void;
  isAdmin?: boolean;
}

export function WaSlaAlertBanner({
  alerts,
  onOpenConversation,
  onAcknowledge,
  onAcknowledgeAll,
  isAdmin = false,
}: WaSlaAlertBannerProps) {
  const [isOpen, setIsOpen] = useState(true);

  const unackedAlerts = alerts.filter((a) => !a.acknowledged);
  const escalatedAlerts = unackedAlerts.filter((a) => a.escalated);

  if (unackedAlerts.length === 0) return null;

  const hasEscalated = escalatedAlerts.length > 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div
        className={`rounded-xl border overflow-hidden transition-colors ${
          hasEscalated
            ? "bg-destructive/5 border-destructive/20"
            : "bg-warning/5 border-warning/20"
        }`}
      >
        {/* Header */}
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/20 transition-colors">
            <div className="flex items-center gap-2.5">
              <div
                className={`p-1.5 rounded-lg ${
                  hasEscalated ? "bg-destructive/10" : "bg-warning/10"
                }`}
              >
                {hasEscalated ? (
                  <AlertTriangle className="h-4 w-4 text-destructive animate-pulse" />
                ) : (
                  <BellRing className="h-4 w-4 text-warning animate-pulse" />
                )}
              </div>
              <span className="text-sm font-semibold text-foreground">
                {hasEscalated ? "⚠️ Alertas Críticos de SLA" : "🔔 Alertas de SLA"}
              </span>
              <Badge
                variant="destructive"
                className="text-[10px] px-1.5 py-0 animate-pulse"
              >
                {unackedAlerts.length}
              </Badge>
              {escalatedAlerts.length > 0 && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 border-destructive/30 text-destructive"
                >
                  {escalatedAlerts.length} escalados
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs gap-1"
                onClick={(e) => {
                  e.stopPropagation();
                  onAcknowledgeAll();
                }}
              >
                <CheckCheck className="h-3 w-3" />
                Reconhecer todos
              </Button>
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </button>
        </CollapsibleTrigger>

        {/* Alerts List */}
        <CollapsibleContent>
          <ScrollArea className="max-h-48">
            <div className="px-3 pb-3 space-y-1.5">
              {unackedAlerts.map((alert) => {
                const cfg = TIPO_CONFIG[alert.tipo] || TIPO_CONFIG.atendente_sem_resposta;
                const Icon = cfg.icon;
                const minutesAgo = alert.tempo_sem_resposta_minutos;
                const timeStr = minutesAgo
                  ? minutesAgo >= 60
                    ? `${Math.floor(minutesAgo / 60)}h${minutesAgo % 60 > 0 ? `${minutesAgo % 60}min` : ""}`
                    : `${minutesAgo}min`
                  : formatDistanceToNow(new Date(alert.created_at), { locale: ptBR });

                return (
                  <div
                    key={alert.id}
                    className={`flex items-start gap-3 p-2.5 rounded-lg border transition-colors ${
                      alert.escalated
                        ? "bg-destructive/5 border-destructive/15 hover:bg-destructive/10"
                        : "bg-card/80 border-border/30 hover:bg-muted/30"
                    }`}
                  >
                    <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${cfg.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-xs font-semibold text-foreground">{cfg.label}</span>
                        {alert.cliente_nome && (
                          <span className="text-xs text-foreground/80">— {alert.cliente_nome}</span>
                        )}
                        <span className="text-[10px] text-muted-foreground">• há {timeStr}</span>
                        {alert.escalated && (
                          <Badge variant="destructive" className="text-[9px] px-1 py-0">
                            ESCALADO
                          </Badge>
                        )}
                      </div>
                      {alert.ai_summary && (
                        <p className="text-[11px] text-muted-foreground leading-relaxed flex items-start gap-1">
                          <Sparkles className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                          {alert.ai_summary}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => onOpenConversation(alert.conversation_id)}
                        title="Abrir conversa"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => onAcknowledge(alert.id)}
                        title="Reconhecer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
