import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatPhoneBR } from "@/lib/formatters";
import { FileText, Image, ExternalLink, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
      <DialogContent className="w-[90vw] max-w-xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        {/* §25 HEADER */}
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              Detalhes do Lead
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Informações completas do lead
            </p>
          </div>
        </DialogHeader>

        {/* §25 BODY */}
        <div className="p-5 space-y-5 flex-1 min-h-0 overflow-y-auto">
          {lead.lead_code && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-sm px-3 py-1">
                {lead.lead_code}
              </Badge>
            </div>
          )}

          {/* Dados pessoais */}
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Dados pessoais
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Nome</p>
                <p className="font-medium text-sm">{lead.nome}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Telefone</p>
                <p className="font-medium text-sm">{formatPhoneBR(lead.telefone)}</p>
              </div>
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Endereço */}
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Endereço
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">CEP</p>
                <p className="font-medium text-sm">{lead.cep || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cidade/Estado</p>
                <p className="font-medium text-sm">
                  {lead.cidade}, {lead.estado}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Bairro</p>
                <p className="font-medium text-sm">{lead.bairro || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Rua</p>
                <p className="font-medium text-sm">{lead.rua || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Número</p>
                <p className="font-medium text-sm">{lead.numero || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Complemento</p>
                <p className="font-medium text-sm">{lead.complemento || "-"}</p>
              </div>
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Imóvel */}
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Imóvel e Consumo
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Área</p>
                <p className="font-medium text-sm">{lead.area}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tipo de Telhado</p>
                <p className="font-medium text-sm">{lead.tipo_telhado}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Rede</p>
                <p className="font-medium text-sm">{lead.rede_atendimento}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Consumo Médio</p>
                <p className="font-medium text-sm">{lead.media_consumo} kWh</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Consumo Previsto</p>
                <p className="font-medium text-sm">{lead.consumo_previsto} kWh</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Data de Cadastro</p>
                <p className="font-medium text-sm">
                  {format(new Date(lead.created_at), "dd/MM/yyyy 'às' HH:mm", {
                    locale: ptBR,
                  })}
                </p>
              </div>
            </div>
          </div>

          {lead.observacoes && (
            <>
              <div className="border-t border-border" />
              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Observações</p>
                <p className="font-medium text-sm">{lead.observacoes}</p>
              </div>
            </>
          )}

          {/* Arquivos Anexados */}
          {lead.arquivos_urls && lead.arquivos_urls.length > 0 && (
            <>
              <div className="border-t border-border" />
              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Arquivos Anexados ({lead.arquivos_urls.length})
                </p>
                <div className="space-y-2">
                  {lead.arquivos_urls.map((filePath, index) => {
                    const fileName = filePath.split("/").pop() || `Arquivo ${index + 1}`;
                    const isImage = /\.(jpg|jpeg|png)$/i.test(fileName);

                    return (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
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
      </DialogContent>
    </Dialog>
  );
}
