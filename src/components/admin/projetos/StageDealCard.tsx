import { useState, useMemo, useRef, useCallback, useEffect, memo } from "react";
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
  Calendar, CheckCircle2, AlertTriangle, ShieldCheck, UserCog,
  MapPin, Lock as LockIcon, DollarSign, AlertCircle
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
import { PropostaBadge } from "./PropostaBadge";
import { PROPOSAL_STATUS_CONFIG } from "@/lib/proposalStatusConfig";
const PROPOSTA_STATUS_MAP = PROPOSAL_STATUS_CONFIG;


function getTimeInStage(lastChange: string) {
  const hours = differenceInHours(new Date(), new Date(lastChange));
  if (hours < 1) return "agora";
  if (hours < 24) return `${hours}h`;
  const days = differenceInDays(new Date(), new Date(lastChange));
  if (days >= 30) {
    const months = Math.floor(days / 30);
    return `${months} ${months === 1 ? "mês" : "meses"}`;
  }
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

function StageDealCardImpl({
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
  // -------- Stale-closure shield (RB-176 / AP-54) --------
  // A custom equality do `memo` IGNORA identidade de callbacks (eles são recriados
  // inline pelo pai a cada render). Para evitar que handlers do card disparem uma
  // versão "velha" do callback do pai, mantemos os últimos refs vivos via useRef
  // e expomos handlers internos ESTÁVEIS que sempre leem do ref + `deal` corrente.
  // Isso preserva a memoização (sem rebind por render do pai) E garante frescor.
  const latest = useRef({ onClick, onDragStart, onProposalClick, onArchive, onTransfer, onTag, onSchedule });
  useEffect(() => {
    latest.current = { onClick, onDragStart, onProposalClick, onArchive, onTransfer, onTag, onSchedule };
  });

  const handleClick = useCallback(() => latest.current.onClick?.(), []);
  const handleDragStart = useCallback(
    (e: React.DragEvent) => latest.current.onDragStart?.(e, deal.deal_id),
    [deal.deal_id],
  );
  // handleProposalClick intencionalmente omitido: prop existe mas não é consumida no JSX hoje.
  const handleArchive = useCallback(() => latest.current.onArchive?.(deal), [deal]);
  const handleTransfer = useCallback(() => latest.current.onTransfer?.(deal), [deal]);
  const handleTag = useCallback(() => latest.current.onTag?.(deal), [deal]);
  const handleSchedule = useCallback(() => latest.current.onSchedule?.(deal), [deal]);

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
  const isPropostaAceita = hasTrackedProposalStatus && ["aceita", "accepted"].includes(normalizedProposalStatus);
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

  // SLA Calculation Logic
  const slaDays = deal.sla_days || 0;
  const daysInStage = differenceInDays(new Date(), new Date(deal.last_stage_change));
  
  const operationalStatus = useMemo(() => {
    const isBlocked = (deal.notas?.toLowerCase().includes("bloqueado")) || deal.pendencias?.some(p => p.bloqueia_fluxo);
    if (isBlocked) return "blocked";

    if (slaDays > 0) {
      if (daysInStage > slaDays * 1.5) return "critical";
      if (daysInStage >= slaDays) return "delayed";
      if (daysInStage >= slaDays * 0.8) return "attention";
    }
    
    const hours = differenceInHours(new Date(), new Date(deal.last_stage_change));
    if (hours >= 168) return "critical"; // 7 days fallback
    if (hours >= 72) return "attention"; // 3 days fallback
    
    return "normal";
  }, [deal.last_stage_change, deal.notas, deal.pendencias, slaDays, daysInStage]);

  const isBlocked = operationalStatus === "blocked";
  const isCritical = operationalStatus === "critical";
  const isDelayed = operationalStatus === "delayed";
  const isAttention = operationalStatus === "attention";

  function formatTimeInStage(lastChange: string) {
    const hours = differenceInHours(new Date(), new Date(lastChange));
    if (hours < 1) return "agora";
    if (hours < 24) return `${hours}h`;
    const days = differenceInDays(new Date(), new Date(lastChange));
    if (days >= 30) {
      const months = Math.floor(days / 30);
      return `${months} ${months === 1 ? "mês" : "meses"}`;
    }
    return `${days}d`;
  }

  const mainPendencia = deal.pendencias?.sort((a, b) => {
    const priority = { critica: 4, alta: 3, media: 2, baixa: 1 };
    return (priority[b.criticidade as keyof typeof priority] || 0) - (priority[a.criticidade as keyof typeof priority] || 0);
  })[0];


  
  const cardContent = (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={handleClick}
      className={cn(
        "kanban-card group transition-all duration-200",
        borderClass,
        isDragging && "kanban-card--dragging shadow-xl scale-[1.02]",
        // Escalonamento de criticidade — vermelho APENAS para bloqueio/crítico real.
        // Atenção/atraso já são comunicados pela top-bar colorida + cor do tempo.
        isBlocked && "border-l-2 border-l-destructive",
        isCritical && !isBlocked && "border-l-2 border-l-destructive/70"
      )}
    >
      {/* Left color bar */}
      <div className="kanban-card__top-bar" style={topBarStyle} />

      <div className="relative px-3 pt-2 pb-2 space-y-2 flex-1 min-w-0">
        {/* HEADER: Code + Client Name + Block Indicator */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-0.5">
              {deal.deal_num && (
                <span className="text-[9px] font-mono font-bold text-primary bg-primary/10 px-1 rounded">
                  #{deal.deal_num}
                </span>
              )}
              <p className={cn(
                "text-xs font-bold leading-tight line-clamp-1",
                isInactive ? "text-muted-foreground" : "text-foreground"
              )}>
                {deal.customer_name || "Sem nome"}
              </p>
            </div>
            {visibleFields.has("cidade") && (deal.customer_city || deal.customer_state) && (
              <p className="text-[10px] text-muted-foreground truncate leading-snug flex items-center gap-1">
                <MapPin className="h-2 w-2" />
                {[deal.customer_city, deal.customer_state].filter(Boolean).join(", ")}
              </p>
            )}
            <p className="text-[9px] text-primary/70 font-semibold uppercase mt-0.5 tracking-tight line-clamp-1">
              {deal.stage_name}
            </p>
          </div>
          
          <div className="flex flex-col items-end gap-1">
            {(deal as any).operational_score > 0 && (
              <Badge variant="outline" className={cn(
                "h-5 text-[10px] font-bold tabular-nums border",
                (deal as any).operational_score > 150 ? "border-destructive/40 text-destructive bg-destructive/5" :
                (deal as any).operational_score > 100 ? "border-warning/40 text-warning bg-warning/5" :
                "border-border text-muted-foreground bg-muted/30"
              )}>
                {(deal as any).operational_score}
              </Badge>
            )}
            {isBlocked ? (
              <Badge variant="outline" className="shrink-0 text-[9px] h-[18px] px-1.5 font-semibold gap-1 border-destructive/40 text-destructive bg-destructive/5">
                <LockIcon className="h-2.5 w-2.5" />
                Bloqueado
              </Badge>
            ) : isPropostaAceita ? (
              <Badge variant="outline" className="shrink-0 text-[9px] h-[18px] px-1.5 font-semibold gap-1 border-success/40 text-success bg-success/5">
                <ShieldCheck className="h-2.5 w-2.5" />
                Aceita
              </Badge>
            ) : null}
          </div>
        </div>

        {/* OPERATIONAL EXECUTION (Phase 2C) */}
        {(deal.proxima_acao || deal.responsavel_operacional) && (
          <div className="bg-primary/[0.04] rounded-md p-2 space-y-1.5">
            {deal.proxima_acao && (
              <div className="flex items-start gap-1.5">
                <div className="mt-0.5 p-0.5 bg-primary/20 rounded shadow-sm">
                  <Zap className="h-2.5 w-2.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[8px] uppercase font-bold text-primary/70 tracking-tighter block leading-none mb-0.5">Próxima Ação</span>
                  <p className="text-[10px] font-bold text-foreground leading-tight line-clamp-1">{deal.proxima_acao}</p>
                </div>
              </div>
            )}
            
            <div className="flex items-center justify-between pt-1">
              {deal.responsavel_operacional && (
                <div className="flex items-center gap-1.5">
                  <UserCog className="h-3 w-3 text-primary/60" />
                  <span className="text-[9px] font-bold text-muted-foreground uppercase">{deal.responsavel_operacional}</span>
                </div>
              )}
              {deal.prazo_acao && (
                <div className={cn(
                  "flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold",
                  new Date(deal.prazo_acao) < new Date() ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
                )}>
                  <Calendar className="h-2.5 w-2.5" />
                  {formatDate(deal.prazo_acao)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* DEPENDENCY INDICATOR */}
        {deal.dependencia_tipo && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded-md">
            <AlertCircle className="h-3 w-3 text-amber-600" />
            <span className="text-[9px] font-bold text-amber-700 uppercase">Aguardando: {deal.dependencia_tipo}</span>
          </div>
        )}

        {/* OPERATIONAL INFO: SLA / Time in Stage + Responsibility */}
        <div className="flex items-center justify-between bg-muted/30 rounded-md p-1.5">
          <div className="flex flex-col gap-0.5">
            <span className="text-[8px] uppercase font-bold text-muted-foreground tracking-tighter">
              {isBlocked ? "Parado há" : "Com a bola há"}
            </span>
            <div className={cn(
              "flex items-center gap-1 text-[12px] font-bold tabular-nums",
              isCritical || isBlocked ? "text-destructive" :
              isDelayed ? "text-warning" :
              "text-foreground"
            )}>
              <Clock className="h-3 w-3" />
              {formatTimeInStage(deal.last_stage_change)}
              {slaDays > 0 && (
                <span className="text-[8px] font-normal text-muted-foreground ml-1">
                  / {slaDays}d
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[8px] uppercase font-bold text-muted-foreground tracking-tighter">Responsável</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-foreground truncate max-w-[80px]">
                {deal.responsavel_operacional || deal.owner_name}
              </span>
              <Avatar className="h-5 w-5 border border-border/60">
                <AvatarFallback className={cn("text-[7px] font-bold", getAvatarColor(deal.responsavel_operacional || deal.owner_name))}>
                  {getInitials(deal.responsavel_operacional || deal.owner_name)}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>

        {/* PENDENCIES: Real Operational Obstacles */}
        {mainPendencia && (
          <div className={cn(
            "flex items-start gap-1.5 rounded p-1.5",
            mainPendencia.criticidade === 'critica'
              ? "bg-destructive/5 border border-destructive/20"
              : "bg-warning/5 border border-warning/20"
          )}>
            <AlertTriangle className={cn(
              "h-3 w-3 shrink-0 mt-0.5",
              mainPendencia.criticidade === 'critica'
                ? "text-destructive"
                : "text-warning"
            )} />
            <div className="flex-1 min-w-0">
              <p className={cn(
                "text-[10px] font-bold leading-tight line-clamp-1",
                mainPendencia.criticidade === 'critica'
                  ? "text-destructive"
                  : "text-foreground"
              )}>
                {mainPendencia.titulo}
              </p>
              {mainPendencia.sla_at && (
                <span className="text-[8px] text-muted-foreground block mt-0.5">
                  SLA: {formatDate(mainPendencia.sla_at)}
                </span>
              )}
            </div>
            {mainPendencia.bloqueia_fluxo && (
              <LockIcon className="h-2.5 w-2.5 text-destructive shrink-0" />
            )}
          </div>
        )}

        {/* FALLBACK NOTE: If no formal pendency exists */}
        {!mainPendencia && deal.notas?.trim() && (
          <div className="flex items-start gap-1.5 bg-warning/5 border border-warning/20 rounded p-1.5">
            <StickyNote className="h-3 w-3 text-warning shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-900/80 leading-tight line-clamp-2 italic">
              {deal.notas}
            </p>
          </div>
        )}

        {/* METRICS & ETIQUETAS (Commercial Data - Secondary) */}
        <div className="flex items-center justify-between pt-1 border-t border-border/20 mt-1">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-[10px] font-mono">
              <Zap className="h-2.5 w-2.5 text-success" />
              <span className="font-bold">{hasKwp ? deal.deal_kwp.toFixed(1).replace(".", ",") : "—"}</span>
              <span className="text-muted-foreground text-[8px]">kWp</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-mono">
              <DollarSign className="h-2.5 w-2.5 text-warning" />
              <span className="font-bold">{hasValue ? formatBRL(deal.deal_value) : "—"}</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {allEtiquetaCfgs.slice(0, 2).map((et, i) => (
              <span
                key={i}
                className="h-3.5 px-1.5 rounded-full text-[8px] font-bold text-white shadow-sm flex items-center justify-center"
                style={{ backgroundColor: et.cor }}
              >
                {et.short || et.label.substring(0, 3)}
              </span>
            ))}
            {allEtiquetaCfgs.length > 2 && (
              <span className="text-[8px] font-bold text-muted-foreground">+{allEtiquetaCfgs.length - 2}</span>
            )}
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
          <ContextMenuItem className="text-xs gap-2" onClick={handleClick}>
            <ExternalLink className="h-3.5 w-3.5" /> Abrir detalhes
          </ContextMenuItem>
          <ContextMenuItem className="text-xs gap-2" onClick={() => { if (deal.customer_phone) setWhatsappDialogOpen(true); }} disabled={!deal.customer_phone}>
            <MessageSquare className="h-3.5 w-3.5" /> Enviar WhatsApp
          </ContextMenuItem>
          <ContextMenuItem className="text-xs gap-2" onClick={handleSchedule}>
            <Calendar className="h-3.5 w-3.5" /> Agendar compromisso
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Gerenciar
          </ContextMenuLabel>
          <ContextMenuItem className="text-xs gap-2" onClick={handleTransfer}>
            <UserPlus className="h-3.5 w-3.5" /> Transferir consultor
          </ContextMenuItem>
          <ContextMenuItem className="text-xs gap-2" onClick={handleTag}>
            <Tag className="h-3.5 w-3.5" /> Alterar etiqueta
          </ContextMenuItem>
          <ContextMenuItem className="text-xs gap-2" onClick={() => { navigator.clipboard.writeText(deal.deal_id); }}>
            <Copy className="h-3.5 w-3.5" /> Copiar ID
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem className="text-xs gap-2 text-destructive focus:text-destructive" onClick={handleArchive}>
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

/**
 * Memoized export — RB-176 / AP-54 compliance.
 *
 * Stability contract:
 *  - Re-render APENAS quando dados visíveis do card mudarem: `deal` (ref), `isDragging`,
 *    `hasAutomation`, `dynamicEtiquetas`, `cardVisibleFields`.
 *  - Callbacks (onClick, onDragStart, onProposalClick, onArchive, onTransfer, onTag,
 *    onSchedule) são INTENCIONALMENTE IGNORADOS na equality — pais inline-arrow os
 *    recriam a cada render e isso destruiria a memoização.
 *
 * Stale-closure shield (interno):
 *  - Os callbacks externos vivos são espelhados em `latest` (useRef) atualizado em
 *    cada commit (`useEffect` sem deps). Handlers internos do card são `useCallback`
 *    estáveis que sempre disparam `latest.current.*` com o `deal` corrente do render.
 *  - Resultado: mesmo que o pai passe um onArchive/onTransfer/... "novo" sem mudar
 *    `deal` (e nós pulemos o render), o próximo clique ainda chamará a versão MAIS
 *    NOVA do callback — sem closure stale, sem flicker, sem rebind.
 *
 * Re-renderiza quando: `deal` muda por referência (React Query structural sharing
 * já garante referência estável quando o conteúdo não muda), drag state muda,
 * automação muda, etiquetas dinâmicas mudam, ou conjunto de campos visíveis muda.
 */
export const StageDealCard = memo(StageDealCardImpl, (prev, next) => {
  if (prev.deal !== next.deal) return false;
  if (prev.isDragging !== next.isDragging) return false;
  if (prev.hasAutomation !== next.hasAutomation) return false;
  if (prev.dynamicEtiquetas !== next.dynamicEtiquetas) return false;
  if (prev.cardVisibleFields !== next.cardVisibleFields) return false;
  return true;
});

