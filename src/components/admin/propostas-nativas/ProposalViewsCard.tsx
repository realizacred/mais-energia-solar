import { useMemo } from "react";
import { Eye, Clock, Smartphone, Monitor, Send, CheckCircle2, XCircle, UserCheck, Globe, MessageCircle, Link2, Mail, BarChart3, FileText, RefreshCw, Timer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useProposalTracking } from "@/hooks/useProposalTracking";
import { format, formatDistanceToNow, parseISO, eachDayOfInterval, startOfDay, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface ProposalTrackingPanelProps {
  propostaId: string;
  versaoId?: string;
  statusVisualizacao?: string | null;
  primeiroAcessoEm?: string | null;
  ultimoAcessoEm?: string | null;
  totalAberturas?: number;
}

function isMobile(ua: string | null) {
  if (!ua) return false;
  return /mobile|android|iphone|ipad/i.test(ua);
}

const CANAL_ICON: Record<string, any> = {
  whatsapp: MessageCircle,
  link: Link2,
  email: Mail,
};

export function ProposalViewsCard({ propostaId, versaoId, statusVisualizacao, primeiroAcessoEm, ultimoAcessoEm, totalAberturas }: ProposalTrackingPanelProps) {
  const { data, isLoading: loading } = useProposalTracking(propostaId, versaoId);

  const views = data?.views ?? [];
  const totalViews = data?.totalViews ?? 0;
  const tokens = data?.tokens ?? [];
  const envios = data?.envios ?? [];
  const events = data?.events ?? [];

  const deviceBreakdown = useMemo(() => {
    let mobile = 0, desktop = 0;
    views.forEach(v => {
      if (isMobile(v.user_agent)) mobile++;
      else desktop++;
    });
    return { mobile, desktop };
  }, [views]);

  const activeToken = tokens.find(t => t.decisao) || tokens[0] || null;

  // Total duration across all tracked tokens
  const totalDuration = useMemo(() => {
    return tokens.reduce((sum, t) => sum + (t.duracao_total_segundos || 0), 0);
  }, [tokens]);

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    if (min < 60) return `${min}min ${sec > 0 ? `${sec}s` : ""}`.trim();
    const hrs = Math.floor(min / 60);
    const remMin = min % 60;
    return `${hrs}h ${remMin > 0 ? `${remMin}min` : ""}`.trim();
  };

  const EVENT_LABELS: Record<string, { label: string; icon: typeof Eye }> = {
    proposta_visualizada: { label: "Cliente visualizou", icon: Eye },
    proposta_enviada: { label: "Proposta enviada", icon: Send },
    proposta_aceita: { label: "Proposta aceita", icon: CheckCircle2 },
    proposta_recusada: { label: "Proposta recusada", icon: XCircle },
    status_change: { label: "Status alterado", icon: RefreshCw },
    version_created: { label: "Nova versão criada", icon: FileText },
  };

  // Daily views aggregation for chart
  const dailyViews = useMemo(() => {
    if (views.length === 0) return [];

    const now = new Date();
    const oldest = views.length > 0
      ? views.reduce((min, v) => {
          const d = new Date(v.created_at);
          return d < min ? d : min;
        }, now)
      : subDays(now, 7);

    const start = startOfDay(oldest > subDays(now, 30) ? oldest : subDays(now, 30));
    const end = startOfDay(now);
    const days = eachDayOfInterval({ start, end });

    const countMap = new Map<string, number>();
    views.forEach(v => {
      const dayKey = format(startOfDay(new Date(v.created_at)), "yyyy-MM-dd");
      countMap.set(dayKey, (countMap.get(dayKey) || 0) + 1);
    });

    return days.map(d => ({
      dia: format(d, "dd/MM", { locale: ptBR }),
      views: countMap.get(format(d, "yyyy-MM-dd")) || 0,
    }));
  }, [views]);

  const ChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-card border border-border rounded-lg shadow-sm p-2 text-xs">
        <p className="font-medium text-foreground">{label}</p>
        <p className="text-muted-foreground">
          Visualizações: <span className="font-semibold text-foreground">{payload[0].value}</span>
        </p>
      </div>
    );
  };

  if (loading) return <Skeleton className="h-40 rounded-xl" />;

  return (
    <div className="space-y-4">
      {/* ── Decision Status ──────────────────────────────── */}
      {activeToken?.decisao && (
        <Card className={`border-l-[3px] ${activeToken.decisao === "aceita" ? "border-l-success" : "border-l-destructive"} border-border/60`}>
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              {activeToken.decisao === "aceita" ? (
                <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                  <XCircle className="h-5 w-5 text-destructive" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">
                  Proposta {activeToken.decisao === "aceita" ? "Aceita" : "Recusada"}
                </p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                  {activeToken.aceite_nome && (
                    <span className="flex items-center gap-1">
                      <UserCheck className="h-3 w-3" />
                      {activeToken.aceite_nome}
                    </span>
                  )}
                  {activeToken.aceite_documento && (
                    <span>Doc: {activeToken.aceite_documento}</span>
                  )}
                  {activeToken.used_at && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(activeToken.used_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  )}
                </div>
                {activeToken.aceite_observacoes && (
                  <p className="text-xs text-muted-foreground mt-2 bg-muted/50 rounded-lg p-2">
                    💬 {activeToken.aceite_observacoes}
                  </p>
                )}
                {activeToken.recusa_motivo && (
                  <p className="text-xs text-muted-foreground mt-2 bg-destructive/5 rounded-lg p-2">
                    ❌ Motivo: {activeToken.recusa_motivo}
                  </p>
                )}
                {activeToken.assinatura_url && (
                  <div className="mt-2">
                    <p className="text-[10px] text-muted-foreground mb-1">Assinatura digital:</p>
                    <img
                      src={activeToken.assinatura_url}
                      alt="Assinatura"
                      className="h-12 rounded border border-border/60 bg-card p-1"
                    />
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Engagement Metrics ────────────────────────────── */}
      <Card className="border-border/60">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 mb-3">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">Engajamento</p>
            {statusVisualizacao && (
              <Badge
                variant="outline"
                className={cn(
                  "ml-auto text-[10px]",
                  statusVisualizacao === "aberto" && "border-success text-success",
                  statusVisualizacao === "enviado" && "border-info text-info",
                  statusVisualizacao === "nao_enviado" && "border-muted-foreground text-muted-foreground",
                )}
              >
                {statusVisualizacao === "aberto" ? "Aberto" : statusVisualizacao === "enviado" ? "Enviado" : "Não enviado"}
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Views</p>
              <p className="text-lg font-bold">{totalViews}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Mobile</p>
              <div className="flex items-center justify-center gap-1">
                <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-lg font-bold">{deviceBreakdown.mobile}</p>
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Desktop</p>
              <div className="flex items-center justify-center gap-1">
                <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-lg font-bold">{deviceBreakdown.desktop}</p>
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Envios</p>
              <div className="flex items-center justify-center gap-1">
                <Send className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-lg font-bold">{envios.length}</p>
              </div>
            </div>
          </div>

          {/* ── Daily Views Chart ─────────────────────────── */}
          {dailyViews.length > 1 && (
            <>
              <Separator className="my-3" />
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground">Visualizações por dia</p>
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={dailyViews} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="dia"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar
                    dataKey="views"
                    fill="hsl(var(--primary))"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={32}
                  />
                </BarChart>
              </ResponsiveContainer>
            </>
          )}

          {(primeiroAcessoEm || activeToken?.first_viewed_at) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mb-3">
              <span>
                Primeiro acesso: {format(new Date(primeiroAcessoEm || activeToken!.first_viewed_at!), "dd/MM HH:mm", { locale: ptBR })}
              </span>
              {(ultimoAcessoEm || activeToken?.last_viewed_at) && (
                <span>
                  Último acesso: {formatDistanceToNow(new Date(ultimoAcessoEm || activeToken!.last_viewed_at!), { locale: ptBR, addSuffix: true })}
                </span>
              )}
              {typeof totalAberturas === "number" && totalAberturas > 0 && (
                <span>Total: {totalAberturas} abertura{totalAberturas !== 1 ? "s" : ""}</span>
              )}
            </div>
          )}

          {/* Envios timeline */}
          {envios.length > 0 && (
            <>
              <Separator className="my-3" />
              <p className="text-xs font-medium text-muted-foreground mb-2">Histórico de Envios</p>
              <div className="space-y-1.5">
                {envios.map(e => {
                  const CanalIcon = CANAL_ICON[e.canal] || Send;
                  return (
                    <div key={e.id} className="flex items-center gap-2 text-xs">
                      <CanalIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <Badge variant="outline" className="text-[10px]">{e.canal}</Badge>
                      {e.destinatario && <span className="text-muted-foreground truncate">{e.destinatario}</span>}
                      <span className="ml-auto text-muted-foreground whitespace-nowrap">
                        {format(new Date(e.enviado_em), "dd/MM HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Views timeline */}
          {views.length > 0 && (
            <>
              <Separator className="my-3" />
              <p className="text-xs font-medium text-muted-foreground mb-2">Últimas Visualizações</p>
              <div className="space-y-1.5">
                {views.slice(0, 8).map(v => (
                  <div key={v.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                    {isMobile(v.user_agent) ? (
                      <Smartphone className="h-3 w-3 shrink-0" />
                    ) : (
                      <Monitor className="h-3 w-3 shrink-0" />
                    )}
                    <span>{format(new Date(v.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                    {v.referrer && (
                      <span className="text-[10px] truncate max-w-[120px]">
                        <Globe className="h-2.5 w-2.5 inline mr-0.5" />
                        {(() => { try { return new URL(v.referrer).hostname; } catch { return v.referrer; } })()}
                      </span>
                    )}
                  </div>
                ))}
                {totalViews > 8 && (
                  <p className="text-[10px] text-muted-foreground">+{totalViews - 8} visualizações anteriores</p>
                )}
              </div>
            </>
          )}

          {views.length === 0 && envios.length === 0 && events.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              Nenhuma atividade registrada ainda.
            </p>
          )}

          {/* ── Duration ─────────────────────────────────── */}
          {totalDuration > 0 && (
            <>
              <Separator className="my-3" />
              <div className="flex items-center gap-2 text-xs">
                <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Tempo total na proposta:</span>
                <span className="font-semibold text-foreground">{formatDuration(totalDuration)}</span>
              </div>
            </>
          )}

          {/* ── Events Timeline ──────────────────────────── */}
          {events.length > 0 && (
            <>
              <Separator className="my-3" />
              <p className="text-xs font-medium text-muted-foreground mb-2">Linha do Tempo</p>
              <div className="space-y-1.5">
                {events.slice(0, 12).map(ev => {
                  const config = EVENT_LABELS[ev.tipo] || { label: ev.tipo, icon: Eye };
                  const EvIcon = config.icon;
                  const payload = ev.payload || {};
                  const extra = ev.tipo === "proposta_visualizada" && payload.view_count
                    ? ` (${payload.view_count}ª vez)`
                    : ev.tipo === "status_change" && payload.new_status
                      ? ` → ${payload.new_status}`
                      : "";
                  return (
                    <div key={ev.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <EvIcon className="h-3 w-3 shrink-0" />
                      <span className="truncate">{config.label}{extra}</span>
                      <span className="ml-auto whitespace-nowrap text-[10px]">
                        {format(new Date(ev.created_at), "dd/MM HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  );
                })}
                {events.length > 12 && (
                  <p className="text-[10px] text-muted-foreground">+{events.length - 12} eventos anteriores</p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
