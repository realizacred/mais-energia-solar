import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  Shield,
  RefreshCw,
  Loader2,
  Flame,
  Clock,
  TrendingDown,
  DollarSign,
  UserX,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { useAiInsights } from "@/hooks/useAiInsights";

interface Props {
  insights: ReturnType<typeof useAiInsights>;
}

const severityConfig = {
  critico: { color: "bg-destructive text-destructive-foreground", border: "border-destructive/30" },
  alto: { color: "bg-warning text-warning-foreground", border: "border-warning/30" },
  medio: { color: "bg-info text-info-foreground", border: "border-info/30" },
  baixo: { color: "bg-muted text-muted-foreground", border: "border-border" },
};

const typeIcons: Record<string, any> = {
  lead_parado: Flame,
  followup_atrasado: Clock,
  conversao_queda: TrendingDown,
  proposta_expirando: Clock,
  inadimplencia: DollarSign,
  vendedor_inativo: UserX,
  outro: Info,
};

export function DirectorAlerts({ insights }: Props) {
  const { getLatestByType, generateInsight, generating } = insights;
  const latest = getLatestByType("alert");
  const payload = latest?.payload;
  const isGenerating = generating === "alert";

  const healthScore = payload?.score_saude_comercial ?? null;
  const healthColor =
    healthScore >= 70 ? "text-success" : healthScore >= 40 ? "text-warning" : "text-destructive";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          <h3 className="text-base font-semibold">Alertas & Riscos</h3>
          {latest && (
            <Badge variant="outline" className="text-xs">
              {format(new Date(latest.created_at), "dd/MM HH:mm", { locale: ptBR })}
            </Badge>
          )}
        </div>
        <Button
          onClick={() => generateInsight("alert")}
          disabled={isGenerating}
          size="sm"
          variant="outline"
          className="gap-2"
        >
          {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {isGenerating ? "Analisando..." : "Atualizar Alertas"}
        </Button>
      </div>

      {isGenerating && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-10 w-10 text-warning animate-spin mb-4" />
            <p className="text-sm font-medium text-muted-foreground">Identificando riscos...</p>
          </CardContent>
        </Card>
      )}

      {!payload && !isGenerating && (
        <Card className="border-dashed border-2 border-muted-foreground/20">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 rounded-2xl bg-warning/10 mb-4">
              <Shield className="h-8 w-8 text-warning" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Nenhum alerta gerado</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Clique em "Atualizar Alertas" para identificar riscos comerciais.
            </p>
          </CardContent>
        </Card>
      )}

      {payload && !payload.parse_error && !isGenerating && (
        <>
          {/* Health Score */}
          {healthScore !== null && (
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Saúde Comercial</p>
                    <p className={`text-3xl font-bold ${healthColor}`}>{healthScore}/100</p>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/50">
                    <Shield className={`h-6 w-6 ${healthColor}`} />
                  </div>
                </div>
                <Progress
                  value={healthScore}
                  className="h-2"
                />
                {payload.resumo_riscos && (
                  <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                    {payload.resumo_riscos}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Alerts List */}
          {payload.alertas && payload.alertas.length > 0 && (
            <div className="space-y-3">
              {payload.alertas.map((alerta: any, idx: number) => {
                const severity = severityConfig[alerta.severidade as keyof typeof severityConfig] || severityConfig.baixo;
                const Icon = typeIcons[alerta.tipo] || Info;

                return (
                  <Card key={idx} className={`${severity.border} transition-all duration-200 hover:-translate-y-0.5`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${severity.color.replace("text-", "bg-").split(" ")[0]}/10`}>
                          <Icon className={`h-4 w-4 ${severity.color.split(" ")[1] || "text-foreground"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={`${severity.color} text-[10px]`}>
                              {alerta.severidade}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{alerta.tipo?.replace(/_/g, " ")}</span>
                          </div>
                          <p className="text-sm font-medium text-foreground">{alerta.titulo}</p>
                          <p className="text-xs text-muted-foreground mt-1">{alerta.descricao}</p>
                          {alerta.acao_sugerida && (
                            <div className="mt-2 px-3 py-2 rounded-lg bg-muted/50 border border-border/40">
                              <p className="text-xs text-muted-foreground">
                                <span className="font-semibold text-foreground">Ação sugerida:</span>{" "}
                                {alerta.acao_sugerida}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
