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
  Trophy,
  XCircle,
  DollarSign,
} from "lucide-react";
import { differenceInDays, differenceInHours } from "date-fns";
import { cn } from "@/lib/utils";
import { formatBRLCompact } from "@/lib/formatters";

interface Lead {
  id: string;
  lead_code: string | null;
  nome: string;
  telefone: string;
  cidade: string;
  estado: string;
  media_consumo: number;
  consultor: string | null;
  status_id: string | null;
  created_at: string;
  ultimo_contato?: string | null;
  visto?: boolean;
  potencia_kwp?: number | null;
  valor_projeto?: number | null;
  status_nome?: string | null;
}

interface KanbanCardProps {
  lead: Lead;
  onDragStart: (e: React.DragEvent, lead: Lead) => void;
  isDragging: boolean;
  onViewDetails?: (lead: Lead) => void;
  onQuickAction?: (lead: Lead, action: string) => void;
  onWin?: (lead: Lead) => void;
  onLose?: (lead: Lead) => void;
}

// Estimated kWp from consumption (rough: consumo/130)
function estimateKwp(consumo: number): number {
  return Math.round((consumo / 130) * 10) / 10;
}

// Estimated project value (rough: kWp * 5000)
function estimateValue(kwp: number): number {
  return kwp * 5000;
}

const STATUS_BADGE_COLORS: Record<string, string> = {
  "aguardando vistoria": "bg-amber-100 text-amber-800 border-amber-200",
  "proposta enviada": "bg-blue-100 text-blue-800 border-blue-200",
  "contrato emitido": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "negociação": "bg-purple-100 text-purple-800 border-purple-200",
  "implementação": "bg-green-100 text-green-800 border-green-200",
};

function getStatusBadgeClass(statusName: string | null | undefined): string {
  if (!statusName) return "";
  const key = statusName.toLowerCase();
  return STATUS_BADGE_COLORS[key] || "bg-muted text-muted-foreground";
}

export function KanbanCard({
  lead,
  onDragStart,
  isDragging,
  onViewDetails,
  onQuickAction,
  onWin,
  onLose,
}: KanbanCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const kwp = lead.potencia_kwp || estimateKwp(lead.media_consumo);
  const valor = lead.valor_projeto || estimateValue(kwp);

  // Inactivity: 48h+ without update
  const lastActivity = lead.ultimo_contato || lead.created_at;
  const hoursSinceActivity = differenceInHours(new Date(), new Date(lastActivity));
  const isInactive = hoursSinceActivity >= 48;

  const getTimeAgo = () => {
    const hours = differenceInHours(new Date(), new Date(lead.created_at));
    if (hours < 24) return `${hours}h atrás`;
    const days = differenceInDays(new Date(), new Date(lead.created_at));
    if (days === 1) return "ontem";
    return `${days}d atrás`;
  };

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, lead)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "group relative bg-card rounded-md border border-slate-200 cursor-grab active:cursor-grabbing transition-all duration-200",
        isDragging && "opacity-50 scale-95 shadow-lg ring-2 ring-primary",
        !isDragging && "hover:shadow-md hover:border-primary/40",
        !lead.visto && "border-l-4 border-l-primary",
        isInactive && !isDragging && "border-l-4 border-l-warning",
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-1 px-2.5 pt-2 pb-1">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{lead.nome}</p>
          {lead.lead_code && (
            <span className="text-[10px] text-muted-foreground font-mono">{lead.lead_code}</span>
          )}
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <div className={cn(
            "flex items-center gap-0.5 transition-opacity duration-150",
            isHovered ? "opacity-100" : "opacity-0"
          )}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onViewDetails?.(lead); }}>
                    <Eye className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Ver detalhes</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => onQuickAction?.(lead, "whatsapp")}>
                  <MessageSquare className="h-4 w-4 mr-2" /> Enviar WhatsApp
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onQuickAction?.(lead, "call")}>
                  <Phone className="h-4 w-4 mr-2" /> Ligar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onQuickAction?.(lead, "markContacted")}>
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Marcar como contatado
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-success" onClick={() => onWin?.(lead)}>
                  <Trophy className="h-4 w-4 mr-2" /> Ganhar
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={() => onLose?.(lead)}>
                  <XCircle className="h-4 w-4 mr-2" /> Perder
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <GripVertical className={cn("w-3.5 h-3.5 text-muted-foreground", isHovered ? "opacity-100" : "opacity-30")} />
        </div>
      </div>

      {/* Technical Data */}
      <div className="px-2.5 pb-1.5 space-y-1">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-warning" />
            <span className="font-medium text-foreground">{kwp} kWp</span>
          </span>
          <span className="flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-success" />
            <span className="font-medium text-foreground">{formatBRLCompact(valor)}</span>
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{lead.cidade}, {lead.estado}</span>
        </div>

        <div className="flex items-center justify-between">
          {lead.consultor && (
            <Badge variant="secondary" className="text-[10px] h-5 gap-1 px-1.5">
              <User className="w-2.5 h-2.5" />
              {lead.consultor.split(" ")[0]}
            </Badge>
          )}
          {lead.status_nome && (
            <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5 border", getStatusBadgeClass(lead.status_nome))}>
              {lead.status_nome}
            </Badge>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-2.5 py-1.5 border-t border-slate-100 bg-muted/20 rounded-b-md flex items-center justify-between">
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="w-3 h-3" /> {getTimeAgo()}
        </span>
        {isInactive && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <AlertTriangle className="h-3.5 w-3.5 text-warning" />
              </TooltipTrigger>
              <TooltipContent>Sem atualização há mais de 48h</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}
