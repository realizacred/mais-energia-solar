import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, AlertTriangle, CheckCircle2, RefreshCw, Loader2, ArrowRight, MinusCircle, FileText } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import type { TenantPremises } from "@/hooks/useTenantPremises";
import { FieldTooltip } from "./shared";
import { SectionCard } from "@/components/ui-kit/SectionCard";

interface Concessionaria {
  id: string;
  nome: string;
  sigla: string | null;
  estado: string | null;
  tarifa_energia: number | null;
  tarifa_fio_b: number | null;
  aliquota_icms: number | null;
  custo_disponibilidade_monofasico: number | null;
  custo_disponibilidade_bifasico: number | null;
  custo_disponibilidade_trifasico: number | null;
  possui_isencao_scee: boolean | null;
  percentual_isencao: number | null;
}

interface Props {
  premises: TenantPremises;
  onChange: (fn: (prev: TenantPremises) => TenantPremises) => void;
  onSyncedFields?: (fields: string[]) => void;
  onAutoSave?: () => Promise<void>;
}

/**
 * Pick the best MT subgrupo record for solar GD:
 * Priority: A4 Verde > A4 Azul > A3 Verde > A3 Azul
 */
function pickBestMT(subgrupos: any[]): any {
  const mtCandidates = subgrupos.filter((s: any) =>
    s.subgrupo?.startsWith("A4") || s.subgrupo?.startsWith("A3")
  );
  if (mtCandidates.length === 0) return null;

  // Prefer A4 over A3, Verde over Azul
  const priority = (s: any) => {
    let score = 0;
    if (s.subgrupo?.startsWith("A4")) score += 10;
    if (s.modalidade_tarifaria === "Verde") score += 5;
    return score;
  };
  mtCandidates.sort((a: any, b: any) => priority(b) - priority(a));
  return mtCandidates[0];
}

export function ConcessionariaSection({ premises, onChange, onSyncedFields, onAutoSave }: Props) {
  const [concessionarias, setConcessionarias] = useState<Concessionaria[]>([]);
  const [loadingConc, setLoadingConc] = useState(true);
  const [subgrupoData, setSubgrupoData] = useState<{ bt: any; mt: any }>({ bt: null, mt: null });
  const [justSynced, setJustSynced] = useState(false);
  const [bulkSyncing, setBulkSyncing] = useState(false);
  const [bulkResult, setBulkResult] = useState<{
    total: number;
    updated: number;
    skipped: number;
    unchanged?: number;
    details?: Array<{
      nome: string;
      sigla: string | null;
      status: 'atualizada' | 'sem_alteracao' | 'sem_dados';
      fonte?: string;
      origem?: string;
      changes?: {
        tarifa_energia?: { de: number | null; para: number | null };
        tarifa_fio_b?: { de: number | null; para: number | null };
      };
    }>;
  } | null>(null);

  useEffect(() => {
    supabase
      .from("concessionarias")
      .select("id, nome, sigla, estado, tarifa_energia, tarifa_fio_b, aliquota_icms, custo_disponibilidade_monofasico, custo_disponibilidade_bifasico, custo_disponibilidade_trifasico, possui_isencao_scee, percentual_isencao")
      .eq("ativo", true)
      .order("nome")
      .then(({ data }) => {
        if (data) setConcessionarias(data as Concessionaria[]);
        setLoadingConc(false);
      });
  }, []);

  const selectedConc = concessionarias.find((c) => c.id === (premises as any).concessionaria_id);

  useEffect(() => {
    if (!selectedConc) { setSubgrupoData({ bt: null, mt: null }); return; }
    supabase
      .from("concessionaria_tarifas_subgrupo")
      .select("*")
      .eq("concessionaria_id", selectedConc.id)
      .eq("is_active", true)
      .then(({ data }) => {
        const bt = data?.find((s: any) => s.subgrupo?.startsWith("B1")) || null;
        const mt = pickBestMT(data || []);
        setSubgrupoData({ bt, mt });
      });
  }, [selectedConc?.id]);

  const handleConcessionariaChange = useCallback(async (concId: string) => {
    const conc = concessionarias.find((c) => c.id === concId);
    if (!conc) return;
    setJustSynced(false);

    const { data: subgrupos } = await supabase
      .from("concessionaria_tarifas_subgrupo")
      .select("*")
      .eq("concessionaria_id", concId)
      .eq("is_active", true)
      .order("subgrupo");

    const bt = subgrupos?.find((s: any) => s.subgrupo?.startsWith("B1")) as any;
    const mt = pickBestMT(subgrupos || []);
    // Update subgrupoData immediately so divergence check uses fresh values
    setSubgrupoData({ bt: bt || null, mt: mt || null });

    // Use 0 as fallback instead of keeping stale premise values
    onChange((p) => ({
      ...p,
      concessionaria_id: concId,
      // BT tariffs
      tarifa: bt
        ? ((bt.tarifa_energia ?? 0) + (bt.tarifa_fio_b ?? 0))
        : ((conc.tarifa_energia ?? 0) + (conc.tarifa_fio_b ?? 0)),
      tusd_fio_b_bt: bt?.tarifa_fio_b ?? conc.tarifa_fio_b ?? 0,
      imposto_energia: conc.aliquota_icms ?? 0,
      tarifacao_compensada_bt: bt?.tarifacao_bt ?? 0,
      // MT tariffs — reset to 0 if no MT data
      tarifa_te_ponta: mt?.te_ponta ?? 0,
      tarifa_tusd_ponta: mt?.tusd_ponta ?? 0,
      tarifa_te_fora_ponta: mt?.te_fora_ponta ?? 0,
      tarifa_tusd_fora_ponta: mt?.tusd_fora_ponta ?? 0,
      tarifacao_compensada_fora_ponta: mt?.tarifacao_fora_ponta ?? 0,
      tarifacao_compensada_ponta: mt?.tarifacao_ponta ?? 0,
      preco_demanda: mt?.demanda_consumo_rs ?? 0,
      preco_demanda_geracao: mt?.demanda_geracao_rs ?? 0,
      // Fio B ponta/fora ponta — use MT data if available, otherwise 0
      tusd_fio_b_fora_ponta: mt?.fio_b_fora_ponta ?? 0,
      tusd_fio_b_ponta: mt?.fio_b_ponta ?? 0,
    }));
  }, [concessionarias, onChange]);



  // Map divergencia campo names to TenantPremises keys for highlight
  const FIELD_MAP: Record<string, keyof TenantPremises> = {
    "Tarifa": "tarifa",
    "TUSD Fio B BT": "tusd_fio_b_bt",
    "ICMS": "imposto_energia",
    "Tarifação Compensada BT": "tarifacao_compensada_bt",
    "Fio B Fora Ponta": "tusd_fio_b_fora_ponta",
    "Fio B Ponta": "tusd_fio_b_ponta",
    "TE Ponta": "tarifa_te_ponta",
    "TUSD Ponta": "tarifa_tusd_ponta",
    "TE Fora Ponta": "tarifa_te_fora_ponta",
    "TUSD Fora Ponta": "tarifa_tusd_fora_ponta",
    "Demanda": "preco_demanda",
    "Demanda Geração": "preco_demanda_geracao",
    "Tarifação Compensada FP": "tarifacao_compensada_fora_ponta",
    "Tarifação Compensada P": "tarifacao_compensada_ponta",
  };

  const divergencias = useMemo(() => {
    if (!selectedConc || justSynced) return [];
    const diffs: { campo: string; premissa: number; conc: number }[] = [];
    const check = (campo: string, pVal: number, cVal: number | null | undefined, tol = 0.0001) => {
      if (cVal != null && Math.abs(pVal - cVal) > tol) diffs.push({ campo, premissa: pVal, conc: cVal });
    };
    const concTarifaTotal = subgrupoData.bt
      ? ((subgrupoData.bt.tarifa_energia ?? 0) + (subgrupoData.bt.tarifa_fio_b ?? 0))
      : ((selectedConc.tarifa_energia ?? 0) + (selectedConc.tarifa_fio_b ?? 0));
    check("Tarifa", premises.tarifa, concTarifaTotal);
    check("TUSD Fio B BT", premises.tusd_fio_b_bt, subgrupoData.bt?.tarifa_fio_b ?? selectedConc.tarifa_fio_b);
    check("ICMS", premises.imposto_energia, selectedConc.aliquota_icms, 0.01);
    if (subgrupoData.bt) {
      check("Tarifação Compensada BT", premises.tarifacao_compensada_bt, subgrupoData.bt.tarifacao_bt);
    }
    // Fio B ponta/fora ponta comes from MT data, not BT
    if (subgrupoData.mt) {
      check("Fio B Fora Ponta", premises.tusd_fio_b_fora_ponta, subgrupoData.mt.fio_b_fora_ponta);
      check("Fio B Ponta", premises.tusd_fio_b_ponta, subgrupoData.mt.fio_b_ponta);
    }
    if (subgrupoData.mt) {
      check("TE Ponta", premises.tarifa_te_ponta, subgrupoData.mt.te_ponta);
      check("TUSD Ponta", premises.tarifa_tusd_ponta, subgrupoData.mt.tusd_ponta);
      check("TE Fora Ponta", premises.tarifa_te_fora_ponta, subgrupoData.mt.te_fora_ponta);
      check("TUSD Fora Ponta", premises.tarifa_tusd_fora_ponta, subgrupoData.mt.tusd_fora_ponta);
      check("Demanda", premises.preco_demanda, subgrupoData.mt.demanda_consumo_rs);
      check("Demanda Geração", premises.preco_demanda_geracao, subgrupoData.mt.demanda_geracao_rs);
    }
    return diffs;
  }, [selectedConc, subgrupoData, premises, justSynced]);

  const [syncing, setSyncing] = useState(false);

  const syncAllFromConc = useCallback(async () => {
    if (!selectedConc) return;
    setSyncing(true);
    const bt = subgrupoData.bt as any;
    const mt = subgrupoData.mt as any;

    // Collect field keys that will be synced
    const syncedKeys = Object.values(FIELD_MAP).filter(Boolean) as string[];

    onChange((p) => ({
      ...p,
      concessionaria_id: selectedConc.id,
      // BT tariffs
      tarifa: bt
        ? ((bt.tarifa_energia ?? 0) + (bt.tarifa_fio_b ?? 0))
        : ((selectedConc.tarifa_energia ?? 0) + (selectedConc.tarifa_fio_b ?? 0)),
      tusd_fio_b_bt: bt?.tarifa_fio_b ?? selectedConc.tarifa_fio_b ?? 0,
      imposto_energia: selectedConc.aliquota_icms ?? 0,
      tarifacao_compensada_bt: bt?.tarifacao_bt ?? 0,
      // MT tariffs — reset to 0 if no MT data
      tarifa_te_ponta: mt?.te_ponta ?? 0,
      tarifa_tusd_ponta: mt?.tusd_ponta ?? 0,
      tarifa_te_fora_ponta: mt?.te_fora_ponta ?? 0,
      tarifa_tusd_fora_ponta: mt?.tusd_fora_ponta ?? 0,
      tarifacao_compensada_fora_ponta: mt?.tarifacao_fora_ponta ?? 0,
      tarifacao_compensada_ponta: mt?.tarifacao_ponta ?? 0,
      preco_demanda: mt?.demanda_consumo_rs ?? 0,
      preco_demanda_geracao: mt?.demanda_geracao_rs ?? 0,
      // Fio B ponta/fora ponta — from MT, not BT
      tusd_fio_b_fora_ponta: mt?.fio_b_fora_ponta ?? 0,
      tusd_fio_b_ponta: mt?.fio_b_ponta ?? 0,
    }));

    // Notify parent about synced fields for visual highlight
    onSyncedFields?.(syncedKeys);
    setJustSynced(true);

    // Auto-save after a micro-delay to let React state settle
    if (onAutoSave) {
      setTimeout(async () => {
        try {
          await onAutoSave();
          toast.success("Premissas sincronizadas e salvas automaticamente!");
        } catch (e) {
          console.error("Auto-save after sync failed:", e);
          toast.error("Erro ao salvar após sincronização");
        } finally {
          setSyncing(false);
        }
      }, 150);
    } else {
      toast.success(
        `Campos atualizados. Clique em Salvar para confirmar.`,
        { duration: 4000 }
      );
      setSyncing(false);
    }
  }, [selectedConc, subgrupoData, onChange, divergencias, onSyncedFields, onAutoSave]);

  // Bulk sync: update ALL concessionárias from their own subgrupo data
  const bulkSyncAll = useCallback(async () => {
    setBulkSyncing(true);
    setBulkResult(null);
    try {
      const { data, error } = await supabase.rpc("sync_concessionarias_from_subgrupos");
      if (error) throw error;
      const result = data as any;
      if (result?.error) throw new Error(result.error);
      setBulkResult(result);
      toast.success(`${result.updated} concessionária(s) atualizada(s) de ${result.total} total.`);
    } catch (e: any) {
      toast.error("Erro ao sincronizar concessionárias", { description: e.message });
    } finally {
      setBulkSyncing(false);
    }
  }, []);

  // Reset justSynced when premises change externally (user edits a field)
  useEffect(() => {
    if (justSynced) {
      // Will re-evaluate divergencias on next render cycle
    }
  }, [premises]);

  return (
    <div className="space-y-5">
      {/* Card 1: Concessionária Padrão selector */}
      <SectionCard icon={Zap} title="Concessionária Padrão" description="Selecione a concessionária para preencher automaticamente os campos de tarifa, Fio B e ICMS." variant="orange">
        <div className="space-y-3">
          <Select
            value={(premises as any).concessionaria_id || ""}
            onValueChange={(v) => {
              setJustSynced(false);
              handleConcessionariaChange(v);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={loadingConc ? "Carregando..." : "Selecione a concessionária"} />
            </SelectTrigger>
            <SelectContent>
              {concessionarias.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome} {c.sigla ? `(${c.sigla})` : ""} — {c.estado || ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedConc && (
            <div className="flex flex-wrap gap-2 text-[10px]">
              <Badge variant="outline" className="text-[10px] font-mono">TE: R$ {selectedConc.tarifa_energia?.toFixed(6) ?? "—"}/kWh</Badge>
              <Badge variant="outline" className="text-[10px] font-mono">TUSD (Fio B): R$ {selectedConc.tarifa_fio_b?.toFixed(6) ?? "—"}/kWh</Badge>
              <Badge variant="secondary" className="text-[10px] font-mono">Total (TE+TUSD): R$ {((selectedConc.tarifa_energia ?? 0) + (selectedConc.tarifa_fio_b ?? 0)).toFixed(6)}/kWh</Badge>
              <Badge variant="outline" className="text-[10px]">ICMS: {selectedConc.aliquota_icms ?? "—"}%</Badge>
              {selectedConc.possui_isencao_scee && (
                <Badge variant="secondary" className="text-[10px]">Isenção SCEE: {selectedConc.percentual_isencao}%</Badge>
              )}
            </div>
          )}

          {/* Sync button */}
          {selectedConc && !justSynced && (
            <Button
              type="button"
              variant="default"
              size="sm"
              className="w-full gap-2"
              onClick={syncAllFromConc}
              disabled={syncing}
            >
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Sincronizar TODAS as premissas com valores da concessionária
              {divergencias.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px]">{divergencias.length} divergências</Badge>
              )}
            </Button>
          )}

          {/* Divergence detail */}
          {divergencias.length > 0 && !justSynced && (
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-warning">
                <AlertTriangle className="h-3.5 w-3.5" />
                Valores divergentes da concessionária
              </div>
              <div className="flex flex-wrap gap-2">
                {divergencias.map((d) => (
                  <Badge key={d.campo} variant="outline" className="text-[10px] border-warning/40">
                    {d.campo}: premissa {d.premissa.toFixed(5)} ≠ conc. {d.conc.toFixed(5)}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Success message */}
          {justSynced && (
            <div className="rounded-lg border border-success/30 bg-success/10 p-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span className="text-xs font-medium text-success">
                Todos os campos foram sincronizados e salvos com a concessionária.
              </span>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Card 2: Atualização em Lote */}
      <SectionCard icon={RefreshCw} title="Atualização em Lote" description="Atualiza TODAS as concessionárias ativas com os dados de suas próprias tarifas de subgrupo (B1 ativo)." variant="blue">
        <div className="space-y-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full gap-2 border-info/40 hover:bg-info/10"
            onClick={bulkSyncAll}
            disabled={bulkSyncing}
          >
            {bulkSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 text-info" />}
            Atualizar TODAS as concessionárias de uma vez
          </Button>
          {bulkResult && (
            <div className="space-y-3">
              {/* Summary */}
              <div className="rounded-lg border border-success/30 bg-success/10 p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span className="text-xs font-semibold text-success">
                    Sincronização concluída
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 ml-6">
                  <Badge variant="default" className="text-[10px] bg-success/80">{bulkResult.updated} atualizada(s)</Badge>
                  {(bulkResult.unchanged ?? 0) > 0 && (
                    <Badge variant="secondary" className="text-[10px]">{bulkResult.unchanged} sem alteração</Badge>
                  )}
                  {bulkResult.skipped > 0 && (
                    <Badge variant="outline" className="text-[10px] border-warning/40 text-warning">{bulkResult.skipped} sem dados</Badge>
                  )}
                  <Badge variant="outline" className="text-[10px]">{bulkResult.total} total</Badge>
                </div>
              </div>

              {/* Detailed report */}
              {bulkResult.details && bulkResult.details.length > 0 && (
                <div className="rounded-lg border border-border/60 bg-muted/20">
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">Relatório detalhado</span>
                  </div>
                  <ScrollArea className="max-h-[300px]">
                    <div className="divide-y divide-border/30">
                      {bulkResult.details
                        .sort((a, b) => {
                          const order = { atualizada: 0, sem_dados: 1, sem_alteracao: 2 };
                          return (order[a.status] ?? 9) - (order[b.status] ?? 9);
                        })
                        .map((d, i) => (
                        <div key={i} className="px-3 py-2 flex items-start gap-2">
                          {d.status === 'atualizada' && <CheckCircle2 className="h-3.5 w-3.5 text-success mt-0.5 shrink-0" />}
                          {d.status === 'sem_alteracao' && <MinusCircle className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />}
                          {d.status === 'sem_dados' && <AlertTriangle className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-medium truncate">
                                {d.nome} {d.sigla ? `(${d.sigla})` : ''}
                              </span>
                              {d.fonte && (
                                <Badge variant="outline" className="text-[9px] shrink-0">Fonte: {d.fonte}</Badge>
                              )}
                              {d.origem && d.origem !== 'manual' && (
                                <Badge variant="secondary" className="text-[9px] shrink-0">{d.origem}</Badge>
                              )}
                            </div>
                            {d.status === 'atualizada' && d.changes && (
                              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                                {d.changes.tarifa_energia && (
                                  d.changes.tarifa_energia.de !== d.changes.tarifa_energia.para && (
                                    <span className="text-[10px] text-muted-foreground font-mono">
                                      TE: {(d.changes.tarifa_energia.de ?? 0).toFixed(6)}
                                      <ArrowRight className="inline h-2.5 w-2.5 mx-0.5" />
                                      <span className="text-success font-semibold">{(d.changes.tarifa_energia.para ?? 0).toFixed(6)}</span>
                                    </span>
                                  )
                                )}
                                {d.changes.tarifa_fio_b && (
                                  d.changes.tarifa_fio_b.de !== d.changes.tarifa_fio_b.para && (
                                    <span className="text-[10px] text-muted-foreground font-mono">
                                      Fio B: {(d.changes.tarifa_fio_b.de ?? 0).toFixed(6)}
                                      <ArrowRight className="inline h-2.5 w-2.5 mx-0.5" />
                                      <span className="text-success font-semibold">{(d.changes.tarifa_fio_b.para ?? 0).toFixed(6)}</span>
                                    </span>
                                  )
                                )}
                              </div>
                            )}
                            {d.status === 'sem_dados' && (
                              <span className="text-[10px] text-warning">Nenhum subgrupo B1 ativo encontrado</span>
                            )}
                            {d.status === 'sem_alteracao' && (
                              <span className="text-[10px] text-muted-foreground">Valores já estão atualizados</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
