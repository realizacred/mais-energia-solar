import { useState, useMemo } from "react";
import { formatBRLCompact as formatBRL } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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

  // Determine border class — priority: won > lost > critical > warning > etiqueta > proposal status
  const isWonLost = deal.deal_status === "won" || deal.deal_status === "lost";
  const hasEtiquetaColor = !!etiquetaCfg?.cor;
  const borderClass = isWonLost
    ? (deal.deal_status === "won" ? "kanban-card--won" : "kanban-card--lost")
    : stagnation === "critical"
      ? "kanban-card--stagnation-critical"
      : stagnation === "warning"
        ? "kanban-card--stagnation-warning"
        : hasEtiquetaColor
          ? "kanban-card--etiqueta"
          : propostaInfo
            ? "kanban-card--has-proposal"
            : "kanban-card--no-proposal";

  const borderStyle = hasEtiquetaColor && !isWonLost && !stagnation
    ? { borderLeftColor: etiquetaCfg.cor, borderLeftWidth: 4, borderLeftStyle: "solid" as const }
    : undefined;

  const cardContent = (
    <div
      draggable
      onDragStart={e => onDragStart(e, deal.deal_id)}
      onClick={onClick}
      className={cn(
        "kanban-card group",
        borderClass,
        isDragging && "kanban-card--dragging",
      )}
      style={borderStyle}
    >
      {/* ── Etiqueta accent bar at the top ── */}
      {etiquetaCfg && (
        <div className="relative">
          <div
            className="h-[5px] rounded-t-[inherit]"
            style={{ background: etiquetaCfg.cor }}
          />
          <div
            className="absolute top-0 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-b-md text-[9px] font-bold text-white shadow-md"
            style={{ backgroundColor: etiquetaCfg.cor }}
          >
            {etiquetaCfg.icon && <span className="text-[10px]">{etiquetaCfg.icon}</span>}
            {etiquetaCfg.short || etiquetaCfg.label}
          </div>
        </div>
      )}

      <div className="p-3.5 space-y-2">
        {/* Row 1: Header — Name + Value */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className={cn(
                "text-[13px] font-semibold leading-tight line-clamp-1",
                isInactive ? "text-muted-foreground" : "text-foreground"
              )}>
                {deal.customer_name || deal.deal_title || "Sem nome"}
              </p>
              {deal.deal_num != null && (
                <span className="text-[9px] font-mono font-semibold text-primary/60 shrink-0">
                  #{deal.deal_num}
                </span>
              )}
            </div>
            {(deal.customer_city || deal.customer_state) && (
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                {[deal.customer_city, deal.customer_state].filter(Boolean).join(", ")}
              </p>
            )}
          </div>
          {deal.deal_value > 0 && (
            <span className="text-[13px] font-bold text-success whitespace-nowrap tabular-nums">
              {formatBRL(deal.deal_value)}
            </span>
          )}
        </div>

        {/* Row 2: Status chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {propostaInfo ? (
            <Badge variant="secondary" className={cn("text-[9px] h-[18px] px-1.5 font-semibold border-0", propostaInfo.className)}>
              {propostaInfo.label}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[9px] h-[18px] px-1.5 font-medium border-warning/40 text-warning bg-warning/8">
              Sem proposta
            </Badge>
          )}
          {deal.deal_kwp > 0 && (
            <Badge variant="outline" className="text-[9px] h-[18px] px-1.5 font-mono font-semibold border-info/30 text-info bg-info/5">
              <Zap className="h-2.5 w-2.5 mr-0.5" />
              {deal.deal_kwp.toFixed(1).replace(".", ",")} kWp
            </Badge>
          )}
        </div>

        {/* Row 3: Doc progress bar + economia */}
        {(docTotal > 0 || deal.proposta_economia_mensal || deal.expected_close_date) && (
          <div className="space-y-1.5">
            {docTotal > 0 && (
              <div className="flex items-center gap-2">
                <FileText className={cn("h-3 w-3 shrink-0", docDone === docTotal ? "text-success" : "icon-document")} />
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-300",
                      docDone === docTotal ? "bg-success" : docDone > 0 ? "bg-info" : "bg-muted-foreground/20"
                    )}
                    style={{ width: `${docTotal > 0 ? (docDone / docTotal) * 100 : 0}%` }}
                  />
                </div>
                <span className={cn("text-[10px] tabular-nums font-medium shrink-0", docDone === docTotal ? "text-success" : "text-muted-foreground")}>
                  {docDone}/{docTotal}
                </span>
              </div>
            )}
            <div className="flex items-center gap-3 text-[10px]">
              {deal.proposta_economia_mensal && (
                <span className="flex items-center gap-1 text-success font-medium">
                  <TrendingDown className="h-3 w-3" />
                  {formatBRL(deal.proposta_economia_mensal)}/mês
                </span>
              )}
              {deal.expected_close_date && (
                <span className={cn(
                  "flex items-center gap-1 ml-auto",
                  isOverdue ? "text-destructive font-semibold" : "text-muted-foreground"
                )}>
                  <Clock className="h-3 w-3" />
                  {new Date(deal.expected_close_date).toLocaleDateString("pt-BR")}
                  {isOverdue && <span className="text-[8px] uppercase tracking-wide font-bold">Atrasado</span>}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Row 5: Quick action icons */}
        <div className="flex items-center gap-1 pt-1.5 border-t border-border/40">
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="action-icon-btn action-icon-btn--whatsapp"
                  onClick={(e) => { e.stopPropagation(); if (deal.customer_phone) setWhatsappDialogOpen(true); }}
                  disabled={!deal.customer_phone}
                >
                  <MessageSquare className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-xs">WhatsApp</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="action-icon-btn action-icon-btn--proposal"
                  onClick={(e) => { e.stopPropagation(); onClick(); }}
                >
                  <FileText className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-xs">Propostas</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="action-icon-btn action-icon-btn--phone"
                  onClick={(e) => { e.stopPropagation(); if (deal.customer_phone) window.open(`tel:${deal.customer_phone}`); }}
                  disabled={!deal.customer_phone}
                >
                  <Phone className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-xs">Ligar</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="action-icon-btn action-icon-btn--calendar"
                  onClick={(e) => { e.stopPropagation(); onSchedule?.(deal); }}
                >
                  <Calendar className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-xs">Agendar</TooltipContent>
            </Tooltip>
            {deal.notas?.trim() && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="action-icon-btn action-icon-btn--note">
                    <StickyNote className="h-4 w-4" />
                  </span>
                </TooltipTrigger>
                <TooltipContent className="text-xs max-w-[250px]">
                  <p className="whitespace-pre-wrap">{deal.notas}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </TooltipProvider>

          {/* Spacer + Owner */}
          <div className="ml-auto flex items-center gap-1.5">
            <Avatar className="h-5 w-5 border border-border/50">
              <AvatarFallback className="text-[8px] font-bold bg-secondary/10 text-secondary">
                {getInitials(deal.owner_name)}
              </AvatarFallback>
            </Avatar>
            <span className={cn(
              "text-[10px] tabular-nums font-medium",
              stagnation === "critical" ? "text-destructive font-bold" :
              stagnation === "warning" ? "text-warning font-bold" :
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
