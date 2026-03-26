import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Package, Globe, Building2, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { Modulo } from "./types";
import { STATUS_LABELS } from "./types";
import { calcCompletude } from "@/utils/calcCompletude";

interface Props {
  modulo: Modulo | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

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

export function ModuloViewModal({ modulo: m, open, onOpenChange }: Props) {
  if (!m) return null;

  const statusInfo = STATUS_LABELS[m.status] || STATUS_LABELS.rascunho;
  const isGlobal = m.tenant_id === null;
  const completude = calcCompletude(m);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-4xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">{m.fabricante} {m.modelo}</DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {m.potencia_wp}Wp · {m.tipo_celula}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
            {m.bifacial && <Badge variant="outline">Bifacial</Badge>}
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
                <Field label="Fabricante" value={m.fabricante} />
                <Field label="Modelo" value={m.modelo} />
                <Field label="Tipo de célula" value={m.tipo_celula} />
                <Field label="Nº de células" value={m.num_celulas} />
                <Field label="Bifacial" value={m.bifacial ? "Sim" : "Não"} />
                <Field label="Tensão do sistema" value={m.tensao_sistema} />
              </Section>

              <Section title="Elétrico DC (STC)">
                <Field label="Vmp" value={m.vmp_v} unit=" V" />
                <Field label="Imp" value={m.imp_a} unit=" A" />
                <Field label="Voc" value={m.voc_v} unit=" V" />
                <Field label="Isc" value={m.isc_a} unit=" A" />
              </Section>

              <Section title="Coeficientes Térmicos">
                <Field label="Pmax" value={m.temp_coeff_pmax} unit=" %/°C" />
                <Field label="Voc" value={m.temp_coeff_voc} unit=" %/°C" />
                <Field label="Isc" value={m.temp_coeff_isc} unit=" %/°C" />
              </Section>
            </div>

            {/* Coluna direita */}
            <div className="flex flex-col gap-4">
              <Section title="Potência & Eficiência">
                <Field label="Potência" value={m.potencia_wp} unit=" Wp" />
                <Field label="Eficiência" value={m.eficiencia_percent} unit="%" />
                <Field label="Área" value={m.area_m2} unit=" m²" />
              </Section>

              <Section title="Físico">
                <Field label="Comprimento" value={m.comprimento_mm} unit=" mm" />
                <Field label="Largura" value={m.largura_mm} unit=" mm" />
                <Field label="Profundidade" value={m.profundidade_mm} unit=" mm" />
                <Field label="Peso" value={m.peso_kg} unit=" kg" />
              </Section>

              <Section title="Garantia & Datasheet">
                <Field label="Garantia produto" value={m.garantia_produto_anos} unit=" anos" />
                <Field label="Garantia performance" value={m.garantia_performance_anos} unit=" anos" />
                {m.datasheet_url ? (
                  <div className="pt-2">
                    <Button variant="outline" size="sm" className="w-full gap-2" asChild>
                      <a href={m.datasheet_url} target="_blank" rel="noopener noreferrer">
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
