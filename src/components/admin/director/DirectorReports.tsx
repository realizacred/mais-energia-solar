import { format } from "date-fns";
import { Spinner } from "@/components/ui-kit/Spinner";
import { ptBR } from "date-fns/locale";
import {
  FileBarChart,
  RefreshCw,
  Download,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { useAiInsights } from "@/hooks/useAiInsights";

interface Props {
  insights: ReturnType<typeof useAiInsights>;
}

export function DirectorReports({ insights }: Props) {
  const { getLatestByType, generateInsight, generating, insights: allInsights } = insights;
  const latest = getLatestByType("weekly_report");
  const payload = latest?.payload;
  const isGenerating = generating === "weekly_report";

  const handleExport = () => {
    if (!payload) return;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-comercial-${format(new Date(), "yyyy-MM-dd")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportText = () => {
    if (!payload) return;
    let text = `RELATÓRIO COMERCIAL\n${"=".repeat(50)}\n\n`;
    text += `Período: ${payload.periodo || "N/A"}\n\n`;
    text += `RESUMO\n${"-".repeat(30)}\n${payload.resumo || ""}\n\n`;

    if (payload.metricas) {
      text += `MÉTRICAS\n${"-".repeat(30)}\n`;
      payload.metricas.forEach((m: any) => {
        text += `• ${m.label}: ${m.valor_atual} (anterior: ${m.valor_anterior}, ${m.variacao})\n`;
      });
      text += "\n";
    }

    if (payload.ranking_vendedores) {
      text += `RANKING VENDEDORES\n${"-".repeat(30)}\n`;
      payload.ranking_vendedores.forEach((v: any, i: number) => {
        text += `${i + 1}. ${v.nome} — Leads: ${v.leads}, Conversões: ${v.conversoes}, Valor: R$ ${v.valor?.toLocaleString("pt-BR")}\n`;
      });
      text += "\n";
    }

    if (payload.recomendacoes_estrategicas) {
      text += `RECOMENDAÇÕES\n${"-".repeat(30)}\n`;
      payload.recomendacoes_estrategicas.forEach((r: string, i: number) => {
        text += `${i + 1}. ${r}\n`;
      });
      text += "\n";
    }

    if (payload.projecao_proxima_semana) {
      text += `PROJEÇÃO\n${"-".repeat(30)}\n${payload.projecao_proxima_semana}\n`;
    }

    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-comercial-${format(new Date(), "yyyy-MM-dd")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <FileBarChart className="h-5 w-5 text-secondary" />
          <h3 className="text-base font-semibold">Relatórios</h3>
          {latest && (
            <Badge variant="outline" className="text-xs">
              {format(new Date(latest.created_at), "dd/MM HH:mm", { locale: ptBR })}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {payload && (
            <>
              <Button onClick={handleExportText} size="sm" variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Exportar TXT
              </Button>
              <Button onClick={handleExport} size="sm" variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Exportar JSON
              </Button>
            </>
          )}
          <Button
            onClick={() => generateInsight("weekly_report")}
            disabled={isGenerating}
            size="sm"
            className="gap-2"
          >
            {isGenerating ? <Spinner size="sm" /> : <RefreshCw className="h-4 w-4" />}
            {isGenerating ? "Gerando..." : "Gerar Relatório"}
          </Button>
        </div>
      </div>

      {isGenerating && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Spinner size="lg" />
            <p className="text-sm font-medium text-muted-foreground">Gerando relatório semanal...</p>
          </CardContent>
        </Card>
      )}

      {!payload && !isGenerating && (
        <Card className="border-dashed border-2 border-muted-foreground/20">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 rounded-2xl bg-secondary/10 mb-4">
              <FileBarChart className="h-8 w-8 text-secondary" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Nenhum relatório gerado</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Clique em "Gerar Relatório" para criar um relatório semanal completo.
            </p>
          </CardContent>
        </Card>
      )}

      {payload && !payload.parse_error && !isGenerating && (
        <>
          {/* Summary */}
          {payload.resumo && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">
                  📊 {payload.periodo || "Relatório Semanal"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                  {payload.resumo}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Metrics */}
          {payload.metricas && payload.metricas.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">📈 Métricas</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Métrica</TableHead>
                      <TableHead>Atual</TableHead>
                      <TableHead>Anterior</TableHead>
                      <TableHead>Variação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payload.metricas.map((m: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium text-sm">{m.label}</TableCell>
                        <TableCell className="text-sm">{m.valor_atual}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{m.valor_anterior}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {m.variacao}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Vendor Ranking */}
          {payload.ranking_vendedores && payload.ranking_vendedores.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-warning" />
                  Ranking de Vendedores
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {payload.ranking_vendedores.map((v: any, i: number) => (
                    <div
                      key={i}
                      className={`flex items-center gap-3 p-3 rounded-xl border border-border/40 ${i === 0 ? "bg-warning/5 border-warning/20" : "bg-muted/30"}`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${i === 0 ? "bg-warning text-warning-foreground" : i === 1 ? "bg-muted-foreground/20 text-foreground" : "bg-muted text-muted-foreground"}`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{v.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {v.leads} leads · {v.conversoes} conversões · R$ {v.valor?.toLocaleString("pt-BR")}
                        </p>
                      </div>
                      {v.destaque && (
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {v.destaque}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Strategic Recommendations */}
          {payload.recomendacoes_estrategicas && payload.recomendacoes_estrategicas.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">💡 Recomendações Estratégicas</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {payload.recomendacoes_estrategicas.map((r: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="text-primary font-bold shrink-0">{i + 1}.</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Projection */}
          {payload.projecao_proxima_semana && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-primary mb-1">🔮 Projeção Próxima Semana</p>
                <p className="text-sm text-foreground">{payload.projecao_proxima_semana}</p>
              </CardContent>
            </Card>
          )}

          {/* History */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">📋 Histórico de Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-thin">
                {allInsights.slice(0, 20).map((insight) => (
                  <div
                    key={insight.id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 text-sm"
                  >
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {insight.insight_type.replace(/_/g, " ")}
                    </Badge>
                    <span className="text-muted-foreground truncate">
                      {format(new Date(insight.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
