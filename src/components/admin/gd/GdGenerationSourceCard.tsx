/**
 * GdGenerationSourceCard — Shows the generation source info for a GD snapshot.
 */
import { Badge } from "@/components/ui/badge";
import { Gauge, Radio, FileText, AlertTriangle, ShieldCheck, ShieldAlert, Shield } from "lucide-react";
import type { GdMonthlySnapshot } from "@/services/energia/gdEnergyEngine";

interface Props {
  snapshot: GdMonthlySnapshot;
}

const SOURCE_LABELS: Record<string, { label: string; icon: typeof Gauge; description: string }> = {
  meter: { label: "Medidor", icon: Gauge, description: "Geração calculada via medidor bidirecional" },
  monitoring: { label: "Monitoramento", icon: Radio, description: "Geração via telemetria da usina" },
  invoice: { label: "Fatura", icon: FileText, description: "Geração estimada via fatura da UC geradora" },
  missing: { label: "Não encontrado", icon: AlertTriangle, description: "Sem fonte de geração para este mês" },
};

const CONFIDENCE_LABELS: Record<string, { label: string; icon: typeof ShieldCheck; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  high: { label: "Alta", icon: ShieldCheck, variant: "default" },
  medium: { label: "Média", icon: Shield, variant: "secondary" },
  low: { label: "Baixa", icon: ShieldAlert, variant: "outline" },
  missing: { label: "Indisponível", icon: AlertTriangle, variant: "destructive" },
};

export function GdGenerationSourceCard({ snapshot }: Props) {
  const sourceType = snapshot.generation_source_type || "missing";
  const confidence = snapshot.generation_source_confidence || "missing";
  const sourceInfo = SOURCE_LABELS[sourceType] || SOURCE_LABELS.missing;
  const confInfo = CONFIDENCE_LABELS[confidence] || CONFIDENCE_LABELS.missing;
  const SourceIcon = sourceInfo.icon;
  const ConfIcon = confInfo.icon;

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0">
            <SourceIcon className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">Fonte: {sourceInfo.label}</p>
            <p className="text-[11px] text-muted-foreground">{sourceInfo.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={confInfo.variant} className="text-[10px] gap-1">
            <ConfIcon className="w-3 h-3" />
            Confiabilidade: {confInfo.label}
          </Badge>
        </div>
      </div>
      {snapshot.generation_source_notes && (
        <p className="text-[11px] text-muted-foreground mt-2 pl-10">
          {snapshot.generation_source_notes}
        </p>
      )}
    </div>
  );
}
