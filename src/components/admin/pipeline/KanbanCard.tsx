 import { useState } from "react";
 import { Badge } from "@/components/ui/badge";
 import { Button } from "@/components/ui/button";
 import {
   Tooltip,
   TooltipContent,
   TooltipProvider,
   TooltipTrigger,
 } from "@/components/ui/tooltip";
 import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
 } from "@/components/ui/dropdown-menu";
 import {
   GripVertical,
   Phone,
   MapPin,
   Zap,
   User,
   Clock,
   MoreHorizontal,
   Eye,
   MessageSquare,
   AlertTriangle,
   CheckCircle2,
 } from "lucide-react";
 import { format, differenceInDays, differenceInHours } from "date-fns";
 import { ptBR } from "date-fns/locale";
 import { cn } from "@/lib/utils";
 
 interface Lead {
   id: string;
   lead_code: string | null;
   nome: string;
   telefone: string;
   cidade: string;
   estado: string;
   media_consumo: number;
   vendedor: string | null;
   status_id: string | null;
   created_at: string;
   ultimo_contato?: string | null;
   visto?: boolean;
 }
 
 interface KanbanCardProps {
   lead: Lead;
   onDragStart: (e: React.DragEvent, lead: Lead) => void;
   isDragging: boolean;
   onViewDetails?: (lead: Lead) => void;
   onQuickAction?: (lead: Lead, action: string) => void;
 }
 
 export function KanbanCard({
   lead,
   onDragStart,
   isDragging,
   onViewDetails,
   onQuickAction,
 }: KanbanCardProps) {
   const [isHovered, setIsHovered] = useState(false);
 
   // Calculate urgency based on last contact
   const getUrgencyInfo = () => {
     if (!lead.ultimo_contato) {
       const daysSinceCreation = differenceInDays(new Date(), new Date(lead.created_at));
       if (daysSinceCreation >= 7) return { level: "critical", label: "Crítico", color: "text-red-500" };
       if (daysSinceCreation >= 3) return { level: "high", label: "Urgente", color: "text-orange-500" };
       return null;
     }
     
     const daysSinceContact = differenceInDays(new Date(), new Date(lead.ultimo_contato));
     if (daysSinceContact >= 7) return { level: "critical", label: "Crítico", color: "text-red-500" };
     if (daysSinceContact >= 3) return { level: "high", label: "Urgente", color: "text-orange-500" };
     if (daysSinceContact >= 1) return { level: "medium", label: "Pendente", color: "text-yellow-500" };
     return null;
   };
 
   const urgency = getUrgencyInfo();
 
   // Format time ago
   const getTimeAgo = () => {
     const hours = differenceInHours(new Date(), new Date(lead.created_at));
     if (hours < 24) return `${hours}h atrás`;
     const days = differenceInDays(new Date(), new Date(lead.created_at));
     if (days === 1) return "ontem";
     return `${days} dias atrás`;
   };
 
   return (
     <div
       draggable
       onDragStart={(e) => onDragStart(e, lead)}
       onMouseEnter={() => setIsHovered(true)}
       onMouseLeave={() => setIsHovered(false)}
       className={cn(
         "group relative bg-card rounded-lg border shadow-sm cursor-grab active:cursor-grabbing transition-all duration-200",
         isDragging && "opacity-50 scale-95 shadow-lg ring-2 ring-primary",
         !isDragging && "hover:shadow-md hover:border-primary/50",
         !lead.visto && "border-l-4 border-l-primary",
         urgency?.level === "critical" && "ring-1 ring-red-200"
       )}
     >
       {/* Header */}
       <div className="flex items-start justify-between gap-2 p-3 pb-2">
         <div className="flex-1 min-w-0">
           <div className="flex items-center gap-2">
             <p className="font-medium text-sm truncate">{lead.nome}</p>
             {urgency && (
               <TooltipProvider>
                 <Tooltip>
                   <TooltipTrigger>
                     <AlertTriangle className={cn("h-3.5 w-3.5", urgency.color)} />
                   </TooltipTrigger>
                   <TooltipContent>
                     <p>{urgency.label}: Sem contato recente</p>
                   </TooltipContent>
                 </Tooltip>
               </TooltipProvider>
             )}
           </div>
           {lead.lead_code && (
             <Badge variant="outline" className="font-mono text-[10px] mt-1 h-5">
               {lead.lead_code}
             </Badge>
           )}
         </div>
 
         <div className="flex items-center gap-1">
           {/* Quick Actions (visible on hover) */}
           <div className={cn(
             "flex items-center gap-1 transition-opacity duration-200",
             isHovered ? "opacity-100" : "opacity-0"
           )}>
             <TooltipProvider>
               <Tooltip>
                 <TooltipTrigger asChild>
                   <Button
                     variant="ghost"
                     size="icon"
                     className="h-6 w-6"
                     onClick={(e) => {
                       e.stopPropagation();
                       onViewDetails?.(lead);
                     }}
                   >
                     <Eye className="h-3.5 w-3.5" />
                   </Button>
                 </TooltipTrigger>
                 <TooltipContent>Ver detalhes</TooltipContent>
               </Tooltip>
             </TooltipProvider>
 
             <DropdownMenu>
               <DropdownMenuTrigger asChild>
                 <Button variant="ghost" size="icon" className="h-6 w-6">
                   <MoreHorizontal className="h-3.5 w-3.5" />
                 </Button>
               </DropdownMenuTrigger>
               <DropdownMenuContent align="end" className="w-48">
                 <DropdownMenuItem onClick={() => onQuickAction?.(lead, "whatsapp")}>
                   <MessageSquare className="h-4 w-4 mr-2" />
                   Enviar WhatsApp
                 </DropdownMenuItem>
                 <DropdownMenuItem onClick={() => onQuickAction?.(lead, "call")}>
                   <Phone className="h-4 w-4 mr-2" />
                   Ligar
                 </DropdownMenuItem>
                 <DropdownMenuSeparator />
                 <DropdownMenuItem onClick={() => onQuickAction?.(lead, "markContacted")}>
                   <CheckCircle2 className="h-4 w-4 mr-2" />
                   Marcar como contatado
                 </DropdownMenuItem>
               </DropdownMenuContent>
             </DropdownMenu>
           </div>
 
           <GripVertical className={cn(
             "w-4 h-4 text-muted-foreground flex-shrink-0 transition-opacity",
             isHovered ? "opacity-100" : "opacity-40"
           )} />
         </div>
       </div>
 
       {/* Content */}
       <div className="px-3 pb-2 space-y-1.5">
         <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
           <Phone className="w-3 h-3 flex-shrink-0" />
           <a 
             href={`tel:${lead.telefone}`}
             className="truncate hover:text-primary hover:underline"
             onClick={(e) => e.stopPropagation()}
           >
             {lead.telefone}
           </a>
         </div>
         <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
           <MapPin className="w-3 h-3 flex-shrink-0" />
           <span className="truncate">{lead.cidade}, {lead.estado}</span>
         </div>
         <div className="flex items-center justify-between">
           <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
             <Zap className="w-3 h-3 flex-shrink-0 text-yellow-500" />
             <span className="font-medium">{lead.media_consumo} kWh</span>
           </div>
           {lead.vendedor && (
             <Badge variant="secondary" className="text-[10px] h-5 gap-1">
               <User className="w-2.5 h-2.5" />
               {lead.vendedor.split(" ")[0]}
             </Badge>
           )}
         </div>
       </div>
 
       {/* Footer */}
       <div className="px-3 py-2 border-t bg-muted/30 rounded-b-lg flex items-center justify-between">
         <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
           <Clock className="w-3 h-3" />
           <span>{getTimeAgo()}</span>
         </div>
         {lead.ultimo_contato && (
           <span className="text-[10px] text-muted-foreground">
             Contato: {format(new Date(lead.ultimo_contato), "dd/MM", { locale: ptBR })}
           </span>
         )}
       </div>
     </div>
   );
 }