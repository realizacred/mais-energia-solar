import { useState, useCallback, useEffect } from "react";
import {
  FileUp, Loader2, CheckCircle2, AlertTriangle, Zap, Receipt, ShieldCheck,
  ArrowRight, Search, RefreshCw, Building,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────

interface ExtractedData {
  concessionaria_nome: string | null;
  cidade: string | null;
  estado: string | null;
  consumo_kwh: number | null;
  tarifa_energia_kwh: number | null;
  tarifa_fio_b_kwh: number | null;
  valor_total: number | null;
  icms_percentual: number | null;
  pis_valor: number | null;
  cofins_valor: number | null;
  bandeira_tarifaria: string | null;
  classe_consumo: string | null;
  tipo_ligacao: string | null;
  mes_referencia: string | null;
  demanda_contratada_kw: number | null;
  confidence: number;
  raw_fields: Record<string, string>;
}

interface ConcMatch {
  id: string;
  nome: string;
  sigla: string | null;
  estado: string | null;
  tarifa_energia: number | null;
  tarifa_fio_b: number | null;
  aliquota_icms: number | null;
  pis_percentual: number | null;
  cofins_percentual: number | null;
}

interface DiffField {
  label: string;
  field: string;
  current: number | null;
  extracted: number | null;
  unit: string;
  decimals: number;
  enabled: boolean;
}

type Step = "upload" | "review" | "match" | "diff" | "done";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDataExtracted?: (data: ExtractedData) => void;
}

// ── Helpers ───────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "");
}

function matchScore(conc: ConcMatch, extracted: ExtractedData): number {
  let score = 0;
  const eName = normalize(extracted.concessionaria_nome || "");
  const cName = normalize(conc.nome);
  const cSigla = normalize(conc.sigla || "");

  if (eName && cName && cName.includes(eName)) score += 50;
  if (eName && cSigla && (cSigla.includes(eName) || eName.includes(cSigla))) score += 40;
  if (eName && cName && eName.includes(cName)) score += 30;
  if (extracted.estado && conc.estado && extracted.estado.toUpperCase() === conc.estado.toUpperCase()) score += 20;

  // Fuzzy substring
  if (eName.length >= 4 && cName.length >= 4) {
    const shorter = eName.length < cName.length ? eName : cName;
    const longer = eName.length >= cName.length ? eName : cName;
    if (longer.includes(shorter.substring(0, Math.min(6, shorter.length)))) score += 15;
  }

  return Math.min(score, 100);
}

function fmt(v: number | null, decimals: number, unit: string): string {
  if (v == null) return "—";
  return `${unit === "%" ? "" : "R$ "}${v.toFixed(decimals)}${unit === "%" ? "%" : ` ${unit}`}`;
}

// ── Main Component ────────────────────────────────────────────────

export function ImportContaEnergiaDialog({ open, onOpenChange, onDataExtracted }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [loading, setLoading] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [manualText, setManualText] = useState("");

  // Match step
  const [concessionarias, setConcessionarias] = useState<ConcMatch[]>([]);
  const [selectedConcId, setSelectedConcId] = useState<string>("");
  const [autoMatched, setAutoMatched] = useState(false);

  // Diff step
  const [diffFields, setDiffFields] = useState<DiffField[]>([]);
  const [updating, setUpdating] = useState(false);

  const resetState = useCallback(() => {
    setStep("upload");
    setLoading(false);
    setExtractedData(null);
    setManualText("");
    setConcessionarias([]);
    setSelectedConcId("");
    setAutoMatched(false);
    setDiffFields([]);
    setUpdating(false);
  }, []);

  // Fetch concessionárias when dialog opens
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from("concessionarias")
        .select("id, nome, sigla, estado, tarifa_energia, tarifa_fio_b, aliquota_icms, pis_percentual, cofins_percentual")
        .eq("ativo", true)
        .order("nome");
      if (data) setConcessionarias(data);
    })();
  }, [open]);

  // ── Upload / Parse ──────────────────────────────────────────────

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file) return;
    setLoading(true);
    try {
      const text = await file.text();
      if (text.length < 50 || !/[a-zA-Z]{3,}/g.test(text)) {
        toast.info("PDF sem texto selecionável", {
          description: "Cole o texto da conta manualmente no campo abaixo.",
        });
        setLoading(false);
        return;
      }
      await processText(text);
    } catch (err) {
      console.error("Error reading file:", err);
      toast.error("Erro ao ler arquivo", { description: "Tente colar o texto da conta manualmente." });
    } finally {
      setLoading(false);
    }
  }, []);

  const processText = async (text: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-conta-energia", {
        body: { text },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao processar");
      setExtractedData(data.data);
      setStep("review");
    } catch (err: any) {
      toast.error("Erro ao extrair dados", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = () => {
    if (manualText.trim().length < 20) {
      toast.error("Texto muito curto para análise");
      return;
    }
    processText(manualText);
  };

  // ── Match ───────────────────────────────────────────────────────

  const proceedToMatch = () => {
    if (!extractedData) return;

    // Auto-match
    const scored = concessionarias
      .map(c => ({ ...c, score: matchScore(c, extractedData) }))
      .filter(c => c.score > 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length > 0 && scored[0].score >= 40) {
      setSelectedConcId(scored[0].id);
      setAutoMatched(true);
    } else {
      setAutoMatched(false);
    }

    setStep("match");
  };

  // ── Diff ────────────────────────────────────────────────────────

  const proceedToDiff = () => {
    if (!extractedData || !selectedConcId) return;
    const conc = concessionarias.find(c => c.id === selectedConcId);
    if (!conc) return;

    const fields: DiffField[] = [];

    if (extractedData.tarifa_energia_kwh != null) {
      fields.push({
        label: "Tarifa Energia (TE)",
        field: "tarifa_energia",
        current: conc.tarifa_energia,
        extracted: extractedData.tarifa_energia_kwh,
        unit: "/kWh",
        decimals: 6,
        enabled: true,
      });
    }

    if (extractedData.tarifa_fio_b_kwh != null) {
      fields.push({
        label: "TUSD / Fio B",
        field: "tarifa_fio_b",
        current: conc.tarifa_fio_b,
        extracted: extractedData.tarifa_fio_b_kwh,
        unit: "/kWh",
        decimals: 6,
        enabled: true,
      });
    }

    if (extractedData.icms_percentual != null) {
      fields.push({
        label: "ICMS",
        field: "aliquota_icms",
        current: conc.aliquota_icms,
        extracted: extractedData.icms_percentual,
        unit: "%",
        decimals: 2,
        enabled: true,
      });
    }

    if (extractedData.pis_valor != null && extractedData.consumo_kwh && extractedData.consumo_kwh > 0) {
      // Convert PIS from R$ to % approximation using total value
      const pct = extractedData.valor_total && extractedData.valor_total > 0
        ? Math.round(extractedData.pis_valor / extractedData.valor_total * 10000) / 100
        : null;
      if (pct != null) {
        fields.push({
          label: "PIS (%)",
          field: "pis_percentual",
          current: conc.pis_percentual,
          extracted: pct,
          unit: "%",
          decimals: 2,
          enabled: true,
        });
      }
    }

    if (extractedData.cofins_valor != null && extractedData.valor_total && extractedData.valor_total > 0) {
      const pct = Math.round(extractedData.cofins_valor / extractedData.valor_total * 10000) / 100;
      fields.push({
        label: "COFINS (%)",
        field: "cofins_percentual",
        current: conc.cofins_percentual,
        extracted: pct,
        unit: "%",
        decimals: 2,
        enabled: true,
      });
    }

    setDiffFields(fields);
    setStep("diff");
  };

  const toggleField = (idx: number) => {
    setDiffFields(prev => prev.map((f, i) => i === idx ? { ...f, enabled: !f.enabled } : f));
  };

  // ── Update ──────────────────────────────────────────────────────

  const handleUpdate = async () => {
    if (!selectedConcId || diffFields.length === 0) return;

    const enabledFields = diffFields.filter(f => f.enabled && f.extracted != null);
    if (enabledFields.length === 0) {
      toast.info("Nenhum campo selecionado para atualizar");
      return;
    }

    setUpdating(true);
    try {
      // 1. Update concessionaria
      const concUpdate: Record<string, number> = {};
      for (const f of enabledFields) {
        concUpdate[f.field] = f.extracted!;
      }
      concUpdate["ultima_sync_tarifas" as any] = undefined as any; // keep type compatible
      
      const { error: concErr } = await supabase
        .from("concessionarias")
        .update({
          ...concUpdate,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedConcId);

      if (concErr) throw concErr;

      // 2. Also update B1 subgrupo if TE/TUSD changed
      const teField = enabledFields.find(f => f.field === "tarifa_energia");
      const tusdField = enabledFields.find(f => f.field === "tarifa_fio_b");

      if (teField || tusdField) {
        const teVal = teField?.extracted ?? diffFields.find(f => f.field === "tarifa_energia")?.current ?? 0;
        const tusdVal = tusdField?.extracted ?? diffFields.find(f => f.field === "tarifa_fio_b")?.current ?? 0;

        // Upsert B1 Convencional
        await supabase
          .from("concessionaria_tarifas_subgrupo")
          .upsert({
            concessionaria_id: selectedConcId,
            tenant_id: (await supabase.from("concessionarias").select("tenant_id").eq("id", selectedConcId).single()).data?.tenant_id,
            subgrupo: "B1",
            modalidade_tarifaria: "Convencional",
            tarifa_energia: Math.round(((teVal || 0) + (tusdVal || 0)) * 1000000) / 1000000,
            tarifa_fio_b: tusdVal || 0,
            origem: "conta_energia",
            is_active: true,
            updated_at: new Date().toISOString(),
          }, { onConflict: "tenant_id,concessionaria_id,subgrupo,modalidade_tarifaria" });
      }

      const conc = concessionarias.find(c => c.id === selectedConcId);
      toast.success(`${conc?.nome || "Concessionária"} atualizada`, {
        description: `${enabledFields.length} campo(s) atualizado(s) com dados da conta de energia.`,
      });

      onDataExtracted?.(extractedData!);
      setStep("done");
    } catch (err: any) {
      toast.error("Erro ao atualizar", { description: err.message });
    } finally {
      setUpdating(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetState(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="w-5 h-5 text-primary" />
            Importar Conta de Energia
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && "Faça upload de uma conta de luz ou cole o texto para extrair tarifas."}
            {step === "review" && "Revise os dados extraídos antes de continuar."}
            {step === "match" && "Selecione a concessionária para atualizar."}
            {step === "diff" && "Compare os valores atuais com os extraídos e selecione o que atualizar."}
            {step === "done" && "Atualização concluída!"}
          </DialogDescription>
        </DialogHeader>

        {/* ── Step: Upload ─────────────────────────────────────── */}
        {step === "upload" && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border/60 rounded-xl p-6 text-center space-y-3 hover:border-primary/40 transition-colors">
              <FileUp className="w-8 h-8 mx-auto text-muted-foreground" />
              <div>
                <Label htmlFor="conta-file" className="text-sm font-medium text-primary cursor-pointer hover:underline">
                  Selecionar PDF da conta
                </Label>
                <input
                  id="conta-file"
                  type="file"
                  accept=".pdf,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />
                <p className="text-xs text-muted-foreground mt-1">PDF ou TXT • Máx 10MB</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Ou cole o texto da conta:</Label>
              <Textarea
                placeholder="Cole o texto copiado da conta de energia..."
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                rows={6}
                className="text-xs font-mono"
              />
              <Button
                onClick={handleManualSubmit}
                disabled={loading || manualText.trim().length < 20}
                className="w-full gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                Analisar Texto
              </Button>
            </div>
            {loading && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Extraindo dados da conta...
              </div>
            )}
          </div>
        )}

        {/* ── Step: Review ─────────────────────────────────────── */}
        {step === "review" && extractedData && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Confiança:</span>
              <Badge
                variant="outline"
                className={`text-xs ${
                  extractedData.confidence >= 70 ? "bg-success/10 text-success border-success/30" :
                  extractedData.confidence >= 40 ? "bg-warning/10 text-warning border-warning/30" :
                  "bg-destructive/10 text-destructive border-destructive/30"
                }`}
              >
                {extractedData.confidence >= 70 ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <AlertTriangle className="w-3 h-3 mr-1" />}
                {extractedData.confidence}%
              </Badge>
            </div>

            <Section icon={<Zap className="w-4 h-4" />} title="Concessionária">
              <FieldRow label="Nome" value={extractedData.concessionaria_nome} />
              <FieldRow label="Cidade" value={extractedData.cidade} />
              <FieldRow label="Estado" value={extractedData.estado} />
              <FieldRow label="Referência" value={extractedData.mes_referencia} />
            </Section>

            <Section icon={<Receipt className="w-4 h-4" />} title="Tarifas Extraídas">
              <FieldRow label="Consumo" value={extractedData.consumo_kwh != null ? `${extractedData.consumo_kwh} kWh` : null} />
              <FieldRow label="TE" value={extractedData.tarifa_energia_kwh != null ? `R$ ${extractedData.tarifa_energia_kwh.toFixed(6)}/kWh` : null} highlight />
              <FieldRow label="TUSD/Fio B" value={extractedData.tarifa_fio_b_kwh != null ? `R$ ${extractedData.tarifa_fio_b_kwh.toFixed(6)}/kWh` : null} highlight />
              <FieldRow label="Valor Total" value={extractedData.valor_total != null ? `R$ ${extractedData.valor_total.toFixed(2)}` : null} />
            </Section>

            <Section icon={<ShieldCheck className="w-4 h-4" />} title="Impostos">
              <FieldRow label="ICMS" value={extractedData.icms_percentual != null ? `${extractedData.icms_percentual}%` : null} />
              <FieldRow label="PIS" value={extractedData.pis_valor != null ? `R$ ${extractedData.pis_valor.toFixed(2)}` : null} />
              <FieldRow label="COFINS" value={extractedData.cofins_valor != null ? `R$ ${extractedData.cofins_valor.toFixed(2)}` : null} />
            </Section>

            <div className="rounded-lg bg-muted/30 border border-border/40 p-3 text-xs text-muted-foreground">
              ⚠️ Revise os valores. Os dados são extraídos por regex e podem conter imprecisões.
            </div>
          </div>
        )}

        {/* ── Step: Match ──────────────────────────────────────── */}
        {step === "match" && (
          <div className="space-y-4">
            {autoMatched && (
              <div className="rounded-lg bg-success/5 border border-success/20 p-3 text-xs text-success flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Concessionária identificada automaticamente
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Selecione a concessionária para atualizar:</Label>
              <Select value={selectedConcId} onValueChange={setSelectedConcId}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {concessionarias.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        <Building className="w-3 h-3 text-muted-foreground" />
                        {c.nome}
                        {c.estado && <span className="text-muted-foreground text-[10px]">({c.estado})</span>}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {extractedData?.cidade && (
              <div className="text-xs text-muted-foreground">
                <Search className="w-3 h-3 inline mr-1" />
                Conta de: <strong>{extractedData.cidade}</strong>
                {extractedData.estado && ` — ${extractedData.estado}`}
                {extractedData.concessionaria_nome && ` (${extractedData.concessionaria_nome})`}
              </div>
            )}
          </div>
        )}

        {/* ── Step: Diff ───────────────────────────────────────── */}
        {step === "diff" && (
          <div className="space-y-4">
            <div className="text-xs text-muted-foreground mb-2">
              Marque os campos que deseja atualizar na concessionária <strong>{concessionarias.find(c => c.id === selectedConcId)?.nome}</strong>:
            </div>

            {diffFields.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                Nenhum campo para atualizar — os dados da conta não contêm tarifas válidas.
              </div>
            ) : (
              <div className="space-y-2">
                {diffFields.map((f, idx) => {
                  const changed = f.current != null && f.extracted != null && Math.abs(f.current - f.extracted) > 0.000001;
                  const isNew = f.current == null && f.extracted != null;
                  return (
                    <div
                      key={f.field}
                      className={`rounded-lg border p-3 flex items-center gap-3 transition-colors ${
                        f.enabled ? "border-primary/30 bg-primary/5" : "border-border/40 bg-muted/20 opacity-60"
                      }`}
                    >
                      <Switch checked={f.enabled} onCheckedChange={() => toggleField(idx)} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium">{f.label}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[11px] font-mono ${changed ? "text-muted-foreground line-through" : "text-muted-foreground"}`}>
                            {fmt(f.current, f.decimals, f.unit)}
                          </span>
                          <ArrowRight className="w-3 h-3 text-primary shrink-0" />
                          <span className={`text-[11px] font-mono font-semibold ${changed || isNew ? "text-primary" : "text-foreground"}`}>
                            {fmt(f.extracted, f.decimals, f.unit)}
                          </span>
                          {isNew && <Badge variant="outline" className="text-[9px] h-4 px-1 bg-success/10 text-success border-success/30">Novo</Badge>}
                          {changed && !isNew && <Badge variant="outline" className="text-[9px] h-4 px-1 bg-warning/10 text-warning border-warning/30">Alterado</Badge>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="rounded-lg bg-info/5 border border-info/20 p-3 text-xs text-info">
              💡 Também será atualizado o subgrupo B1 com os novos valores de TE e TUSD.
            </div>
          </div>
        )}

        {/* ── Step: Done ───────────────────────────────────────── */}
        {step === "done" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <CheckCircle2 className="w-12 h-12 text-success" />
            <p className="text-sm font-semibold">Concessionária atualizada com sucesso!</p>
            <p className="text-xs text-muted-foreground text-center">
              Os novos valores já estão disponíveis para geração de propostas.
            </p>
          </div>
        )}

        {/* ── Footer ───────────────────────────────────────────── */}
        <DialogFooter className="gap-2">
          {step === "review" && (
            <>
              <Button variant="outline" onClick={() => { setStep("upload"); setExtractedData(null); }}>Voltar</Button>
              <Button onClick={proceedToMatch} className="gap-2">
                <ArrowRight className="w-4 h-4" />
                Selecionar Concessionária
              </Button>
            </>
          )}
          {step === "match" && (
            <>
              <Button variant="outline" onClick={() => setStep("review")}>Voltar</Button>
              <Button onClick={proceedToDiff} disabled={!selectedConcId} className="gap-2">
                <ArrowRight className="w-4 h-4" />
                Comparar Valores
              </Button>
            </>
          )}
          {step === "diff" && (
            <>
              <Button variant="outline" onClick={() => setStep("match")}>Voltar</Button>
              <Button
                onClick={handleUpdate}
                disabled={updating || diffFields.filter(f => f.enabled).length === 0}
                className="gap-2"
              >
                {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Atualizar {diffFields.filter(f => f.enabled).length} campo(s)
              </Button>
            </>
          )}
          {step === "done" && (
            <Button onClick={() => { onOpenChange(false); resetState(); }}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Sub-components ────────────────────────────────────────────────

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/50 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold">{icon}{title}</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">{children}</div>
    </div>
  );
}

function FieldRow({ label, value, highlight }: { label: string; value: string | null; highlight?: boolean }) {
  return (
    <>
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className={`text-[11px] font-mono ${value ? (highlight ? "text-primary font-semibold" : "text-foreground") : "text-muted-foreground/50 italic"}`}>
        {value || "não detectado"}
      </span>
    </>
  );
}
