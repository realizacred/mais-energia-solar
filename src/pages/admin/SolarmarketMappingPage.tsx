/**
 * SolarmarketMappingPage — mapeamento manual de funis e etapas SM → CRM nativo.
 *
 * Permite ao operador associar manualmente:
 *  - Funis do SolarMarket (sm_funis_raw / payloads de propostas) a Pipelines nativos
 *  - Etapas do SolarMarket a Stages nativos do pipeline correspondente
 *
 * Persistência: tabelas `sm_funil_pipeline_map` e `sm_etapa_stage_map`
 * (ver migration 2026-04 — RLS por tenant).
 *
 * Governança:
 *  - RB-01: cores semânticas (success/warning/primary)
 *  - RB-04: queries em hooks dedicados (useFunilMap/useEtapaMap, useSolarmarketDiagnostic)
 *  - RB-06: LoadingState durante fetch inicial
 *  - RB-10: layout responsivo (grid-cols-1 + tabela com overflow-x-auto)
 *  - RB-18: tabelas envolvidas em container com overflow-x-auto
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Save, CheckCircle2, AlertCircle, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { toast } from "@/hooks/use-toast";
import { useSolarmarketDiagnostic } from "@/hooks/useSolarmarketDiagnostic";
import {
  useFunilMap, useEtapaMap, useSaveFunilMap, useSaveEtapaMap,
} from "@/hooks/useSmMappings";

const NONE = "__none__";

export default function SolarmarketMappingPage() {
  const diagnostic = useSolarmarketDiagnostic();
  const funilMap = useFunilMap();

  // Local draft: smFunilName -> pipelineId
  const [funilDraft, setFunilDraft] = useState<Record<string, string>>({});
  const saveFunil = useSaveFunilMap();

  // Inicializa draft de funis com o que já existe no banco
  useEffect(() => {
    if (!funilMap.data) return;
    setFunilDraft((prev) => {
      const next = { ...prev };
      for (const row of funilMap.data ?? []) {
        if (next[row.sm_funil_name] === undefined) next[row.sm_funil_name] = row.pipeline_id;
      }
      return next;
    });
  }, [funilMap.data]);

  // Etapas: precisa de um funil selecionado
  const smFunis = diagnostic.data?.smFunis ?? [];
  const pipelines = diagnostic.data?.pipelines ?? [];
  const [selectedFunil, setSelectedFunil] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedFunil && smFunis.length) setSelectedFunil(smFunis[0].nome);
  }, [smFunis, selectedFunil]);

  const etapaMap = useEtapaMap(selectedFunil);
  const [etapaDraft, setEtapaDraft] = useState<Record<string, string>>({});
  const saveEtapa = useSaveEtapaMap();

  // Reset draft ao trocar funil; popula com o que já existe
  useEffect(() => {
    if (!selectedFunil) return;
    const initial: Record<string, string> = {};
    for (const row of etapaMap.data ?? []) initial[row.sm_etapa_name] = row.stage_id;
    setEtapaDraft(initial);
  }, [selectedFunil, etapaMap.data]);

  // Pipeline associado ao funil selecionado (define quais stages mostrar)
  const pipelineDoFunil = useMemo(() => {
    const pid = funilDraft[selectedFunil ?? ""];
    return pipelines.find((p) => p.id === pid) ?? null;
  }, [pipelines, funilDraft, selectedFunil]);

  const etapasDoFunil = useMemo(
    () => smFunis.find((f) => f.nome === selectedFunil)?.etapas ?? [],
    [smFunis, selectedFunil]
  );

  const handleSaveFunis = async () => {
    const rows = Object.entries(funilDraft)
      .filter(([, pid]) => pid && pid !== NONE)
      .map(([sm_funil_name, pipeline_id]) => ({ sm_funil_name, pipeline_id }));
    if (!rows.length) {
      toast({ title: "Nada para salvar", description: "Selecione ao menos um pipeline." });
      return;
    }
    try {
      await saveFunil.mutateAsync(rows);
      toast({ title: "Mapeamento de funis salvo", description: `${rows.length} associação(ões) gravada(s).` });
    } catch (e) {
      toast({ title: "Erro ao salvar", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleSaveEtapas = async () => {
    if (!selectedFunil) return;
    const rows = Object.entries(etapaDraft)
      .filter(([, sid]) => sid && sid !== NONE)
      .map(([sm_etapa_name, stage_id]) => ({
        sm_funil_name: selectedFunil,
        sm_etapa_name,
        stage_id,
      }));
    if (!rows.length) {
      toast({ title: "Nada para salvar", description: "Selecione ao menos um stage." });
      return;
    }
    try {
      await saveEtapa.mutateAsync(rows);
      toast({ title: "Mapeamento de etapas salvo", description: `${rows.length} associação(ões) gravada(s).` });
    } catch (e) {
      toast({ title: "Erro ao salvar", description: (e as Error).message, variant: "destructive" });
    }
  };

  if (diagnostic.isLoading || funilMap.isLoading) {
    return <LoadingState message="Carregando mapeamentos..." context="general" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 via-background to-background">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1400px]">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Settings2 className="w-6 h-6 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-foreground">Mapeamento SolarMarket → CRM</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Associe funis e etapas do SolarMarket aos pipelines/stages nativos.
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/solarmarket-diagnostic">
              <ArrowLeft className="w-4 h-4" /> Voltar ao Diagnóstico
            </Link>
          </Button>
        </div>

        {/* SEÇÃO 1: Funis → Pipelines */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              1. Mapeamento de Funis
            </CardTitle>
            <CardDescription>
              Cada funil do SolarMarket é associado a um pipeline nativo do CRM.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {smFunis.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum funil encontrado em <code>sm_propostas_raw</code>. Importe propostas primeiro.
              </p>
            ) : (
              <>
                <div className="rounded-lg border border-border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Funil SolarMarket</TableHead>
                        <TableHead className="w-12 text-center">→</TableHead>
                        <TableHead>Pipeline Nativo</TableHead>
                        <TableHead className="w-20 text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {smFunis.map((f) => {
                        const value = funilDraft[f.nome] ?? NONE;
                        const ok = value !== NONE;
                        return (
                          <TableRow key={f.nome}>
                            <TableCell className="font-medium text-foreground">
                              {f.nome}
                              <span className="ml-2 text-xs text-muted-foreground">
                                ({f.totalPropostas} propostas)
                              </span>
                            </TableCell>
                            <TableCell className="text-center text-muted-foreground">
                              <ArrowRight className="w-4 h-4 inline" />
                            </TableCell>
                            <TableCell>
                              <Select
                                value={value}
                                onValueChange={(v) =>
                                  setFunilDraft((d) => ({ ...d, [f.nome]: v }))
                                }
                              >
                                <SelectTrigger className="w-full max-w-xs">
                                  <SelectValue placeholder="Selecione um pipeline" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={NONE}>— não mapeado —</SelectItem>
                                  {pipelines.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                      {p.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-center">
                              {ok ? (
                                <CheckCircle2 className="w-5 h-5 text-success inline" />
                              ) : (
                                <AlertCircle className="w-5 h-5 text-warning inline" />
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-end mt-4">
                  <Button onClick={handleSaveFunis} disabled={saveFunil.isPending}>
                    <Save className="w-4 h-4" />
                    {saveFunil.isPending ? "Salvando..." : "Salvar Mapeamentos"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* SEÇÃO 2: Etapas → Stages */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">2. Mapeamento de Etapas</CardTitle>
            <CardDescription>
              Selecione um funil para associar suas etapas aos stages do pipeline nativo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <span className="text-sm font-medium text-foreground">Funil:</span>
              <Select
                value={selectedFunil ?? ""}
                onValueChange={(v) => setSelectedFunil(v)}
              >
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue placeholder="Selecione um funil" />
                </SelectTrigger>
                <SelectContent>
                  {smFunis.map((f) => (
                    <SelectItem key={f.nome} value={f.nome}>
                      {f.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!pipelineDoFunil ? (
              <p className="text-sm text-warning bg-warning/10 border border-warning/20 rounded-md p-3">
                Selecione e salve um pipeline para este funil na seção 1 antes de mapear etapas.
              </p>
            ) : etapasDoFunil.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma etapa encontrada para este funil.
              </p>
            ) : (
              <>
                <div className="rounded-lg border border-border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Etapa SolarMarket</TableHead>
                        <TableHead className="w-12 text-center">→</TableHead>
                        <TableHead>Stage Nativo ({pipelineDoFunil.name})</TableHead>
                        <TableHead className="w-20 text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {etapasDoFunil.map((etapa) => {
                        const value = etapaDraft[etapa] ?? NONE;
                        const ok = value !== NONE;
                        return (
                          <TableRow key={etapa}>
                            <TableCell className="font-medium text-foreground">{etapa}</TableCell>
                            <TableCell className="text-center text-muted-foreground">
                              <ArrowRight className="w-4 h-4 inline" />
                            </TableCell>
                            <TableCell>
                              <Select
                                value={value}
                                onValueChange={(v) =>
                                  setEtapaDraft((d) => ({ ...d, [etapa]: v }))
                                }
                              >
                                <SelectTrigger className="w-full max-w-xs">
                                  <SelectValue placeholder="Selecione um stage" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={NONE}>— não mapeado —</SelectItem>
                                  {pipelineDoFunil.stages.map((s) => (
                                    <SelectItem key={s.id} value={s.id}>
                                      {s.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-center">
                              {ok ? (
                                <CheckCircle2 className="w-5 h-5 text-success inline" />
                              ) : (
                                <AlertCircle className="w-5 h-5 text-warning inline" />
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSaveEtapas} disabled={saveEtapa.isPending}>
                    <Save className="w-4 h-4" />
                    {saveEtapa.isPending ? "Salvando..." : "Salvar Mapeamentos"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
