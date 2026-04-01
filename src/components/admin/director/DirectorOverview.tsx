import { format } from "date-fns";
import { Spinner } from "@/components/ui-kit/Spinner";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { useLeadStats } from "@/hooks/useDirectorOverview";
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  
  AlertCircle,
  CheckCircle2,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { useAiInsights } from "@/hooks/useAiInsights";

interface Props {
  insights: ReturnType<typeof useAiInsights>;
}

export function DirectorOverview({ insights }: Props) {
  const navigate = useNavigate();
  const { getLatestByType, generateInsight, generating } = insights;
  const latest = getLatestByType("daily_summary");
  const payload = latest?.payload;
  const isGenerating = generating === "daily_summary";

  // Pipeline adoption alert
  const [leadStats, setLeadStats] = useState<{ total: number; semStatus: number } | null>(null);
  useEffect(() => {
    (async () => {
      const { count: total } = await supabase.from("leads").select("id", { count: "exact", head: true }).is("deleted_at", null);
      const { count: semStatus } = await supabase.from("leads").select("id", { count: "exact", head: true }).is("deleted_at", null).is("status_id", null);
      setLeadStats({ total: total || 0, semStatus: semStatus || 0 });
    })();
  }, []);

  const trendIcon = (t: string) => {
    if (t === "up") return <TrendingUp className="h-4 w-4 text-success" />;
    if (t === "down") return <TrendingDown className="h-4 w-4 text-destructive" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const pctSemStatus = leadStats && leadStats.total > 0
    ? Math.round((leadStats.semStatus / leadStats.total) * 100)
    : 0;

  return (
    <div className="space-y-5">
      {/* Pipeline adoption alert */}
      {leadStats && pctSemStatus >= 50 && (
        <Card className="border-l-[3px] border-l-destructive bg-card shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-destructive/10 text-destructive shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {leadStats.semStatus} leads sem classificação ({pctSemStatus}%)
              </p>
              <p className="text-xs text-muted-foreground">
                O funil não está sendo acompanhado — classifique os leads para ativar automações e métricas.
              </p>
            </div>
            <Button size="sm" onClick={() => navigate("/admin/leads")} className="shrink-0">
              Classificar agora
            </Button>
          </CardContent>
        </Card>
      )}
      {/* Generate Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold">Resumo Executivo</h3>
          {latest && (
            <Badge variant="outline" className="text-xs">
              {format(new Date(latest.created_at), "dd/MM HH:mm", { locale: ptBR })}
            </Badge>
          )}
        </div>
        <Button
          onClick={() => generateInsight("daily_summary")}
          disabled={isGenerating}
          size="sm"
          className="gap-2"
        >
          {isGenerating ? (
            <Spinner size="sm" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {isGenerating ? "Gerando..." : "Gerar Insights"}
        </Button>
      </div>

      {!payload && !isGenerating && (
        <Card className="border-dashed border-2 border-muted-foreground/20">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 rounded-2xl bg-primary/10 mb-4">
              <Brain className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Nenhum insight gerado ainda</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-4">
              Clique em "Gerar Insights" para que a IA analise seus dados comerciais e crie um resumo executivo.
            </p>
          </CardContent>
        </Card>
      )}

      {isGenerating && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Spinner size="lg" />
            <p className="text-sm font-medium text-muted-foreground">
              Analisando dados do CRM...
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Isso pode levar alguns segundos
            </p>
          </CardContent>
        </Card>
      )}

      {payload && !payload.parse_error && !isGenerating && (
        <>
          {/* KPI Cards */}
          {payload.kpis && payload.kpis.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {payload.kpis.map((kpi: any, idx: number) => (
                <Card
                  key={idx}
                  className={`relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${kpi.destaque ? "border-primary/30 bg-primary/5" : ""}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-1">
                      <span className="text-xs text-muted-foreground font-medium truncate pr-2">
                        {kpi.label}
                      </span>
                      {trendIcon(kpi.tendencia)}
                    </div>
                    <p className="text-lg font-bold text-foreground">{kpi.valor}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Executive Summary */}
          {payload.resumo_executivo && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Brain className="h-4 w-4 text-primary" />
                  Análise do Momento Comercial
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                  {payload.resumo_executivo}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Highlights & Attention */}
          <div className="grid md:grid-cols-2 gap-4">
            {payload.destaques_positivos && payload.destaques_positivos.length > 0 && (
              <Card className="border-success/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-success">
                    <CheckCircle2 className="h-4 w-4" />
                    Destaques Positivos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {payload.destaques_positivos.map((d: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <ArrowUpRight className="h-4 w-4 text-success shrink-0 mt-0.5" />
                        {d}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {payload.pontos_atencao && payload.pontos_atencao.length > 0 && (
              <Card className="border-warning/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-warning">
                    <AlertCircle className="h-4 w-4" />
                    Pontos de Atenção
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {payload.pontos_atencao.map((p: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Bottlenecks */}
          {payload.gargalos && payload.gargalos.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">🚧 Gargalos do Funil</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {payload.gargalos.map((g: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-3 rounded-xl bg-muted/50 border border-border/40"
                    >
                      <Badge
                        variant={g.impacto === "alto" ? "destructive" : "secondary"}
                        className="text-[10px] shrink-0 mt-0.5"
                      >
                        {g.impacto}
                      </Badge>
                      <div>
                        <p className="text-sm font-medium">{g.etapa}</p>
                        <p className="text-xs text-muted-foreground">{g.descricao}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
