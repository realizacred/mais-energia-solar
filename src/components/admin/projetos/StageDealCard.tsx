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
  Calendar,
} from "lucide-react";
import { ScheduleWhatsAppDialog } from "@/components/vendor/ScheduleWhatsAppDialog";
import type { DealKanbanCard } from "@/hooks/useDealPipeline";
import { differenceInDays, differenceInHours } from "date-fns";
import { formatDate } from "@/lib/dateUtils";

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
  gerada: { label: "Gerada", className: "bg-success/10 text-success border-success/20" },
  generated: { label: "Gerada", className: "bg-success/10 text-success border-success/20" },
  enviada: { label: "Enviada", className: "bg-info/10 text-info border-info/20" },
  sent: { label: "Enviada", className: "bg-info/10 text-info border-info/20" },
  aceita: { label: "Aceita", className: "bg-success/15 text-success border-success/30" },
  accepted: { label: "Aceita", className: "bg-success/15 text-success border-success/30" },
  recusada: { label: "Recusada", className: "bg-destructive/10 text-destructive border-destructive/20" },
  rejected: { label: "Recusada", className: "bg-destructive/10 text-destructive border-destructive/20" },
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
  const allEtiquetaCfgs = useMemo(() => {
    const cfgs: { label: string; short: string; cor: string; icon: string | null }[] = [];
    if (deal.etiqueta_ids && deal.etiqueta_ids.length > 0) {
      deal.etiqueta_ids.forEach(eid => {
        const found = dynamicEtiquetas.find(e => e.id === eid);
        if (found) cfgs.push({ label: found.nome, short: found.short || found.nome.substring(0, 3).toUpperCase(), cor: found.cor, icon: found.icon });
      });
    }
    if (cfgs.length === 0 && deal.etiqueta) {
      const found = dynamicEtiquetas.find(e =>
        e.nome.toLowerCase() === deal.etiqueta?.toLowerCase() || e.id === deal.etiqueta
      );
      if (found) cfgs.push({ label: found.nome, short: found.short || found.nome.substring(0, 3).toUpperCase(), cor: found.cor, icon: found.icon });
    }
    return cfgs;
  }, [deal.etiqueta, deal.etiqueta_ids, dynamicEtiquetas]);

  const etiquetaCfg = allEtiquetaCfgs[0] || null;

  const isInactive = deal.deal_status === "perdido" || deal.deal_status === "cancelado";
  const propostaInfo = deal.proposta_status ? PROPOSTA_STATUS_MAP[deal.proposta_status] : null;
  const timeInStage = getTimeInStage(deal.last_stage_change);
  const stagnation = getStagnationLevel(deal.last_stage_change);
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);

  const DOC_KEYS = ["rg_cnh", "conta_luz", "iptu_imovel", "fotos", "autorizacao_art", "contrato_assinado"];
  const docTotal = deal.doc_checklist ? DOC_KEYS.length : 0;
  const docDone = deal.doc_checklist ? DOC_KEYS.filter(k => !!deal.doc_checklist![k]).length : 0;
  const isOverdue = deal.expected_close_date && new Date(deal.expected_close_date) < new Date();

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
    ? { borderLeftColor: etiquetaCfg.cor, borderLeftWidth: 3, borderLeftStyle: "solid" as const }
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
      <div className="p-2 space-y-1">
        {/* HEADER: Name + Value */}
        <div className="flex items-start justify-between gap-1.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <p className={cn(
                "text-[12px] font-semibold leading-tight line-clamp-1",
                isInactive ? "text-muted-foreground" : "text-foreground"
              )}>
                {deal.customer_name || deal.deal_title || "Sem nome"}
              </p>
              {deal.deal_num != null && (
                <span className="text-[9px] font-mono text-muted-foreground/60 shrink-0">
                  #{deal.deal_num}
                </span>
              )}
            </div>
          </div>
          <span className="text-[12px] font-bold text-foreground whitespace-nowrap tabular-nums shrink-0">
            {deal.deal_value > 0 ? formatBRL(deal.deal_value) : "R$ —"}
          </span>
        </div>

        {/* SUBHEADER: Location + kWp */}
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {(deal.customer_city || deal.customer_state) && (
            <span className="truncate">
              {[deal.customer_city, deal.customer_state].filter(Boolean).join(", ")}
            </span>
          )}
          <span className="flex items-center gap-0.5 shrink-0 font-medium">
            <Zap className="h-2.5 w-2.5 text-warning" />
            {deal.deal_kwp > 0 ? `${deal.deal_kwp.toFixed(1).replace(".", ",")} kWp` : "— kWp"}
          </span>
        </div>

        {/* STATUS + ETIQUETAS */}
        <div className="flex flex-wrap items-center gap-1">
          {propostaInfo ? (
            <Badge variant="outline" className={cn("text-[9px] h-[16px] px-1.5 font-medium border", propostaInfo.className)}>
              {propostaInfo.label}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[9px] h-[16px] px-1.5 font-medium text-muted-foreground border-border">
              Sem proposta
            </Badge>
          )}
          {allEtiquetaCfgs.map((et, i) => (
            <TooltipProvider key={i} delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className="inline-flex items-center gap-0.5 px-1.5 py-px rounded text-[8px] font-bold text-white"
                    style={{ backgroundColor: et.cor }}
                  >
                    {et.icon && <span className="text-[9px]">{et.icon}</span>}
                    {et.short || et.label}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">{et.label}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>

        {/* DOC PROGRESS (compact) */}
        {docTotal > 0 && docDone > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  docDone === docTotal ? "bg-success" : docDone > 0 ? "bg-info" : "bg-muted-foreground/20"
                )}
                style={{ width: `${(docDone / docTotal) * 100}%` }}
              />
            </div>
            <span className={cn("text-[9px] tabular-nums font-medium shrink-0", docDone === docTotal ? "text-success" : "text-muted-foreground")}>
              {docDone}/{docTotal}
            </span>
          </div>
        )}

        {/* METRICS LINE: economia + time */}
        <div className="flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-2">
            {deal.proposta_economia_mensal ? (
              <span className="flex items-center gap-0.5 text-success font-medium">
                <TrendingDown className="h-2.5 w-2.5" />
                {formatBRL(deal.proposta_economia_mensal)}/mês
              </span>
            ) : null}
            {deal.expected_close_date && (
              <span className={cn(
                "flex items-center gap-0.5",
                isOverdue ? "text-destructive font-semibold" : "text-muted-foreground"
              )}>
                <Clock className="h-2.5 w-2.5" />
                {formatDate(deal.expected_close_date)}
              </span>
            )}
          </div>

          {/* Owner + time in stage */}
          <div className="flex items-center gap-1">
            <Avatar className="h-4 w-4 border border-border/40">
              <AvatarFallback className="text-[7px] font-bold bg-muted text-muted-foreground">
                {getInitials(deal.owner_name)}
              </AvatarFallback>
            </Avatar>
            <span className={cn(
              "text-[9px] tabular-nums font-medium",
              stagnation === "critical" ? "text-destructive" :
              stagnation === "warning" ? "text-warning" :
              "text-muted-foreground"
            )}>
              {timeInStage}
            </span>
          </div>
        </div>

        {/* ACTIONS (inline, minimal — no separator bar) */}
        <div className="flex items-center gap-0.5">
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="action-icon-btn action-icon-btn--whatsapp"
                  onClick={(e) => { e.stopPropagation(); if (deal.customer_phone) setWhatsappDialogOpen(true); }}
                  disabled={!deal.customer_phone}
                >
                  <MessageSquare className="h-3 w-3" />
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
                  <FileText className="h-3 w-3" />
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
                  <Phone className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-xs">Ligar</TooltipContent>
            </Tooltip>
            {deal.notas?.trim() && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="action-icon-btn action-icon-btn--note">
                    <StickyNote className="h-3 w-3" />
                  </span>
                </TooltipTrigger>
                <TooltipContent className="text-xs max-w-[250px]">
                  <p className="whitespace-pre-wrap">{deal.notas}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </TooltipProvider>
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
          <ContextMenuItem className="text-xs gap-2" onClick={() => onClick()}>
            <ExternalLink className="h-3.5 w-3.5" /> Abrir detalhes
          </ContextMenuItem>
          <ContextMenuItem className="text-xs gap-2" onClick={() => { if (deal.customer_phone) setWhatsappDialogOpen(true); }} disabled={!deal.customer_phone}>
            <MessageSquare className="h-3.5 w-3.5" /> Enviar WhatsApp
          </ContextMenuItem>
          <ContextMenuItem className="text-xs gap-2" onClick={() => onSchedule?.(deal)}>
            <Calendar className="h-3.5 w-3.5" /> Agendar compromisso
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Gerenciar
          </ContextMenuLabel>
          <ContextMenuItem className="text-xs gap-2" onClick={() => onTransfer?.(deal)}>
            <UserPlus className="h-3.5 w-3.5" /> Transferir consultor
          </ContextMenuItem>
          <ContextMenuItem className="text-xs gap-2" onClick={() => onTag?.(deal)}>
            <Tag className="h-3.5 w-3.5" /> Alterar etiqueta
          </ContextMenuItem>
          <ContextMenuItem className="text-xs gap-2" onClick={() => { navigator.clipboard.writeText(deal.deal_id); }}>
            <Copy className="h-3.5 w-3.5" /> Copiar ID
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem className="text-xs gap-2 text-destructive focus:text-destructive" onClick={() => onArchive?.(deal)}>
            <Archive className="h-3.5 w-3.5" /> Arquivar
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
