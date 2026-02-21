import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, AlertTriangle, CheckCircle2, RefreshCw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { TenantPremises } from "@/hooks/useTenantPremises";
import { FieldTooltip } from "./shared";

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

export function ConcessionariaSection({ premises, onChange, onSyncedFields, onAutoSave }: Props) {
  const [concessionarias, setConcessionarias] = useState<Concessionaria[]>([]);
  const [loadingConc, setLoadingConc] = useState(true);
  const [subgrupoData, setSubgrupoData] = useState<{ bt: any; mt: any }>({ bt: null, mt: null });
  const [justSynced, setJustSynced] = useState(false);

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
        const mt = data?.find((s: any) => s.subgrupo?.startsWith("A4") || s.subgrupo?.startsWith("A3")) || null;
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
    const mt = subgrupos?.find((s: any) => s.subgrupo?.startsWith("A4") || s.subgrupo?.startsWith("A3")) as any;

    onChange((p) => ({
      ...p,
      concessionaria_id: concId,
      tarifa: bt ? ((bt.tarifa_energia ?? 0) + (bt.tarifa_fio_b ?? 0)) : ((conc.tarifa_energia ?? 0) + (conc.tarifa_fio_b ?? 0)) || p.tarifa,
      tusd_fio_b_bt: bt?.tarifa_fio_b ?? conc.tarifa_fio_b ?? p.tusd_fio_b_bt,
      imposto_energia: conc.aliquota_icms ?? p.imposto_energia,
      tarifacao_compensada_bt: bt?.tarifacao_bt ?? p.tarifacao_compensada_bt,
      tusd_fio_b_fora_ponta: bt?.fio_b_fora_ponta ?? p.tusd_fio_b_fora_ponta,
      tusd_fio_b_ponta: bt?.fio_b_ponta ?? p.tusd_fio_b_ponta,
      tarifa_te_ponta: mt?.te_ponta ?? p.tarifa_te_ponta,
      tarifa_tusd_ponta: mt?.tusd_ponta ?? p.tarifa_tusd_ponta,
      tarifa_te_fora_ponta: mt?.te_fora_ponta ?? p.tarifa_te_fora_ponta,
      tarifa_tusd_fora_ponta: mt?.tusd_fora_ponta ?? p.tarifa_tusd_fora_ponta,
      tarifacao_compensada_fora_ponta: mt?.tarifacao_fora_ponta ?? p.tarifacao_compensada_fora_ponta,
      tarifacao_compensada_ponta: mt?.tarifacao_ponta ?? p.tarifacao_compensada_ponta,
      preco_demanda: mt?.demanda_consumo_rs ?? p.preco_demanda,
      preco_demanda_geracao: mt?.demanda_geracao_rs ?? p.preco_demanda_geracao,
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
      check("Fio B Fora Ponta", premises.tusd_fio_b_fora_ponta, subgrupoData.bt.fio_b_fora_ponta);
      check("Fio B Ponta", premises.tusd_fio_b_ponta, subgrupoData.bt.fio_b_ponta);
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
      tarifa: bt ? ((bt.tarifa_energia ?? 0) + (bt.tarifa_fio_b ?? 0)) : ((selectedConc.tarifa_energia ?? 0) + (selectedConc.tarifa_fio_b ?? 0)) || p.tarifa,
      tusd_fio_b_bt: bt?.tarifa_fio_b ?? selectedConc.tarifa_fio_b ?? p.tusd_fio_b_bt,
      imposto_energia: selectedConc.aliquota_icms ?? p.imposto_energia,
      tarifacao_compensada_bt: bt?.tarifacao_bt ?? p.tarifacao_compensada_bt,
      tusd_fio_b_fora_ponta: bt?.fio_b_fora_ponta ?? p.tusd_fio_b_fora_ponta,
      tusd_fio_b_ponta: bt?.fio_b_ponta ?? p.tusd_fio_b_ponta,
      tarifa_te_ponta: mt?.te_ponta ?? p.tarifa_te_ponta,
      tarifa_tusd_ponta: mt?.tusd_ponta ?? p.tarifa_tusd_ponta,
      tarifa_te_fora_ponta: mt?.te_fora_ponta ?? p.tarifa_te_fora_ponta,
      tarifa_tusd_fora_ponta: mt?.tusd_fora_ponta ?? p.tarifa_tusd_fora_ponta,
      tarifacao_compensada_fora_ponta: mt?.tarifacao_fora_ponta ?? p.tarifacao_compensada_fora_ponta,
      tarifacao_compensada_ponta: mt?.tarifacao_ponta ?? p.tarifacao_compensada_ponta,
      preco_demanda: mt?.demanda_consumo_rs ?? p.preco_demanda,
      preco_demanda_geracao: mt?.demanda_geracao_rs ?? p.preco_demanda_geracao,
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

  // Reset justSynced when premises change externally (user edits a field)
  useEffect(() => {
    if (justSynced) {
      // Will re-evaluate divergencias on next render cycle
    }
  }, [premises]);

  return (
    <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-5 space-y-3">
      <Label className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
        <Zap className="h-3.5 w-3.5" />
        Concessionária Padrão
        <FieldTooltip text="Selecione a concessionária para preencher automaticamente os campos de tarifa, Fio B e ICMS." />
      </Label>
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

      {/* Always-visible sync button */}
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

      {/* Divergence detail panel */}
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

      {/* Success message after sync */}
      {justSynced && (
        <div className="rounded-lg border border-success/30 bg-success/10 p-3 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <span className="text-xs font-medium text-success">
            Todos os campos foram sincronizados e salvos com a concessionária.
          </span>
        </div>
      )}
    </div>
  );
}
