import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Star } from "lucide-react";

export type PropostaBadgeType = "gerada" | "aceita" | "principal" | "gerado" | "enviada" | "rascunho" | "migrada" | "desatualizada" | "aguardando_aceite";

interface PropostaBadgeProps {
  type: PropostaBadgeType;
  className?: string;
  inconsistent?: boolean;
}


const TOOLTIPS: Record<string, string> = {
  gerada: "Proposta gerada automaticamente pelo sistema",
  aceita: "Cliente aceitou esta proposta formalmente",
  aguardando_aceite: "Proposta enviada, aguardando aceite formal do cliente",
  principal: "Proposta principal deste projeto — valor usado no kanban",
  gerado: "Documento gerado e disponível para envio",
  enviada: "Proposta enviada ao cliente aguardando resposta",
  rascunho: "Proposta em edição, não enviada ao cliente",
  migrada: "Proposta importada do sistema SolarMarket",
  desatualizada: "Esta proposta possui uma versão mais recente",
};

const LABELS: Record<string, string | React.ReactNode> = {
  gerada: "Gerada",
  aceita: "Aceita",
  aguardando_aceite: "Aguardando aceite",
  principal: (
    <>
      <Star className="h-2.5 w-2.5 inline mr-0.5 -mt-0.5" />
      Principal
    </>
  ),
  gerado: "Gerado",
  enviada: "Enviada",
  rascunho: "Rascunho",
  migrada: "Migrada SM",
  desatualizada: "Desatualizada",
};

const STYLES: Record<string, string> = {
  gerada: "bg-info/10 text-info border-info/30",
  aceita: "bg-success/10 text-success border-success/30",
  aguardando_aceite: "bg-warning/10 text-warning border-warning/30",
  principal: "bg-warning/10 text-warning",
  gerado: "bg-success/10 text-success border-success/30",
  enviada: "bg-primary/10 text-primary border-primary/30",
  rascunho: "bg-muted text-muted-foreground",
  migrada: "bg-warning/10 text-warning border-warning/30",
  desatualizada: "bg-warning/10 text-warning border-warning/20",
};


import { AlertTriangle } from "lucide-react";

export function PropostaBadge({ type, className, inconsistent }: PropostaBadgeProps) {
  const label = LABELS[type];
  const tooltip = type === "aceita" && inconsistent 
    ? "Status indica aceito mas falta evidência formal (data/token). Auditoria necessária." 
    : TOOLTIPS[type];
  const style = type === "aceita" && inconsistent 
    ? "bg-destructive/10 text-destructive border-destructive/30 animate-pulse" 
    : STYLES[type];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={cn(
              "text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap cursor-default gap-1",
              style,
              className
            )}
          >
            {type === "aceita" && inconsistent && <AlertTriangle className="h-2.5 w-2.5" />}
            {label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs max-w-[200px]">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

