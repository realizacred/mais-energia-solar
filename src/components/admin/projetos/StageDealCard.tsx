import { useState, useMemo } from "react";
import { formatBRLCompact as formatBRL } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuLabel,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Zap, FileText, MessageSquare, TrendingDown,
  Clock, Phone, StickyNote, Archive,
  UserPlus, Tag, Copy, ExternalLink,
  MoreHorizontal, Calendar,
} from "lucide-react";
import { ScheduleWhatsAppDialog } from "@/components/vendor/ScheduleWhatsAppDialog";
import type { DealKanbanCard } from "@/hooks/useDealPipeline";
import { differenceInDays, differenceInHours } from "date-fns";

interface DynamicEtiqueta {
  id: string;
  nome: string;
  cor: string;
  grupo: string;
  short: string | null;
  icon: string | null;
}

const PROPOSTA_STATUS_MAP: Record<string, { label: string; className: string }> = {
  rascunho: { label: "Rascunho", className: "bg-muted text-muted-foreground" },
  gerada: { label: "Gerada", className: "bg-warning/10 text-warning" },
  generated: { label: "Gerada", className: "bg-warning/10 text-warning" },
  enviada: { label: "Enviada", className: "bg-info/10 text-info" },
  sent: { label: "Enviada", className: "bg-info/10 text-info" },
  aceita: { label: "Aceita", className: "bg-success/10 text-success" },
  accepted: { label: "Aceita", className: "bg-success/10 text-success" },
  recusada: { label: "Recusada", className: "bg-destructive/10 text-destructive" },
  rejected: { label: "Recusada", className: "bg-destructive/10 text-destructive" },
  expirada: { label: "Expirada", className: "bg-muted text-muted-foreground" },
  expired: { label: "Expirada", className: "bg-muted text-muted-foreground" },
};

function getTimeInStage(lastChange: string) {
  const hours = differenceInHours(new Date(), new Date(lastChange));
  if (hours < 1) return "agora";
  if (hours < 24) return `${hours}h`;
  const days = differenceInDays(new Date(), new Date(lastChange));
  return `${days}d`;
}

function getStagnationLevel(lastChange: string) {
  const hours = differenceInHours(new Date(), new Date(lastChange));
  if (hours >= 168) return "critical";
  if (hours >= 72) return "warning";
  return null;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase())
    .join("");
}

export interface StageDealCardProps {
  deal: DealKanbanCard;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onClick: () => void;
  hasAutomation?: boolean;
  dynamicEtiquetas?: DynamicEtiqueta[];
  onArchive?: (deal: DealKanbanCard) => void;
  onTransfer?: (deal: DealKanbanCard) => void;
  onTag?: (deal: DealKanbanCard) => void;
  onSchedule?: (deal: DealKanbanCard) => void;
}

export function StageDealCard({
  deal,
  isDragging,
  onDragStart,
  onClick,
  dynamicEtiquetas = [],
  onArchive,
  onTransfer,
  onTag,
  onSchedule,
}: StageDealCardProps) {
  const etiquetaCfg = useMemo(() => {
    if (!deal.etiqueta) return null;
    const found = dynamicEtiquetas.find(e =>
      e.nome.toLowerCase() === deal.etiqueta?.toLowerCase() || e.id === deal.etiqueta
    );
    if (found) return { label: found.nome, short: found.short || found.nome.substring(0, 3).toUpperCase(), cor: found.cor, icon: found.icon };
    return null;
  }, [deal.etiqueta, dynamicEtiquetas]);

  const isInactive = deal.deal_status === "perdido" || deal.deal_status === "cancelado";
  const propostaInfo = deal.proposta_status ? PROPOSTA_STATUS_MAP[deal.proposta_status] : null;
  const timeInStage = getTimeInStage(deal.last_stage_change);
  const stagnation = getStagnationLevel(deal.last_stage_change);
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);

  const docChecklist = deal.doc_checklist as Record<string, boolean> | null;
  const docTotal = docChecklist ? Object.keys(docChecklist).length : 0;
  const docDone = docChecklist ? Object.values(docChecklist).filter(Boolean).length : 0;
  const isOverdue = deal.expected_close_date && new Date(deal.expected_close_date) < new Date();

  const cardContent = (
    <div
      draggable
      onDragStart={e => onDragStart(e, deal.deal_id)}
      onClick={onClick}
      className={cn(
        "bg-card rounded-xl cursor-grab active:cursor-grabbing",
        "border border-border/40 shadow-sm",
        "hover:shadow-md hover:border-border/80 transition-all duration-200 ease-out relative group",
        deal.deal_status === "won" && "bg-success/5 border-success/20",
        deal.deal_status === "lost" && "opacity-50",
        isDragging && "opacity-30 scale-95 shadow-lg",
      )}
    >
      {/* Stagnation left accent */}
      {stagnation && (
        <div className={cn(
          "absolute left-0 top-2 bottom-2 w-[3px] rounded-full",
          stagnation === "critical" ? "bg-destructive" : "bg-warning"
        )} />
      )}

      <div className="p-3 space-y-2">
        {/* Row 1: Header — Name + City + Value */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className={cn(
              "text-sm font-semibold leading-tight line-clamp-1",
              isInactive ? "text-muted-foreground" : "text-foreground"
            )}>
              {deal.customer_name || deal.deal_title || "Sem nome"}
            </p>
            {(deal.customer_city || deal.customer_state) && (
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                {[deal.customer_city, deal.customer_state].filter(Boolean).join(", ")}
              </p>
            )}
          </div>
          {deal.deal_value > 0 && (
            <span className="text-sm font-bold text-foreground whitespace-nowrap tabular-nums">
              {formatBRL(deal.deal_value)}
            </span>
          )}
        </div>

        {/* Row 2: Status chips */}
        <div className="flex flex-wrap items-center gap-1">
          {propostaInfo && (
            <Badge variant="secondary" className={cn("text-[9px] h-[18px] px-1.5 font-medium border-0", propostaInfo.className)}>
              {propostaInfo.label}
            </Badge>
          )}
          {etiquetaCfg && (
            <span
              className="text-[9px] font-semibold rounded-full px-1.5 py-0.5 text-white"
              style={{ backgroundColor: etiquetaCfg.cor }}
            >
              {etiquetaCfg.icon ? `${etiquetaCfg.icon} ` : ""}{etiquetaCfg.short || etiquetaCfg.label}
            </span>
          )}
          {deal.deal_kwp > 0 && (
            <Badge variant="outline" className="text-[9px] h-[18px] px-1.5 font-mono font-medium border-border/50">
              <Zap className="h-2.5 w-2.5 mr-0.5 text-info" />
              {deal.deal_kwp.toFixed(1).replace(".", ",")} kWp
            </Badge>
          )}
        </div>

        {/* Row 3: Next action / expected close */}
        {deal.expected_close_date && (
          <div className={cn(
            "flex items-center gap-1.5 text-[10px] rounded-md px-2 py-1",
            isOverdue ? "bg-destructive/10 text-destructive font-medium" : "bg-muted/50 text-muted-foreground"
          )}>
            <Clock className="h-3 w-3 shrink-0" />
            <span>Fechamento: {new Date(deal.expected_close_date).toLocaleDateString("pt-BR")}</span>
            {isOverdue && <span className="font-bold ml-auto">ATRASADO</span>}
          </div>
        )}

        {/* Row 4: Progress indicators */}
        {(docTotal > 0 || deal.proposta_economia_mensal) && (
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            {docTotal > 0 && (
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {docDone}/{docTotal} docs
              </span>
            )}
            {deal.proposta_economia_mensal && (
              <span className="flex items-center gap-1 text-success">
                <TrendingDown className="h-3 w-3" />
                {formatBRL(deal.proposta_economia_mensal)}/mês
              </span>
            )}
          </div>
        )}

        {/* Row 5: Quick action icons */}
        <div className="flex items-center gap-0.5 pt-0.5 border-t border-border/30">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-success hover:bg-success/10 transition-colors duration-150"
                onClick={(e) => { e.stopPropagation(); if (deal.customer_phone) setWhatsappDialogOpen(true); }}
                disabled={!deal.customer_phone}
              >
                <MessageSquare className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-xs">WhatsApp</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-info hover:bg-info/10 transition-colors duration-150"
                onClick={(e) => { e.stopPropagation(); onClick(); }}
              >
                <FileText className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-xs">Propostas</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors duration-150"
                onClick={(e) => { e.stopPropagation(); if (deal.customer_phone) window.open(`tel:${deal.customer_phone}`); }}
                disabled={!deal.customer_phone}
              >
                <Phone className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-xs">Ligar</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-warning hover:bg-warning/10 transition-colors duration-150"
                onClick={(e) => { e.stopPropagation(); onSchedule?.(deal); }}
              >
                <Calendar className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-xs">Agendar</TooltipContent>
          </Tooltip>
          {deal.notas?.trim() && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground">
                  <StickyNote className="h-3.5 w-3.5" />
                </span>
              </TooltipTrigger>
              <TooltipContent className="text-xs max-w-[250px]">
                <p className="whitespace-pre-wrap">{deal.notas}</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Spacer + Owner */}
          <div className="ml-auto flex items-center gap-1.5">
            <Avatar className="h-5 w-5 border border-border/50">
              <AvatarFallback className="text-[8px] font-bold bg-muted text-muted-foreground">
                {getInitials(deal.owner_name)}
              </AvatarFallback>
            </Avatar>
            <span className={cn(
              "text-[10px] tabular-nums",
              stagnation === "critical" ? "text-destructive font-semibold" :
              stagnation === "warning" ? "text-warning font-semibold" :
              "text-muted-foreground"
            )}>
              {timeInStage}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          {cardContent}
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <ContextMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Ações rápidas
          </ContextMenuLabel>
          <ContextMenuItem
            className="text-xs gap-2"
            onClick={() => onClick()}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Abrir detalhes
          </ContextMenuItem>
          <ContextMenuItem
            className="text-xs gap-2"
            onClick={() => { if (deal.customer_phone) setWhatsappDialogOpen(true); }}
            disabled={!deal.customer_phone}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Enviar WhatsApp
          </ContextMenuItem>
          <ContextMenuItem
            className="text-xs gap-2"
            onClick={() => onSchedule?.(deal)}
          >
            <Calendar className="h-3.5 w-3.5" />
            Agendar compromisso
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Gerenciar
          </ContextMenuLabel>
          <ContextMenuItem
            className="text-xs gap-2"
            onClick={() => onTransfer?.(deal)}
          >
            <UserPlus className="h-3.5 w-3.5" />
            Transferir consultor
          </ContextMenuItem>
          <ContextMenuItem
            className="text-xs gap-2"
            onClick={() => onTag?.(deal)}
          >
            <Tag className="h-3.5 w-3.5" />
            Alterar etiqueta
          </ContextMenuItem>
          <ContextMenuItem
            className="text-xs gap-2"
            onClick={() => {
              navigator.clipboard.writeText(deal.deal_id);
            }}
          >
            <Copy className="h-3.5 w-3.5" />
            Copiar ID
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            className="text-xs gap-2 text-destructive focus:text-destructive"
            onClick={() => onArchive?.(deal)}
          >
            <Archive className="h-3.5 w-3.5" />
            Arquivar
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <ScheduleWhatsAppDialog
        lead={deal.customer_phone ? { nome: deal.customer_name, telefone: deal.customer_phone } : null}
        open={whatsappDialogOpen}
        onOpenChange={setWhatsappDialogOpen}
      />
    </>
  );
}
