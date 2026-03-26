import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Cpu, Globe, Building2, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { type Inversor } from "@/hooks/useInversoresCatalogo";
import { calcCompletudeInversor } from "@/utils/calcCompletudeInversor";

interface Props {
  inversor: Inversor | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  rascunho: { label: "Rascunho", color: "bg-warning/15 text-warning border-warning/20" },
  revisao: { label: "Revisão", color: "bg-info/15 text-info border-info/20" },
  publicado: { label: "Publicado", color: "bg-success/15 text-success border-success/20" },
};

function Field({ label, value, unit }: { label: string; value: string | number | null | undefined; unit?: string }) {
  const display = value != null && value !== "" ? `${value}${unit || ""}` : "—";
  return (
    <div className="flex justify-between py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{display}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{title}</h4>
      <div className="rounded-lg border bg-card p-3">{children}</div>
    </div>
  );
}

export function InversorViewModal({ inversor: inv, open, onOpenChange }: Props) {
  if (!inv) return null;

  const statusInfo = STATUS_LABELS[inv.status] || STATUS_LABELS.rascunho;
  const isGlobal = inv.tenant_id === null;
  const completude = calcCompletudeInversor(inv);
  const formatPotencia = (kw: number) => kw < 1 ? `${(kw * 1000).toFixed(0)} W` : `${kw} kW`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-4xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Cpu className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">{inv.fabricante} {inv.modelo}</DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatPotencia(inv.potencia_nominal_kw)} · {inv.fases} · {inv.tipo}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
            {isGlobal ? (
              <Badge variant="secondary" className="gap-1 text-xs"><Globe className="w-3 h-3" /> Global</Badge>
            ) : (
              <Badge variant="default" className="gap-1 text-xs"><Building2 className="w-3 h-3" /> Custom</Badge>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto max-h-[85vh] p-5">
          {/* Completude */}
          <div className="space-y-1.5 mb-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Completude do cadastro</span>
              <span className={`text-xs font-bold ${completude === 100 ? "text-success" : completude >= 70 ? "text-warning" : "text-destructive"}`}>
                {completude}%
              </span>
            </div>
            <Progress value={completude} className="h-2" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Coluna esquerda */}
            <div className="flex flex-col gap-4">
              <Section title="Identificação">
                <Field label="Fabricante" value={inv.fabricante} />
                <Field label="Modelo" value={inv.modelo} />
                <Field label="Tipo" value={inv.tipo} />
                <Field label="Fases" value={inv.fases} />
              </Section>

              <Section title="Entrada DC">
                <Field label="Tensão máx entrada" value={inv.tensao_entrada_max_v} unit=" V" />
                <Field label="Corrente máx entrada" value={inv.corrente_entrada_max_a} unit=" A" />
                <Field label="Tensão MPPT mín" value={inv.tensao_mppt_min_v} unit=" V" />
                <Field label="Tensão MPPT máx" value={inv.tensao_mppt_max_v} unit=" V" />
              </Section>

              <Section title="MPPTs">
                <Field label="Nº de MPPTs" value={inv.mppt_count} />
                <Field label="Strings/MPPT" value={inv.strings_por_mppt} />
              </Section>
            </div>

            {/* Coluna direita */}
            <div className="flex flex-col gap-4">
              <Section title="Saída AC">
                <Field label="Potência nominal" value={inv.potencia_nominal_kw} unit=" kW" />
                <Field label="Potência máxima" value={inv.potencia_maxima_kw} unit=" kW" />
                <Field label="Tensão saída" value={inv.tensao_saida_v} unit=" V" />
                <Field label="Corrente saída" value={inv.corrente_saida_a} unit=" A" />
                <Field label="Fator de potência" value={inv.fator_potencia} />
                <Field label="Eficiência máx" value={inv.eficiencia_max_percent} unit="%" />
              </Section>

              <Section title="Físico">
                <Field label="Dimensões" value={inv.dimensoes_mm} />
                <Field label="Peso" value={inv.peso_kg} unit=" kg" />
                <Field label="Proteção IP" value={inv.ip_protection} />
                <Field label="Wi-Fi integrado" value={inv.wifi_integrado ? "Sim" : "Não"} />
              </Section>

              <Section title="Garantia & Datasheet">
                <Field label="Garantia" value={inv.garantia_anos} unit=" anos" />
                {inv.datasheet_url ? (
                  <div className="pt-2">
                    <Button variant="outline" size="sm" className="w-full gap-2" asChild>
                      <a href={inv.datasheet_url} target="_blank" rel="noopener noreferrer">
                        <FileText className="w-4 h-4" /> Abrir datasheet (PDF)
                      </a>
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-2">Sem datasheet anexado.</p>
                )}
              </Section>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
