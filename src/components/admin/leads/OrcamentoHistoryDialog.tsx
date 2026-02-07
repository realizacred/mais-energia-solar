import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Phone, Clock, FileText, Eye, MessageSquare, MapPin, Zap, ShoppingCart } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
        style={{ backgroundColor: status.cor, color: "#fff" }}
        className="text-xs"
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
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>{group.nome}</span>
            <Badge variant="outline" className="font-mono">
              {group.lead_code}
            </Badge>
            <Badge variant="secondary" className="ml-auto">
              {group.count} orçamento{group.count > 1 ? "s" : ""}
            </Badge>
          </DialogTitle>
          <DialogDescription className="flex items-center gap-4 pt-2">
            <span className="flex items-center gap-1">
              <Phone className="h-3.5 w-3.5" />
              {group.telefone}
            </span>
            {onWhatsApp && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 text-success border-success/30 hover:bg-success/10"
                onClick={() => onWhatsApp(group.telefone, group.nome, group.lead_id)}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                WhatsApp
              </Button>
            )}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {/* Latest/Most Recent Orcamento Highlighted - DESTAQUE PRINCIPAL */}
          <div className="mb-4">
            <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
              <Zap className="h-4 w-4 text-success" />
              Proposta Mais Recente
            </h4>
            <div className="rounded-lg border-2 border-success/40 bg-success/5 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="default" className="font-mono text-xs bg-success text-success-foreground">
                      {latestOrcamento.orc_code || "-"}
                    </Badge>
                    {getStatusBadge(latestOrcamento.status_id)}
                    <Badge variant="secondary" className="text-xs bg-success/20 text-success border-success/30">
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
                      className="bg-primary hover:bg-primary/90"
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
              
              <div className="space-y-3">
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
                            ? "border-primary/30 bg-primary/5" 
                            : "border-muted"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <Badge 
                                variant={isFirst ? "default" : "outline"} 
                                className={`font-mono text-xs ${isFirst ? "bg-primary/80" : ""}`}
                              >
                                {orcamento.orc_code || "-"}
                              </Badge>
                              {getStatusBadge(orcamento.status_id)}
                              {isFirst && (
                                <Badge variant="secondary" className="text-xs bg-primary/20 text-primary border-primary/30">
                                  Primeiro Orçamento
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs space-y-0.5 text-muted-foreground">
                              <p>{orcamento.cidade}, {orcamento.estado} • {orcamento.media_consumo} kWh</p>
                              <p className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(new Date(orcamento.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {onViewOrcamento && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8"
                                onClick={() => onViewOrcamento(orcamento)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                            {onConvertOrcamento && !isConverted && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-primary hover:text-primary hover:bg-primary/10"
                                onClick={() => {
                                  onConvertOrcamento(orcamento);
                                  onOpenChange(false);
                                }}
                              >
                                <ShoppingCart className="h-4 w-4" />
                              </Button>
                            )}
                            {isConverted && (
                              <Badge variant="outline" className="text-xs text-primary border-primary/30">
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
