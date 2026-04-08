import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatPhoneBR } from "@/lib/formatters";
import { FileText, Image, ExternalLink, User, History, Mail } from "lucide-react";
import { LeadAuditHistory } from "./LeadAuditHistory";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Lead } from "@/types/lead";

interface LeadViewDialogProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function InfoField({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium text-foreground mt-0.5">{value || "—"}</p>
    </div>
  );
}

export function LeadViewDialog({ lead, open, onOpenChange }: LeadViewDialogProps) {
  const { toast } = useToast();

  const handleOpenFile = async (filePath: string) => {
    const { data, error } = await supabase.storage
      .from("contas-luz")
      .createSignedUrl(filePath, 3600);

    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    } else {
      toast({
        title: "Erro",
        description: "Não foi possível abrir o arquivo.",
        variant: "destructive",
      });
    }
  };

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-4xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        {/* §25 HEADER */}
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              {lead.nome}
            </DialogTitle>
            <div className="flex items-center gap-2 mt-0.5">
              {lead.lead_code && (
                <Badge variant="outline" className="font-mono text-xs">{lead.lead_code}</Badge>
              )}
              <p className="text-xs text-muted-foreground">Detalhes completos do lead</p>
            </div>
          </div>
        </DialogHeader>

        {/* §25 BODY — 2 columns */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-5">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Left Column */}
              <div className="flex-1 space-y-5">
                {/* IDENTIFICAÇÃO */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Identificação
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InfoField label="Nome" value={lead.nome} />
                    <InfoField label="Telefone" value={formatPhoneBR(lead.telefone)} />
                    {lead.email && (
                      <div>
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">E-mail</p>
                        <a href={`mailto:${lead.email}`} className="text-sm font-medium text-primary hover:underline mt-0.5 flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5" />
                          {lead.email}
                        </a>
                      </div>
                    )}
                    <InfoField label="Consultor" value={lead.consultor_nome || lead.consultor} />
                    <InfoField label="Origem" value={lead.area} />
                  </div>
                </div>

                <div className="border-t border-border" />

                {/* ENDEREÇO */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Endereço
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InfoField label="CEP" value={lead.cep} />
                    <InfoField label="Cidade / Estado" value={[lead.cidade, lead.estado].filter(Boolean).join(", ")} />
                    <InfoField label="Bairro" value={lead.bairro} />
                    <InfoField label="Rua" value={lead.rua} />
                    <InfoField label="Número" value={lead.numero} />
                    <InfoField label="Complemento" value={lead.complemento} />
                  </div>
                </div>

                {/* Arquivos Anexados */}
                {lead.arquivos_urls && lead.arquivos_urls.length > 0 && (
                  <>
                    <div className="border-t border-border" />
                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Arquivos Anexados ({lead.arquivos_urls.length})
                      </p>
                      <div className="space-y-2">
                        {lead.arquivos_urls.map((filePath, index) => {
                          const fileName = filePath.split("/").pop() || `Arquivo ${index + 1}`;
                          const isImage = /\.(jpg|jpeg|png)$/i.test(fileName);
                          return (
                            <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                {isImage ? (
                                  <Image className="w-5 h-5 text-primary" />
                                ) : (
                                  <FileText className="w-5 h-5 text-destructive" />
                                )}
                                <span className="text-sm font-medium truncate">{fileName}</span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenFile(filePath)}
                                className="flex items-center gap-1 text-primary hover:text-primary"
                              >
                                <ExternalLink className="w-4 h-4" />
                                Abrir
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Right Column */}
              <div className="flex-1 space-y-5">
                {/* IMÓVEL E CONSUMO */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Imóvel e Consumo
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InfoField label="Tipo de Telhado" value={lead.tipo_telhado} />
                    <InfoField label="Rede" value={lead.rede_atendimento} />
                    <InfoField label="Consumo Médio" value={lead.media_consumo ? `${lead.media_consumo} kWh` : null} />
                    <InfoField label="Consumo Previsto" value={lead.consumo_previsto ? `${lead.consumo_previsto} kWh` : null} />
                  </div>
                </div>

                <div className="border-t border-border" />

                {/* HISTÓRICO */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Histórico
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InfoField
                      label="Criado em"
                      value={format(new Date(lead.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    />
                    <InfoField
                      label="Atualizado em"
                      value={lead.updated_at ? format(new Date(lead.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : null}
                    />
                    <InfoField
                      label="Último contato"
                      value={lead.ultimo_contato ? format(new Date(lead.ultimo_contato), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : null}
                    />
                    <InfoField
                      label="Próxima ação"
                      value={lead.proxima_acao}
                    />
                  </div>
                </div>

                {/* OBSERVAÇÕES */}
                {lead.observacoes && (
                  <>
                    <div className="border-t border-border" />
                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Observações</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{lead.observacoes}</p>
                    </div>
                  </>
                )}

                {/* Valor estimado */}
                {lead.valor_estimado != null && lead.valor_estimado > 0 && (
                  <>
                    <div className="border-t border-border" />
                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Negócio</p>
                      <InfoField label="Valor Estimado" value={`R$ ${lead.valor_estimado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Audit History — full width below */}
            <div className="border-t border-border mt-5 pt-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-3">
                <History className="w-3.5 h-3.5" /> Histórico de Alterações
              </p>
              <LeadAuditHistory leadId={lead.id} />
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
