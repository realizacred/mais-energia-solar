/**
 * Migração SolarMarket — Step 2 (Mapear).
 *
 * Subfase 2.1 — escolha do PAPEL de cada funil do SolarMarket.
 *  - Lista os funis vindos do staging (sm_funis_raw).
 *  - Para cada funil, o usuário escolhe um papel:
 *      • pipeline         → vira um pipeline nativo (precisa escolher qual)
 *      • vendedor_source  → cada etapa indica o consultor responsável (2.2)
 *      • tag              → vira etiqueta (futuro)
 *      • ignore           → não é migrado
 *  - O papel é gravado em sm_funil_pipeline_map.role.
 *  - Para 'pipeline', um dropdown abre para escolher qual pipeline nativo.
 *
 * Subfase 2.2 (próxima): mapeamento detalhado etapa→consultor / etapa→stage.
 * Subfase 2.3 (depois):  validação global, pré-sugestões e botão Step 3.
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MigrationLayout } from "@/components/admin/solarmarket/MigrationLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Folder,
  Workflow,
  Users,
  Tag,
  Ban,
  CheckCircle2,
  AlertCircle,
  Plus,
  Zap,
} from "lucide-react";
import { useTenantId } from "@/hooks/useTenantId";
import {
  useSmFunisStaging,
  useSaveFunilPapel,
  type FunilPapel,
} from "@/hooks/useSmFunisStaging";
import {
  usePipelinesCrm,
  useCreatePipelineCrm,
} from "@/hooks/usePipelinesCrm";
import { useCriarPipelineAuto } from "@/hooks/useCriarPipelineAuto";
import { useEnsureComercialMirror } from "@/hooks/useEnsureComercialMirror";
import { useSmEtapasFunil } from "@/hooks/useSmEtapasFunil";
import { useSmConsultorMappings } from "@/hooks/useSmConsultorMapping";
import { useMigrationConfig } from "@/hooks/useMigrationConfig";
import { EtapasToConsultores } from "@/components/admin/solarmarket/mapeamento/EtapasToConsultores";
import { ConfiguracoesPadraoCard } from "@/components/admin/solarmarket/mapeamento/ConfiguracoesPadraoCard";

import { MappingValidation } from "@/components/admin/solarmarket/mapeamento/MappingValidation";
import { toast } from "sonner";

const PAPEIS: { value: FunilPapel; label: string; descricao: string; icon: typeof Workflow }[] = [
  {
    value: "pipeline",
    label: "Vira pipeline no CRM",
    descricao: "As etapas serão convertidas em estágios de um pipeline nativo.",
    icon: Workflow,
  },
  {
    value: "vendedor_source",
    label: "Fonte de consultor",
    descricao: "Cada etapa indica o consultor responsável pelo projeto.",
    icon: Users,
  },
  {
    value: "tag",
    label: "Vira etiqueta/tag",
    descricao: "As etapas viram etiquetas aplicadas aos projetos.",
    icon: Tag,
  },
  {
    value: "ignore",
    label: "Ignorar",
    descricao: "Este funil não será migrado.",
    icon: Ban,
  },
];

export default function MigracaoStep2Mapear() {
  const { data: tenantId } = useTenantId();
  // Garante o funil de execução "Comercial" espelhando o pipeline existente
  // (RB-61: arquitetura dual). Roda 1x ao montar.
  useEnsureComercialMirror(tenantId);
  const { data: funis, isLoading } = useSmFunisStaging(tenantId ?? undefined);
  const { data: pipelines } = usePipelinesCrm(tenantId);
  const { data: config } = useMigrationConfig(tenantId);
  const { data: consultorMappings } = useSmConsultorMappings(tenantId);
  const funilVendedoresNome =
    funis?.find((f) => f.papel === "vendedor_source")?.nome ?? null;
  const { data: etapasVendedores } = useSmEtapasFunil(
    tenantId,
    funilVendedoresNome,
  );
  const saveMutation = useSaveFunilPapel();
  const createPipelineMutation = useCreatePipelineCrm();
  const criarAutoMutation = useCriarPipelineAuto();

  // Funis em que o usuário selecionou "pipeline" mas ainda não escolheu qual.
  const [pendentes, setPendentes] = useState<Record<string, boolean>>({});
  // Dialog de criação de pipeline novo. Guarda o funil que disparou para
  // já vincular automaticamente após a criação.
  const [criarOpen, setCriarOpen] = useState(false);
  const [nomeNovoPipeline, setNomeNovoPipeline] = useState("");
  const [funilParaVincular, setFunilParaVincular] = useState<string | null>(null);

  const getPipelineName = (id: string | null) =>
    pipelines?.find((p) => p.id === id)?.name ?? null;

  const handleChangePapel = async (smFunilName: string, papel: FunilPapel) => {
    if (!tenantId) return;

    // 'pipeline' precisa de mais info (qual pipeline) — não salva ainda.
    if (papel === "pipeline") {
      setPendentes((prev) => ({ ...prev, [smFunilName]: true }));
      return;
    }

    try {
      await saveMutation.mutateAsync({
        tenantId,
        smFunilName,
        papel,
        pipelineId: null,
      });
      setPendentes((prev) => {
        const next = { ...prev };
        delete next[smFunilName];
        return next;
      });
      toast.success("Papel salvo");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar papel";
      toast.error(msg);
    }
  };

  const handleEscolherPipeline = async (
    smFunilName: string,
    pipelineId: string,
  ) => {
    if (!tenantId || !pipelineId) return;
    try {
      await saveMutation.mutateAsync({
        tenantId,
        smFunilName,
        papel: "pipeline",
        pipelineId,
      });
      setPendentes((prev) => {
        const next = { ...prev };
        delete next[smFunilName];
        return next;
      });
      toast.success("Pipeline vinculado");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao vincular pipeline";
      toast.error(msg);
    }
  };

  const abrirCriarPipeline = (smFunilName: string) => {
    setFunilParaVincular(smFunilName);
    setNomeNovoPipeline("");
    setCriarOpen(true);
  };

  const handleCriarPipeline = async () => {
    if (!tenantId || !nomeNovoPipeline.trim()) return;
    try {
      const novo = await createPipelineMutation.mutateAsync({
        tenantId,
        name: nomeNovoPipeline,
      });
      toast.success("Pipeline criado");
      setCriarOpen(false);
      if (funilParaVincular) {
        await handleEscolherPipeline(funilParaVincular, novo.id);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao criar pipeline";
      toast.error(msg);
    }
  };

  const totalFunis = funis?.length ?? 0;
  const totalDefinidos = funis?.filter((f) => f.papel !== null).length ?? 0;

  const headerActions =
    !isLoading && funis ? (
      <Badge
        variant="outline"
        className={
          totalDefinidos === totalFunis
            ? "h-6 bg-success/10 text-success border-success/20"
            : "h-6 bg-warning/10 text-warning border-warning/20"
        }
      >
        {totalDefinidos} de {totalFunis} definidos
      </Badge>
    ) : null;

  return (
    <MigrationLayout
      stepLabel="Step 2 / 4"
      title="Configurar mapeamentos"
      subtitle="Defina como cada funil do SolarMarket deve ser tratado no CRM. O detalhamento de etapas vem na próxima etapa."
      backTo="/admin/migracao-solarmarket"
      backLabel="Voltar para a importação"
      actions={headerActions}
    >
      {/* Lista de funis em grid 2 colunas em telas largas */}
      <div className="space-y-3">
        {isLoading && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 w-full rounded-lg" />
            ))}
          </div>
        )}

        {!isLoading && funis && funis.length === 0 && (
          <Card className="bg-card border-border shadow-sm">
            <CardContent className="p-5 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-warning" />
              <p className="text-sm text-muted-foreground">
                Nenhum funil encontrado no staging. Volte ao Step 1 e execute a importação.
              </p>
            </CardContent>
          </Card>
        )}

        {!isLoading &&
          funis?.map((f) => {
            const mostrarPipelineSelector =
              f.papel === "pipeline" || pendentes[f.nome];
            const pipelineNome = getPipelineName(f.pipelineId);

            return (
              <Card
                key={f.smFunilId}
                className="bg-card border-border shadow-sm hover:shadow-md transition-shadow"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 shrink-0">
                        <Folder className="w-5 h-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-base font-semibold text-foreground truncate">
                          {f.nome}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">
                          {f.qtdEtapas} {f.qtdEtapas === 1 ? "etapa" : "etapas"} •{" "}
                          {f.qtdProjetosVinculados.toLocaleString("pt-BR")}{" "}
                          {f.qtdProjetosVinculados === 1 ? "projeto vinculado" : "projetos vinculados"}
                        </p>
                      </div>
                    </div>
                    {f.papel && (
                      <Badge
                        variant="outline"
                        className="bg-success/10 text-success border-success/20 shrink-0"
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        {PAPEIS.find((p) => p.value === f.papel)?.label ?? f.papel}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <Label className="text-sm font-medium text-foreground mb-3 block">
                    Papel deste funil:
                  </Label>
                  <RadioGroup
                    value={pendentes[f.nome] ? "pipeline" : f.papel ?? ""}
                    onValueChange={(v) => handleChangePapel(f.nome, v as FunilPapel)}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                  >
                    {PAPEIS.map((p) => {
                      const Icon = p.icon;
                      const id = `${f.smFunilId}-${p.value}`;
                      return (
                        <Label
                          key={p.value}
                          htmlFor={id}
                          className="flex items-start gap-3 rounded-lg border border-border bg-background p-3 cursor-pointer hover:border-primary/40 hover:bg-muted/40 transition-colors data-[state=checked]:border-primary"
                        >
                          <RadioGroupItem value={p.value} id={id} className="mt-0.5" />
                          <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">
                              {p.label}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {p.descricao}
                            </p>
                          </div>
                        </Label>
                      );
                    })}
                  </RadioGroup>

                  {/* Seletor de pipeline (somente quando papel = 'pipeline') */}
                  {mostrarPipelineSelector && (
                    <div className="mt-4 p-4 bg-primary/5 rounded-lg border border-primary/20 space-y-2">
                      <Label className="text-sm font-medium text-foreground block">
                        Qual pipeline do CRM este funil deve alimentar?
                      </Label>
                      <Select
                        value={f.pipelineId ?? ""}
                        onValueChange={(v) => {
                          if (v === "__new__") {
                            abrirCriarPipeline(f.nome);
                            return;
                          }
                          if (v === "__auto__") {
                            if (!tenantId) return;
                            criarAutoMutation.mutate({
                              tenantId,
                              smFunilName: f.nome,
                            });
                            return;
                          }
                          handleEscolherPipeline(f.nome, v);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um pipeline..." />
                        </SelectTrigger>
                        <SelectContent>
                          {(pipelines ?? []).map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                              {p.qtd_stages > 0
                                ? ` (${p.qtd_stages} ${p.qtd_stages === 1 ? "etapa" : "etapas"})`
                                : " (sem etapas)"}
                            </SelectItem>
                          ))}
                          {(pipelines ?? []).length > 0 && <SelectSeparator />}
                          <SelectItem value="__auto__">
                            <span className="flex items-start gap-1.5 text-primary">
                              <Zap className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                              <span className="flex flex-col">
                                <span className="text-sm font-medium">
                                  Criar automaticamente "{f.nome}"
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  Com as {f.qtdEtapas}{" "}
                                  {f.qtdEtapas === 1 ? "etapa" : "etapas"} do SolarMarket
                                </span>
                              </span>
                            </span>
                          </SelectItem>
                          <SelectSeparator />
                          <SelectItem value="__new__">
                            <span className="flex items-center gap-1.5">
                              <Plus className="w-3.5 h-3.5" />
                              Criar novo pipeline (vazio)
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      {f.papel === "pipeline" && pipelineNome && (
                        <p className="text-xs text-success flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Vinculado ao pipeline: <strong>{pipelineNome}</strong>
                        </p>
                      )}
                      {f.papel === "pipeline" && !pipelineNome && (
                        <p className="text-xs text-warning">
                          Escolha um pipeline para concluir o vínculo.
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
      </div>

      {/* Mapeamento etapa → consultor (apenas para funis 'vendedor_source') */}
      {tenantId &&
        funis
          ?.filter((f) => f.papel === "vendedor_source")
          .map((f) => (
            <EtapasToConsultores
              key={`et-${f.smFunilId}`}
              tenantId={tenantId}
              smFunilName={f.nome}
            />
          ))}

      {/* Configurações padrão (fallbacks) */}
      {tenantId && <ConfiguracoesPadraoCard tenantId={tenantId} />}

      {/* Validação global + botão Continuar */}
      {tenantId && funis && (
        <MappingValidation
          funis={funis}
          config={config}
          etapasVendedores={etapasVendedores ?? []}
          consultorMappings={consultorMappings ?? []}
        />
      )}

      {/* Dialog de criação de pipeline */}
      <Dialog open={criarOpen} onOpenChange={setCriarOpen}>
        <DialogContent className="w-[90vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Criar novo pipeline</DialogTitle>
            <DialogDescription>
              O pipeline será criado vazio. As etapas serão definidas na próxima sub-etapa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">
              Nome do pipeline
            </Label>
            <Input
              autoFocus
              placeholder="Ex: Comercial, Engenharia"
              value={nomeNovoPipeline}
              onChange={(e) => setNomeNovoPipeline(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && nomeNovoPipeline.trim()) {
                  handleCriarPipeline();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCriarOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCriarPipeline}
              disabled={!nomeNovoPipeline.trim() || createPipelineMutation.isPending}
            >
              {createPipelineMutation.isPending ? "Criando..." : "Criar pipeline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
