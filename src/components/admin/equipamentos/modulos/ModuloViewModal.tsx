import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FileText, ExternalLink } from "lucide-react";
import type { Modulo } from "./types";
import { STATUS_LABELS } from "./types";

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
  const dims = m.comprimento_mm && m.largura_mm
    ? `${m.comprimento_mm} × ${m.largura_mm}${m.profundidade_mm ? ` × ${m.profundidade_mm}` : ""} mm`
    : null;
  const tempCoeffs = [m.temp_coeff_pmax, m.temp_coeff_voc, m.temp_coeff_isc].some(v => v != null)
    ? `${m.temp_coeff_pmax ?? "—"} / ${m.temp_coeff_voc ?? "—"} / ${m.temp_coeff_isc ?? "—"}`
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <DialogTitle className="text-lg">{m.fabricante} {m.modelo}</DialogTitle>
            <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
            {m.bifacial && <Badge variant="outline">Bifacial</Badge>}
          </div>
          <p className="text-sm text-muted-foreground mt-1">{m.potencia_wp}Wp · {m.tipo_celula}</p>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Identificação */}
          <Section title="Identificação">
            <Field label="Fabricante" value={m.fabricante} />
            <Field label="Modelo" value={m.modelo} />
            <Field label="Tensão do sistema" value={m.tensao_sistema} />
          </Section>

          {/* Elétrico */}
          <Section title="Elétrico (STC)">
            <Field label="Potência" value={m.potencia_wp} unit=" Wp" />
            <Field label="Vmp" value={m.vmp_v} unit=" V" />
            <Field label="Imp" value={m.imp_a} unit=" A" />
            <Field label="Voc" value={m.voc_v} unit=" V" />
            <Field label="Isc" value={m.isc_a} unit=" A" />
          </Section>

          {/* Construção */}
          <Section title="Construção">
            <Field label="Tipo de célula" value={m.tipo_celula} />
            <Field label="Nº de células" value={m.num_celulas} />
            <Field label="Dimensões" value={dims} />
            <Field label="Peso" value={m.peso_kg} unit=" kg" />
            <Field label="Área" value={m.area_m2} unit=" m²" />
          </Section>

          {/* Temperatura */}
          <Section title="Coeficientes de Temperatura">
            <Field label="Pmax / Voc / Isc" value={tempCoeffs} />
            <Field label="Pmax" value={m.temp_coeff_pmax} unit=" %/°C" />
            <Field label="Voc" value={m.temp_coeff_voc} unit=" %/°C" />
            <Field label="Isc" value={m.temp_coeff_isc} unit=" %/°C" />
          </Section>

          {/* Performance */}
          <Section title="Performance">
            <Field label="Eficiência" value={m.eficiencia_percent} unit="%" />
            <Field label="Garantia produto" value={m.garantia_produto_anos} unit=" anos" />
            <Field label="Garantia performance" value={m.garantia_performance_anos} unit=" anos" />
          </Section>

          {/* Datasheet */}
          <Section title="Datasheet">
            {m.datasheet_url ? (
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="w-full gap-2" asChild>
                  <a href={m.datasheet_url} target="_blank" rel="noopener noreferrer">
                    <FileText className="w-4 h-4" /> Abrir datasheet (PDF)
                  </a>
                </Button>
                {m.datasheet_source_url && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <ExternalLink className="w-3 h-3" />
                    <a href={m.datasheet_source_url} target="_blank" rel="noopener noreferrer" className="truncate hover:underline">
                      {m.datasheet_source_url}
                    </a>
                  </div>
                )}
                {m.datasheet_found_at && (
                  <p className="text-xs text-muted-foreground">
                    Encontrado em: {new Date(m.datasheet_found_at).toLocaleDateString("pt-BR")}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-2">
                Sem datasheet anexado. Edite o módulo para anexar ou buscar.
              </p>
            )}
          </Section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
