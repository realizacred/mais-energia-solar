import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  User,
  MapPin,
  CalendarDays,
  Wrench,
  Image,
  Video,
  Volume2,
  Grid3X3,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";

interface ServicoValidacao {
  id: string;
  tipo: string;
  status: string;
  data_agendada: string;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  cliente: { nome: string; telefone: string } | null;
  instalador_nome?: string;
  fotos_urls: string[] | null;
  audio_url: string | null;
  video_url: string | null;
  layout_modulos: { totalModules: number; backgroundImage?: string } | null;
  observacoes_conclusao: string | null;
  validado: boolean;
  validado_em: string | null;
  observacoes_validacao: string | null;
}

interface ServicoValidacaoDialogProps {
  servico: ServicoValidacao | null;
  isOpen: boolean;
  onClose: () => void;
  onValidated: () => void;
}

const tipoLabels: Record<string, string> = {
  instalacao: "Instalação Solar",
  manutencao: "Manutenção",
  visita_tecnica: "Visita Técnica",
  suporte: "Suporte/Reparo",
};

export function ServicoValidacaoDialog({
  servico,
  isOpen,
  onClose,
  onValidated,
}: ServicoValidacaoDialogProps) {
  const { user } = useAuth();
  const [validando, setValidando] = useState(false);
  const [observacoes, setObservacoes] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const handleValidar = async (aprovado: boolean) => {
    if (!servico || !user) return;

    try {
      setValidando(true);

      const { error } = await supabase
        .from("servicos_agendados")
        .update({
          validado: aprovado,
          validado_por: user.id,
          validado_em: new Date().toISOString(),
          observacoes_validacao: observacoes || null,
          ...(aprovado ? { status: "concluido" as const } : {}),
        })
        .eq("id", servico.id);

      if (error) throw error;

      toast({
        title: aprovado ? "Serviço Validado!" : "Serviço Marcado para Revisão",
        description: aprovado 
          ? "O serviço foi aprovado e validado com sucesso."
          : "O instalador será notificado sobre a necessidade de revisão.",
      });

      onValidated();
      onClose();
    } catch (error) {
      console.error("Error validating:", error);
      toast({
        title: "Erro ao validar",
        variant: "destructive",
      });
    } finally {
      setValidando(false);
    }
  };

  if (!servico) return null;

  const hasMedia = servico.fotos_urls?.length || servico.audio_url || servico.video_url;
  const hasLayout = servico.layout_modulos && servico.layout_modulos.totalModules > 0;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" />
              Validar Serviço
              {servico.validado && (
                <Badge className="bg-success text-success-foreground ml-2">
                  Já Validado
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6">
              {/* Info Header */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Wrench className="h-3 w-3" /> Tipo
                  </p>
                  <Badge variant="outline">{tipoLabels[servico.tipo]}</Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" /> Data
                  </p>
                  <p className="font-medium">
                    {format(parseISO(servico.data_agendada), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
                {servico.cliente && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3" /> Cliente
                    </p>
                    <p className="font-medium">{servico.cliente.nome}</p>
                  </div>
                )}
                {servico.instalador_nome && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3" /> Instalador
                    </p>
                    <p className="font-medium">{servico.instalador_nome}</p>
                  </div>
                )}
                {(servico.endereco || servico.bairro || servico.cidade) && (
                  <div className="col-span-2 space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> Endereço
                    </p>
                    <p className="text-sm">
                      {[servico.endereco, servico.bairro, servico.cidade].filter(Boolean).join(", ")}
                    </p>
                  </div>
                )}
              </div>

              {/* Observações do Instalador */}
              {servico.observacoes_conclusao && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium mb-2">Observações do Instalador</p>
                  <p className="text-sm text-muted-foreground">{servico.observacoes_conclusao}</p>
                </div>
              )}

              {/* Mídia */}
              {(hasMedia || hasLayout) && (
                <Tabs defaultValue="fotos" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="fotos" className="gap-2">
                      <Image className="h-4 w-4" />
                      <span className="hidden sm:inline">Fotos</span>
                      {servico.fotos_urls?.length ? (
                        <Badge variant="secondary" className="ml-1">{servico.fotos_urls.length}</Badge>
                      ) : null}
                    </TabsTrigger>
                    <TabsTrigger value="video" disabled={!servico.video_url}>
                      <Video className="h-4 w-4" />
                    </TabsTrigger>
                    <TabsTrigger value="audio" disabled={!servico.audio_url}>
                      <Volume2 className="h-4 w-4" />
                    </TabsTrigger>
                    <TabsTrigger value="layout" disabled={!hasLayout}>
                      <Grid3X3 className="h-4 w-4" />
                      {hasLayout && (
                        <Badge variant="secondary" className="ml-1">{servico.layout_modulos?.totalModules}</Badge>
                      )}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="fotos" className="mt-4">
                    {servico.fotos_urls?.length ? (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {servico.fotos_urls.map((url, index) => (
                          <img
                            key={index}
                            src={url}
                            alt={`Foto ${index + 1}`}
                            className="w-full h-24 object-cover rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => setSelectedPhoto(url)}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-center py-8 text-muted-foreground">Nenhuma foto</p>
                    )}
                  </TabsContent>

                  <TabsContent value="video" className="mt-4">
                    {servico.video_url ? (
                      <video controls className="w-full max-h-60 rounded-lg border" src={servico.video_url} />
                    ) : (
                      <p className="text-center py-8 text-muted-foreground">Nenhum vídeo</p>
                    )}
                  </TabsContent>

                  <TabsContent value="audio" className="mt-4">
                    {servico.audio_url ? (
                      <audio controls className="w-full" src={servico.audio_url} />
                    ) : (
                      <p className="text-center py-8 text-muted-foreground">Nenhum áudio</p>
                    )}
                  </TabsContent>

                  <TabsContent value="layout" className="mt-4">
                    {hasLayout ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 p-3 bg-secondary/10 rounded-lg">
                          <Grid3X3 className="h-5 w-5 text-secondary" />
                          <span className="font-medium">{servico.layout_modulos?.totalModules} módulos</span>
                        </div>
                        {servico.layout_modulos?.backgroundImage && (
                          <img
                            src={servico.layout_modulos.backgroundImage}
                            alt="Layout de módulos"
                            className="w-full rounded-lg border"
                          />
                        )}
                      </div>
                    ) : (
                      <p className="text-center py-8 text-muted-foreground">Nenhum layout</p>
                    )}
                  </TabsContent>
                </Tabs>
              )}

              {/* Campo de Observações da Validação */}
              {!servico.validado && (
                <div className="space-y-2">
                  <Label>Observações da Validação (opcional)</Label>
                  <Textarea
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Adicione comentários ou feedback para o instalador..."
                    rows={3}
                  />
                </div>
              )}

              {/* Validação Anterior */}
              {servico.validado && servico.validado_em && (
                <div className="p-4 bg-success/10 rounded-lg">
                  <p className="text-sm font-medium text-success mb-1">Validado em</p>
                  <p className="text-sm">
                    {format(parseISO(servico.validado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                  {servico.observacoes_validacao && (
                    <p className="text-sm text-muted-foreground mt-2">
                      {servico.observacoes_validacao}
                    </p>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>

          {!servico.validado && (
            <DialogFooter className="gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => handleValidar(false)}
                disabled={validando}
                className="gap-2 text-destructive hover:bg-destructive/10"
              >
                <XCircle className="h-4 w-4" />
                Solicitar Revisão
              </Button>
              <Button
                onClick={() => handleValidar(true)}
                disabled={validando}
                className="gap-2"
              >
                {validando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Aprovar e Validar
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Photo Modal */}
      {selectedPhoto && (
        <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
          <DialogContent className="max-w-4xl p-2">
            <img
              src={selectedPhoto}
              alt="Foto ampliada"
              className="w-full max-h-[80vh] object-contain rounded-lg"
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
