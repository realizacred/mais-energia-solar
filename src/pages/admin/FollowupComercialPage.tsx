/**
 * Central de Recuperação Comercial (Phase 1 — read-only).
 *
 * Reaproveita (RB-76, sem duplicar):
 *  - vw_proposal_followup_inbox  (Phase 0)
 *  - RPC get_followup_kpis       (Phase 0)
 *  - PageHeader, StatCard, EmptyState, Skeleton (ui-kit padrão)
 *
 * Hooks: useFollowupComercialKpis / useFollowupComercialInbox
 *        — queries não vivem no componente (governança §16/§23).
 *
 * Disparos manuais/automáticos virão nas Phases 2+ atrás de feature flag.
 */
import { useMemo, useState } from "react";
import {
  Flame,
  Snowflake,
  EyeOff,
  Eye,
  Clock,
  Send,
  RefreshCw,
  Sparkles,
  Search,
  Inbox,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { StatCard } from "@/components/ui-kit/StatCard";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FollowupSendDialog } from "@/components/admin/followup-comercial/FollowupSendDialog";
import { FollowupComercialAnalytics } from "@/components/admin/followup-comercial/FollowupComercialAnalytics";
import {
  useFollowupComercialKpis,
  useFollowupComercialInbox,
  type FollowupClasse,
  type FollowupInboxRow,
} from "@/hooks/useFollowupComercial";
import { formatDiasParado, formatDiasParadoCompact } from "@/lib/formatters/diasParado";

import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const TZ = "America/Sao_Paulo";

const classeLabel: Record<string, { label: string; tone: string }> = {
  sem_resposta: { label: "Sem resposta", tone: "bg-warning/10 text-warning border-warning/30" },
  visualizada_sem_retorno: {
    label: "Visualizada s/ retorno",
    tone: "bg-info/10 text-info border-info/30",
  },
  esquecida: { label: "Esquecida", tone: "bg-destructive/10 text-destructive border-destructive/30" },
  negociacao_quente: { label: "Quente", tone: "bg-success/10 text-success border-success/30" },
  outro: { label: "—", tone: "bg-muted text-muted-foreground border-border" },
};

const tempLabel: Record<string, string> = {
  quente: "🔥 Quente",
  morna: "🌤 Morna",
  fria: "❄️ Fria",
};

function formatBRL(v: number | null | undefined) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function formatRelative(iso: string | null) {
  if (!iso) return "—";
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });
  } catch {
    return "—";
  }
}

function formatAbsolute(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: TZ,
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

function KpiSkeletons() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-[88px] rounded-lg" />
      ))}
    </div>
  );
}

function TableSkeletons() {
  return (
    <div className="p-4 space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

export default function FollowupComercialPage() {
  const [classe, setClasse] = useState<FollowupClasse | "todos">("todos");
  const [diasMin, setDiasMin] = useState<string>("0");
  const [search, setSearch] = useState("");
  const [sendTarget, setSendTarget] = useState<FollowupInboxRow | null>(null);

  const kpis = useFollowupComercialKpis();
  const inbox = useFollowupComercialInbox({
    classe,
    diasMin: Number(diasMin) || 0,
    search,
  });

  const rows = inbox.data ?? [];

  const totalValor = useMemo(
    () => rows.reduce((acc, r) => acc + (Number(r.valor_total) || 0), 0),
    [rows]
  );

  const refreshAll = () => {
    kpis.refetch();
    inbox.refetch();
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        icon={Flame}
        title="Recuperação Comercial"
        description="Propostas paradas, visualizadas sem retorno e oportunidades de reaquecimento. Modo leitura."
        helpText="Consolidação read-only de propostas comerciais elegíveis para follow-up. As ações de envio serão liberadas nas próximas fases atrás de feature flag."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={refreshAll}
            disabled={inbox.isFetching || kpis.isFetching}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${inbox.isFetching || kpis.isFetching ? "animate-spin" : ""}`}
            />
            Atualizar
          </Button>
        }
      />

      {/* KPIs */}
      {kpis.isLoading ? (
        <KpiSkeletons />
      ) : kpis.isError ? (
        <Card className="border-l-[3px] border-l-destructive">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Não foi possível carregar os KPIs.
            </div>
            <Button size="sm" variant="outline" onClick={() => kpis.refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" /> Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={EyeOff} label="Sem resposta" value={kpis.data?.sem_resposta ?? 0} color="warning" />
          <StatCard icon={Eye} label="Visualizadas s/ retorno" value={kpis.data?.visualizadas_sem_retorno ?? 0} color="info" />
          <StatCard icon={Clock} label="Esquecidas 30+ dias" value={kpis.data?.esquecidas_30d ?? 0} color="destructive" />
          <StatCard icon={Flame} label="Quentes" value={kpis.data?.quentes ?? 0} color="success" />
          <StatCard icon={Snowflake} label="Frias" value={kpis.data?.frias ?? 0} color="muted" />
          <StatCard icon={Send} label="Follow-ups pendentes" value={kpis.data?.followups_pendentes ?? 0} color="primary" />
          <StatCard icon={Sparkles} label="Recuperadas 30d" value={kpis.data?.recuperadas_30d ?? 0} color="success" />
          <StatCard icon={Clock} label="Esquecidas 90+" value={kpis.data?.esquecidas_90d ?? 0} color="destructive" />
        </div>
      )}

      {/* Filtros */}
      <Card className="border-border">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente, código ou título…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={classe} onValueChange={(v) => setClasse(v as FollowupClasse | "todos")}>
            <SelectTrigger><SelectValue placeholder="Classe" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as classes</SelectItem>
              <SelectItem value="sem_resposta">Sem resposta</SelectItem>
              <SelectItem value="visualizada_sem_retorno">Visualizada sem retorno</SelectItem>
              <SelectItem value="esquecida">Esquecidas</SelectItem>
              <SelectItem value="negociacao_quente">Quentes</SelectItem>
            </SelectContent>
          </Select>
          <Select value={diasMin} onValueChange={setDiasMin}>
            <SelectTrigger><SelectValue placeholder="Tempo parado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Qualquer tempo</SelectItem>
              <SelectItem value="3">3+ dias</SelectItem>
              <SelectItem value="7">7+ dias</SelectItem>
              <SelectItem value="15">15+ dias</SelectItem>
              <SelectItem value="30">30+ dias</SelectItem>
              <SelectItem value="60">60+ dias</SelectItem>
              <SelectItem value="90">90+ dias</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Inbox */}
      <Card className="border-border">
        <CardContent className="p-0">
          {inbox.isLoading ? (
            <TableSkeletons />
          ) : inbox.isError ? (
            <div className="p-6 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Erro ao carregar inbox de recuperação.
              </div>
              <Button size="sm" variant="outline" onClick={() => inbox.refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" /> Tentar novamente
              </Button>
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="Nenhuma proposta encontrada"
              description="Ajuste os filtros ou aguarde novas propostas elegíveis para reaquecimento."
            />
          ) : (
            <>
              <div className="px-4 py-3 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs text-muted-foreground">
                <span>
                  {rows.length} proposta(s) — valor potencial{" "}
                  <strong className="text-foreground">{formatBRL(totalValor)}</strong>
                </span>
                <span className="hidden sm:inline">
                  Limite 300 — refine filtros para listas maiores
                </span>
              </div>

              {/* Mobile cards (<= sm) */}
              <ul className="md:hidden divide-y divide-border">
                {rows.map((r) => {
                  const c = classeLabel[r.classe_followup ?? "outro"] ?? classeLabel.outro;
                  return (
                    <li key={`m-${r.proposta_id}-${r.versao_id ?? "v"}`} className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium text-sm text-foreground truncate">
                            {r.cliente_nome ?? "—"}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {r.codigo ? `${r.codigo} · ` : ""}{r.titulo ?? "Sem título"}
                          </div>
                        </div>
                        <Badge variant="outline" className={`${c.tone} text-[10px] shrink-0`}>
                          {c.label}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <div className="text-muted-foreground">Valor</div>
                          <div className="font-medium text-foreground">{formatBRL(r.valor_total)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Parado</div>
                          <div className="font-medium text-foreground">
                            {formatDiasParado(r.dias_parado)}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Aberturas</div>
                          <div className="font-medium text-foreground">{r.total_aberturas ?? 0}</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                        <span>{tempLabel[r.temperatura ?? ""] ?? "—"}</span>
                        <span title={formatAbsolute(r.ultima_atividade_em)}>
                          {formatRelative(r.ultima_atividade_em)}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        disabled={!r.telefone_normalized}
                        onClick={() => setSendTarget(r)}
                      >
                        <Send className="h-3.5 w-3.5 mr-2" /> Enviar follow-up
                      </Button>
                    </li>
                  );
                })}
              </ul>

              {/* Desktop table (>= md) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-2">Cliente / Proposta</th>
                      <th className="text-left px-4 py-2">Classe</th>
                      <th className="text-left px-4 py-2">Temperatura</th>
                      <th className="text-right px-4 py-2">Valor</th>
                      <th className="text-right px-4 py-2">kWp</th>
                      <th className="text-right px-4 py-2">Aberturas</th>
                      <th className="text-right px-4 py-2">Parado</th>
                      <th className="text-left px-4 py-2">Última atividade</th>
                      <th className="text-right px-4 py-2 w-[1%]">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const c = classeLabel[r.classe_followup ?? "outro"] ?? classeLabel.outro;
                      return (
                        <tr
                          key={`${r.proposta_id}-${r.versao_id ?? "v"}`}
                          className="border-t border-border hover:bg-muted/30"
                        >
                          <td className="px-4 py-2">
                            <div className="font-medium text-foreground truncate max-w-[260px]">
                              {r.cliente_nome ?? "—"}
                            </div>
                            <div className="text-xs text-muted-foreground truncate max-w-[260px]">
                              {r.codigo ? `${r.codigo} · ` : ""}{r.titulo ?? "Sem título"}
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <Badge variant="outline" className={c.tone}>{c.label}</Badge>
                          </td>
                          <td className="px-4 py-2 text-xs text-foreground">
                            {tempLabel[r.temperatura ?? ""] ?? "—"}
                            {r.score_ia != null && (
                              <span className="text-muted-foreground ml-1">({r.score_ia})</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums">{formatBRL(r.valor_total)}</td>
                          <td className="px-4 py-2 text-right tabular-nums">
                            {r.potencia_kwp ? Number(r.potencia_kwp).toFixed(2) : "—"}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums">{r.total_aberturas ?? 0}</td>
                          <td className="px-4 py-2 text-right tabular-nums">
                            <span title={formatDiasParado(r.dias_parado)}>{formatDiasParadoCompact(r.dias_parado)}</span>
                          </td>
                          <td
                            className="px-4 py-2 text-xs text-muted-foreground"
                            title={formatAbsolute(r.ultima_atividade_em)}
                          >
                            {formatRelative(r.ultima_atividade_em)}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!r.telefone_normalized}
                              onClick={() => setSendTarget(r)}
                            >
                              <Send className="h-3.5 w-3.5 mr-1.5" /> Enviar
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <FollowupSendDialog
        row={sendTarget}
        open={!!sendTarget}
        onOpenChange={(o) => !o && setSendTarget(null)}
      />
    </div>
  );
}
