/**
 * Central de Recuperação Comercial (Phase 1 — read-only).
 *
 * Reaproveita:
 *  - vw_proposal_followup_inbox (Phase 0)
 *  - RPC get_followup_kpis     (Phase 0)
 *  - StatCard, LoadingState, PageHeader patterns existentes
 *
 * RB-76: nada de duplicar dashboards. Esta tela é leitura pura.
 *        Disparos manuais/automáticos virão nas Phases 2+ atrás de feature flag.
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
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui-kit/StatCard";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import {
  useFollowupComercialKpis,
  useFollowupComercialInbox,
  type FollowupClasse,
} from "@/hooks/useFollowupComercial";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const classeLabel: Record<string, { label: string; tone: string }> = {
  sem_resposta: { label: "Sem resposta", tone: "bg-warning/10 text-warning" },
  visualizada_sem_retorno: {
    label: "Visualizada s/ retorno",
    tone: "bg-info/10 text-info",
  },
  esquecida: { label: "Esquecida", tone: "bg-destructive/10 text-destructive" },
  negociacao_quente: { label: "Quente", tone: "bg-success/10 text-success" },
  outro: { label: "—", tone: "bg-muted text-muted-foreground" },
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

export default function FollowupComercialPage() {
  const [classe, setClasse] = useState<FollowupClasse | "todos">("todos");
  const [diasMin, setDiasMin] = useState<string>("0");
  const [search, setSearch] = useState("");

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

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Central de Recuperação Comercial
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Propostas paradas, visualizações sem retorno e oportunidades de
            reaquecimento. <span className="font-medium">Modo leitura.</span>
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            kpis.refetch();
            inbox.refetch();
          }}
          disabled={inbox.isFetching}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${inbox.isFetching ? "animate-spin" : ""}`}
          />
          Atualizar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={EyeOff}
          label="Sem resposta"
          value={kpis.data?.sem_resposta ?? "—"}
          color="warning"
        />
        <StatCard
          icon={Eye}
          label="Visualizadas s/ retorno"
          value={kpis.data?.visualizadas_sem_retorno ?? "—"}
          color="info"
        />
        <StatCard
          icon={Clock}
          label="Esquecidas 30+ dias"
          value={kpis.data?.esquecidas_30d ?? "—"}
          color="destructive"
        />
        <StatCard
          icon={Flame}
          label="Quentes"
          value={kpis.data?.quentes ?? "—"}
          color="success"
        />
        <StatCard
          icon={Snowflake}
          label="Frias"
          value={kpis.data?.frias ?? "—"}
          color="muted"
        />
        <StatCard
          icon={Send}
          label="Follow-ups pendentes"
          value={kpis.data?.followups_pendentes ?? "—"}
          color="primary"
        />
        <StatCard
          icon={Sparkles}
          label="Recuperadas 30d"
          value={kpis.data?.recuperadas_30d ?? "—"}
          color="success"
        />
        <StatCard
          icon={Clock}
          label="Esquecidas 90+"
          value={kpis.data?.esquecidas_90d ?? "—"}
          color="destructive"
        />
      </div>

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
          <Select
            value={classe}
            onValueChange={(v) => setClasse(v as FollowupClasse | "todos")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Classe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as classes</SelectItem>
              <SelectItem value="sem_resposta">Sem resposta</SelectItem>
              <SelectItem value="visualizada_sem_retorno">
                Visualizada sem retorno
              </SelectItem>
              <SelectItem value="esquecida">Esquecidas</SelectItem>
              <SelectItem value="negociacao_quente">Quentes</SelectItem>
            </SelectContent>
          </Select>
          <Select value={diasMin} onValueChange={setDiasMin}>
            <SelectTrigger>
              <SelectValue placeholder="Tempo parado" />
            </SelectTrigger>
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

      {/* Tabela */}
      <Card className="border-border">
        <CardContent className="p-0">
          {inbox.isLoading ? (
            <div className="p-8">
              <LoadingState message="Carregando inbox de recuperação…" />
            </div>
          ) : inbox.isError ? (
            <div className="p-8 text-center text-sm text-destructive">
              Erro ao carregar inbox de follow-up. Tente novamente.
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Nenhuma proposta encontrada com os filtros atuais.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {rows.length} proposta(s) — valor potencial{" "}
                  <strong className="text-foreground">
                    {formatBRL(totalValor)}
                  </strong>
                </span>
                <span>Limite 300 — refine os filtros para listas maiores</span>
              </div>
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
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const c =
                      classeLabel[r.classe_followup ?? "outro"] ??
                      classeLabel.outro;
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
                            {r.codigo ? `${r.codigo} · ` : ""}
                            {r.titulo ?? "Sem título"}
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <Badge variant="outline" className={c.tone}>
                            {c.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-xs">
                          {tempLabel[r.temperatura ?? ""] ?? "—"}
                          {r.score_ia != null && (
                            <span className="text-muted-foreground ml-1">
                              ({r.score_ia})
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {formatBRL(r.valor_total)}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {r.potencia_kwp
                            ? Number(r.potencia_kwp).toFixed(2)
                            : "—"}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {r.total_aberturas ?? 0}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {r.dias_parado != null ? `${r.dias_parado}d` : "—"}
                        </td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">
                          {r.ultima_atividade_em
                            ? formatDistanceToNow(
                                new Date(r.ultima_atividade_em),
                                { addSuffix: true, locale: ptBR }
                              )
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
