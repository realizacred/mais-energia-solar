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
  Calendar, CheckCircle2,
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

import { PROPOSAL_STATUS_CONFIG } from "@/lib/proposalStatusConfig";
const PROPOSTA_STATUS_MAP = PROPOSAL_STATUS_CONFIG;

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

const AVATAR_COLORS = [
  "bg-primary/20 text-primary",
  "bg-success/20 text-success",
  "bg-info/20 text-info",
  "bg-warning/20 text-warning",
  "bg-secondary/20 text-secondary",
  "bg-destructive/20 text-destructive",
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export interface StageDealCardProps {
  deal: DealKanbanCard;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onClick: () => void;
  onProposalClick?: () => void;
  hasAutomation?: boolean;
  dynamicEtiquetas?: DynamicEtiqueta[];
  onArchive?: (deal: DealKanbanCard) => void;
  onTransfer?: (deal: DealKanbanCard) => void;
  onTag?: (deal: DealKanbanCard) => void;
  onSchedule?: (deal: DealKanbanCard) => void;
  cardVisibleFields?: string[];
}

export function StageDealCard({
  deal,
  isDragging,
  onDragStart,
  onClick,
  onProposalClick,
  dynamicEtiquetas = [],
  onArchive,
  onTransfer,
  onTag,
  onSchedule,
  cardVisibleFields,
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
  const hasActiveProposal = Boolean(deal.proposta_id && deal.proposta_status && deal.proposta_status !== "excluida");
  const hasValue = typeof deal.deal_value === "number" && deal.deal_value > 0;
  const hasKwp = typeof deal.deal_kwp === "number" && deal.deal_kwp > 0;
  const propostaInfo = hasActiveProposal && deal.proposta_status ? PROPOSTA_STATUS_MAP[deal.proposta_status] : null;
  const stagnation = getStagnationLevel(deal.last_stage_change);
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const visibleFields = new Set(cardVisibleFields || ["valor_projeto", "potencia_kwp", "cidade"]);

  const DOC_KEYS = ["rg_cnh", "conta_luz", "iptu_imovel", "fotos", "autorizacao_art", "contrato_assinado"];
  const docTotal = deal.doc_checklist ? DOC_KEYS.length : 0;
  const docDone = deal.doc_checklist ? DOC_KEYS.filter(k => !!deal.doc_checklist![k]).length : 0;
  const isOverdue = deal.expected_close_date && new Date(deal.expected_close_date) < new Date();

  const isWonLost = deal.deal_status === "won" || deal.deal_status === "lost";
  const normalizedProposalStatus = deal.proposta_status?.toLowerCase() ?? "";
  const hasTrackedProposalStatus = normalizedProposalStatus.length > 0 && normalizedProposalStatus !== "excluida";
  const isPropostaRecusada = hasTrackedProposalStatus && ["recusada", "rejeitada", "perdida", "rejected"].includes(normalizedProposalStatus);
  const isPropostaAceita = hasTrackedProposalStatus && ["aceita", "accepted", "aprovada", "ganha"].includes(normalizedProposalStatus);
  const hasEtiquetaColor = !!etiquetaCfg?.cor;
  const borderClass = isWonLost
    ? (deal.deal_status === "won" ? "kanban-card--won" : "kanban-card--lost")
    : isPropostaAceita
      ? "kanban-card--proposal-accepted"
      : isPropostaRecusada
        ? "kanban-card--proposal-rejected"
        : stagnation === "critical"
          ? "kanban-card--stagnation-critical"
          : stagnation === "warning"
            ? "kanban-card--stagnation-warning"
            : hasEtiquetaColor
              ? "kanban-card--etiqueta"
              : propostaInfo
                ? "kanban-card--has-proposal"
                : "kanban-card--no-proposal";

  const topBarStyle = hasEtiquetaColor && !isWonLost && !isPropostaRecusada && !isPropostaAceita && !stagnation
    ? { background: `linear-gradient(180deg, ${etiquetaCfg.cor}, ${etiquetaCfg.cor}80)` }
    : undefined;

  // Format time as Xh XXmin
  function formatTimeInStage(lastChange: string) {
    const hours = differenceInHours(new Date(), new Date(lastChange));
    if (hours < 1) return "agora";
    if (hours < 24) {
      return `${hours}h 00min`;
    }
    const days = differenceInDays(new Date(), new Date(lastChange));
    const remainingHours = hours - (days * 24);
    return `${days * 24 + remainingHours}h`;
  }

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
    >
      {/* Left color bar */}
      <div className="kanban-card__top-bar" style={topBarStyle} />

      <div className="relative px-3 pt-2.5 pb-2.5 space-y-2 flex-1 min-w-0">
        {/* Accepted check icon */}
        {isPropostaAceita && (
          <div className="absolute top-2.5 right-3">
            <CheckCircle2 className="h-4 w-4 text-success" />
          </div>
        )}

        {/* HEADER: Avatar + Name + kWp badge */}
        <div className="flex items-center gap-2.5">
          <Avatar className="h-8 w-8 border border-border/40 shrink-0">
            <AvatarFallback className={cn("text-[10px] font-bold", getAvatarColor(deal.customer_name || deal.deal_title || "?"))}>
              {getInitials(deal.customer_name || deal.deal_title || "?")}
            </AvatarFallback>
          </Avatar>
            <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className={cn(
                "text-sm font-semibold leading-tight line-clamp-2",
                isInactive ? "text-muted-foreground" : "text-foreground"
              )}>
                {deal.customer_name || "Sem nome"}
              </p>
              {deal.deal_num != null && (
                <span className="text-[10px] font-mono text-muted-foreground/70 shrink-0">
                  #{deal.deal_num}
                </span>
              )}
            </div>
            {visibleFields.has("cidade") && (deal.customer_city || deal.customer_state) && (
              <p className="text-[11px] text-muted-foreground truncate leading-snug mt-0.5">
                {[deal.customer_city, deal.customer_state].filter(Boolean).join(", ")}
              </p>
            )}
          </div>
          {visibleFields.has("potencia_kwp") && hasKwp && (
            <Badge variant="outline" className="shrink-0 text-[10px] h-[20px] px-1.5 font-semibold bg-success/10 text-success border-success/20 gap-0.5">
              <Zap className="h-3 w-3" />
              {deal.deal_kwp.toFixed(1).replace(".", ",")}
            </Badge>
          )}
        </div>

        {/* METRICS — value + time + status */}
        {visibleFields.has("valor_projeto") && (
          <div className="flex items-center gap-2 text-xs px-0.5">
            <span className="font-bold tabular-nums text-foreground text-sm">
              {hasValue ? formatBRL(deal.deal_value) : "R$ —"}
            </span>
            <span className="text-muted-foreground/30">·</span>
            <span className={cn(
              "tabular-nums font-medium",
              stagnation === "critical" ? "text-destructive" :
              stagnation === "warning" ? "text-warning" :
              "text-muted-foreground"
            )}>
              {formatTimeInStage(deal.last_stage_change)}
            </span>
            {propostaInfo && (
              <>
                <span className="text-muted-foreground/30">·</span>
                <Badge variant="outline" className={cn("text-[9px] h-[18px] px-1.5 py-0 font-medium border", propostaInfo.className)}>
                  {propostaInfo.label}
                </Badge>
              </>
            )}
          </div>
        )}

        {/* ETIQUETAS */}
        {allEtiquetaCfgs.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            {allEtiquetaCfgs.map((et, i) => (
              <TooltipProvider key={i} delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[9px] font-bold text-white shadow-sm"
                      style={{ backgroundColor: et.cor }}
                    >
                      {et.icon && <span className="text-[10px]">{et.icon}</span>}
                      {et.short || et.label}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">{et.label}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        )}

        {/* DOC PROGRESS */}
        {docTotal > 0 && docDone > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  docDone === docTotal ? "bg-success" : docDone > 0 ? "bg-info" : "bg-muted-foreground/20"
                )}
                style={{ width: `${(docDone / docTotal) * 100}%` }}
              />
            </div>
            <span className={cn("text-[10px] tabular-nums font-medium shrink-0", docDone === docTotal ? "text-success" : "text-muted-foreground")}>
              {docDone}/{docTotal}
            </span>
          </div>
        )}

        {/* FOOTER: Actions + Owner */}
        <div className="flex items-center justify-between pt-1.5 border-t border-border/30">
          <div className="flex items-center gap-0.5">
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="action-icon-btn action-icon-btn--whatsapp"
                    onClick={(e) => { e.stopPropagation(); if (deal.customer_phone) setWhatsappDialogOpen(true); }}
                    disabled={!deal.customer_phone}
                  >
                    <MessageSquare className="h-3.5 w-3.5 md:h-3 md:w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-xs">WhatsApp</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="action-icon-btn action-icon-btn--phone"
                    onClick={(e) => { e.stopPropagation(); if (deal.customer_phone) window.open(`tel:${deal.customer_phone}`); }}
                    disabled={!deal.customer_phone}
                  >
                    <Phone className="h-3.5 w-3.5 md:h-3 md:w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-xs">Ligar</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="action-icon-btn action-icon-btn--proposal"
                    onClick={(e) => { e.stopPropagation(); onProposalClick ? onProposalClick() : onClick(); }}
                  >
                    <FileText className="h-3.5 w-3.5 md:h-3 md:w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-xs">Propostas</TooltipContent>
              </Tooltip>
              {deal.notas?.trim() && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="action-icon-btn action-icon-btn--note">
                      <StickyNote className="h-3.5 w-3.5 md:h-3 md:w-3" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="text-xs max-w-[250px]">
                    <p className="whitespace-pre-wrap">{deal.notas}</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </TooltipProvider>
          </div>

          {/* Owner + expected close */}
          <div className="flex items-center gap-1.5">
            {deal.expected_close_date && (
              <span className={cn(
                "flex items-center gap-0.5 text-[10px]",
                isOverdue ? "text-destructive font-semibold" : "text-muted-foreground"
              )}>
                <Clock className="h-3 w-3" />
                {formatDate(deal.expected_close_date)}
              </span>
            )}
            <Avatar className="h-5 w-5 border border-border/40">
              <AvatarFallback className={cn("text-[7px] font-bold", getAvatarColor(deal.owner_name))}>
                {getInitials(deal.owner_name)}
              </AvatarFallback>
            </Avatar>
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
