import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Battery, Globe, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface Bateria {
  id: string;
  fabricante: string;
  modelo: string;
  tipo_bateria: string | null;
  energia_kwh: number | null;
  dimensoes_mm: string | null;
  tensao_operacao_v: string | null;
  tensao_carga_v: number | null;
  tensao_nominal_v: number | null;
  potencia_max_saida_kw: number | null;
  corrente_max_descarga_a: number | null;
  corrente_max_carga_a: number | null;
  correntes_recomendadas_a: string | null;
  ativo: boolean;
  tenant_id?: string | null;
}

interface Props {
  bateria: Bateria | null;
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

function calcCompletudeBateria(b: Bateria): number {
  const fields = [
    b.fabricante, b.modelo, b.tipo_bateria, b.energia_kwh,
    b.tensao_nominal_v, b.potencia_max_saida_kw,
    b.corrente_max_descarga_a, b.corrente_max_carga_a, b.dimensoes_mm,
  ];
  const filled = fields.filter(f => f != null && f !== "").length;
  return Math.round((filled / fields.length) * 100);
}

export function BateriaViewModal({ bateria: b, open, onOpenChange }: Props) {
  if (!b) return null;

  const completude = calcCompletudeBateria(b);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-4xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Battery className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">{b.fabricante} {b.modelo}</DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {b.energia_kwh ? `${b.energia_kwh} kWh` : "—"} · {b.tipo_bateria || "Bateria"}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge className={b.ativo ? "bg-success/15 text-success border-success/20" : "bg-muted text-muted-foreground border-border"}>
              {b.ativo ? "Ativo" : "Inativo"}
            </Badge>
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
                <Field label="Fabricante" value={b.fabricante} />
                <Field label="Modelo" value={b.modelo} />
                <Field label="Tipo" value={b.tipo_bateria} />
              </Section>

              <Section title="Energia">
                <Field label="Capacidade" value={b.energia_kwh} unit=" kWh" />
                <Field label="Tensão nominal" value={b.tensao_nominal_v} unit=" V" />
                <Field label="Tensão operação" value={b.tensao_operacao_v} />
                <Field label="Tensão carga" value={b.tensao_carga_v} unit=" V" />
              </Section>
            </div>

            {/* Coluna direita */}
            <div className="flex flex-col gap-4">
              <Section title="Potência & Correntes">
                <Field label="Potência máx saída" value={b.potencia_max_saida_kw} unit=" kW" />
                <Field label="Corrente máx descarga" value={b.corrente_max_descarga_a} unit=" A" />
                <Field label="Corrente máx carga" value={b.corrente_max_carga_a} unit=" A" />
                <Field label="Correntes recomendadas" value={b.correntes_recomendadas_a} />
              </Section>

              <Section title="Físico">
                <Field label="Dimensões" value={b.dimensoes_mm} />
              </Section>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
