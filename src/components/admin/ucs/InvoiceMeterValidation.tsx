/**
 * InvoiceMeterValidation — Cross-validation panel for invoice vs meter readings.
 * Used inside the expanded detail row of UCInvoicesTab.
 */
import { useQuery } from "@tanstack/react-query";
import { compareFaturaVsMedidor, type FaturaVsMedidorResult, type ValidationStatus } from "@/services/energia/faturaVsMedidorService";
import { formatDecimalBR } from "@/lib/formatters";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, XCircle, Gauge } from "lucide-react";

const STATUS_CONFIG: Record<ValidationStatus, { label: string; badgeClass: string; textClass: string; icon: React.ElementType }> = {
  ok: {
    label: "OK",
    badgeClass: "bg-success/10 text-success border-success/20",
    textClass: "text-success",
    icon: CheckCircle2,
  },
  atencao: {
    label: "Atenção",
    badgeClass: "bg-warning/10 text-warning border-warning/20",
    textClass: "text-warning",
    icon: AlertTriangle,
  },
  critico: {
    label: "Crítico",
    badgeClass: "bg-destructive/10 text-destructive border-destructive/20",
    textClass: "text-destructive",
    icon: XCircle,
  },
};

interface Props {
  unitId: string;
  referenceMonth: number;
  referenceYear: number;
}

export function InvoiceMeterValidation({ unitId, referenceMonth, referenceYear }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["fatura-vs-medidor", unitId, referenceMonth, referenceYear],
    queryFn: () => compareFaturaVsMedidor(unitId, referenceMonth, referenceYear),
    staleTime: 1000 * 60 * 5,
    enabled: !!unitId && !!referenceMonth && !!referenceYear,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!data || !data.has_meter) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Gauge className="w-3.5 h-3.5" />
        <span>UC sem medidor vinculado — validação cruzada indisponível</span>
      </div>
    );
  }

  if (!data.has_invoice) {
    return null;
  }

  const cfg = STATUS_CONFIG[data.status];
  const Icon = cfg.icon;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <p className="text-xs font-semibold text-foreground">Validação Cruzada Medidor</p>
        <Badge variant="outline" className={`text-[10px] ${cfg.badgeClass}`}>
          <Icon className="w-3 h-3 mr-1" />
          {cfg.label}
        </Badge>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="space-y-0.5">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Consumo Fatura</p>
          <p className="text-sm font-medium text-foreground">{formatDecimalBR(data.consumo_fatura, 1)} kWh</p>
        </div>
        <div className="space-y-0.5">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Consumo Medidor</p>
          <p className="text-sm font-medium text-foreground">{formatDecimalBR(data.consumo_medidor, 1)} kWh</p>
        </div>
        <div className="space-y-0.5">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Divergência Consumo</p>
          <p className={`text-sm font-semibold ${cfg.textClass}`}>{data.divergencia_consumo_percent.toFixed(1)}%</p>
        </div>
        <div className="space-y-0.5">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Injeção Fatura</p>
          <p className="text-sm font-medium text-foreground">{formatDecimalBR(data.injecao_fatura, 1)} kWh</p>
        </div>
        <div className="space-y-0.5">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Injeção Medidor</p>
          <p className="text-sm font-medium text-foreground">{formatDecimalBR(data.injecao_medidor, 1)} kWh</p>
        </div>
        <div className="space-y-0.5">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Divergência Injeção</p>
          <p className={`text-sm font-semibold ${cfg.textClass}`}>{data.divergencia_injecao_percent.toFixed(1)}%</p>
        </div>
      </div>
    </div>
  );
}
