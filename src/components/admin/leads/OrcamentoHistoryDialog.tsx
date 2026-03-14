import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatPhoneBR } from "@/lib/formatters";
import { Phone, Clock, FileText, Eye, MessageSquare, MapPin, Zap, ShoppingCart } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { GroupedOrcamento } from "@/hooks/useGroupedOrcamentos";
import type { OrcamentoDisplayItem } from "@/types/orcamento";
import type { LeadStatus } from "@/types/lead";

interface OrcamentoHistoryDialogProps {
  group: GroupedOrcamento | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statuses?: LeadStatus[];
  onViewOrcamento?: (orcamento: OrcamentoDisplayItem) => void;
  onWhatsApp?: (telefone: string, nome: string, leadId: string) => void;
  /** Callback para converter um orçamento específico em venda */
  onConvertOrcamento?: (orcamento: OrcamentoDisplayItem) => void;
}

export function OrcamentoHistoryDialog({
  group,
  open,
  onOpenChange,
  statuses = [],
  onViewOrcamento,
  onWhatsApp,
  onConvertOrcamento,
}: OrcamentoHistoryDialogProps) {
  if (!group) return null;

  const getStatusBadge = (statusId: string | null) => {
    const status = statuses.find((s) => s.id === statusId);
    if (!status) return null;
    return (
      <Badge
        style={{ backgroundColor: status.cor }}
        className="text-xs text-primary-foreground"
      >
        {status.nome}
      </Badge>
    );
  };

  const convertidoStatus = statuses.find((s) => s.nome === "Convertido");
  const isOrcamentoConverted = (statusId: string | null) => {
    return convertidoStatus && statusId === convertidoStatus.id;
  };

  const latestOrcamento = group.latestOrcamento as OrcamentoDisplayItem;
  const firstOrcamento = group.firstOrcamento as OrcamentoDisplayItem;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-2xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        {/* §25 HEADER — FIX 1: bg-primary/10 text-primary */}
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <span>{group.nome}</span>
              <Badge variant="outline" className="font-mono text-xs">
                {group.lead_code}
              </Badge>
              {/* FIX 2: Badge orçamentos — sem azul hardcoded */}
              <Badge variant="outline" className="ml-auto text-xs bg-primary/10 text-primary border-primary/30">
                {group.count} orçamento{group.count > 1 ? "s" : ""}
              </Badge>
            </DialogTitle>
            <div className="flex items-center gap-4 mt-1">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Phone className="h-3.5 w-3.5" />
                {formatPhoneBR(group.telefone)}
              </span>
              {/* FIX 7: WhatsApp — text-[#25D366] exceção aceita §34 */}
              {onWhatsApp && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 gap-1 text-xs text-[#25D366] border-success/30 hover:bg-success/10"
                  onClick={() => onWhatsApp(group.telefone, group.nome, group.lead_id)}
                >
                  <MessageSquare className="h-3 w-3" />
                  WhatsApp
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* §39: flex-1 min-h-0 em vez de max-h-[70vh] */}
        <ScrollArea className="flex-1 min-h-0 p-5">
          {/* FIX 5: Card mais recente — border-l-[3px] border-l-primary */}
          <div className="mb-4">
            <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
              <Zap className="h-4 w-4 text-success" />
              Proposta Mais Recente
            </h4>
            <div className="rounded-lg border border-border border-l-[3px] border-l-primary bg-card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    {/* FIX 3: Badge ORC mais recente — success semântico */}
                    <Badge variant="outline" className="font-mono text-xs bg-success/10 text-success border-success/20">
                      {latestOrcamento.orc_code || "-"}
                    </Badge>
                    {getStatusBadge(latestOrcamento.status_id)}
                    {/* FIX 6: Badge "Mais Recente" */}
                    <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">
                      Mais Recente
                    </Badge>
                  </div>
                  <div className="text-sm space-y-1">
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      {latestOrcamento.cidade}, {latestOrcamento.estado}
                    </p>
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <Zap className="h-3.5 w-3.5" />
                      Consumo: {latestOrcamento.media_consumo} kWh
                    </p>
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {format(new Date(latestOrcamento.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {onViewOrcamento && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onViewOrcamento(latestOrcamento)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Ver
                    </Button>
                  )}
                  {onConvertOrcamento && !isOrcamentoConverted(latestOrcamento.status_id) && (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => {
                        onConvertOrcamento(latestOrcamento);
                        onOpenChange(false);
                      }}
                    >
                      <ShoppingCart className="h-4 w-4 mr-1" />
                      Converter
                    </Button>
                  )}
                  {isOrcamentoConverted(latestOrcamento.status_id) && (
                    <Badge variant="outline" className="text-primary border-primary/30">
                      Convertido
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          {group.count > 1 && (
            <>
              <Separator className="my-4" />
              
              <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Propostas Anteriores ({group.count - 1})
              </h4>
              
              <div className="space-y-3 pb-4">
                {group.allOrcamentos
                  .filter((orc) => orc.id !== latestOrcamento.id)
                  .map((orc) => {
                    const orcamento = orc as OrcamentoDisplayItem;
                    const isFirst = orcamento.id === firstOrcamento.id;
                    const isConverted = isOrcamentoConverted(orcamento.status_id);
                    
                    return (
                      <div
                        key={orcamento.id}
                        className={`rounded-lg border p-3 transition-colors ${
                          isFirst 
                            ? "border-primary/20 bg-primary/5" 
                            : "border-border bg-card"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              {/* FIX 3: Badges ORC — primeiro=primary, intermediário=muted */}
                              <Badge 
                                variant="outline" 
                                className={`font-mono text-xs ${
                                  isFirst 
                                    ? "bg-primary/10 text-primary border-primary/20" 
                                    : "bg-muted text-muted-foreground border-border"
                                }`}
                              >
                                {orcamento.orc_code || "-"}
                              </Badge>
                              {getStatusBadge(orcamento.status_id)}
                              {/* FIX 6: Badge "Primeiro Orçamento" */}
                              {isFirst && (
                                <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                                  Primeiro Orçamento
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm space-y-1 mt-1">
                              <p className="flex items-center gap-2 text-muted-foreground">
                                <MapPin className="h-3.5 w-3.5" />
                                {orcamento.cidade}, {orcamento.estado}
                              </p>
                              <p className="flex items-center gap-2 text-muted-foreground">
                                <Zap className="h-3.5 w-3.5" />
                                Consumo: {orcamento.media_consumo} kWh
                              </p>
                              <p className="flex items-center gap-2 text-muted-foreground">
                                <Clock className="h-3.5 w-3.5" />
                                {format(new Date(orcamento.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            {onViewOrcamento && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onViewOrcamento(orcamento)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Ver
                              </Button>
                            )}
                            {onConvertOrcamento && !isConverted && (
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => {
                                  onConvertOrcamento(orcamento);
                                  onOpenChange(false);
                                }}
                              >
                                <ShoppingCart className="h-4 w-4 mr-1" />
                                Converter
                              </Button>
                            )}
                            {isConverted && (
                              <Badge variant="outline" className="text-primary border-primary/30">
                                Convertido
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
