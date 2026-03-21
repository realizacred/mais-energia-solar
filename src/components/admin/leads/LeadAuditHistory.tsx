/**
 * LeadAuditHistory — Timeline de alterações do lead (audit log).
 * §1: Cores semânticas — §12: Skeleton loading.
 */
import { useLeadAuditLog, getCampoLabel } from "@/hooks/useLeadAuditLog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  leadId: string;
}

export function LeadAuditHistory({ leadId }: Props) {
  const { data: entries = [], isLoading } = useLeadAuditLog(leadId);

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-3/4 mb-1" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Nenhuma alteração registrada ainda.
      </div>
    );
  }

  return (
    <ScrollArea className="max-h-[300px]">
      <div className="space-y-3 p-4">
        {entries.map((entry) => (
          <div key={entry.id} className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <Clock className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {getCampoLabel(entry.campo_alterado)}
                </Badge>
                {entry.user_nome && (
                  <span className="text-xs text-muted-foreground">
                    por {entry.user_nome}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                <span className="truncate max-w-[120px]" title={entry.valor_anterior || "—"}>
                  {entry.valor_anterior || "—"}
                </span>
                <ArrowRight className="w-3 h-3 shrink-0" />
                <span className="truncate max-w-[120px] text-foreground font-medium" title={entry.valor_novo || "—"}>
                  {entry.valor_novo || "—"}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {format(new Date(entry.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
