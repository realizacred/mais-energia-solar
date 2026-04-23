/**
 * MigracaoEtapasCard — UI da migração em 3 etapas sequenciais (SolarMarket → CRM).
 *
 * Etapa 1: Clientes
 * Etapa 2: Projetos + Deals (depende da Etapa 1 estar 100%)
 * Etapa 3: Propostas (depende da Etapa 2 estar 100%)
 *
 * Cada etapa: dry-run + migração real, lotes pequenos (200), status visual e progresso.
 *
 * Governança aplicada:
 *   - RB-04/BP-04: lógica em hooks (useMigrar*), componente só renderiza
 *   - RB-05: queries com staleTime herdadas dos hooks
 *   - RB-21: shadow-sm em cards
 *   - DS-02: cards KPI com border-l semântico
 *   - DS-05: badges semânticas (success/warning/destructive)
 *   - RB-01/RB-02: cores semânticas, dark mode nativo
 */
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
  Users, FolderKanban, FileText, FlaskConical, Rocket, Loader2,
  CheckCircle2, Lock, Circle, AlertTriangle, ArrowRight,
} from "lucide-react";
import { useSolarmarketStagingTotals, useSolarmarketPromote } from "@/hooks/useSolarmarketPromote";
import { useMigrarClientes } from "@/hooks/useMigrarClientes";
import { useMigrarProjetos } from "@/hooks/useMigrarProjetos";
import { useMigrarPropostas } from "@/hooks/useMigrarPropostas";
import { useDefaultPipeline } from "@/hooks/useDefaultPipeline";

type Scope = "cliente" | "projeto" | "proposta";

interface EtapaConfig {
  scope: Scope;
  numero: 1 | 2 | 3;
  titulo: string;
  descricao: string;
  icon: typeof Users;
}

const ETAPAS: EtapaConfig[] = [
  { scope: "cliente",  numero: 1, titulo: "Clientes",          descricao: "Cria registros canônicos em clientes.", icon: Users },
  { scope: "projeto",  numero: 2, titulo: "Projetos + Deals",  descricao: "Cria projetos no CRM e deals comerciais.", icon: FolderKanban },
  { scope: "proposta", numero: 3, titulo: "Propostas",          descricao: "Cria propostas nativas e versões.", icon: FileText },
];

function pct(promoted: number, total: number): number {
  if (!total) return 0;
  return Math.min(100, Math.round((promoted / total) * 100));
}

interface EtapaCardProps {
  etapa: EtapaConfig;
  total: number;
  promoted: number;
  /** Etapa anterior está 100% concluída? (Etapa 1 sempre liberada.) */
  unlocked: boolean;
  isPending: boolean;
  isActive: boolean;
  onDryRun: () => void;
  onMigrar: () => void;
  batchLimit: number;
}

function statusBadge(unlocked: boolean, completed: boolean, isActive: boolean) {
  if (isActive) {
    return (
      <Badge variant="outline" className="bg-info/10 text-info border-info/20 gap-1.5">
        <Loader2 className="w-3 h-3 animate-spin" />
        Em execução
      </Badge>
    );
  }
  if (completed) {
    return (
      <Badge variant="outline" className="bg-success/10 text-success border-success/20 gap-1.5">
        <CheckCircle2 className="w-3 h-3" />
        Concluída
      </Badge>
    );
  }
  if (!unlocked) {
    return (
      <Badge variant="outline" className="bg-muted text-muted-foreground border-border gap-1.5">
        <Lock className="w-3 h-3" />
        Aguardando etapa anterior
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 gap-1.5">
      <Circle className="w-3 h-3" />
      Pronta para iniciar
    </Badge>
  );
}

function EtapaCard({
  etapa, total, promoted, unlocked, isPending, isActive, onDryRun, onMigrar,
}: EtapaCardProps) {
  const Icon = etapa.icon;
  const completed = total > 0 && promoted >= total;
  const progresso = pct(promoted, total);
  const restantes = Math.max(0, total - promoted);

  // border-l por estado
  const border = completed
    ? "border-l-success"
    : isActive
    ? "border-l-info"
    : unlocked
    ? "border-l-primary"
    : "border-l-border";

  const bg = completed ? "bg-success/10" : isActive ? "bg-info/10" : unlocked ? "bg-primary/10" : "bg-muted";
  const fg = completed ? "text-success" : isActive ? "text-info" : unlocked ? "text-primary" : "text-muted-foreground";

  return (
    <Card className={`border-l-[3px] ${border} bg-card shadow-sm`}>
      <CardContent className="p-5 space-y-4">
        {/* Cabeçalho da etapa */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bg} shrink-0`}>
              <Icon className={`w-5 h-5 ${fg}`} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono text-muted-foreground">Etapa {etapa.numero}</span>
                <h3 className="text-base font-semibold text-foreground">{etapa.titulo}</h3>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{etapa.descricao}</p>
            </div>
          </div>
          {statusBadge(unlocked, completed, isActive)}
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Total no staging</p>
            <p className="text-xl font-bold text-foreground tracking-tight">{total.toLocaleString("pt-BR")}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Já migrados</p>
            <p className="text-xl font-bold text-success tracking-tight">{promoted.toLocaleString("pt-BR")}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Restantes</p>
            <p className="text-xl font-bold text-foreground tracking-tight">{restantes.toLocaleString("pt-BR")}</p>
          </div>
        </div>

        {/* Progresso */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Progresso da etapa</span>
            <span className="font-mono">{progresso}%</span>
          </div>
          <Progress value={progresso} className="h-2" />
        </div>

        {/* Ações */}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={onDryRun}
            disabled={!unlocked || isPending || total === 0}
            title="Simula sem gravar nada — apenas relatório de impacto"
          >
            {isActive && isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
            Simular
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={onMigrar}
            disabled={!unlocked || isPending || restantes === 0}
            title={restantes === 0 ? "Nada a migrar" : "Promove um lote para o CRM"}
          >
            {isActive && isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
            Migrar lote
          </Button>
          {!unlocked && (
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <ArrowRight className="w-3 h-3" />
              Conclua a etapa anterior para liberar
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function MigracaoEtapasCard() {
  const { data: totais, isLoading } = useSolarmarketStagingTotals();
  const { data: pipeline, isLoading: isLoadingPipeline } = useDefaultPipeline();
  const { jobs } = useSolarmarketPromote();

  const [batchLimit, setBatchLimit] = useState(200);
  const [activeScope, setActiveScope] = useState<Scope | null>(null);

  const clientes = useMigrarClientes();
  const projetos = useMigrarProjetos();
  const propostas = useMigrarPropostas();

  const pipelineBlocked = !isLoadingPipeline && (!pipeline || pipeline.stagesCount === 0);
  const runningJob = jobs.find((j) => j.status === "running" || j.status === "pending");
  const isAnyPending = clientes.isPending || projetos.isPending || propostas.isPending || !!runningJob;

  // Liberação sequencial: etapa N só libera quando N-1 está 100% migrado.
  const t = totais ?? {
    cliente: { total: 0, promoted: 0 },
    projeto: { total: 0, promoted: 0 },
    proposta: { total: 0, promoted: 0 },
  };

  const e1Done = t.cliente.total > 0 && t.cliente.promoted >= t.cliente.total;
  const e2Done = t.projeto.total > 0 && t.projeto.promoted >= t.projeto.total;
  const e3Done = t.proposta.total > 0 && t.proposta.promoted >= t.proposta.total;

  const totalGeral = t.cliente.total + t.projeto.total + t.proposta.total;
  const promovidoGeral = t.cliente.promoted + t.projeto.promoted + t.proposta.promoted;
  const progressoGeral = pct(promovidoGeral, totalGeral);

  async function handleRun(scope: Scope, dry_run: boolean) {
    const limit = Math.min(Math.max(1, Number(batchLimit) || 1), 200);
    setActiveScope(scope);
    try {
      const fn = scope === "cliente" ? clientes.run : scope === "projeto" ? projetos.run : propostas.run;
      const res = await fn({ batch_limit: limit, dry_run });
      const label = scope === "cliente" ? "Clientes" : scope === "projeto" ? "Projetos" : "Propostas";
      toast({
        title: dry_run ? `Simulação concluída — ${label}` : `Lote promovido — ${label}`,
        description: dry_run
          ? `Job ${res.job_id.slice(0, 8)} — ${res.candidates ?? 0} candidato(s) identificado(s).`
          : `Job ${res.job_id.slice(0, 8)} concluído (${res.status}).`,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      toast({ title: "Falha ao executar", description: message, variant: "destructive" });
    } finally {
      setActiveScope(null);
    }
  }

  const etapasState = useMemo(
    () => [
      { ...ETAPAS[0], total: t.cliente.total,  promoted: t.cliente.promoted,  unlocked: !pipelineBlocked },
      { ...ETAPAS[1], total: t.projeto.total,  promoted: t.projeto.promoted,  unlocked: !pipelineBlocked && e1Done },
      { ...ETAPAS[2], total: t.proposta.total, promoted: t.proposta.promoted, unlocked: !pipelineBlocked && e1Done && e2Done },
    ],
    [t, e1Done, e2Done, pipelineBlocked],
  );

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Rocket className="w-4 h-4 text-primary" />
              Migração em etapas
            </CardTitle>
            <CardDescription>
              Promove staging para o CRM em 3 etapas sequenciais e granulares.
              Lotes pequenos para evitar timeouts e estouros de memória.
            </CardDescription>
          </div>
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="etapas-batch" className="text-xs text-muted-foreground">
                Tamanho do lote
              </Label>
              <Input
                id="etapas-batch"
                type="number"
                min={1}
                max={200}
                value={batchLimit}
                onChange={(e) => setBatchLimit(Number(e.target.value) || 1)}
                className="w-24 h-9"
                disabled={isAnyPending}
              />
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {pipelineBlocked && (
          <div className="flex items-start gap-3 p-4 rounded-lg border border-warning/40 bg-warning/5">
            <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-foreground">Funil padrão não configurado</p>
              <p className="text-xs text-muted-foreground mt-1">
                Configure um funil padrão de projetos antes de iniciar a migração.
              </p>
            </div>
          </div>
        )}

        {/* Progresso geral */}
        <div className="rounded-lg border border-border p-4 bg-muted/30">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-medium text-foreground">Progresso geral</span>
            <span className="font-mono text-muted-foreground">
              {promovidoGeral.toLocaleString("pt-BR")} / {totalGeral.toLocaleString("pt-BR")} ({progressoGeral}%)
            </span>
          </div>
          <Progress value={progressoGeral} className="h-2" />
        </div>

        {/* 3 etapas */}
        <div className="grid grid-cols-1 gap-4">
          {etapasState.map((e) => (
            <EtapaCard
              key={e.scope}
              etapa={e}
              total={e.total}
              promoted={e.promoted}
              unlocked={e.unlocked}
              isPending={isAnyPending}
              isActive={activeScope === e.scope}
              onDryRun={() => handleRun(e.scope, true)}
              onMigrar={() => handleRun(e.scope, false)}
              batchLimit={batchLimit}
            />
          ))}
        </div>

        {isLoading && (
          <p className="text-xs text-muted-foreground">Carregando totais…</p>
        )}
      </CardContent>
    </Card>
  );
}
