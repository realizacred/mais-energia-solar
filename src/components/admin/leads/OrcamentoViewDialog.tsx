import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileText, Image, ExternalLink } from "lucide-react";
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
import type { OrcamentoDisplayItem } from "@/types/orcamento";

interface OrcamentoViewDialogProps {
  orcamento: OrcamentoDisplayItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OrcamentoViewDialog({ orcamento, open, onOpenChange }: OrcamentoViewDialogProps) {
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

  if (!orcamento) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-brand-blue">Detalhes do Orçamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Códigos */}
          <div className="flex items-center gap-2 flex-wrap">
            {orcamento.orc_code && (
              <Badge variant="default" className="font-mono text-sm px-3 py-1 bg-primary">
                {orcamento.orc_code}
              </Badge>
            )}
            {orcamento.lead_code && (
              <Badge variant="outline" className="font-mono text-sm px-3 py-1">
                {orcamento.lead_code}
              </Badge>
            )}
          </div>

          {/* Cliente */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Nome</p>
              <p className="font-medium">{orcamento.nome}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Telefone</p>
              <p className="font-medium">{orcamento.telefone}</p>
            </div>
          </div>

          {/* Endereço */}
          <div className="pt-2 border-t">
            <p className="text-sm font-medium text-muted-foreground mb-2">Endereço do Orçamento</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">CEP</p>
                <p className="font-medium text-sm">{orcamento.cep || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cidade/Estado</p>
                <p className="font-medium text-sm">
                  {orcamento.cidade}, {orcamento.estado}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Bairro</p>
                <p className="font-medium text-sm">{orcamento.bairro || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Rua</p>
                <p className="font-medium text-sm">{orcamento.rua || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Número</p>
                <p className="font-medium text-sm">{orcamento.numero || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Vendedor</p>
                <p className="font-medium text-sm">{orcamento.vendedor || "-"}</p>
              </div>
            </div>
          </div>

          {/* Imóvel */}
          <div className="pt-2 border-t">
            <p className="text-sm font-medium text-muted-foreground mb-2">
              Imóvel e Consumo
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Área</p>
                <p className="font-medium text-sm">{orcamento.area}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tipo de Telhado</p>
                <p className="font-medium text-sm">{orcamento.tipo_telhado}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Rede</p>
                <p className="font-medium text-sm">{orcamento.rede_atendimento}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Consumo Médio</p>
                <p className="font-medium text-sm">{orcamento.media_consumo} kWh</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Consumo Previsto</p>
                <p className="font-medium text-sm">{orcamento.consumo_previsto} kWh</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Data de Cadastro</p>
                <p className="font-medium text-sm">
                  {format(new Date(orcamento.created_at), "dd/MM/yyyy 'às' HH:mm", {
                    locale: ptBR,
                  })}
                </p>
              </div>
            </div>
          </div>

          {orcamento.observacoes && (
            <div className="pt-2 border-t">
              <p className="text-sm text-muted-foreground">Observações</p>
              <p className="font-medium text-sm">{orcamento.observacoes}</p>
            </div>
          )}

          {/* Arquivos Anexados */}
          {orcamento.arquivos_urls && orcamento.arquivos_urls.length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-sm text-muted-foreground mb-2">
                Arquivos Anexados ({orcamento.arquivos_urls.length})
              </p>
              <div className="space-y-2">
                {orcamento.arquivos_urls.map((filePath, index) => {
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
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
