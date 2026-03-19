import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Phone, X, DollarSign, Bot, Sparkles } from "lucide-react";
import { formatBRL } from "@/lib/formatters";

interface AlertCardProps {
  alert: {
    id: string;
    tipo_alerta: string;
    severidade: string;
    contexto_json: Record<string, any>;
    margem_disponivel: number | null;
    created_at: string;
    resolvido_at: string | null;
    lead_intelligence_profiles?: {
      temperamento: string | null;
      urgencia_score: number | null;
      dor_principal: string | null;
    };
    leads?: {
      nome: string;
      lead_code: string;
      valor_projeto: number | null;
    };
  };
  consultorMaxDesconto?: number;
  gerenteMaxDesconto?: number;
  onResolve?: (alertId: string, acao: string) => void;
  onUseSuggestion?: (texto: string) => void;
}

const SEVERIDADE_STYLES: Record<string, string> = {
  critica: "bg-destructive/10 text-destructive border-destructive/20",
  alta: "bg-warning/10 text-warning border-warning/20",
  media: "bg-info/10 text-info border-info/20",
  baixa: "bg-muted text-muted-foreground border-border",
};

const TIPO_ICONS: Record<string, string> = {
  preco_detectado: "💰",
  tempo_urgente: "⏰",
  concorrencia: "🏢",
  reaquecimento_oportunidade: "🔥",
};

export function IntelligenceAlertCard({ alert, consultorMaxDesconto = 3, gerenteMaxDesconto = 8, onResolve, onUseSuggestion }: AlertCardProps) {
  const lead = alert.leads;
  const profile = alert.lead_intelligence_profiles;
  const ctx = alert.contexto_json || {};
  const valorProjeto = lead?.valor_projeto || 0;
  const isIA = ctx.analisado_por === "ia";

  const valorConsultor = valorProjeto * (1 - consultorMaxDesconto / 100);
  const valorGerente = valorProjeto * (1 - gerenteMaxDesconto / 100);

  return (
    <Card className="bg-card border-border shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-2 border-b border-border">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">{TIPO_ICONS[alert.tipo_alerta] || "🚨"}</span>
            <CardTitle className="text-sm font-semibold text-foreground uppercase tracking-wide">
              {alert.tipo_alerta.replace(/_/g, " ")}
            </CardTitle>
            {lead && (
              <span className="text-xs text-muted-foreground">
                — {lead.nome} ({lead.lead_code})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {isIA && (
              <Badge variant="outline" className="text-xs gap-1 border-primary/30 text-primary">
                <Bot className="w-3 h-3" /> IA
              </Badge>
            )}
            <Badge variant="outline" className={`text-xs ${SEVERIDADE_STYLES[alert.severidade] || ""}`}>
              {alert.severidade}
            </Badge>
            {profile?.urgencia_score != null && (
              <Badge variant="outline" className="text-xs">
                Urgência: {profile.urgencia_score}/100
              </Badge>
            )}
            {ctx.confianca != null && (
              <Badge variant="secondary" className="text-xs">
                Confiança: {Math.round((ctx.confianca ?? 0) * 100)}%
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-3 space-y-3">
        {/* Objeção específica detectada pela IA */}
        {ctx.objecao_especifica && (
          <blockquote className="border-l-2 border-primary pl-3 italic text-sm text-muted-foreground">
            "{ctx.objecao_especifica}"
          </blockquote>
        )}

        {/* Frase detectada (heurística) */}
        {ctx.frase_detectada && !ctx.objecao_especifica && (
          <blockquote className="border-l-2 border-primary pl-3 italic text-sm text-muted-foreground">
            "{ctx.frase_detectada}"
          </blockquote>
        )}

        {/* Justificativa da IA */}
        {ctx.justificativa && (
          <div className="bg-muted/30 border border-border rounded-lg p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
              <Bot className="w-3 h-3" /> Análise da IA
            </p>
            <p className="text-sm text-foreground">{ctx.justificativa}</p>
          </div>
        )}

        {/* Contexto */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
          {valorProjeto > 0 && <p>Proposta: <span className="font-medium text-foreground">{formatBRL(valorProjeto)}</span></p>}
          {alert.margem_disponivel && <p>Margem: <span className="font-medium text-foreground">{alert.margem_disponivel}%</span></p>}
          {profile?.temperamento && (
            <p>Temperamento: <span className="font-medium text-foreground capitalize">{profile.temperamento}</span></p>
          )}
          {profile?.dor_principal && (
            <p>Dor: <span className="font-medium text-foreground capitalize">{profile.dor_principal}</span></p>
          )}
          {ctx.proximo_passo_sugerido && (
            <p>Próximo passo: <span className="font-medium text-foreground capitalize">{ctx.proximo_passo_sugerido}</span></p>
          )}
          {ctx.modelo && (
            <p>Modelo: <span className="font-medium text-foreground">{ctx.modelo}</span></p>
          )}
        </div>

        {/* Sugestões IA */}
        {ctx.sugestao_abordagem && (
          <div className="bg-muted/30 border border-border rounded-lg p-3 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Sugestões de abordagem {isIA ? "(IA)" : ""}
            </p>
            {Array.isArray(ctx.sugestao_abordagem) ? (
              ctx.sugestao_abordagem.map((s: string, i: number) => (
                <div key={i} className="flex items-start gap-2">
                  <p className="text-sm text-foreground flex-1">
                    {i + 1}. {s}
                  </p>
                  {onUseSuggestion && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-xs h-6 px-2"
                      onClick={() => onUseSuggestion(s)}
                    >
                      Usar
                    </Button>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-foreground">{ctx.sugestao_abordagem}</p>
            )}
          </div>
        )}

        {/* Desconto info */}
        {valorProjeto > 0 && (
          <div className="bg-muted/30 border border-border rounded-lg p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
              <DollarSign className="w-3 h-3 inline" /> Autorização de desconto
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <p>Consultor (até {consultorMaxDesconto}%): <span className="font-semibold text-foreground">{formatBRL(valorConsultor)}</span></p>
              <p>Gerente (até {gerenteMaxDesconto}%): <span className="font-semibold text-foreground">{formatBRL(valorGerente)}</span></p>
            </div>
          </div>
        )}

        {/* Custo da análise (transparência) */}
        {ctx.tokens && (
          <p className="text-[11px] text-muted-foreground/60">
            Análise: {ctx.tokens} tokens • Modelo: {ctx.modelo || "N/A"}
          </p>
        )}

        {/* Ações */}
        {!alert.resolvido_at && onResolve && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button variant="default" size="sm" className="gap-1" onClick={() => onResolve(alert.id, "desconto_aplicado")}>
              <DollarSign className="w-3.5 h-3.5" /> Aplicar Desconto
            </Button>
            <Button variant="outline" size="sm" className="gap-1" onClick={() => onResolve(alert.id, "ligacao_realizada")}>
              <Phone className="w-3.5 h-3.5" /> Ligar
            </Button>
            <Button variant="outline" size="sm" className="gap-1" onClick={() => onResolve(alert.id, "escalado")}>
              <AlertTriangle className="w-3.5 h-3.5" /> Escalar
            </Button>
            <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={() => onResolve(alert.id, "ignorado")}>
              <X className="w-3.5 h-3.5" /> Ignorar
            </Button>
          </div>
        )}

        {/* Resolved state */}
        {alert.resolvido_at && (
          <Badge variant="secondary" className="text-xs">
            ✅ Resolvido: {new Date(alert.resolvido_at).toLocaleDateString("pt-BR")}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
