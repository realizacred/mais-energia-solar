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
import { useEffect, useMemo, useRef, useState } from "react";
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
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { StatCard } from "@/components/ui-kit/StatCard";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FollowupSendDialog } from "@/components/admin/followup-comercial/FollowupSendDialog";
import { FollowupComercialAnalytics } from "@/components/admin/followup-comercial/FollowupComercialAnalytics";
import { FollowupRecoveryRow } from "@/components/admin/followup-comercial/FollowupRecoveryRow";
import { OpportunityBanner } from "@/components/admin/followup-comercial/OpportunityBanner";
import {
  useFollowupComercialKpis,
  useFollowupComercialInbox,
  useFollowupComercialInboxSummary,
  type FollowupClasse,
  type FollowupInboxRow,
  type FollowupInboxSort,
} from "@/hooks/useFollowupComercial";

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function KpiSkeletons() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-[88px] rounded-lg" />
      ))}
    </div>
  );
}

function RowSkeletons() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-lg" />
      ))}
    </div>
  );
}


export default function FollowupComercialPage() {
  const [classe, setClasse] = useState<FollowupClasse | "todos">("todos");
  const [diasMin, setDiasMin] = useState<string>("0");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<FollowupInboxSort>("dias_parado");
  const [sendTarget, setSendTarget] = useState<FollowupInboxRow | null>(null);
  const [dialogTab, setDialogTab] = useState<"mensagem" | "historico">("mensagem");

  const filters = useMemo(
    () => ({ classe, diasMin: Number(diasMin) || 0, search, sort }),
    [classe, diasMin, search, sort]
  );

  const kpis = useFollowupComercialKpis();
  const inbox = useFollowupComercialInbox(filters);
  const summary = useFollowupComercialInboxSummary(filters);

  const rows = useMemo<FollowupInboxRow[]>(
    () => inbox.data?.pages.flat() ?? [],
    [inbox.data]
  );

  const totalReal = summary.data?.total_count ?? rows.length;
  const valorPotencialReal = summary.data?.valor_potencial_total ?? 0;

  // Lazy-load: observa o sentinel do rodapé
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !inbox.hasNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !inbox.isFetchingNextPage) {
          inbox.fetchNextPage();
        }
      },
      { rootMargin: "300px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inbox.hasNextPage, inbox.isFetchingNextPage, inbox.fetchNextPage]);

  const refreshAll = () => {
    kpis.refetch();
    inbox.refetch();
    summary.refetch();
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

      <Tabs defaultValue="inbox" className="w-full">
        <TabsList>
          <TabsTrigger value="inbox" className="gap-1.5">
            <Inbox className="h-3.5 w-3.5" /> Inbox
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="space-y-6 mt-4">
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
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
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
          <Select value={sort} onValueChange={(v) => setSort(v as FollowupInboxSort)}>
            <SelectTrigger><SelectValue placeholder="Ordenar por" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="dias_parado">Mais parados</SelectItem>
              <SelectItem value="score_ia">Maior score IA</SelectItem>
              <SelectItem value="valor_total">Maior valor</SelectItem>
              <SelectItem value="ultima_atividade">Atividade recente</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Banner de oportunidade */}
      {!inbox.isLoading && !inbox.isError && rows.length > 0 && (
        <OpportunityBanner rows={rows} />
      )}

      {/* Inbox */}
      {inbox.isLoading ? (
        <Card className="border-border"><CardContent className="p-4"><RowSkeletons /></CardContent></Card>
      ) : inbox.isError ? (
        <Card className="border-l-[3px] border-l-destructive">
          <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Erro ao carregar inbox de recuperação.
            </div>
            <Button size="sm" variant="outline" onClick={() => inbox.refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" /> Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card className="border-border"><CardContent className="p-0">
          <EmptyState
            icon={Inbox}
            title="Nenhuma proposta encontrada"
            description="Ajuste os filtros ou aguarde novas propostas elegíveis para reaquecimento."
          />
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs text-muted-foreground px-1">
            <span>
              {rows.length} proposta(s) — valor potencial{" "}
              <strong className="text-foreground">{formatBRL(totalValor)}</strong>
            </span>
            <span className="hidden sm:inline">
              Limite 300 — refine filtros para listas maiores
            </span>
          </div>
          <ul className="rounded-lg overflow-hidden">
            {rows.map((r) => (
              <FollowupRecoveryRow
                key={`${r.proposta_id}-${r.versao_id ?? "v"}`}
                row={r}
                onSend={(row) => { setDialogTab("mensagem"); setSendTarget(row); }}
                onHistory={(row) => { setDialogTab("historico"); setSendTarget(row); }}
              />
            ))}
          </ul>
        </div>
      )}
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <FollowupComercialAnalytics />
        </TabsContent>
      </Tabs>

      <FollowupSendDialog
        row={sendTarget}
        open={!!sendTarget}
        defaultTab={dialogTab}
        onOpenChange={(o) => !o && setSendTarget(null)}
      />
    </div>
  );
}

