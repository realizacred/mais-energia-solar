import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Props {
  temperamento: "quente" | "morno" | "frio" | "congelado";
  urgenciaScore?: number;
  className?: string;
}

const CONFIG: Record<string, { label: string; className: string; icon: string }> = {
  quente: {
    label: "Quente",
    className: "bg-destructive/10 text-destructive border-destructive/20",
    icon: "🔥",
  },
  morno: {
    label: "Morno",
    className: "bg-warning/10 text-warning border-warning/20",
    icon: "🌡️",
  },
  frio: {
    label: "Frio",
    className: "bg-info/10 text-info border-info/20",
    icon: "❄️",
  },
  congelado: {
    label: "Congelado",
    className: "bg-muted text-muted-foreground border-border",
    icon: "🧊",
  },
};

export function IntelligenceBadge({ temperamento, urgenciaScore, className }: Props) {
  const cfg = CONFIG[temperamento] || CONFIG.frio;

  return (
    <Badge variant="outline" className={cn("text-[10px] gap-1", cfg.className, className)}>
      {cfg.icon} {cfg.label}
      {urgenciaScore !== undefined && (
        <span className="ml-0.5 opacity-70">({urgenciaScore})</span>
      )}
    </Badge>
  );
}
