import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { UserCheck, ArrowRightLeft, Clock, Loader2, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { LeadOwnershipData } from "@/hooks/useLeadOwnership";

interface LeadOwnershipCardProps {
  ownership: LeadOwnershipData;
}

export function LeadOwnershipCard({ ownership }: LeadOwnershipCardProps) {
  if (ownership.loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-muted-foreground text-sm">
        <Loader2 className="h-3 w-3 animate-spin" />
        Carregando histórico...
      </div>
    );
  }

  // Nothing to show if no data
  if (!ownership.consultor_atual_nome && ownership.historico.length === 0) {
    return null;
  }

  return (
    <div className="pt-2 border-t">
      <div className="flex items-center gap-2 mb-2">
        <p className="text-sm font-medium text-muted-foreground">Histórico do Lead</p>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-3 w-3 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>
              Dados inferidos de logs existentes
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {ownership.foi_reatribuido && (
          <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/30">
            <ArrowRightLeft className="h-3 w-3 mr-1" />
            Reatribuído
          </Badge>
        )}
      </div>

      <div className="space-y-2">
        {/* Current consultant */}
        <div className="flex items-center gap-2">
          <UserCheck className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs text-muted-foreground">Consultor atual:</span>
          <span className="text-sm font-medium">
            {ownership.consultor_atual_nome || "Não definido"}
          </span>
        </div>

        {/* First consultant (if different) */}
        {ownership.primeiro_consultor_nome && 
         ownership.primeiro_consultor_nome !== ownership.consultor_atual_nome && (
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Primeiro consultor:</span>
            <span className="text-sm font-medium">{ownership.primeiro_consultor_nome}</span>
            {ownership.primeiro_consultor_data && (
              <span className="text-xs text-muted-foreground">
                ({format(new Date(ownership.primeiro_consultor_data), "dd/MM/yy", { locale: ptBR })})
              </span>
            )}
          </div>
        )}

        {/* History timeline (compact) */}
        {ownership.historico.length > 1 && (
          <div className="mt-2 pl-4 border-l-2 border-muted space-y-1.5">
            {ownership.historico.map((entry, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
                <div>
                  <span className="text-muted-foreground">
                    {format(new Date(entry.data), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </span>
                  <span className="mx-1">—</span>
                  {entry.tipo === "criacao" ? (
                    <span>
                      Cadastrado por <strong>{entry.consultor_nome || "Sistema"}</strong>
                    </span>
                  ) : (
                    <span>
                      {entry.consultor_anterior_nome && (
                        <>{entry.consultor_anterior_nome} → </>
                      )}
                      <strong>{entry.consultor_nome || "?"}</strong>
                      {entry.motivo && (
                        <span className="text-muted-foreground ml-1">({entry.motivo})</span>
                      )}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
