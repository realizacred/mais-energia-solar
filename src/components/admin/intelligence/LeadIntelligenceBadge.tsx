import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface LeadIntelligenceBadgeProps {
  temperamento: "quente" | "morno" | "frio" | "congelado" | null;
  urgenciaScore: number | null;
  dorPrincipal: string | null;
  ultimaAnalise?: string | null;
}

const TEMP_CONFIG: Record<string, { icon: string; className: string }> = {
  quente: { icon: "🔥", className: "bg-destructive/10 text-destructive border-destructive/20" },
  morno: { icon: "🟡", className: "bg-warning/10 text-warning border-warning/20" },
  frio: { icon: "❄️", className: "bg-info/10 text-info border-info/20" },
  congelado: { icon: "🧊", className: "bg-muted text-muted-foreground border-border" },
};

const DOR_ICONS: Record<string, string> = {
  preco: "💰",
  tempo: "⏰",
  confianca: "🤝",
  concorrencia: "🏢",
  desconhecimento: "❓",
};

export function LeadIntelligenceBadge({ temperamento, urgenciaScore, dorPrincipal, ultimaAnalise }: LeadIntelligenceBadgeProps) {
  if (!temperamento && urgenciaScore == null) return null;

  const tempCfg = temperamento ? TEMP_CONFIG[temperamento] : null;
  const dorIcon = dorPrincipal ? DOR_ICONS[dorPrincipal] || "📋" : null;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex flex-col gap-0.5">
            {tempCfg && urgenciaScore != null && (
              <Badge variant="outline" className={`text-[10px] gap-1 ${tempCfg.className}`}>
                {tempCfg.icon} {urgenciaScore}/100
              </Badge>
            )}
            {dorIcon && dorPrincipal && (
              <Badge variant="outline" className="text-[10px] gap-1">
                {dorIcon} {dorPrincipal}
              </Badge>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs max-w-[200px]">
          <p className="font-medium capitalize">{temperamento || "Sem análise"}</p>
          {urgenciaScore != null && <p>Urgência: {urgenciaScore}/100</p>}
          {dorPrincipal && <p>Dor: {dorPrincipal}</p>}
          {ultimaAnalise && <p className="text-muted-foreground">Análise: {new Date(ultimaAnalise).toLocaleDateString("pt-BR")}</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
