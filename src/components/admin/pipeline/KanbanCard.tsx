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
    if (hours < 24) return `${hours}h`;
    const days = differenceInDays(new Date(), new Date(lead.created_at));
    return `${days}d`;
  };

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, lead)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "group relative bg-card rounded-lg border border-border/50 cursor-grab active:cursor-grabbing",
        "transition-all duration-200 ease-out",
        isDragging && "opacity-40 scale-95",
        !isDragging && "hover:border-border",
      )}
      style={{ boxShadow: isDragging ? "var(--shadow-lg)" : "var(--shadow-xs)" }}
    >
      <div className="p-3 space-y-1.5">
        {/* Line 1: Name (strong) */}
        <div className="flex items-start justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {isInactive && (
              <span className="w-1.5 h-1.5 rounded-full bg-warning shrink-0 mt-1.5" />
            )}
            {!lead.visto && !isInactive && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
            )}
            <p className="text-sm font-semibold truncate text-foreground leading-tight">{lead.nome}</p>
          </div>

          <div className={cn(
            "flex items-center gap-0.5 shrink-0 transition-opacity duration-150",
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
        </div>

        {/* Line 2: Value + kWp (secondary emphasis) */}
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 font-semibold text-foreground">
            <DollarSign className="w-3 h-3 text-success" />
            {formatBRLCompact(valor)}
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Zap className="w-3 h-3" />
            {kwp} kWp
          </span>
        </div>

        {/* Line 3: Time + location (compact) */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1 truncate">
            <MapPin className="w-3 h-3 shrink-0" />
            {lead.cidade}, {lead.estado}
          </span>
          <span className="flex items-center gap-1 shrink-0 tabular-nums">
            <Clock className="w-3 h-3" />
            {getTimeAgo()}
          </span>
        </div>

        {/* Line 4: Status badge (small, solid) */}
        <div className="flex items-center justify-between pt-0.5">
          {lead.consultor && (
            <span className="text-xs text-muted-foreground truncate max-w-[100px]">
              {lead.consultor.split(" ")[0]}
            </span>
          )}
          {lead.status_nome && (
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-medium">
              {lead.status_nome}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
