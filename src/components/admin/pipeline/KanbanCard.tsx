import { motion } from "framer-motion";
import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  Phone,
  MapPin,
  Zap,
  Clock,
  MoreHorizontal,
  Eye,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  Trophy,
  XCircle,
  DollarSign,
  Flame,
  Thermometer,
  Snowflake,
  Package,
} from "lucide-react";
import { differenceInDays, differenceInHours } from "date-fns";
import { cn } from "@/lib/utils";
import { formatBRLCompact } from "@/lib/formatters";
import { useLeadScoresMap } from "@/hooks/useLeadScoresMap";
import { useAnaliseCredito } from "@/hooks/useAnaliseCredito";

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

function estimateKwp(consumo: number): number {
  return Math.round((consumo / 130) * 10) / 10;
}

function estimateValue(kwp: number): number {
  return kwp * 5000;
}

export const KanbanCard = memo(({
  lead,
  onDragStart,
  isDragging,
  onViewDetails,
  onQuickAction,
  onWin,
  onLose,
}: KanbanCardProps) => {
  const { data: scoresMap } = useLeadScoresMap();
  const leadScore = scoresMap?.get(lead.id);

  const { data: analises } = useAnaliseCredito(null, lead.id);
  const lastAnalise = analises?.[0];

  const kwp = lead.potencia_kwp || estimateKwp(lead.media_consumo);
  const valor = lead.valor_projeto || estimateValue(kwp);

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
    <motion.div
      draggable
      onDragStart={(e) => onDragStart(e as unknown as React.DragEvent, lead)}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.15 }}
      className={cn(
        "group relative bg-card rounded-lg border border-border p-3 shadow-sm cursor-grab active:cursor-grabbing",
        "hover:shadow-md hover:border-primary/30 transition-all duration-200",
        "touch-manipulation",
        isDragging && "opacity-50 rotate-1 shadow-lg"
      )}
    >
      <div className="space-y-1.5">
        <FornecedorPedidoInfo projetoId={lead.id} />

        {/* Line 1: Lead code + urgency badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-xs font-mono text-muted-foreground">
              {lead.lead_code || "—"}
            </span>
            {leadScore && (
              <ScoreBadge score={leadScore.score} nivel={leadScore.nivel} />
            )}
            {lastAnalise && (
              <Badge 
                variant="outline" 
                className={cn(
                  "text-[9px] h-4 px-1 uppercase font-bold",
                  lastAnalise.status === 'aprovado' ? "bg-success/10 text-success border-success/20" :
                  lastAnalise.status === 'reprovado' ? "bg-destructive/10 text-destructive border-destructive/20" :
                  "bg-warning/10 text-warning border-warning/20"
                )}
              >
                Crédito: {lastAnalise.status === 'em_analise' ? 'ANÁLISE' : lastAnalise.status}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {isInactive && (
              <Badge className="text-[10px] h-4 bg-destructive/10 text-destructive border-destructive/20">
                <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                Urgente
              </Badge>
            )}
            {!lead.visto && !isInactive && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
            )}
            <div className={cn(
              "flex items-center gap-0.5 shrink-0 transition-opacity duration-150",
              "opacity-100 md:opacity-0 md:group-hover:opacity-100"
            )}>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 min-h-[44px] min-w-[44px] md:h-6 md:w-6 md:min-h-0 md:min-w-0" onClick={(e) => { e.stopPropagation(); onViewDetails?.(lead); }}>
                      <Eye className="h-4 w-4 md:h-3 md:w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Ver detalhes</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <KanbanCardMenu lead={lead} onQuickAction={onQuickAction} onWin={onWin} onLose={onLose} />
            </div>
          </div>
        </div>

        {/* Line 2: Name */}
        <p className="text-sm font-semibold text-foreground truncate" title={lead.nome}>{lead.nome}</p>

        {/* Line 3: Compact infos — city + kWh */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 truncate">
            <MapPin className="w-3 h-3 shrink-0" />
            {lead.cidade}/{lead.estado}
          </span>
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3" />
            {lead.media_consumo} kWh
          </span>
        </div>

        {/* Line 4: Footer — value + consultant + time */}
        <div className="flex items-center justify-between pt-0.5">
          <span className="text-xs font-semibold text-primary flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-success" />
            {formatBRLCompact(valor)}
          </span>
          <div className="flex items-center gap-2">
            {lead.consultor && (
              <span className="text-xs text-muted-foreground truncate max-w-[80px]">
                {lead.consultor.split(" ")[0]}
              </span>
            )}
            <span className="text-xs text-muted-foreground tabular-nums flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {getTimeAgo()}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

/** Score badge — hot/warm/cold */
function ScoreBadge({ score, nivel }: { score: number; nivel: "hot" | "warm" | "cold" }) {
  const config = {
    hot: { icon: Flame, className: "bg-destructive/10 text-destructive border-destructive/20" },
    warm: { icon: Thermometer, className: "bg-warning/10 text-warning border-warning/20" },
    cold: { icon: Snowflake, className: "bg-muted text-muted-foreground border-border" },
  }[nivel];
  const Icon = config.icon;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className={cn("text-[10px] h-4 gap-0.5 cursor-default", config.className)}>
            <Icon className="w-2.5 h-2.5" />
            {score}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>Score: {score}/100 ({nivel})</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Extracted dropdown menu to keep the main component clean */
function KanbanCardMenu({
  lead,
  onQuickAction,
  onWin,
  onLose,
}: Pick<KanbanCardProps, "lead" | "onQuickAction" | "onWin" | "onLose">) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 min-h-[44px] min-w-[44px] md:h-6 md:w-6 md:min-h-0 md:min-w-0">
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
  );
}


function FornecedorPedidoInfo({ projetoId }: { projetoId: string }) {
  const { data: ordem } = useQuery({
    queryKey: ["projeto-fornecedor-card", projetoId],
    queryFn: async () => {
      const { data } = await supabase
        .from("ordens_compra")
        .select("id, numero_pedido, valor_total, data_previsao_entrega, status, fornecedores(nome)")
        .eq("projeto_id", projetoId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });

  if (!ordem) return null;

  return (
    <div className="mb-2 p-1.5 bg-primary/5 rounded border border-primary/10 space-y-1">
      <div className="flex items-center gap-1.5 text-[10px] font-bold text-primary truncate">
        <Package className="w-3 h-3 shrink-0" />
        {((ordem as any).fornecedores?.nome || "Fornecedor").toUpperCase()}
      </div>
      <div className="flex items-center justify-between text-[9px] text-muted-foreground">
        <span>Ped: {ordem.numero_pedido || "N/A"}</span>
        <span className="font-mono">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(ordem.valor_total)}</span>
      </div>
    </div>
  );
}

KanbanCard.displayName = "KanbanCard";
