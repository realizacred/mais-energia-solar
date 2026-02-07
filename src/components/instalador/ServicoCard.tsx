 import { format, parseISO } from "date-fns";
 import { ptBR } from "date-fns/locale";
 import { Card, CardContent } from "@/components/ui/card";
 import { Badge } from "@/components/ui/badge";
 import { Button } from "@/components/ui/button";
 import {
   CalendarDays,
   Clock,
   User,
   Wrench,
   CheckCircle2,
   AlertCircle,
   Play,
   ClipboardCheck,
   Phone,
   MapPin,
 } from "lucide-react";
 
 interface ServicoAgendado {
   id: string;
   tipo: "instalacao" | "manutencao" | "visita_tecnica" | "suporte";
   status: "agendado" | "em_andamento" | "concluido" | "cancelado" | "reagendado";
   data_agendada: string;
   hora_inicio: string | null;
   hora_fim: string | null;
   data_hora_inicio: string | null;
   data_hora_fim: string | null;
   endereco: string | null;
   bairro: string | null;
   cidade: string | null;
   descricao: string | null;
   observacoes: string | null;
   observacoes_conclusao: string | null;
   fotos_urls: string[] | null;
   cliente: { nome: string; telefone: string } | null;
 }
 
 const tipoLabels: Record<string, string> = {
   instalacao: "Instalação Solar",
   manutencao: "Manutenção",
   visita_tecnica: "Visita Técnica",
   suporte: "Suporte/Reparo",
 };
 
 const statusConfig: Record<string, { label: string; bgColor: string; textColor: string; borderColor: string; icon: typeof CheckCircle2 }> = {
   agendado: { label: "Agendado", bgColor: "bg-info/10", textColor: "text-info", borderColor: "border-info/30", icon: CalendarDays },
   em_andamento: { label: "Em Andamento", bgColor: "bg-warning/10", textColor: "text-warning", borderColor: "border-warning/30", icon: Play },
   concluido: { label: "Concluído", bgColor: "bg-success/10", textColor: "text-success", borderColor: "border-success/30", icon: CheckCircle2 },
   cancelado: { label: "Cancelado", bgColor: "bg-destructive/10", textColor: "text-destructive", borderColor: "border-destructive/30", icon: AlertCircle },
   reagendado: { label: "Reagendado", bgColor: "bg-muted", textColor: "text-muted-foreground", borderColor: "border-muted", icon: CalendarDays },
 };
 
 interface ServicoCardProps {
   servico: ServicoAgendado;
   onOpenServico: (servico: ServicoAgendado) => void;
 }
 
 export function ServicoCard({ servico, onOpenServico }: ServicoCardProps) {
   const config = statusConfig[servico.status];
   const StatusIcon = config?.icon || CalendarDays;
 
   return (
     <Card className={`overflow-hidden border-l-4 ${config?.borderColor || "border-muted"} hover-lift`}>
       <CardContent className="p-4 sm:p-5 space-y-4">
         {/* Header do Card */}
         <div className="flex items-start justify-between gap-3">
           <div className="flex-1 space-y-2">
             <div className="flex items-center gap-2">
               <div className="p-2 rounded-lg bg-secondary/10">
                 <Wrench className="h-4 w-4 text-secondary" />
               </div>
               <span className="font-semibold text-foreground">{tipoLabels[servico.tipo]}</span>
             </div>
             <Badge className={`${config?.bgColor} ${config?.textColor} border-0 font-medium`}>
               <StatusIcon className="h-3 w-3 mr-1.5" />
               {config?.label}
             </Badge>
           </div>
           <div className="text-right space-y-1">
             <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
               <CalendarDays className="h-4 w-4 text-secondary" />
               {format(parseISO(servico.data_agendada), "dd/MM", { locale: ptBR })}
             </div>
             {servico.hora_inicio && (
               <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                 <Clock className="h-3.5 w-3.5" />
                 {servico.hora_inicio.slice(0, 5)}
               </div>
             )}
           </div>
         </div>
 
         {/* Info do Cliente */}
         {servico.cliente && (
           <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
             <div className="p-2 rounded-full bg-background">
               <User className="h-4 w-4 text-secondary" />
             </div>
             <div className="flex-1 min-w-0">
               <span className="font-medium text-foreground block truncate">{servico.cliente.nome}</span>
               {servico.cliente.telefone && (
                 <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                   <Phone className="h-3 w-3" />
                   {servico.cliente.telefone}
                 </div>
               )}
             </div>
           </div>
         )}
 
         {/* Endereço */}
         {(servico.endereco || servico.bairro || servico.cidade) && (
           <div className="flex items-start gap-2 text-sm text-muted-foreground">
             <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-secondary" />
             <span>
               {[servico.endereco, servico.bairro, servico.cidade]
                 .filter(Boolean)
                 .join(", ")}
             </span>
           </div>
         )}
 
         {/* Descrição */}
         {servico.descricao && (
           <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
             {servico.descricao}
           </p>
         )}
 
         {/* Ações */}
         {servico.status === "agendado" && (
           <div className="pt-3 border-t">
             <Button
               size="default"
               className="w-full bg-success hover:bg-success/90 text-success-foreground shadow-sm"
               onClick={() => onOpenServico(servico)}
             >
               <Play className="h-4 w-4 mr-2" />
               Iniciar Atendimento
             </Button>
           </div>
         )}
 
         {servico.status === "em_andamento" && (
           <div className="flex gap-3 pt-3 border-t">
             <Button
               size="default"
               variant="outline"
               className="flex-1 border-secondary text-secondary hover:bg-secondary hover:text-secondary-foreground"
               onClick={() => onOpenServico(servico)}
             >
               <ClipboardCheck className="h-4 w-4 mr-2" />
               Continuar
             </Button>
             <Button
               size="default"
               className="bg-success hover:bg-success/90 text-success-foreground"
               onClick={() => onOpenServico(servico)}
             >
               <ClipboardCheck className="h-4 w-4" />
             </Button>
           </div>
         )}
       </CardContent>
     </Card>
   );
 }
 
 export type { ServicoAgendado };