import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { User, Phone, MapPin, Zap, ExternalLink, X, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface WaLeadInfoCardProps {
  leadId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function WaLeadInfoCard({ leadId, open, onOpenChange }: WaLeadInfoCardProps) {
  const { data: lead, isLoading } = useQuery({
    queryKey: ["wa-lead-info", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, lead_code, nome, telefone, estado, cidade, bairro, rua, numero, media_consumo, consumo_previsto, area, tipo_telhado, rede_atendimento, observacoes, status_id, created_at, lead_statuses(nome, cor)")
        .eq("id", leadId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open && !!leadId,
    staleTime: 30 * 1000,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <User className="h-4 w-4 text-primary" />
            </div>
            Informações do Lead
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !lead ? (
          <p className="text-sm text-muted-foreground text-center py-8">Lead não encontrado.</p>
        ) : (
          <div className="space-y-4">
            {/* Header with name and code */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground">{lead.nome}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  {lead.lead_code && (
                    <Badge variant="outline" className="font-mono text-xs">{lead.lead_code}</Badge>
                  )}
                  {(lead as any).lead_statuses && (
                    <Badge
                      className="text-[10px] px-1.5 py-0"
                      style={{
                        backgroundColor: (lead as any).lead_statuses.cor + "20",
                        color: (lead as any).lead_statuses.cor,
                        borderColor: (lead as any).lead_statuses.cor + "40",
                      }}
                    >
                      {(lead as any).lead_statuses.nome}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Contact */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/40">
                <Phone className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Telefone</p>
                  <p className="text-sm font-medium">{lead.telefone}</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/40">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Local</p>
                  <p className="text-sm font-medium">
                    {[lead.cidade, lead.estado].filter(Boolean).join(", ") || "—"}
                  </p>
                </div>
              </div>
            </div>

            {/* Energy info */}
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
              <div className="flex items-center gap-1.5 mb-2">
                <Zap className="h-3.5 w-3.5 text-primary" />
                <p className="text-xs font-semibold text-primary">Dados de Consumo</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-[10px] text-muted-foreground">Média</p>
                  <p className="text-sm font-bold">{lead.media_consumo} <span className="text-[10px] font-normal text-muted-foreground">kWh</span></p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Previsto</p>
                  <p className="text-sm font-bold">{lead.consumo_previsto} <span className="text-[10px] font-normal text-muted-foreground">kWh</span></p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Telhado</p>
                  <p className="text-sm font-medium truncate">{lead.tipo_telhado || "—"}</p>
                </div>
              </div>
            </div>

            {/* Address */}
            {(lead.rua || lead.bairro) && (
              <div className="text-xs text-muted-foreground">
                <p className="font-medium text-foreground/80 mb-0.5">Endereço</p>
                <p>{[lead.rua, lead.numero, lead.bairro, lead.cidade, lead.estado].filter(Boolean).join(", ")}</p>
              </div>
            )}

            {/* Observations */}
            {lead.observacoes && (
              <div className="text-xs text-muted-foreground">
                <p className="font-medium text-foreground/80 mb-0.5">Observações</p>
                <p className="whitespace-pre-wrap">{lead.observacoes}</p>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-border/40">
              <span className="text-[10px] text-muted-foreground">
                Criado em {format(new Date(lead.created_at), "dd/MM/yyyy", { locale: ptBR })}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={() => window.open(`/admin?tab=leads`, '_blank')}
              >
                <ExternalLink className="h-3 w-3" />
                Abrir no Admin
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
