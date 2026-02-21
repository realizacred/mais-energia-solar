import { useState, useCallback } from "react";
import { FileUp, Loader2, CheckCircle2, AlertTriangle, Zap, Receipt, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDataExtracted?: (data: ExtractedData) => void;
}

export function ImportContaEnergiaDialog({ open, onOpenChange, onDataExtracted }: Props) {
  const [step, setStep] = useState<"upload" | "review">("upload");
  const [loading, setLoading] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [rawText, setRawText] = useState("");
  const [manualText, setManualText] = useState("");

  const resetState = useCallback(() => {
    setStep("upload");
    setLoading(false);
    setExtractedData(null);
    setRawText("");
    setManualText("");
  }, []);

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file) return;

    // For now, we read PDF as text. Most Brazilian energy bills have selectable text.
    // If the PDF is image-based, we'll fall back to manual text input.
    setLoading(true);

    try {
      const text = await file.text();
      
      // Check if we got useful text
      if (text.length < 50 || !/[a-zA-Z]{3,}/g.test(text)) {
        toast.info("PDF sem texto selecionável", {
          description: "Cole o texto da conta manualmente no campo abaixo.",
        });
        setStep("upload");
        setLoading(false);
        return;
      }

      setRawText(text);
      await processText(text);
    } catch (err) {
      console.error("Error reading file:", err);
      toast.error("Erro ao ler arquivo", {
        description: "Tente colar o texto da conta manualmente.",
      });
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

  const handleConfirm = () => {
    if (extractedData && onDataExtracted) {
      onDataExtracted(extractedData);
    }
    toast.success("Dados da conta extraídos com sucesso");
    onOpenChange(false);
    resetState();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetState(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="w-5 h-5 text-primary" />
            Importar Conta de Energia
          </DialogTitle>
          <DialogDescription>
            Faça upload de uma conta de luz em PDF ou cole o texto para extrair tarifas e dados automaticamente.
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            {/* File upload */}
            <div className="border-2 border-dashed border-border/60 rounded-xl p-6 text-center space-y-3 hover:border-primary/40 transition-colors">
              <FileUp className="w-8 h-8 mx-auto text-muted-foreground" />
              <div>
                <Label
                  htmlFor="conta-file"
                  className="text-sm font-medium text-primary cursor-pointer hover:underline"
                >
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

            {/* Manual text input */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">
                Ou cole o texto da conta aqui:
              </Label>
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
          </div>
        )}

        {step === "review" && extractedData && (
          <div className="space-y-4">
            {/* Confidence badge */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Confiança da extração:</span>
              <Badge
                variant={extractedData.confidence >= 50 ? "default" : "secondary"}
                className={`text-xs ${
                  extractedData.confidence >= 70 ? "bg-success/20 text-success border-success/30" :
                  extractedData.confidence >= 40 ? "bg-warning/20 text-warning border-warning/30" :
                  "bg-destructive/20 text-destructive border-destructive/30"
                }`}
              >
                {extractedData.confidence >= 70 ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <AlertTriangle className="w-3 h-3 mr-1" />}
                {extractedData.confidence}%
              </Badge>
            </div>

            {/* Concessionária */}
            <Section icon={<Zap className="w-4 h-4" />} title="Concessionária">
              <FieldRow label="Nome" value={extractedData.concessionaria_nome} />
              <FieldRow label="Cidade" value={extractedData.cidade} />
              <FieldRow label="Estado" value={extractedData.estado} />
              <FieldRow label="Classe" value={extractedData.classe_consumo} />
              <FieldRow label="Tipo ligação" value={extractedData.tipo_ligacao} />
              <FieldRow label="Referência" value={extractedData.mes_referencia} />
            </Section>

            {/* Tarifas */}
            <Section icon={<Receipt className="w-4 h-4" />} title="Tarifas Extraídas">
              <FieldRow label="Consumo" value={extractedData.consumo_kwh != null ? `${extractedData.consumo_kwh} kWh` : null} />
              <FieldRow label="Tarifa Energia (TE)" value={extractedData.tarifa_energia_kwh != null ? `R$ ${extractedData.tarifa_energia_kwh.toFixed(6)}/kWh` : null} highlight />
              <FieldRow label="TUSD / Fio B" value={extractedData.tarifa_fio_b_kwh != null ? `R$ ${extractedData.tarifa_fio_b_kwh.toFixed(6)}/kWh` : null} highlight />
              <FieldRow label="Valor Total" value={extractedData.valor_total != null ? `R$ ${extractedData.valor_total.toFixed(2)}` : null} />
              <FieldRow label="Demanda" value={extractedData.demanda_contratada_kw != null ? `${extractedData.demanda_contratada_kw} kW` : null} />
              <FieldRow label="Bandeira" value={extractedData.bandeira_tarifaria} />
            </Section>

            {/* Impostos */}
            <Section icon={<ShieldCheck className="w-4 h-4" />} title="Impostos">
              <FieldRow label="ICMS" value={extractedData.icms_percentual != null ? `${extractedData.icms_percentual}%` : null} />
              <FieldRow label="PIS" value={extractedData.pis_valor != null ? `R$ ${extractedData.pis_valor.toFixed(2)}` : null} />
              <FieldRow label="COFINS" value={extractedData.cofins_valor != null ? `R$ ${extractedData.cofins_valor.toFixed(2)}` : null} />
            </Section>

            <div className="rounded-lg bg-muted/30 border border-border/40 p-3 text-xs text-muted-foreground">
              <p>⚠️ Revise os valores antes de confirmar. Os dados são extraídos por regex e podem conter imprecisões.</p>
            </div>
          </div>
        )}

        {step === "review" && (
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setStep("upload"); setExtractedData(null); }}>
              Voltar
            </Button>
            <Button onClick={handleConfirm} className="gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Confirmar Dados
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Helper components ────────────────────────────────────────────────────────

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/50 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {children}
      </div>
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
