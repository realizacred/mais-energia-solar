/**
 * Migração SolarMarket — Wizard unificado em 3 steps.
 *
 * Step 1 (esta página): Importar dados do SolarMarket para a área de revisão.
 * Step 2: Configurar mapeamentos.
 * Step 3: Promover para o CRM.
 *
 * Linguagem de negócio. Botões perigosos escondidos em "Ações avançadas".
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Cloud,
  Users,
  FolderKanban,
  FileText,
  GitBranch,
  Sliders,
  CheckCircle2,
  Play,
  Loader2,
  Ban,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Settings,
  Eraser,
  ArrowRight,
  Clock,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { SmStagingTable } from "@/components/admin/solarmarket/SmStagingTable";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, Eye as EyeIcon } from "lucide-react";
import { useMigracaoSolarmarket } from "@/hooks/useMigracaoSolarmarket";
import { useSolarmarketImport } from "@/hooks/useSolarmarketImport";
import { useSolarmarketConfig } from "@/hooks/useSolarmarketConfig";
import { useTenantId } from "@/hooks/useTenantId";
import { useRunningSolarmarketJob } from "@/hooks/useRunningSolarmarketJob";
import { useLastSolarmarketJob } from "@/hooks/useLastSolarmarketJob";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const STEP_LABELS_BUSINESS: Record<string, string> = {
  auth: "Conectando ao SolarMarket",
  funis: "Funis e etapas",
  clientes: "Clientes",
  projetos: "Projetos",
  projeto_funis: "Vínculos de projeto",
  propostas: "Propostas",
  custom_fields: "Campos customizados",
  done: "Concluído",
};

function StepDot({
  index,
  label,
  state,
}: {
  index: number;
  label: string;
  state: "active" | "done" | "locked";
}) {
  const styles = {
    active: "bg-primary text-primary-foreground border-primary shadow-md",
    done: "bg-success text-success-foreground border-success",
    locked: "bg-muted text-muted-foreground border-border",
  }[state];

  const labelStyle = {
    active: "text-foreground font-semibold",
    done: "text-success font-medium",
    locked: "text-muted-foreground",
  }[state];

  return (
    <div className="flex flex-col items-center gap-2 min-w-0">
      <div
        className={cn(
          "w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all",
          styles,
        )}
      >
        {state === "done" ? <CheckCircle2 className="w-5 h-5" /> : index}
      </div>
      <span className={cn("text-xs sm:text-sm text-center", labelStyle)}>
        {label}
      </span>
    </div>
  );
}

function Stepper({ current }: { current: 1 | 2 | 3 | 4 }) {
  const steps: Array<{ idx: number; label: string }> = [
    { idx: 1, label: "Importar" },
    { idx: 2, label: "Mapear" },
    { idx: 3, label: "Custom Fields" },
    { idx: 4, label: "Migrar" },
  ];

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-2">
          {steps.map((s, i) => {
            const state =
              s.idx < current ? "done" : s.idx === current ? "active" : "locked";
            return (
              <div key={s.idx} className="flex items-center flex-1 min-w-0">
                <div className="flex-1 flex justify-center">
                  <StepDot index={s.idx} label={s.label} state={state} />
                </div>
                {i < steps.length - 1 && (
                  <div
                    className={cn(
                      "h-0.5 flex-1 mx-2 transition-colors",
                      s.idx < current ? "bg-success" : "bg-border",
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function ProgressBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="relative h-3 w-full rounded-full bg-muted overflow-hidden ring-1 ring-border">
      <motion.div
        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary via-primary to-info"
        initial={{ width: 0 }}
        animate={{ width: `${v}%` }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      />
    </div>
  );
}

export default function MigracaoSolarmarket() {
  const { data: tenantId } = useTenantId();
  const {
    stats,
    isLoading,
    currentStep,
    stagingPronto,
    runningJob: runningJobFromMigracao,
    importAll,
    cancelImport,
    testConnection,
  } = useMigracaoSolarmarket();

  const { isConfigured, isLoading: loadingCfg } = useSolarmarketConfig();
  const { clearStaging } = useSolarmarketImport();
  const { data: runningJobFromHook } = useRunningSolarmarketJob(tenantId ?? null);
  const { data: lastJob } = useLastSolarmarketJob(tenantId ?? null);

  // Fonte única de verdade para "está importando agora": hook dedicado (running/pending).
  const runningJob = runningJobFromHook ?? runningJobFromMigracao ?? null;
  const isImporting = !!runningJob;

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const queryClient = useQueryClient();

  const handleResetAll = async () => {
    setResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke("sm-reset-all");
      if (error) throw error;
      if (data?.success === false) {
        const firstErr = data?.errors?.[0]?.error ?? "Falha parcial";
        throw new Error(firstErr);
      }
      toast({
        title: "Reset executado com sucesso",
        description: `${(data?.total_deleted ?? 0).toLocaleString("pt-BR")} registro(s) apagado(s).`,
      });
      setResetOpen(false);
      setResetConfirmText("");
      await queryClient.invalidateQueries();
      // Recarregar a página para garantir estado limpo.
      setTimeout(() => window.location.reload(), 600);
    } catch (e: any) {
      toast({
        title: "Falha ao resetar",
        description: e?.message ?? "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setResetting(false);
    }
  };

  if (isLoading || loadingCfg) {
    return <LoadingState message="Carregando migração..." />;
  }

  const handleImport = async () => {
    try {
      await importAll.mutateAsync({
        clientes: true,
        projetos: true,
        propostas: true,
        funis: true,
        custom_fields: true,
        projeto_funis: true,
      });
      toast({
        title: "Importação iniciada",
        description: "Os dados estão sendo baixados do SolarMarket.",
      });
    } catch (e: any) {
      toast({
        title: "Erro ao iniciar",
        description: e?.message || "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleCancel = async () => {
    if (!runningJob) return;
    if (!confirm("Tem certeza que deseja cancelar a importação em andamento?"))
      return;
    try {
      await cancelImport.mutateAsync(runningJob.id);
      toast({ title: "Importação cancelada" });
    } catch (e: any) {
      toast({
        title: "Erro ao cancelar",
        description: e?.message,
        variant: "destructive",
      });
    }
  };

  const handleTest = async () => {
    try {
      const res: any = await testConnection.mutateAsync();
      toast({
        title: "Conexão OK",
        description: res?.message || "Tudo certo com o SolarMarket.",
      });
    } catch (e: any) {
      toast({
        title: "Falha na conexão",
        description: e?.message || "Verifique a configuração.",
        variant: "destructive",
      });
    }
  };

  const handleClearStaging = async () => {
    try {
      await clearStaging.mutateAsync(undefined);
      toast({ title: "Dados de revisão apagados" });
    } catch (e: any) {
      toast({
        title: "Falha ao apagar",
        description: e?.message,
        variant: "destructive",
      });
    }
  };

  const progressPct = runningJob ? Math.round(Number(runningJob.progress_pct ?? 0)) : 0;
  const stepLabel =
    (runningJob?.current_step && STEP_LABELS_BUSINESS[runningJob.current_step]) ||
    "Iniciando…";

  const counts = {
    clientes: stats?.staging.clientes ?? 0,
    projetos: stats?.staging.projetos ?? 0,
    propostas: stats?.staging.propostas ?? 0,
    funis: stats?.staging.funis ?? 0,
    projeto_funis: stats?.staging.projeto_funis ?? 0,
    custom_fields: stats?.staging.custom_fields ?? 0,
  };

  const importInProgress = !!runningJobFromHook;
  const allEntitiesImported =
    counts.clientes > 0 &&
    counts.projetos > 0 &&
    counts.propostas > 0 &&
    counts.funis > 0 &&
    counts.projeto_funis > 0 &&
    counts.custom_fields > 0;
  const importDone = !importInProgress && allEntitiesImported;

  const items = [
    { icon: Users, label: "Clientes e contatos", value: stats?.staging.clientes ?? 0 },
    { icon: FolderKanban, label: "Projetos (com vínculos de funis)", value: stats?.staging.projetos ?? 0 },
    { icon: FileText, label: "Propostas", value: stats?.staging.propostas ?? 0 },
    { icon: GitBranch, label: "Funis e etapas do SolarMarket", value: stats?.staging.funis ?? 0 },
    { icon: Sliders, label: "Campos customizados", value: stats?.staging.custom_fields ?? 0 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 via-background to-background">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1200px]">
        {/* HEADER */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-4"
        >
          <div className="relative shrink-0">
            <div
              className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/40 to-info/30 blur-lg opacity-70"
              aria-hidden
            />
            <div className="relative h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-gradient-to-br from-primary to-info flex items-center justify-center shadow-md ring-1 ring-border">
              <Cloud className="w-6 h-6 sm:w-7 sm:h-7 text-primary-foreground" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Migração SolarMarket
              </h1>
              <Badge
                variant="outline"
                className="bg-primary/10 text-primary border-primary/20 gap-1.5"
              >
                <Sparkles className="w-3 h-3" /> Assistente
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Importe, configure e migre seus dados do SolarMarket para o CRM.
            </p>
          </div>
        </motion.div>

        {/* STEPPER */}
        <Stepper current={currentStep} />

        {/* AVISO SE NÃO CONFIGURADO */}
        {!isConfigured && (
          <Card className="border-l-[3px] border-l-warning bg-warning/5 shadow-sm">
            <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">
                  Conexão com o SolarMarket não configurada
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Cadastre URL e token antes de importar.
                </p>
              </div>
              <Button asChild size="sm">
                <Link to="/admin/configuracoes/integracoes/solarmarket">
                  <Settings className="w-4 h-4" /> Configurar
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* STEP 1 — IMPORTAR */}
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Baixar dados do SolarMarket
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Vamos baixar uma cópia dos seus dados do SolarMarket. Eles ficam em
                uma área de revisão antes de entrar no seu CRM — nada é alterado
                automaticamente.
              </p>
            </div>

            {/* Lista do que será baixado */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {items.map((it) => (
                <div
                  key={it.label}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <it.icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{it.label}</p>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              <span>Tempo estimado: ~1 hora para 1.900 projetos.</span>
            </div>

            {/* Estado: importando / pronto */}
            {isImporting && runningJob ? (
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                    <span className="text-sm font-medium text-foreground truncate">
                      Etapa atual: {stepLabel}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-foreground tabular-nums">
                    {progressPct}%
                  </span>
                </div>
                <ProgressBar value={progressPct} />
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancel}
                    className="border-destructive/40 text-destructive hover:bg-destructive/10"
                  >
                    <Ban className="w-4 h-4" /> Cancelar importação
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-center pt-2">
                <Button
                  size="lg"
                  onClick={handleImport}
                  disabled={!isConfigured || importAll.isPending}
                  className="px-8 gap-2"
                >
                  {importAll.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Play className="w-5 h-5" />
                  )}
                  {stagingPronto ? "Importar novamente" : "Iniciar importação"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* RESUMO DA ÁREA DE REVISÃO */}
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-6 space-y-4">
            <h3 className="text-base font-semibold text-foreground">
              Dados na área de revisão
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: "Clientes", value: stats?.staging.clientes ?? 0, icon: Users },
                { label: "Projetos", value: stats?.staging.projetos ?? 0, icon: FolderKanban },
                { label: "Propostas", value: stats?.staging.propostas ?? 0, icon: FileText },
                { label: "Funis", value: stats?.staging.funis ?? 0, icon: GitBranch },
                { label: "Vínculos projeto-funil", value: stats?.staging.projeto_funis ?? 0, icon: GitBranch },
                { label: "Campos custom", value: stats?.staging.custom_fields ?? 0, icon: Sliders },
              ].map((k) => (
                <div
                  key={k.label}
                  className="p-3 rounded-lg bg-muted/30 border border-border"
                >
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <k.icon className="w-3.5 h-3.5" />
                    <span className="text-xs">{k.label}</span>
                  </div>
                  <p className="text-xl font-bold text-foreground tabular-nums mt-1">
                    {k.value.toLocaleString("pt-BR")}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* INSPECIONAR DADOS IMPORTADOS */}
        {tenantId && (stats?.totalStaging ?? 0) > 0 && (
          <Card className="bg-card border-border shadow-sm">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <EyeIcon className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-foreground">
                    Inspecionar dados importados
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Veja os dados brutos antes de configurar os mapeamentos.
                  </p>
                </div>
              </div>

              <Tabs defaultValue="clientes" className="w-full">
                <TabsList className="overflow-x-auto flex-wrap h-auto">
                  <TabsTrigger value="clientes">
                    Clientes ({counts.clientes.toLocaleString("pt-BR")})
                  </TabsTrigger>
                  <TabsTrigger value="projetos">
                    Projetos ({counts.projetos.toLocaleString("pt-BR")})
                  </TabsTrigger>
                  <TabsTrigger value="propostas">
                    Propostas ({counts.propostas.toLocaleString("pt-BR")})
                  </TabsTrigger>
                  <TabsTrigger value="funis">
                    Funis ({counts.funis.toLocaleString("pt-BR")})
                  </TabsTrigger>
                  <TabsTrigger value="projeto-funis">
                    Vínculos ({counts.projeto_funis.toLocaleString("pt-BR")})
                  </TabsTrigger>
                  <TabsTrigger value="custom">
                    Campos ({counts.custom_fields.toLocaleString("pt-BR")})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="clientes" className="mt-4">
                  <SmStagingTable tabela="sm_clientes_raw" tenantId={tenantId} />
                </TabsContent>
                <TabsContent value="projetos" className="mt-4">
                  <SmStagingTable tabela="sm_projetos_raw" tenantId={tenantId} />
                </TabsContent>
                <TabsContent value="propostas" className="mt-4">
                  <SmStagingTable tabela="sm_propostas_raw" tenantId={tenantId} />
                </TabsContent>
                <TabsContent value="funis" className="mt-4">
                  <SmStagingTable tabela="sm_funis_raw" tenantId={tenantId} />
                </TabsContent>
                <TabsContent value="projeto-funis" className="mt-4">
                  <SmStagingTable
                    tabela="sm_projeto_funis_raw"
                    tenantId={tenantId}
                  />
                </TabsContent>
                <TabsContent value="custom" className="mt-4">
                  <SmStagingTable
                    tabela="sm_custom_fields_raw"
                    tenantId={tenantId}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* RODAPÉ — PRÓXIMO PASSO */}
        {importDone ? (
          <Card className="bg-success/10 border-success/20 shadow-sm">
            <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-start gap-3 flex-1">
                <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Importação concluída
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Próximo passo: configurar mapeamentos entre os funis do SolarMarket
                    e os pipelines do seu CRM.
                  </p>
                </div>
              </div>
              <Button asChild>
                <Link to="/admin/migracao-solarmarket/mapear">
                  Ir para Step 2 <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : importInProgress ? (
          <Card className="bg-info/10 border-info/20 shadow-sm">
            <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-start gap-3 flex-1">
                <Loader2 className="w-5 h-5 text-info shrink-0 mt-0.5 animate-spin" />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Importação em andamento
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Aguarde a conclusão de todas as etapas antes de seguir para o próximo passo.
                  </p>
                </div>
              </div>
              <Button disabled>
                Ir para Step 2 <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-muted/30 border-border">
            <CardContent className="p-5 space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                ⏳ Complete a importação acima antes de ir para a Fase 2
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {([
                  { key: "clientes", label: "Clientes", current: counts.clientes, expected: 1930 as number | null },
                  { key: "projetos", label: "Projetos", current: counts.projetos, expected: 1900 },
                  { key: "propostas", label: "Propostas", current: counts.propostas, expected: 1821 },
                  { key: "funis", label: "Funis", current: counts.funis, expected: 6 },
                  { key: "projeto_funis", label: "Vínculos projeto-funil", current: counts.projeto_funis, expected: null },
                  { key: "custom_fields", label: "Campos customizados", current: counts.custom_fields, expected: 17 },
                ]).map((item) => {
                  // Step concluído de verdade só quando _runtime.steps[key].done === true.
                  // Se não há job algum, usamos count > 0 como heurística.
                  const stepDone = lastJob?.scope?._runtime?.steps?.[item.key]?.done === true;
                  const ok = lastJob ? stepDone : item.current > 0;
                  return (
                    <div
                      key={item.label}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-card border border-border"
                    >
                      <span className="text-sm text-foreground">{item.label}</span>
                      <span className="flex items-center gap-2 text-sm font-mono">
                        <span className={ok ? "text-success" : "text-muted-foreground"}>
                          {item.current.toLocaleString("pt-BR")}
                          {item.expected !== null && (
                            <span className="text-muted-foreground">
                              /{item.expected.toLocaleString("pt-BR")}
                            </span>
                          )}
                        </span>
                        {ok ? (
                          <CheckCircle2 className="w-4 h-4 text-success" />
                        ) : (
                          <Clock className="w-4 h-4 text-muted-foreground" />
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* AÇÕES AVANÇADAS (collapsed) */}
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-0">
            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  Ações avançadas
                </span>
              </div>
              {advancedOpen ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
            </button>

            {advancedOpen && (
              <div className="border-t border-border p-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTest}
                    disabled={!isConfigured || testConnection.isPending}
                  >
                    {testConnection.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="w-4 h-4" />
                    )}
                    Testar conexão
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/admin/configuracoes/integracoes/solarmarket">
                      <Settings className="w-4 h-4" /> Ver configuração
                    </Link>
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={
                          clearStaging.isPending ||
                          isImporting ||
                          (stats?.totalStaging ?? 0) === 0
                        }
                        className="border-destructive/40 text-destructive hover:bg-destructive/10"
                      >
                        {clearStaging.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Eraser className="w-4 h-4" />
                        )}
                        Apagar dados de revisão
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="w-[90vw] max-w-md">
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Apagar dados da área de revisão?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Isto apaga apenas a cópia local dos dados do SolarMarket.
                          <br />
                          <strong>Não afeta</strong> Clientes, Projetos ou Propostas
                          que já estão no seu CRM.
                          <br />
                          <br />
                          Para reimportar, será necessário rodar a importação novamente.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleClearStaging}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Sim, apagar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  {/* RESETAR TUDO — destrutivo, dupla confirmação */}
                  <AlertDialog open={resetOpen} onOpenChange={(o) => {
                    setResetOpen(o);
                    if (!o) setResetConfirmText("");
                  }}>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isImporting || resetting}
                        className="border-destructive text-destructive hover:bg-destructive/10"
                      >
                        {resetting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                        Resetar tudo
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="w-[90vw] max-w-lg">
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          ⚠️ Resetar importação do SolarMarket?
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                          <div className="space-y-3 text-sm">
                            <p>Esta ação vai <strong>apagar permanentemente</strong>:</p>
                            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                              <li>Todos os dados baixados do SolarMarket (clientes, projetos, propostas)</li>
                              <li>Histórico de importações</li>
                              <li>Histórico de migrações</li>
                              <li>Mapeamentos configurados</li>
                              <li>Clientes/projetos/propostas que vieram do SolarMarket</li>
                            </ul>
                            <p><strong>Não vai apagar</strong>:</p>
                            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                              <li>Consultores do CRM</li>
                              <li>Pipelines e etapas do CRM</li>
                              <li>Dados nativos do sistema</li>
                            </ul>
                            <p className="pt-2">
                              Para confirmar, digite <strong>RESETAR</strong> abaixo:
                            </p>
                          </div>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <Input
                        autoFocus
                        placeholder="Digite RESETAR para confirmar"
                        value={resetConfirmText}
                        onChange={(e) => setResetConfirmText(e.target.value)}
                      />
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={resetting}>
                          Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction
                          disabled={resetConfirmText !== "RESETAR" || resetting}
                          onClick={(e) => {
                            e.preventDefault();
                            handleResetAll();
                          }}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {resetting ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : null}
                          Sim, resetar tudo
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                <p className="text-xs text-muted-foreground">
                  Estas ações afetam apenas a área de revisão e a conexão com o
                  SolarMarket. Use com cuidado.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
