 import { useState, useEffect } from "react";
 import { supabase } from "@/integrations/supabase/client";
 import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
 import { Badge } from "@/components/ui/badge";
 import { Button } from "@/components/ui/button";
 import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { format, parseISO } from "date-fns";
 import { ptBR } from "date-fns/locale";
 import {
   CalendarDays,
   Clock,
   User,
   MapPin,
   Wrench,
   Image,
   Video,
   Volume2,
   Grid3X3,
   FileText,
   Loader2,
   ExternalLink,
   X,
 } from "lucide-react";
 
 interface ServicoDetail {
   id: string;
   tipo: string;
   status: string;
   data_agendada: string;
   hora_inicio: string | null;
   data_hora_inicio: string | null;
   data_hora_fim: string | null;
   endereco: string | null;
   bairro: string | null;
   cidade: string | null;
   descricao: string | null;
   observacoes: string | null;
   observacoes_conclusao: string | null;
   fotos_urls: string[] | null;
   audio_url: string | null;
   video_url: string | null;
   layout_modulos: {
     backgroundImage: string | null;
     modules: { id: string; x: number; y: number; rotation: number; width: number; height: number }[];
     totalModules: number;
   } | null;
   cliente: { id: string; nome: string; telefone: string } | null;
 }
 
 interface ServicoDetailDialogProps {
   servicoId: string | null;
   isOpen: boolean;
   onClose: () => void;
 }
 
 const tipoLabels: Record<string, string> = {
   instalacao: "Instalação Solar",
   manutencao: "Manutenção",
   visita_tecnica: "Visita Técnica",
   suporte: "Suporte/Reparo",
 };
 
 const statusConfig: Record<string, { label: string; color: string }> = {
   agendado: { label: "Agendado", color: "bg-info text-info-foreground" },
   em_andamento: { label: "Em Andamento", color: "bg-warning text-warning-foreground" },
   concluido: { label: "Concluído", color: "bg-success text-success-foreground" },
   cancelado: { label: "Cancelado", color: "bg-destructive text-destructive-foreground" },
   reagendado: { label: "Reagendado", color: "bg-muted text-muted-foreground" },
 };
 
 export function ServicoDetailDialog({ servicoId, isOpen, onClose }: ServicoDetailDialogProps) {
   const [servico, setServico] = useState<ServicoDetail | null>(null);
   const [loading, setLoading] = useState(false);
   const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
 
   useEffect(() => {
     if (servicoId && isOpen) {
       fetchServico();
     }
   }, [servicoId, isOpen]);
 
   const fetchServico = async () => {
     if (!servicoId) return;
     
     setLoading(true);
     try {
       const { data, error } = await supabase
         .from("servicos_agendados")
         .select(`
           id,
           tipo,
           status,
           data_agendada,
           hora_inicio,
           data_hora_inicio,
           data_hora_fim,
           endereco,
           bairro,
           cidade,
           descricao,
           observacoes,
           observacoes_conclusao,
           fotos_urls,
           audio_url,
           video_url,
           layout_modulos,
           cliente:clientes(id, nome, telefone)
         `)
         .eq("id", servicoId)
         .single();
 
       if (error) throw error;
       setServico(data as unknown as ServicoDetail);
     } catch (error) {
       console.error("Error fetching servico:", error);
     } finally {
       setLoading(false);
     }
   };
 
   const hasMedia = servico?.fotos_urls?.length || servico?.audio_url || servico?.video_url;
   const hasLayout = servico?.layout_modulos && servico.layout_modulos.totalModules > 0;
 
   return (
     <>
       <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
         <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
           <DialogHeader>
             <DialogTitle className="flex items-center gap-2">
               <Wrench className="h-5 w-5 text-primary" />
               Detalhes do Serviço
             </DialogTitle>
           </DialogHeader>
 
           {loading ? (
             <div className="flex justify-center py-12">
               <Loader2 className="h-8 w-8 animate-spin text-primary" />
             </div>
           ) : servico ? (
             <div className="flex-1 overflow-auto space-y-6">
               {/* Header Info */}
               <div className="flex flex-wrap items-center gap-3">
                 <Badge className={statusConfig[servico.status]?.color}>
                   {statusConfig[servico.status]?.label}
                 </Badge>
                 <Badge variant="outline">
                   {tipoLabels[servico.tipo]}
                 </Badge>
                 <div className="flex items-center gap-1 text-sm text-muted-foreground">
                   <CalendarDays className="h-4 w-4" />
                   {format(parseISO(servico.data_agendada), "dd/MM/yyyy", { locale: ptBR })}
                   {servico.hora_inicio && ` às ${servico.hora_inicio.slice(0, 5)}`}
                 </div>
               </div>
 
               {/* Execution Times */}
               {(servico.data_hora_inicio || servico.data_hora_fim) && (
                 <Card>
                   <CardContent className="p-4">
                     <div className="flex items-center gap-6 text-sm">
                       {servico.data_hora_inicio && (
                         <div className="flex items-center gap-2">
                           <Clock className="h-4 w-4 text-success" />
                           <span>Iniciado: {format(parseISO(servico.data_hora_inicio), "dd/MM HH:mm", { locale: ptBR })}</span>
                         </div>
                       )}
                       {servico.data_hora_fim && (
                         <div className="flex items-center gap-2">
                           <Clock className="h-4 w-4 text-info" />
                           <span>Concluído: {format(parseISO(servico.data_hora_fim), "dd/MM HH:mm", { locale: ptBR })}</span>
                         </div>
                       )}
                     </div>
                   </CardContent>
                 </Card>
               )}
 
               {/* Cliente e Local */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {servico.cliente && (
                   <Card>
                     <CardHeader className="pb-2">
                       <CardTitle className="text-sm font-medium flex items-center gap-2">
                         <User className="h-4 w-4 text-secondary" />
                         Cliente
                       </CardTitle>
                     </CardHeader>
                     <CardContent className="pt-0">
                       <p className="font-medium">{servico.cliente.nome}</p>
                       <p className="text-sm text-muted-foreground">{servico.cliente.telefone}</p>
                     </CardContent>
                   </Card>
                 )}
 
                 {(servico.endereco || servico.bairro || servico.cidade) && (
                   <Card>
                     <CardHeader className="pb-2">
                       <CardTitle className="text-sm font-medium flex items-center gap-2">
                         <MapPin className="h-4 w-4 text-secondary" />
                         Endereço
                       </CardTitle>
                     </CardHeader>
                     <CardContent className="pt-0">
                       <p className="text-sm">
                         {[servico.endereco, servico.bairro, servico.cidade].filter(Boolean).join(", ")}
                       </p>
                     </CardContent>
                   </Card>
                 )}
               </div>
 
               {/* Observações */}
               {(servico.descricao || servico.observacoes || servico.observacoes_conclusao) && (
                 <Card>
                   <CardHeader className="pb-2">
                     <CardTitle className="text-sm font-medium flex items-center gap-2">
                       <FileText className="h-4 w-4 text-secondary" />
                       Observações
                     </CardTitle>
                   </CardHeader>
                   <CardContent className="pt-0 space-y-3">
                     {servico.descricao && (
                       <div>
                         <p className="text-xs font-medium text-muted-foreground mb-1">Descrição</p>
                         <p className="text-sm">{servico.descricao}</p>
                       </div>
                     )}
                     {servico.observacoes && (
                       <div>
                         <p className="text-xs font-medium text-muted-foreground mb-1">Observações Internas</p>
                         <p className="text-sm">{servico.observacoes}</p>
                       </div>
                     )}
                     {servico.observacoes_conclusao && (
                       <div>
                         <p className="text-xs font-medium text-muted-foreground mb-1">Observações da Conclusão</p>
                         <p className="text-sm">{servico.observacoes_conclusao}</p>
                       </div>
                     )}
                   </CardContent>
                 </Card>
               )}
 
               {/* Mídia e Layout */}
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
                     <TabsTrigger value="video" className="gap-2" disabled={!servico.video_url}>
                       <Video className="h-4 w-4" />
                       <span className="hidden sm:inline">Vídeo</span>
                     </TabsTrigger>
                     <TabsTrigger value="audio" className="gap-2" disabled={!servico.audio_url}>
                       <Volume2 className="h-4 w-4" />
                       <span className="hidden sm:inline">Áudio</span>
                     </TabsTrigger>
                     <TabsTrigger value="layout" className="gap-2" disabled={!hasLayout}>
                       <Grid3X3 className="h-4 w-4" />
                       <span className="hidden sm:inline">Layout</span>
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
                       <p className="text-center py-8 text-muted-foreground">Nenhuma foto registrada</p>
                     )}
                   </TabsContent>
 
                   <TabsContent value="video" className="mt-4">
                     {servico.video_url ? (
                       <video
                         controls
                         className="w-full max-h-80 rounded-lg border"
                         src={servico.video_url}
                       />
                     ) : (
                       <p className="text-center py-8 text-muted-foreground">Nenhum vídeo registrado</p>
                     )}
                   </TabsContent>
 
                   <TabsContent value="audio" className="mt-4">
                     {servico.audio_url ? (
                       <audio controls className="w-full" src={servico.audio_url} />
                     ) : (
                       <p className="text-center py-8 text-muted-foreground">Nenhum áudio registrado</p>
                     )}
                   </TabsContent>
 
                   <TabsContent value="layout" className="mt-4">
                     {hasLayout ? (
                       <div className="space-y-4">
                         <div className="flex items-center justify-between p-4 bg-secondary/10 rounded-lg">
                           <div className="flex items-center gap-2">
                             <Grid3X3 className="h-5 w-5 text-secondary" />
                             <span className="font-medium">{servico.layout_modulos?.totalModules} módulos</span>
                           </div>
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
                       <p className="text-center py-8 text-muted-foreground">Nenhum layout registrado</p>
                     )}
                   </TabsContent>
                 </Tabs>
               )}
             </div>
           ) : null}
         </DialogContent>
       </Dialog>
 
       {/* Photo Preview Modal */}
       {selectedPhoto && (
         <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
           <DialogContent className="max-w-4xl p-2">
             <Button
               variant="ghost"
               size="icon"
               className="absolute top-2 right-2 z-10"
               onClick={() => setSelectedPhoto(null)}
             >
               <X className="h-4 w-4" />
             </Button>
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