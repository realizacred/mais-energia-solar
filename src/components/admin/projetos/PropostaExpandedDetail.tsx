import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { invalidatePropostaCaches } from "@/lib/invalidatePropostaCaches";
import { getProposalWebUrl } from "@/services/proposal/proposalLinks";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";

import { useNavigate } from "react-router-dom";
import { ProposalSnapshotView } from "@/components/admin/propostas-nativas/ProposalSnapshotView";
import { StepDocumento } from "@/components/admin/propostas-nativas/wizard/StepDocumento";
import { WizardProvider, useWizardContext } from "@/components/admin/propostas-nativas/wizard/WizardContext";
import { ProposalViewsCard } from "@/components/admin/propostas-nativas/ProposalViewsCard";
import {
  Zap, SunMedium, DollarSign, FileText, Eye, Pencil, Copy, Trash2, Download,
  ChevronDown, MoreVertical, ExternalLink, AlertCircle, AlertTriangle, CheckCircle, Loader2,
  Link2, MessageCircle, Mail, CalendarCheck, RefreshCw, Home, Building2, Star, FolderOpen, MessageSquareText, RotateCcw,
  FilePlus, FileCheck, Clock, TrendingUp, PiggyBank, Timer, Trophy
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatNumberBR } from "@/lib/formatters";
import { formatTirPercent } from "@/lib/tirDisplay";
import { cn } from "@/lib/utils";
import { renderProposal, sendProposal } from "@/services/proposalApi";
import { useLazyTemplateAssign } from "@/hooks/useLazyTemplateAssign";
import { getCanonicalProposalTotal } from "@/services/proposal/proposalTotals";
import { formatDateTime, formatDate, formatTime, formatDateShort } from "@/lib/dateUtils";
import { ProposalMessageDrawer } from "./ProposalMessageDrawer";
import { ProposalMessageHistory } from "./ProposalMessageHistory";
import { ClonePropostaModal } from "./ClonePropostaModal";
import { useExcluirProposta } from "@/hooks/usePropostasProjetoTab";
import { usePropostaExpandedSnapshot, usePropostaExpandedUcs, usePropostaExpandedKitItems, usePropostaAuditLogs, usePropostaEvents, type UCDetailData, type ProposalEventEntry } from "@/hooks/usePropostaExpandedData";
import { useReabrirProposta, useIsAdminOrGerente } from "@/hooks/useReabrirProposta";
import { useProposalTemplates } from "@/hooks/useProposalTemplates";
import { PropostaBadge } from "./PropostaBadge";
import { getAvailableProposalActions } from "@/domain/proposal/proposalActionsHelper";
import { isProposalAccepted, normalizeStatus } from "@/domain/proposal/proposalStatus";




// ─── Types ──────────────────────────────────────────

interface VersaoData {
  id: string;
  versao_numero: number;
  valor_total: number;
  potencia_kwp: number | null;
  status: string;
  economia_mensal: number | null;
  payback_meses: number | null;
  created_at: string;
  geracao_mensal: number | null;
  output_pdf_path: string | null;
  output_docx_path: string | null;
  link_pdf: string | null;
  public_slug: string | null;
  gerado_em: string | null;
  template_id_used?: string | null;
  generation_status?: string | null;
  generation_error?: string | null;
  tir?: number | null;
  vpl?: number | null;
}

interface PropostaData {
  id: string;
  titulo: string | null;
  codigo: string | null;
  proposta_num: number | null;
  versao_atual: number | null;
  status: string;
  created_at: string;
  cliente_nome: string | null;
  is_principal: boolean;
  aceita_at: string | null;
  enviada_at: string | null;
  recusada_at: string | null;
  origem: string | null;
  versoes: VersaoData[];
}

interface SnapshotData {
  itens?: Array<{
    descricao: string;
    quantidade: number;
    preco_unitario: number;
    categoria: string;
    fabricante?: string;
    modelo?: string;
  }>;
  ucs?: Array<{
    nome: string;
    is_geradora?: boolean;
    consumo_mensal: number;
    tarifa_distribuidora?: number;
    geracao_mensal_estimada?: number;
  }>;
  servicos?: Array<{
    descricao: string;
    categoria?: string;
    valor: number;
    incluso_no_preco?: boolean;
    incluso?: boolean;
  }>;
  venda?: {
    custo_kit?: number;
    custo_instalacao?: number;
    custo_comissao?: number;
    custo_outros?: number;
    margem_percentual?: number;
    desconto_percentual?: number;
  };
}

// UCDetailData imported from usePropostaExpandedData hook

// ─── Unified Timeline ────────────────────────────────

interface TimelineEntry {
  id: string;
  source: "audit" | "event";
  label: string;
  icon: React.ReactNode;
  dotClass: string;
  badgeClass: string;
  userName: string;
  created_at: string;
}

const EVENT_META: Record<string, { label: string; dotClass: string; badgeClass: string; iconKey: string }> = {
  created: { label: "Criou a proposta", dotClass: "border-success/40 bg-success/10 text-success", badgeClass: "bg-success/10 text-success", iconKey: "filePlus" },
  version_created: { label: "Gerou nova versão", dotClass: "border-warning/40 bg-warning/10 text-warning", badgeClass: "bg-warning/10 text-warning", iconKey: "fileCheck" },
  status_change: { label: "Alterou status", dotClass: "border-primary/40 bg-primary/10 text-primary", badgeClass: "bg-primary/10 text-primary", iconKey: "refresh" },
  deleted: { label: "Excluiu a proposta", dotClass: "border-destructive/40 bg-destructive/10 text-destructive", badgeClass: "bg-destructive/10 text-destructive", iconKey: "trash" },
  cloned: { label: "Clonou a proposta", dotClass: "border-info/40 bg-info/10 text-info", badgeClass: "bg-info/10 text-info", iconKey: "copy" },
  proposta_enviada: { label: "Enviou a proposta", dotClass: "border-info/40 bg-info/10 text-info", badgeClass: "bg-info/10 text-info", iconKey: "mail" },
  proposta_visualizada: { label: "Proposta visualizada pelo cliente", dotClass: "border-warning/40 bg-warning/10 text-warning", badgeClass: "bg-warning/10 text-warning", iconKey: "eye" },
  proposta_aceita: { label: "Proposta aceita pelo cliente", dotClass: "border-success/40 bg-success/10 text-success", badgeClass: "bg-success/10 text-success", iconKey: "check" },
  proposta_recusada: { label: "Proposta recusada pelo cliente", dotClass: "border-destructive/40 bg-destructive/10 text-destructive", badgeClass: "bg-destructive/10 text-destructive", iconKey: "trash" },
};

function getEventIcon(iconKey: string): React.ReactNode {
  switch (iconKey) {
    case "filePlus": return <FilePlus className="h-3 w-3" />;
    case "fileCheck": return <FileCheck className="h-3 w-3" />;
    case "refresh": return <RefreshCw className="h-3 w-3" />;
    case "trash": return <Trash2 className="h-3 w-3" />;
    case "copy": return <Copy className="h-3 w-3" />;
    case "mail": return <Mail className="h-3 w-3" />;
    case "eye": return <Eye className="h-3 w-3" />;
    case "check": return <CheckCircle className="h-3 w-3" />;
    default: return <Clock className="h-3 w-3" />;
  }
}

function getStatusChangeLabel(payload: Record<string, any> | null): string {
  if (!payload) return "Alterou status";
  const prev = payload.previous_status || payload.previousStatus;
  const next = payload.new_status || payload.newStatus;
  if (prev && next) return `Status: ${prev} → ${next}`;
  if (next) return `Status alterado para ${next}`;
  return "Alterou status";
}

function useMergedTimeline(
  auditLogs: Array<{ id: string; acao: string; tabela: string; user_email: string | null; created_at: string }>,
  events: ProposalEventEntry[],
  propostaCreatedAt?: string | null,
  dealStatus?: string,
  acceptedAt?: string | null
): TimelineEntry[] {

  return useMemo(() => {
    const entries: TimelineEntry[] = [];

    // Add proposal_events (semantic — primary source)
    for (const ev of events) {
      const meta = EVENT_META[ev.tipo];
      if (!meta) continue;
      const label = ev.tipo === "status_change" ? getStatusChangeLabel(ev.payload) : meta.label;
      entries.push({
        id: `ev-${ev.id}`,
        source: "event",
        label,
        icon: getEventIcon(meta.iconKey),
        dotClass: meta.dotClass,
        badgeClass: meta.badgeClass,
        userName: "SISTEMA",
        created_at: ev.created_at,
      });
    }

    // Track event timestamps to deduplicate audit_logs
    const eventTimestamps = new Set(events.map(e => new Date(e.created_at).getTime()));

    // Heurística de migração: agrupar audit_logs do tipo 'sistema' que ocorreram
    // dentro de janela de 60s ao redor da criação da proposta em UMA única entrada
    // "Importado do SolarMarket". Evita ruído de 5+ linhas idênticas na timeline.
    const propCreatedTime = propostaCreatedAt ? new Date(propostaCreatedAt).getTime() : null;
    const MIGRATION_WINDOW_MS = 60_000;
    const migrationLogIds = new Set<string>();
    let migrationAnchor: { id: string; created_at: string } | null = null;

    if (propCreatedTime !== null) {
      for (const log of auditLogs) {
        if (log.user_email !== "sistema") continue;
        const logTime = new Date(log.created_at).getTime();
        if (Math.abs(logTime - propCreatedTime) <= MIGRATION_WINDOW_MS) {
          migrationLogIds.add(log.id);
          // Usa o log mais antigo como âncora (representa o momento da importação)
          if (!migrationAnchor || new Date(log.created_at).getTime() < new Date(migrationAnchor.created_at).getTime()) {
            migrationAnchor = { id: log.id, created_at: log.created_at };
          }
        }
      }
    }

    // Só agrupa se houver 2+ logs de migração (evita esconder ações legítimas isoladas)
    const shouldGroupMigration = migrationLogIds.size >= 2 && migrationAnchor !== null;

    if (shouldGroupMigration && migrationAnchor) {
      entries.push({
        id: `mig-${migrationAnchor.id}`,
        source: "audit",
        label: "Importado do SolarMarket",
        icon: <FilePlus className="h-3 w-3" />,
        dotClass: "border-info/40 bg-info/10 text-info",
        badgeClass: "bg-info/10 text-info",
        userName: "SISTEMA",
        created_at: migrationAnchor.created_at,
      });
    }

    // Add audit_logs that DON'T overlap with events (within 5s window)
    // e que não façam parte do grupo de migração já consolidado
    for (const log of auditLogs) {
      if (shouldGroupMigration && migrationLogIds.has(log.id)) continue;

      const logTime = new Date(log.created_at).getTime();
      // Skip if there's a proposal_event within 5 seconds (likely same action)
      const hasDuplicate = [...eventTimestamps].some(evTime => Math.abs(evTime - logTime) < 5000);
      if (hasDuplicate) continue;

      const audit = getAuditMeta(log.acao, log.tabela);
      const userName = log.user_email === "sistema"
        ? "SISTEMA"
        : log.user_email?.split("@")[0]?.toUpperCase() || "SISTEMA";

      entries.push({
        id: `al-${log.id}`,
        source: "audit",
        label: audit.label,
        icon: audit.icon,
        dotClass: audit.dotClass,
        badgeClass: audit.badgeClass,
        userName,
        created_at: log.created_at,
      });
    }
    
    // ─── Synthetic Enterprise Entries ───
    
    // 1. Negociação Ganha (Comercial)
    if (dealStatus === "won") {
      entries.push({
        id: "synthetic-deal-won",
        source: "event",
        label: "Negociação marcada como GANHA",
        icon: <Trophy className="h-3 w-3" />,
        dotClass: "border-success/40 bg-success/10 text-success",
        badgeClass: "bg-success/10 text-success",
        userName: "COMERCIAL",
        created_at: new Date().toISOString(), // Idealmente seria a data real do status_change do deal
      });
    }

    // 2. Status de Aceite Formal
    if (acceptedAt) {
      entries.push({
        id: "synthetic-accepted",
        source: "event",
        label: "PROPOSTA ACEITA FORMALMENTE",
        icon: <CheckCircle className="h-3 w-3" />,
        dotClass: "border-success/60 bg-success/20 text-success font-bold",
        badgeClass: "bg-success/20 text-success",
        userName: "CLIENTE",
        created_at: acceptedAt,
      });
    } else if (dealStatus === "won") {
      entries.push({
        id: "synthetic-waiting-acceptance",
        source: "event",
        label: "Aguardando aceite formal do cliente",
        icon: <Clock className="h-3 w-3" />,
        dotClass: "border-warning/40 bg-warning/10 text-warning",
        badgeClass: "bg-warning/10 text-warning",
        userName: "AUDITORIA",
        created_at: new Date().toISOString(),
      });
    }

    // Sort by date descending
    entries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return entries;
  }, [auditLogs, events, propostaCreatedAt, dealStatus, acceptedAt]);
}


// ─── Status Badge (SSOT from proposalStatusConfig) ───
import { getProposalStatusConfig } from "@/lib/proposalStatusConfig";

function StatusBadge({ status, aceita_at, enviada_at, recusada_at, created_at }: { status: string; aceita_at?: string | null; enviada_at?: string | null; recusada_at?: string | null; created_at?: string | null }) {
  const s = getProposalStatusConfig(status);
  
  // Map internal status to badge type
  const getBadgeType = () => {
    const normalized = normalizeStatus(status);
    if (normalized === "accepted") {
      // GOVERNANÇA: Se é aceito mas não tem evidência, o badge deve refletir isso
      if (!aceita_at) return "aguardando_aceite";
      return "aceita";
    }
    if (["sent", "viewed"].includes(normalized)) return "enviada";
    if (normalized === "generated") return "gerada";
    if (normalized === "draft") return "rascunho";
    return null;
  };

  const badgeType = getBadgeType();
  const isInconsistent = badgeType === "aceita" && !aceita_at;

  // If we have a mapped tooltip type, use it
  if (badgeType) {
    return <PropostaBadge type={badgeType as any} className={s.className} inconsistent={isInconsistent} />;
  }

  // Fallback to standard Badge without custom tooltip for other statuses
  return (
    <Badge variant="outline" className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap cursor-default", s.className)}>
      {s.label}
    </Badge>
  );
}



/** Returns contextual date label based on proposal status */
function getStatusDateLabel(
  status: string,
  aceita_at: string | null,
  enviada_at: string | null,
  recusada_at: string | null,
  created_at: string | null,
): string {
  if (["accepted", "aceita"].includes(status) && aceita_at) {
    return `Aceita em ${formatDateTime(aceita_at)}`;
  }
  if (["rejected", "rejected", "rejeitada", "perdida"].includes(status) && recusada_at) {
    return `Recusada em ${formatDateTime(recusada_at)}`;
  }
  if (["sent", "enviada"].includes(status) && enviada_at) {
    return `Enviada em ${formatDateTime(enviada_at)}`;
  }
  if (["expired", "expirada"].includes(status) && created_at) {
    return `Expirada • Criada em ${formatDateTime(created_at)}`;
  }
  return `Criada em ${formatDateTime(created_at || "")}`;
}

function StatusIcon({ status, isPrincipal }: { status: string; isPrincipal: boolean }) {
  const s = getProposalStatusConfig(status);
  const colorCls = s?.iconCls || (isPrincipal ? "text-primary" : "text-muted-foreground");
  const isAccepted = ["accepted", "aceita"].includes(status);
  const isRejected = ["rejected", "rejeitada", "recusada", "perdida"].includes(status);
  
  if (isAccepted) return <CheckCircle className={cn("h-6 w-6 shrink-0 mr-3", colorCls)} />;
  if (isRejected) return <AlertCircle className={cn("h-6 w-6 shrink-0 mr-3", colorCls)} />;
  return <FileText className={cn("h-6 w-6 shrink-0 mr-3", colorCls)} />;
}

// ─── Financial KPIs (shared) ──────────────────────────
// SSOT: snapshot é fonte de verdade. Coluna direta é apenas cache derivado (último fallback).
// NUNCA recalcular financeiro fora de calcFinancialSeries/calcGrupoB/calcGrupoA.
function FinancialKPIs({ snapshot, latestVersao }: { snapshot: any; latestVersao: VersaoData | undefined }) {
  const s = snapshot || {};
  const fin = s.financeiro || {};

  // Precedência: snapshot.raiz → snapshot.financeiro → coluna direta (cache legado)
  const tir = s.tir ?? fin.tir ?? latestVersao?.tir ?? null;
  const vpl = s.vpl ?? fin.vpl ?? latestVersao?.vpl ?? null;
  const paybackMeses = s.payback_meses ?? fin.payback_meses ?? latestVersao?.payback_meses ?? null;
  const economiaMensal = s.economia_mensal ?? fin.economia_mensal ?? latestVersao?.economia_mensal ?? null;

  const paybackLabel = paybackMeses != null
    ? `${Math.floor(paybackMeses / 12)} anos e ${Math.round(paybackMeses % 12)} meses`
    : "—";

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="flex items-center gap-2 border rounded-lg p-3 bg-card">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-success/10 shrink-0">
          <TrendingUp className="w-4 h-4 text-success" />
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">TIR</p>
          <p className="text-sm font-bold text-foreground">{formatTirPercent(tir)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 border rounded-lg p-3 bg-card">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10 shrink-0">
          <PiggyBank className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">VPL</p>
          <p className="text-sm font-bold text-foreground">{vpl != null ? formatBRL(Number(vpl)) : "—"}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 border rounded-lg p-3 bg-card">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-warning/10 shrink-0">
          <Timer className="w-4 h-4 text-warning" />
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Payback</p>
          <p className="text-sm font-bold text-foreground">{paybackLabel}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 border rounded-lg p-3 bg-card">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-success/10 shrink-0">
          <DollarSign className="w-4 h-4 text-success" />
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Economia/mês</p>
          <p className="text-sm font-bold text-foreground">{economiaMensal != null && economiaMensal > 0 ? formatBRL(Number(economiaMensal)) : "—"}</p>
        </div>
      </div>
    </div>
  );
}

// ─── SM (legacy_import) Tab Components ──────────────

function SmResumoTab({ snapshot, latestVersao, wpPrice }: { snapshot: any; latestVersao: VersaoData | undefined; wpPrice: string | null }) {
  const totalFinal = getCanonicalProposalTotal(latestVersao as any);
  const equipCost = snapshot.equipment_cost || 0;
  const installCost = snapshot.installation_cost || 0;
  const equipPct = totalFinal > 0 ? (equipCost / totalFinal) * 100 : 0;
  const installPct = totalFinal > 0 ? (installCost / totalFinal) * 100 : 0;

  return (
    <div className="space-y-4 mt-3">
      {/* Row 1: Unidades + Summary side by side */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Left: Unidades */}
        <div className="w-full sm:w-72 shrink-0">
          <h4 className="text-sm font-bold text-foreground mb-2">Unidades</h4>
          <div className="border rounded-lg p-3 space-y-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 p-2 rounded-lg shrink-0 bg-success/10">
                <SunMedium className="h-5 w-5 text-success" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground">Unidade (Geradora)</p>
                {snapshot.economia_mensal_percent != null && snapshot.economia_mensal_percent > 0 && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="text-[10px] text-muted-foreground cursor-help underline decoration-dotted">
                          Economia: {formatBRL((snapshot.tarifa_distribuidora || 0) * (snapshot.consumo_mensal || 0) * (snapshot.economia_mensal_percent / 100))} ({formatNumberBR(snapshot.economia_mensal_percent)}%)
                        </p>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs text-xs space-y-1 p-3">
                        <p className="font-semibold">Como é calculada a economia:</p>
                        <p>Tarifa × Consumo × (% Economia / 100)</p>
                        <p className="text-muted-foreground">
                          {formatBRL(snapshot.tarifa_distribuidora || 0)}/kWh × {snapshot.consumo_mensal || 0} kWh × {formatNumberBR(snapshot.economia_mensal_percent)}%
                        </p>
                        <p className="text-muted-foreground">A % representa quanto do consumo será compensado pela geração solar.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <p className="text-[10px] text-muted-foreground">
                  Consumo Total: {snapshot.consumo_mensal || 0} kWh
                </p>
                {(snapshot.energy_generation || snapshot.geracao_mensal) && (
                  <p className="text-[10px] text-muted-foreground">
                    Geração Mensal: {formatNumberBR(Number(snapshot.energy_generation || snapshot.geracao_mensal || 0))} kWh
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Summary table */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-foreground mb-2">Resumo</h4>
          <div className="border rounded-lg overflow-hidden overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/30 text-muted-foreground">
                  <th className="text-left py-2 px-3 font-semibold">ITEM</th>
                  <th className="text-center py-2 px-3 font-semibold w-16">QTD</th>
                  <th className="text-right py-2 px-3 font-semibold w-28">VALORES</th>
                  <th className="text-right py-2 px-3 font-semibold w-24">% DO TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {equipCost > 0 && (
                  <>
                    <tr className="border-t border-border/20">
                      <td className="py-2 px-3 font-semibold text-foreground">Kit</td>
                      <td className="py-2 px-3 text-center text-muted-foreground">1</td>
                      <td className="py-2 px-3 text-right font-semibold text-foreground">{formatBRL(equipCost)}</td>
                      <td className="py-2 px-3 text-right text-muted-foreground">{formatNumberBR(equipPct)}%</td>
                    </tr>
                    {snapshot.panel_model && (
                      <tr className="border-t border-border/10">
                        <td className="py-1.5 px-3 pl-6 text-muted-foreground text-[11px]">{snapshot.panel_model}</td>
                        <td className="py-1.5 px-3 text-center text-muted-foreground text-[11px]">{snapshot.panel_quantity || "—"}</td>
                        <td /><td />
                      </tr>
                    )}
                    {snapshot.inverter_model && (
                      <tr className="border-t border-border/10">
                        <td className="py-1.5 px-3 pl-6 text-muted-foreground text-[11px]">{snapshot.inverter_model}</td>
                        <td className="py-1.5 px-3 text-center text-muted-foreground text-[11px]">{snapshot.inverter_quantity || 1}</td>
                        <td /><td />
                      </tr>
                    )}
                  </>
                )}
                {installCost > 0 && (
                  <tr className="border-t border-border/20">
                    <td className="py-2 px-3 font-semibold text-foreground">Instalação</td>
                    <td className="py-2 px-3 text-center text-muted-foreground">1</td>
                    <td className="py-2 px-3 text-right font-semibold text-foreground">{formatBRL(installCost)}</td>
                    <td className="py-2 px-3 text-right text-muted-foreground">{formatNumberBR(installPct)}%</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-dashed border-border">
                  <td className="py-3 px-3 font-bold text-foreground">Total</td>
                  <td />
                  <td className="py-3 px-3 text-right">
                    {wpPrice && <span className="text-[10px] text-primary font-semibold block">R$ {wpPrice.replace('.', ',')} / Wp</span>}
                    <span className="font-bold text-foreground text-sm">{formatBRL(totalFinal)}</span>
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* Row 2: Financial KPIs full width */}
      <FinancialKPIs snapshot={snapshot} latestVersao={latestVersao} />
    </div>
  );
}





// ─── Native Tab Components ─────────────────────────────

function NativeResumoTab({ snapshot, ucsDetail, latestVersao, wpPrice, buildSummaryRows }: {
  snapshot: SnapshotData | null;
  ucsDetail: UCDetailData[];
  latestVersao: VersaoData | undefined;
  wpPrice: string | null;
  buildSummaryRows: () => Array<{ label: string; qty: number; value: number; pct: number; children?: Array<{ label: string; qty: number }> }>;
}) {
  const geracaoMensal = (snapshot as Record<string, any>)?.geracaoMensalEstimada || (snapshot as Record<string, any>)?.geracao_mensal_kwh || latestVersao?.geracao_mensal || 0;
  // SSOT: snapshot prioritário sobre coluna direta (cache legado pode estar dessincronizado)
  const economiaMensal = (snapshot as Record<string, any>)?.economia_mensal ?? latestVersao?.economia_mensal ?? 0;
  return (
    <div className="space-y-4 mt-3">
      {/* Row 1: Unidades + Resumo side by side */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Left: Unidades */}
        <div className="w-full sm:w-72 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-bold text-foreground">Unidades</h4>
          </div>
          <div className="border rounded-lg p-3 space-y-3">
            {(snapshot?.ucs && snapshot.ucs.length > 0) ? (
              snapshot.ucs.map((uc, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className={cn("mt-0.5 p-2 rounded-lg shrink-0", uc.is_geradora ? "bg-success/10" : "bg-info/10")}>
                    {uc.is_geradora ? <SunMedium className="h-5 w-5 text-success" /> : <Home className="h-5 w-5 text-info" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground">
                      {uc.nome}
                      {uc.is_geradora && <span className="text-[9px] font-normal text-success ml-1">(Geradora)</span>}
                    </p>
                    {economiaMensal > 0 && (
                      <p className="text-[10px] text-muted-foreground">
                        Economia: {formatBRL(economiaMensal)}{uc.consumo_mensal ? ` (${Math.round((economiaMensal / (uc.tarifa_distribuidora * uc.consumo_mensal)) * 100) || 0}%)` : ""}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground">Consumo Total: {uc.consumo_mensal} kWh</p>
                    {uc.is_geradora && geracaoMensal > 0 && (
                      <p className="text-[10px] text-muted-foreground">Geração Mensal: {geracaoMensal.toLocaleString("pt-BR")} kWh</p>
                    )}
                  </div>
                </div>
              ))
            ) : ucsDetail.length > 0 ? (
              ucsDetail.map(uc => (
                <div key={uc.id} className="flex items-start gap-3">
                  <div className="mt-0.5 p-2 rounded-lg shrink-0 bg-info/10">
                    <Home className="h-5 w-5 text-info" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground">{uc.nome}</p>
                    <p className="text-[10px] text-muted-foreground">Consumo: {uc.consumo_mensal_kwh} kWh</p>
                    {uc.geracao_mensal_estimada && (
                      <p className="text-[10px] text-muted-foreground">Geração: {uc.geracao_mensal_estimada.toFixed(0)} kWh</p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-[10px] text-muted-foreground">Sem UCs definidas</p>
            )}
          </div>
        </div>

        {/* Right: Summary table */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-foreground mb-2">Resumo</h4>
          <div className="border rounded-lg overflow-hidden overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/30 text-muted-foreground">
                  <th className="text-left py-2 px-3 font-semibold">ITEM</th>
                  <th className="text-center py-2 px-3 font-semibold w-16">QTD</th>
                  <th className="text-right py-2 px-3 font-semibold w-28">VALORES</th>
                  <th className="text-right py-2 px-3 font-semibold w-24">% DO TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {buildSummaryRows().map((row, idx) => (
                  <>
                    <tr key={idx} className="border-t border-border/20">
                      <td className="py-2 px-3 font-semibold text-foreground">{row.label}</td>
                      <td className="py-2 px-3 text-center text-muted-foreground">{row.qty}</td>
                      <td className="py-2 px-3 text-right font-semibold text-foreground">{formatBRL(row.value)}</td>
                      <td className="py-2 px-3 text-right text-muted-foreground">{formatNumberBR(row.pct)}%</td>
                    </tr>
                    {row.children?.map((child, ci) => (
                      <tr key={`${idx}-${ci}`} className="border-t border-border/10">
                        <td className="py-1.5 px-3 pl-6 text-muted-foreground text-[11px]">{child.label}</td>
                        <td className="py-1.5 px-3 text-center text-muted-foreground text-[11px]">{child.qty}</td>
                        <td className="py-1.5 px-3" />
                        <td className="py-1.5 px-3" />
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-dashed border-border">
                  <td className="py-3 px-3 font-bold text-foreground">Total</td>
                  <td />
                  <td className="py-3 px-3 text-right">
                    {wpPrice && <span className="text-[10px] text-primary font-semibold block">R$ {wpPrice.replace('.', ',')} / Wp</span>}
                    <span className="font-bold text-foreground text-sm">{formatBRL(getCanonicalProposalTotal(latestVersao as any))}</span>
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* Row 2: Financial KPIs full width */}
      <FinancialKPIs snapshot={snapshot as any} latestVersao={latestVersao} />
    </div>
  );
}

// NativeArquivoTab and NativeDadosTab REMOVED — replaced by ProposalSnapshotView (SSOT)
// PDF viewer is inlined directly in the tab content below.

// ─── Main Component ──────────────────────────────────
interface Props {
  proposta: PropostaData;
  isPrincipal: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  dealId: string;
  dealStatus?: string;
  customerId: string | null;
  onRefresh: () => void;
  isOutdated?: boolean;
  onSetPrincipal?: () => void;
  onArchive?: () => void;
}


export function PropostaExpandedDetail({ proposta: p, isPrincipal, isExpanded, onToggle, dealId, dealStatus, customerId, onRefresh, isOutdated, onSetPrincipal, onArchive }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: tenantCtx } = useQuery({ queryKey: ["current-tenant-id"], queryFn: getCurrentTenantId, staleTime: 1000 * 60 * 15 });
  const isMigrated = false;
  const latestVersao = p.versoes[0];
  const enviadaVersao = p.versoes.find(v => v.status === 'sent' || v.status === 'enviada');
  const hasDivergence = enviadaVersao && latestVersao && 
    latestVersao.valor_total !== null && 
    enviadaVersao.valor_total !== null && 
    Math.abs(latestVersao.valor_total - enviadaVersao.valor_total) > 0.01;

  const canonicalTotalLatest = getCanonicalProposalTotal(latestVersao as any);
  const wpPrice = canonicalTotalLatest > 0 && latestVersao?.potencia_kwp
    ? (canonicalTotalLatest / (latestVersao.potencia_kwp * 1000)).toFixed(2)
    : null;

  // Templates for DOCX/HTML detection
  const { data: proposalTemplates = [] } = useProposalTemplates();
  const { assignIfNeeded: lazyAssignTemplate } = useLazyTemplateAssign();

  const versaoIds = p.versoes.map(v => v.id);
  const { data: snapshotData } = usePropostaExpandedSnapshot(latestVersao?.id || null, isExpanded);
  const { data: ucsDetail = [] } = usePropostaExpandedUcs(latestVersao?.id || null, isExpanded);
  const { data: kitItemsDetail = [] } = usePropostaExpandedKitItems(latestVersao?.id || null, isExpanded);
  const { data: auditLogs = [] } = usePropostaAuditLogs(p.id, versaoIds, isExpanded);
  const { data: proposalEvents = [] } = usePropostaEvents(p.id, isExpanded);

  // Merge audit_logs + proposal_events into unified timeline
  const mergedTimeline = useMergedTimeline(auditLogs, proposalEvents, p.created_at, dealStatus, p.aceita_at);
  const loadingDetail = !snapshotData && isExpanded && !!latestVersao?.id;

  // Fallback: buscar dados do lead quando snapshot não tiver dados de cliente/localização
  // Isso acontece quando o snapshot foi sobrescrito pelo engine output (V3/V4+)
  const snapshotMissingClientData = snapshotData && !snapshotData.cliente && !snapshotData.clienteNome && !snapshotData.locCidade;
  const { data: leadFallbackData } = useQuery({
    queryKey: ["lead-fallback-for-snapshot", p.id],
    queryFn: async () => {
      const { data: propData } = await supabase
        .from("propostas_nativas")
        .select("lead_id")
        .eq("id", p.id)
        .maybeSingle();
      if (!propData?.lead_id) return null;
      const { data: lead } = await supabase
        .from("leads")
        .select("nome, telefone, cidade, estado")
        .eq("id", propData.lead_id)
        .maybeSingle();
      return lead;
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!snapshotMissingClientData && isExpanded,
  });

  // Enrich snapshot with lead data when engine schema overwrote client/location data
  const snapshot = (() => {
    if (!snapshotData) return null;
    if (!snapshotMissingClientData) return snapshotData;
    // Inject client/location fallback from lead + proposta metadata
    return {
      ...snapshotData,
      cliente: {
        nome: p.cliente_nome || leadFallbackData?.nome || "",
        celular: leadFallbackData?.telefone || "",
        email: "",
        empresa: "",
        cnpj_cpf: "",
      },
      locCidade: leadFallbackData?.cidade || "",
      locEstado: leadFallbackData?.estado || "",
    };
  })();

  // Fallback: buscar telefone/email do cliente quando snapshot não tiver
  const { data: clienteContato } = useQuery({
    queryKey: ["cliente-contato-fallback", customerId],
    queryFn: async () => {
      if (!customerId) return null;
      const { data, error } = await supabase
        .from("clientes")
        .select("telefone, email")
        .eq("id", customerId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!customerId,
  });
  const [activeTab, setActiveTab] = useState("resumo");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [html, setHtml] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [recusaMotivo, setRecusaMotivo] = useState("");
  const [recusaDialogOpen, setRecusaDialogOpen] = useState(false);
  const [messageDrawerOpen, setMessageDrawerOpen] = useState(false);
  const [cloneModalOpen, setCloneModalOpen] = useState(false);
  const [reabrirDialogOpen, setReabrirDialogOpen] = useState(false);
  const [templateSelecionado, setTemplateSelecionado] = useState("");

  // Edit accepted proposal confirmation
  const [editAceitaDialogOpen, setEditAceitaDialogOpen] = useState(false);
  const [editAceitaMotivo, setEditAceitaMotivo] = useState("");
  const [pendingEditAction, setPendingEditAction] = useState<(() => void) | null>(null);
  const [cancellingDocs, setCancellingDocs] = useState(false);

  const handleEditWithProtection = async (editFn: () => void) => {
    // RB-49: Block edit completely if signed contract exists
    if (p.status === "accepted") {
      const { data: signedDocs } = await supabase
        .from("generated_documents")
        .select("id")
        .eq("deal_id", dealId)
        .eq("signature_status", "signed")
        .limit(1)
        .maybeSingle();

      if (signedDocs) {
        toast({
          title: "Edição bloqueada",
          description: "Esta proposta possui contrato assinado digitalmente e não pode ser editada.",
          variant: "destructive",
        });
        return;
      }

      setPendingEditAction(() => editFn);
      setEditAceitaMotivo("");
      setEditAceitaDialogOpen(true);
    } else {
      editFn();
    }
  };

  const confirmEditAceita = async () => {
    if (!editAceitaMotivo.trim()) {
      toast({ title: "Motivo obrigatório", description: "Informe o motivo para editar a proposta aceita.", variant: "destructive" });
      return;
    }
    setCancellingDocs(true);
    try {
      // Cancel generated (non-signed) documents for this project
      await supabase
        .from("generated_documents")
        .update({
          status: "cancelled",
          observacao: editAceitaMotivo.trim(),
          updated_at: new Date().toISOString(),
        } as any)
        .eq("deal_id", dealId)
        .eq("status", "generated")
        .neq("signature_status", "signed");

      setEditAceitaDialogOpen(false);
      pendingEditAction?.();
    } catch (err) {
      console.error("[PropostaExpandedDetail] Erro ao cancelar documentos:", err);
      toast({ title: "Erro", description: "Falha ao cancelar contratos vinculados.", variant: "destructive" });
    } finally {
      setCancellingDocs(false);
    }
  };

  // Restore the template used during generation from snapshot
  useEffect(() => {
    const snapTpl = (snapshot as any)?.templateSelecionado || (snapshot as any)?.template_selecionado;
    if (snapTpl && !templateSelecionado) {
      setTemplateSelecionado(snapTpl);
    }
  }, [snapshot, templateSelecionado]);

  const [pdfSignedUrl, setPdfSignedUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState(false);

  // Cache signed URL for 50 minutes to avoid re-fetching on expand/collapse (RB-51)
  const signedUrlCacheRef = useRef<{ url: string; path: string; fetchedAt: number } | null>(null);
  const SIGNED_URL_CACHE_MS = 50 * 60 * 1000; // 50 minutes

  useEffect(() => {
    if (!isExpanded) {
      setPdfError(false);
      return;
    }

    if (latestVersao?.output_pdf_path) {
      // Check cache: same path and less than 50 minutes old
      const cache = signedUrlCacheRef.current;
      if (
        cache &&
        cache.path === latestVersao.output_pdf_path &&
        Date.now() - cache.fetchedAt < SIGNED_URL_CACHE_MS
      ) {
        setPdfSignedUrl(cache.url);
        setPdfError(false);
        setPdfLoading(false);
        return;
      }

      setPdfLoading(true);
      setPdfError(false);
      supabase.storage.from("proposta-documentos").createSignedUrl(latestVersao.output_pdf_path, 3600)
        .then(({ data, error }) => {
          if (error || !data?.signedUrl) {
            setPdfError(true);
            setPdfSignedUrl(null);
            signedUrlCacheRef.current = null;
          } else {
            setPdfSignedUrl(data.signedUrl);
            signedUrlCacheRef.current = {
              url: data.signedUrl,
              path: latestVersao.output_pdf_path!,
              fetchedAt: Date.now(),
            };
          }
        })
        .finally(() => setPdfLoading(false));
      return;
    }

    if (latestVersao?.link_pdf) {
      setPdfSignedUrl(latestVersao.link_pdf);
      setPdfError(false);
      setPdfLoading(false);
      return;
    }

    setPdfSignedUrl(null);
    setPdfError(false);
    setPdfLoading(false);
  }, [isExpanded, latestVersao?.output_pdf_path, latestVersao?.link_pdf]);

  // ─── Accept / Reject handler ───
  const updatePropostaStatus = async (newStatus: string, extra?: Record<string, any>) => {
    setUpdatingStatus(true);
    try {
      // Use RPC for status transitions — tenant validation, state machine, and audit in backend
      const { data: rpcResult, error } = await supabase.rpc("proposal_update_status", {
        p_proposta_id: p.id,
        p_new_status: newStatus,
        p_motivo: extra?.motivo || null,
      });
      if (error) throw error;
      if ((rpcResult as any)?.error) throw new Error((rpcResult as any).error);

      // ── Comissão ao aceitar é gerada automaticamente pelo trigger trg_proposta_aceita_comissao ──

      // ── Side effects on acceptance/rejection (commissions, deals, projects) ──
      // These are now handled ATOMICALLY in the backend by the proposal_update_status RPC.
      // The frontend only needs to invalidate the cache.

      toast({ title: `Proposta marcada como "${getProposalStatusConfig(newStatus).label}"` });
      onRefresh();

      // Invalidação centralizada (SSOT: lib/invalidatePropostaCaches.ts).
      // Substitui o antigo `(window as any).queryClient` que invalidava só 4 chaves
      // e causava UI stale (badge "gerada" não virava "aceita", CTAs sumindo).
      invalidatePropostaCaches(queryClient, {
        propostaId: p.id,
        dealId,
        versaoId: latestVersao?.id || null,
      });
    } catch (e: any) {
      toast({ title: "Erro ao atualizar status", description: e.message, variant: "destructive" });
    } finally {
      setUpdatingStatus(false);
    }
  };

  // §16: Queries moved to hooks (usePropostaExpandedData) — AP-01 fix

  // Reset publicUrl quando a versão ativa muda (regeneração cria nova versão).
  // Evita exibir QR/link antigo apontando para versão substituída.
  const lastVersaoIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (latestVersao?.id && lastVersaoIdRef.current && lastVersaoIdRef.current !== latestVersao.id) {
      setPublicUrl(null);
    }
    if (latestVersao?.id) lastVersaoIdRef.current = latestVersao.id;
  }, [latestVersao?.id]);

  // Auto-populate publicUrl from active version (token-based link).
  useEffect(() => {
    if (!isExpanded || publicUrl || !latestVersao?.id || !p.id) return;
    (async () => {
      try {
        const { getOrCreateProposalToken } = await import("@/services/proposal/proposalDetail.service");
        const token = await getOrCreateProposalToken(p.id, latestVersao.id, "public");
        setPublicUrl(getProposalWebUrl(token));
      } catch {
        // Silent — will be populated on manual copy
      }
    })();
  }, [isExpanded, latestVersao?.id, p.id]);

  // Auto-render ONLY when no persisted PDF exists, status indicates generation happened,
  // AND the version was actually generated with a template (template_id_used is set).
  // Without template_id_used, no auto-render — avoids showing a random template preview.
  // Guard: nunca dispara mais de uma vez para a mesma versão (anti-loop em DOCX,
  // onde handleRender não popula `html` e o effect re-rodaria a cada mudança de dep).
  const autoRenderedVersionRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isExpanded || activeTab !== "arquivo" || html || rendering) return;
    if (!latestVersao?.id) return;
    if (autoRenderedVersionRef.current === latestVersao.id) return;
    // Skip auto-render if persisted PDF or external link_pdf exists (migrated proposals)
    if (latestVersao.output_pdf_path || latestVersao.link_pdf) return;
    // Skip auto-render if version was never generated with a template
    if (!latestVersao.template_id_used && !templateSelecionado) return;
    const vStatus = latestVersao.status?.toLowerCase();
    const pStatus = p.status?.toLowerCase();
    if (vStatus === "generated" || vStatus === "ativa" ||
        pStatus === "generated" || pStatus === "sent" || pStatus === "accepted") {
      autoRenderedVersionRef.current = latestVersao.id;
      handleRender();
    }
  }, [isExpanded, activeTab, latestVersao?.id]);

  // Delete handler — uses hook for AP-01 compliance
  const { mutate: excluirProposta, isPending: deleting } = useExcluirProposta();
  const handleDelete = () => {
    excluirProposta(p.id, {
      onSuccess: () => {
        setDeleteOpen(false);
        onRefresh();
      },
      onSettled: () => setDeleteOpen(false),
    });
  };

  // Reabrir handler
  const { data: isAdminOrGerente } = useIsAdminOrGerente();
  const { mutate: reabrirProposta, isPending: reabrindo } = useReabrirProposta();
  const canReabrir = isAdminOrGerente && (p.status === "accepted" || p.status === "rejected");
  const handleReabrir = () => {
    reabrirProposta(p.id, {
      onSuccess: () => {
        setReabrirDialogOpen(false);
        onRefresh();
      },
    });
  };

  // Render proposal — handles both HTML (web) and DOCX templates
  const handleRender = async (overrideTemplateId?: string) => {
    const effectiveTemplateId = overrideTemplateId || templateSelecionado;
    if (!latestVersao?.id) return;

    // Detect if selected template is DOCX
    const selectedTpl = proposalTemplates.find(t => t.id === effectiveTemplateId);
    const isDocxTemplate = selectedTpl?.tipo === "docx";

    if (!effectiveTemplateId) {
      toast({ title: "Selecione um template antes de gerar", variant: "destructive" });
      return;
    }

    setRendering(true);
    try {
      if (isDocxTemplate && p.id) {
        // DOCX pipeline: call template-preview → generates DOCX → converts to PDF → saves paths
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "bguhckqkpnziykpbwbeu";
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJndWhja3FrcG56aXlrcGJ3YmV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NzgwNzQsImV4cCI6MjA4NjA1NDA3NH0.BQAdNsi05xoWHhYJnnvmW3MIwnm8gbXTqosCTe5Ykxw";
        const { data: { session } } = await supabase.auth.getSession();

        const rawResp = await fetch(`https://${projectId}.supabase.co/functions/v1/template-preview`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": `Bearer ${session?.access_token || anonKey}`,
            "apikey": anonKey,
            "x-client-timeout": "120",
          },
          body: JSON.stringify({
            template_id: effectiveTemplateId,
            proposta_id: p.id,
            response_format: "json",
          }),
        });

        if (!rawResp.ok) {
          const errBody = await rawResp.text();
          let errorMsg = "Erro ao gerar DOCX";
          try { errorMsg = JSON.parse(errBody)?.error || errorMsg; } catch { errorMsg = errBody || errorMsg; }
          throw new Error(errorMsg);
        }

        const artifactResult = await rawResp.json();
        signedUrlCacheRef.current = null;

        // If PDF was generated, get signed URL and display it
        if (artifactResult.output_pdf_path) {
          const { data: signedData } = await supabase.storage
            .from("proposta-documentos")
            .createSignedUrl(artifactResult.output_pdf_path, 3600);
          if (signedData?.signedUrl) {
            setPdfSignedUrl(signedData.signedUrl);
            signedUrlCacheRef.current = {
              url: signedData.signedUrl,
              path: artifactResult.output_pdf_path,
              fetchedAt: Date.now(),
            };
          }
          toast({ title: "Proposta gerada!", description: "PDF gerado com sucesso." });
        } else if (artifactResult.output_docx_path) {
          toast({ title: "DOCX gerado!", description: "PDF não foi convertido. DOCX disponível para download." });
        } else {
          toast({ title: "Erro na geração", description: artifactResult.generation_error || "Falha na geração do documento", variant: "destructive" });
        }

        // Refresh data to pick up new output paths
        onRefresh();
      } else {
        // Lazy assign template for migrated proposals without template (on-demand)
        if (isMigrated && !latestVersao.template_id_used) {
          const assignResult = await lazyAssignTemplate(latestVersao.id, p.id);
          if (!assignResult.success) {
            toast({ title: "Erro ao atribuir template", description: assignResult.error, variant: "destructive" });
            return;
          }
        }
        // HTML template: use existing renderProposal
        const result = await renderProposal(latestVersao.id);
        if (result.html) setHtml(result.html);
        else toast({ title: "Proposta renderizada, mas sem HTML retornado." });
      }
    } catch (e: any) {
      toast({ title: "Erro ao gerar arquivo", description: e.message, variant: "destructive" });
    } finally {
      setRendering(false);
    }
  };

  // Download PDF
  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const pdfPath = latestVersao?.output_pdf_path;
      const externalUrl = latestVersao?.link_pdf;
      const safeName = (p.codigo || p.titulo || "proposta")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9-]+/g, "_")
        .replace(/_+/g, "_").replace(/^_+|_+$/g, "");
      const fileName = `Proposta_${safeName}_v${latestVersao?.versao_numero || 1}.pdf`;

      const triggerDownload = (href: string) => {
        const a = document.createElement("a");
        a.href = href;
        a.download = fileName;
        a.rel = "noopener";
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };

      if (pdfPath) {
        const { data, error } = await supabase.storage
          .from("proposta-documentos")
          .createSignedUrl(pdfPath, 3600, { download: fileName });
        if (error) throw error;
        if (!data?.signedUrl) throw new Error("URL assinada não disponível");
        triggerDownload(data.signedUrl);
        toast({ title: "PDF baixado!" });
        return;
      }
      if (externalUrl) {
        triggerDownload(externalUrl);
        toast({ title: "PDF aberto em nova aba" });
        return;
      }
      toast({ title: "PDF não disponível", description: "Gere o arquivo DOCX/PDF primeiro na aba de documentos.", variant: "destructive" });
    } catch (e: any) {
      toast({ title: "Erro ao baixar PDF", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Download DOCX
  const handleDownloadDocx = async () => {
    try {
      const docxPath = latestVersao?.output_docx_path;
      if (!docxPath) {
        toast({ title: "DOCX não disponível", variant: "destructive" });
        return;
      }
      const safeName = (p.codigo || p.titulo || "proposta")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9-]+/g, "_")
        .replace(/_+/g, "_").replace(/^_+|_+$/g, "");
      const fileName = `Proposta_${safeName}_v${latestVersao?.versao_numero || 1}.docx`;
      const { data } = await supabase.storage.from("proposta-documentos").createSignedUrl(docxPath, 3600, { download: fileName });
      if (!data?.signedUrl) {
        toast({ title: "Erro ao obter URL do DOCX", variant: "destructive" });
        return;
      }
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = fileName;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast({ title: "DOCX baixado!" });
    } catch (e: any) {
      toast({ title: "Erro ao baixar DOCX", description: e.message, variant: "destructive" });
    }
  };

  const resolvePublicProposalUrl = async (withTracking = false) => {
    if (!p.id || !latestVersao?.id) {
      throw new Error("Gere a proposta primeiro.");
    }

    const { getOrCreateProposalToken } = await import("@/services/proposal/proposalDetail.service");
    const tipo = withTracking ? "tracked" : "public";
    const token = await getOrCreateProposalToken(p.id, latestVersao.id, tipo);
    const url = getProposalWebUrl(token);

    if (!withTracking) {
      setPublicUrl(url);
    }

    return { token, url };
  };

  const openPublicProposal = async () => {
    try {
      const url = publicUrl ?? (await resolvePublicProposalUrl(false)).url;
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast({ title: "Erro ao abrir proposta", description: e.message, variant: "destructive" });
    }
  };

  const handleSend = async (canal: "link" | "whatsapp") => {
    if (!p.id || !latestVersao?.id) return;
    setSending(true);
    try {
      const result = await sendProposal({
        proposta_id: p.id,
        versao_id: latestVersao.id,
        canal,
        lead_id: undefined,
      });
      const canonicalUrl = getProposalWebUrl(result.token);
      setPublicUrl(canonicalUrl);
      if (canal === "whatsapp" && result.whatsapp_sent) {
        toast({ title: "Proposta enviada via WhatsApp! ✅" });
      } else {
        toast({ title: "Link gerado com sucesso!" });
      }
    } catch (e: any) {
      toast({ title: "Erro ao enviar", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleCopyLink = async (withTracking: boolean) => {
    try {
      const { url } = await resolvePublicProposalUrl(withTracking);
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        window.prompt("Copie o link abaixo:", url);
      }
      toast({ title: withTracking ? "Link rastreável copiado! 🔗" : "Link público copiado! 🔗" });
    } catch (e: any) {
      toast({ title: "Erro ao gerar link", description: e.message, variant: "destructive" });
    }
  };
  const copyPublicLink = () => handleCopyLink(false);
  const copyTrackedLink = () => handleCopyLink(true);

  const validadeDate = latestVersao ? (() => {
    const snap = snapshot as Record<string, any>;
    if (snap?.validade_dias) {
      const d = new Date(latestVersao.created_at);
      d.setDate(d.getDate() + snap.validade_dias);
      return formatDate(d);
    }
    return null;
  })() : null;

  // Build summary table from snapshot — SSOT: mirrors calcPrecoFinal logic from types.ts
  const buildSummaryRows = () => {
    if (!snapshot) return [];
    const rows: Array<{ label: string; qty: number; value: number; pct: number; children?: Array<{ label: string; qty: number }> }> = [];
    const venda = snapshot.venda;
    const totalFinal = getCanonicalProposalTotal(latestVersao as any);
    const servicos = snapshot.servicos || [];

    // Kit items
    const snapshotKitItems = snapshot.itens || [];
    const kitItems = snapshotKitItems.length > 0
      ? snapshotKitItems
      : kitItemsDetail.map((item) => ({
          descricao: item.descricao || item.modelo || item.categoria || "Item do kit",
          quantidade: item.quantidade || 0,
          preco_unitario: item.preco_unitario || 0,
          categoria: item.categoria || "componente",
          fabricante: item.fabricante || undefined,
          modelo: item.modelo || item.descricao || undefined,
        }));
    if (kitItems.length > 0) {
      const kitTotal = kitItems.reduce((s, i) => s + (i.preco_unitario * i.quantidade), 0);
      rows.push({
        label: "Kit Gerador",
        qty: 1,
        value: kitTotal,
        pct: totalFinal > 0 ? (kitTotal / totalFinal) * 100 : 0,
        children: kitItems.map(i => ({
          label: `${i.fabricante || ""} ${i.modelo || i.descricao}`.trim(),
          qty: i.quantidade,
        })),
      });
    }

    // Serviços (native proposals store services as separate items)
    const servicosInclusos = servicos.filter((s: any) => s.incluso_no_preco !== false);
    for (const srv of servicosInclusos) {
      if (srv.valor > 0) {
        rows.push({
          label: srv.descricao || srv.categoria || "Serviço",
          qty: 1,
          value: srv.valor,
          pct: totalFinal > 0 ? (srv.valor / totalFinal) * 100 : 0,
        });
      }
    }

    // Serviços extras (não inclusos no preço) — mostrar como referência
    const servicosExtras = servicos.filter((s: any) => s.incluso_no_preco === false);
    for (const srv of servicosExtras) {
      if (srv.valor > 0) {
        rows.push({
          label: `${srv.descricao || srv.categoria || "Serviço"} (Extra)`,
          qty: 1,
          value: srv.valor,
          pct: totalFinal > 0 ? (srv.valor / totalFinal) * 100 : 0,
        });
      }
    }

    // Legacy: Installation from venda (only if no servicos present)
    if (venda?.custo_instalacao && servicosInclusos.length === 0) {
      rows.push({
        label: "Instalação",
        qty: 1,
        value: venda.custo_instalacao,
        pct: totalFinal > 0 ? (venda.custo_instalacao / totalFinal) * 100 : 0,
      });
    }

    // Commission (from venda)
    if (venda?.custo_comissao) {
      rows.push({
        label: "Comissão",
        qty: 1,
        value: venda.custo_comissao,
        pct: totalFinal > 0 ? (venda.custo_comissao / totalFinal) * 100 : 0,
      });
    }

    // Outros custos (from venda)
    if (venda?.custo_outros) {
      rows.push({
        label: "Outros Custos",
        qty: 1,
        value: venda.custo_outros,
        pct: totalFinal > 0 ? (venda.custo_outros / totalFinal) * 100 : 0,
      });
    }

    // Margin — calculate from cost base (matching calcPrecoFinal SSOT)
    const marginPct = venda?.margem_percentual || 0;
    if (marginPct > 0) {
      const kitTotal = kitItems.reduce((s, i) => s + (i.preco_unitario * i.quantidade), 0);
      const custoServicosInclusos = servicosInclusos.reduce((s: number, sv: any) => s + (sv.valor || 0), 0);
      const custoBase = kitTotal + custoServicosInclusos + (venda?.custo_comissao || 0) + (venda?.custo_outros || 0);
      const marginValue = custoBase * (marginPct / 100);
      rows.push({
        label: `Margem (Markup ${formatNumberBR(marginPct)}%)`,
        qty: 1,
        value: marginValue,
        pct: totalFinal > 0 ? (marginValue / totalFinal) * 100 : 0,
      });
    }

    // Desconto — show if applied
    const descontoPct = venda?.desconto_percentual || 0;
    if (descontoPct > 0) {
      const kitTotal = kitItems.reduce((s, i) => s + (i.preco_unitario * i.quantidade), 0);
      const custoServicosInclusos = servicosInclusos.reduce((s: number, sv: any) => s + (sv.valor || 0), 0);
      const custoBase = kitTotal + custoServicosInclusos + (venda?.custo_comissao || 0) + (venda?.custo_outros || 0);
      const margemVal = custoBase * (marginPct / 100);
      const precoComMargem = custoBase + margemVal;
      const descontoValue = precoComMargem * (descontoPct / 100);
      rows.push({
        label: `Desconto (−${formatNumberBR(descontoPct)}%)`,
        qty: 1,
        value: -descontoValue,
        pct: totalFinal > 0 ? (-descontoValue / totalFinal) * 100 : 0,
      });
    }

    return rows;
  };

  return (
    <>
      <div className={cn(
        "rounded-xl border transition-all",
        isMigrated
          ? "border-2 border-warning/40 bg-warning/5"
          : isPrincipal ? "bg-card border-primary/20 shadow-sm" : "bg-card border-border/40 hover:border-border/70"
      )}>
        {/* ── Header row ──────────────────────── */}
        <div
          className="grid grid-cols-[auto_1fr_auto] md:grid-cols-[auto_minmax(180px,1.2fr)_1fr_1fr_1.3fr_auto] items-center gap-0 py-3 px-4 cursor-pointer"
          onClick={onToggle}
        >
          {/* Icon */}
          <StatusIcon status={p.status} isPrincipal={isPrincipal} />

          {/* Col 1: Name + Status */}
          <div className="min-w-0 pr-3">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-foreground truncate">
                {p.cliente_nome || p.titulo || p.codigo || `Proposta #${p.proposta_num}`}
              </p>
              <StatusBadge status={p.status} aceita_at={p.aceita_at} accepted_via={p.accepted_via} enviada_at={p.enviada_at} recusada_at={p.recusada_at} created_at={p.created_at} />
              {isMigrated && <PropostaBadge type="migrada" />}
              {isPrincipal && <PropostaBadge type="principal" />}
              {isOutdated && <PropostaBadge type="desatualizada" />}

            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {getStatusDateLabel(p.status, p.aceita_at, p.enviada_at, p.recusada_at, p.created_at)}
            </p>
          </div>

          {/* Col 2: Potência - hidden on mobile */}
          <div className="hidden md:flex items-center gap-2 border-l border-border/40 pl-4 pr-3">
            <Zap className="h-4 w-4 text-warning shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground leading-tight">Potência Total</p>
              <p className="text-sm font-bold text-foreground">
                {latestVersao?.potencia_kwp ? `${latestVersao.potencia_kwp.toFixed(2).replace('.', ',')} kWp` : "—"}
              </p>
            </div>
          </div>

          {/* Col 3: Geração Mensal - hidden on mobile */}
          <div className="hidden md:flex items-center gap-2 border-l border-border/40 pl-4 pr-3">
            <SunMedium className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground leading-tight">Geração Mensal</p>
              <p className="text-sm font-bold text-foreground">
                {(() => {
                  const geracaoSnap = (snapshot as any)?.geracaoMensalEstimada ?? (snapshot as any)?.geracao_mensal_estimada;
                  const geracao = geracaoSnap || latestVersao?.geracao_mensal;
                  return geracao ? `${Math.round(Number(geracao)).toLocaleString("pt-BR")} kWh` : "—";
                })()}
              </p>
            </div>
          </div>

          {/* Col 4: Preço do Projeto - hidden on mobile */}
          <div className="hidden md:flex items-center gap-2 border-l border-border/40 pl-4 pr-3">
            <DollarSign className="h-4 w-4 text-warning shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground leading-tight">Preço do Projeto</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className={cn("text-sm font-bold text-foreground", hasDivergence && "cursor-help underline decoration-dotted decoration-warning/50 underline-offset-2")}>
                        {canonicalTotalLatest > 0 ? formatBRL(canonicalTotalLatest) : "—"}
                      </p>
                    </TooltipTrigger>
                    {hasDivergence && (
                      <TooltipContent>
                        <p className="text-xs">
                          Versão atual: {formatBRL(latestVersao.valor_total)} | Versão enviada: {formatBRL(enviadaVersao.valor_total)}
                        </p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>

                {p.status === 'accepted' && (
                  <Badge className="bg-green-600 text-white hover:bg-green-600 border-none h-4 px-1.5 text-[10px] font-bold">Proposta aceita</Badge>
                )}
                {p.status === 'generated' && (
                  <Badge className="bg-blue-600 text-white hover:bg-blue-600 border-none h-4 px-1.5 text-[10px] font-bold">Proposta gerada</Badge>
                )}
                {p.status === 'rejected' && (
                  <Badge className="bg-red-600 text-white hover:bg-red-600 border-none h-4 px-1.5 text-[10px] font-bold">Proposta recusada</Badge>
                )}
                {p.status === 'sent' && (
                  <Badge className="bg-blue-500 text-white hover:bg-blue-500 border-none h-4 px-1.5 text-[10px] font-bold">Proposta enviada</Badge>
                )}

                {p.versoes.length > 1 && (
                  <Badge variant="secondary" className="h-4 px-1.5 text-[11px] font-medium bg-muted text-muted-foreground border-none">
                    v{latestVersao?.versao_numero}
                  </Badge>
                )}

                {hasDivergence && (
                  <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />
                )}
                
                {wpPrice && <span className="text-[10px] font-normal text-muted-foreground">R$ {wpPrice.replace('.', ',')} / Wp</span>}
              </div>
            </div>
          </div>

          {/* Actions + Expand + Menu */}
          <div className="flex items-center gap-3 shrink-0 ml-auto">
            {(() => {
              const actions = getAvailableProposalActions(p.status);
              if (!actions.canAccept && !actions.canReject) return null;
              
              return (
                <div className="hidden sm:flex items-center gap-2 mr-2">
                  {actions.canAccept && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-7 text-[10px] md:text-xs gap-1 border-success/50 text-success hover:bg-success/10 font-medium px-2" 
                      onClick={(e) => {
                        e.stopPropagation();
                        updatePropostaStatus("accepted");
                      }} 
                      disabled={updatingStatus}
                    >
                      <CheckCircle className="h-3 w-3" /> Aceitar
                    </Button>
                  )}
                  {actions.canReject && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-7 text-[10px] md:text-xs gap-1 border-destructive/50 text-destructive hover:bg-destructive/10 font-medium px-2" 
                      disabled={updatingStatus}
                      onClick={(e) => {
                        e.stopPropagation();
                        setRecusaDialogOpen(true);
                      }}
                    >
                      <AlertCircle className="h-3 w-3" /> Recusar
                    </Button>
                  )}
                </div>
              );
            })()}

            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
                {/* Ações de compartilhamento */}
                {latestVersao && (
                  <>
                    {!isMigrated && (
                      <>
                        <DropdownMenuItem onClick={openPublicProposal}>
                          <ExternalLink className="h-3.5 w-3.5 mr-2 text-primary" /> Abrir proposta web
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={copyTrackedLink}>
                          <Link2 className="h-3.5 w-3.5 mr-2 text-muted-foreground" /> Copiar link c/ rastreio
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={copyPublicLink}>
                          <Link2 className="h-3.5 w-3.5 mr-2 text-muted-foreground" /> Copiar link público
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuItem onClick={() => handleSend("whatsapp")} disabled={sending}>
                      <MessageCircle className="h-3.5 w-3.5 mr-2 text-success" /> Enviar WhatsApp
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setMessageDrawerOpen(true)}>
                      <Mail className="h-3.5 w-3.5 mr-2 text-primary" /> Enviar Resumo
                    </DropdownMenuItem>
                    {(latestVersao.output_pdf_path || latestVersao.link_pdf) && (
                      <DropdownMenuItem onClick={handleDownloadPdf} disabled={downloadingPdf}>
                        <Download className="h-3.5 w-3.5 mr-2 text-muted-foreground" /> Baixar PDF
                      </DropdownMenuItem>
                    )}
                    {latestVersao.output_docx_path && (
                      <DropdownMenuItem onClick={handleDownloadDocx}>
                        <Download className="h-3.5 w-3.5 mr-2 text-muted-foreground" /> Baixar DOCX
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={() => handleEditWithProtection(() => {
                  if (!latestVersao?.id) {
                    toast({
                      title: "Proposta sem versão editável",
                      description: "Esta proposta importada ainda não possui uma versão nativa. Use \"Duplicar proposta\" para criar uma versão editável.",
                      variant: "destructive",
                    });
                    return;
                  }
                  const params = new URLSearchParams();
                  if (dealId) params.set("deal_id", dealId);
                  if (customerId) params.set("customer_id", customerId);
                  params.set("proposta_id", p.id);
                  params.set("versao_id", latestVersao.id);
                  navigate(`/admin/propostas-nativas/nova?${params.toString()}`);
                })}>
                  <Pencil className="h-3.5 w-3.5 mr-2 text-primary" /> Editar proposta
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCloneModalOpen(true)}>
                  <Copy className="h-3.5 w-3.5 mr-2 text-muted-foreground" /> Duplicar proposta
                </DropdownMenuItem>
                {!isPrincipal && onSetPrincipal && (
                  <DropdownMenuItem onClick={onSetPrincipal}>
                    <Star className="h-3.5 w-3.5 mr-2 text-warning" /> Definir como principal
                  </DropdownMenuItem>
                )}
                {onArchive && !isPrincipal && (
                  <DropdownMenuItem onClick={onArchive}>
                    <FolderOpen className="h-3.5 w-3.5 mr-2 text-muted-foreground" /> Arquivar proposta
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setDeleteOpen(true)} className="text-destructive focus:text-destructive">
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir proposta
                </DropdownMenuItem>
                {canReabrir && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setReabrirDialogOpen(true)}>
                      <RotateCcw className="h-3.5 w-3.5 mr-2 text-warning" /> Reabrir proposta
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {isExpanded && (
          <div className="border-t border-border/50 bg-background/40">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="px-4 pt-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <TabsList className="overflow-x-auto flex-wrap h-auto bg-transparent p-0 gap-4">
                    <TabsTrigger value="resumo" className="text-xs h-7 px-0 pb-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                      Resumo
                    </TabsTrigger>
                    <TabsTrigger value="arquivo" className="text-xs h-7 px-0 pb-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                      Arquivo
                    </TabsTrigger>
                    <TabsTrigger value="dados" className="text-xs h-7 px-0 pb-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                      Dados
                    </TabsTrigger>
                    <TabsTrigger value="historico" className="text-xs h-7 px-0 pb-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                      Histórico
                    </TabsTrigger>
                    <TabsTrigger value="rastreio" className="text-xs h-7 px-0 pb-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                      Rastreio
                    </TabsTrigger>
                  </TabsList>

                  {(() => {
                    const actions = getAvailableProposalActions(p.status);
                    
                    // Se não tem ações de aceitar/recusar, não renderiza nada aqui
                    if (!actions.canAccept && !actions.canReject) return null;

                    return null;
                  })()}
                </div>

              </div>

              {loadingDetail ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span className="text-xs">Carregando dados...</span>
                </div>
              ) : (
                <WizardProvider>
                  <TabsContent value="resumo" className="px-4 pb-4 mt-0">
                    {(snapshot as Record<string, any>)?.source === "legacy_import" ? (
                      <SmResumoTab snapshot={snapshot as Record<string, any>} latestVersao={latestVersao} wpPrice={wpPrice} />
                    ) : (
                      <NativeResumoTab snapshot={snapshot} ucsDetail={ucsDetail} latestVersao={latestVersao} wpPrice={wpPrice} buildSummaryRows={buildSummaryRows} />
                    )}
                  </TabsContent>

                  <TabsContent value="arquivo" className="px-4 pb-4 mt-0">
                    <div className="mt-3">
                      <StepDocumentoBridge
                        onRender={handleRender}
                        rendering={rendering}
                        html={html}
                        propostaId={p.id}
                        versaoId={latestVersao?.id}
                        outputPdfPath={latestVersao?.output_pdf_path ?? null}
                        outputDocxPath={latestVersao?.output_docx_path ?? null}
                        externalPdfUrl={latestVersao?.link_pdf ?? null}
                        generationStatusOverride={latestVersao?.generation_status ?? null}
                        generationError={latestVersao?.generation_error ?? null}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="dados" className="px-4 pb-4 mt-0">
                    <div className="mt-3">
                      <ProposalSnapshotView
                        snapshot={snapshot as Record<string, unknown> | null}
                        valorTotal={latestVersao?.valor_total}
                        geracaoMensal={latestVersao?.geracao_mensal ?? undefined}
                        economiaMensal={latestVersao?.economia_mensal ?? undefined}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="historico" className="px-4 pb-4 mt-0">
                    <div className="mt-3">
                      {mergedTimeline.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-8">Nenhum registro de histórico encontrado</p>
                      ) : (
                        <div className="relative pl-6">
                          <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-primary/20" />

                          {mergedTimeline.map((entry) => {
                            const dateStr = formatDate(entry.created_at);
                            const timeStr = formatTime(entry.created_at);

                            return (
                              <div key={entry.id} className="relative flex gap-3 pb-5 last:pb-0">
                                <div className="absolute -left-6 mt-1">
                                  <div className={cn("h-5 w-5 rounded-full border-2 flex items-center justify-center", entry.dotClass)}>
                                    {entry.icon}
                                  </div>
                                </div>

                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-foreground">{entry.userName}</p>
                                  <p className="text-[10px] text-muted-foreground">{dateStr} às {timeStr}</p>
                                  <p className="text-xs mt-0.5 flex items-center gap-1.5">
                                    <span className={cn("h-4 w-4 rounded-full flex items-center justify-center shrink-0", entry.badgeClass)}>
                                      {entry.icon}
                                    </span>
                                    <span className="text-foreground">{entry.label}</span>
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="rastreio" className="px-4 pb-4 mt-0">
                    <div className="mt-3">
                      <ProposalViewsCard
                        propostaId={p.id}
                        versaoId={latestVersao?.id}
                        statusVisualizacao={(p as any).status_visualizacao}
                        primeiroAcessoEm={(p as any).primeiro_acesso_em}
                        ultimoAcessoEm={(p as any).ultimo_acesso_em}
                        totalAberturas={(p as any).total_aberturas ?? 0}
                      />
                    </div>
                  </TabsContent>
                </WizardProvider>
              )}
            </Tabs>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="w-[90vw] max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-destructive" />
              </div>
              <AlertDialogTitle>Excluir proposta</AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              Atenção: Propostas com movimentações financeiras (vendas, recebimentos ou comissões) ou obras vinculadas não podem ser excluídas. Deseja prosseguir com a exclusão?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reabrir confirmation */}
      <AlertDialog open={reabrirDialogOpen} onOpenChange={setReabrirDialogOpen}>
        <AlertDialogContent className="w-[90vw] max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5 text-warning" />
              </div>
              <AlertDialogTitle>Reabrir proposta?</AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              A proposta voltará para o status "Enviada" e poderá ser aceita ou rejeitada novamente. Esta ação será registrada no histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reabrindo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReabrir} disabled={reabrindo} className="bg-warning text-warning-foreground hover:bg-warning/90">
              {reabrindo ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RotateCcw className="h-4 w-4 mr-1" />}
              Reabrir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Message history */}
      {isExpanded && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Mensagens enviadas</p>
          <ProposalMessageHistory propostaId={p.id} />
        </div>
      )}

      {/* Message drawer */}
      {latestVersao && (
        <ProposalMessageDrawer
          open={messageDrawerOpen}
          onOpenChange={setMessageDrawerOpen}
          versaoId={latestVersao.id}
          propostaId={p.id}
          projetoId={dealId}
          clienteId={customerId}
          tenantId={tenantCtx?.tenantId}
          propostaData={{
            cliente_nome: p.cliente_nome,
            codigo: p.codigo,
            status: p.status,
          }}
          versaoData={{
            valor_total: latestVersao.valor_total,
            potencia_kwp: latestVersao.potencia_kwp,
            economia_mensal: latestVersao.economia_mensal,
            payback_meses: latestVersao.payback_meses,
            geracao_mensal: latestVersao.geracao_mensal,
            public_slug: latestVersao.public_slug,
          }}
          clienteTelefone={(snapshot as any)?.clienteCelular || clienteContato?.telefone || null}
          clienteEmail={(snapshot as any)?.clienteEmail || clienteContato?.email || null}
        />
      )}

      {/* Clone modal */}
      <ClonePropostaModal
        open={cloneModalOpen}
        onOpenChange={setCloneModalOpen}
        propostaId={p.id}
        propostaTitulo={p.titulo || p.codigo || `Proposta #${p.proposta_num}`}
        dealId={dealId}
        customerId={customerId}
      />

      {/* Edit accepted proposal confirmation dialog */}
      <Dialog open={editAceitaDialogOpen} onOpenChange={setEditAceitaDialogOpen}>
        <DialogContent className="w-[90vw] max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <AlertCircle className="h-5 w-5 text-warning" />
              Editar proposta aceita
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Esta proposta está aceita. Editar irá cancelar os contratos vinculados (não assinados). Deseja continuar?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label className="text-sm font-medium text-foreground">Motivo da edição *</label>
            <Textarea
              placeholder="Informe o motivo para editar esta proposta aceita..."
              value={editAceitaMotivo}
              onChange={(e) => setEditAceitaMotivo(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setEditAceitaDialogOpen(false)} disabled={cancellingDocs}>
              Cancelar
            </Button>
            <Button
              variant="default"
              onClick={confirmEditAceita}
              disabled={!editAceitaMotivo.trim() || cancellingDocs}
              className="bg-warning text-warning-foreground hover:bg-warning/90"
            >
              {cancellingDocs ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar e editar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function getAuditMeta(acao: string, tabela: string): { label: string; icon: React.ReactNode; dotClass: string; badgeClass: string } {
  if (tabela === "propostas_nativas") {
    if (acao === "INSERT") return {
      label: "Criou a proposta",
      icon: <FilePlus className="h-3 w-3" />,
      dotClass: "border-success/40 bg-success/10 text-success",
      badgeClass: "bg-success/10 text-success",
    };
    if (acao === "UPDATE") return {
      label: "Editou a proposta",
      icon: <Pencil className="h-3 w-3" />,
      dotClass: "border-info/40 bg-info/10 text-info",
      badgeClass: "bg-info/10 text-info",
    };
    if (acao === "DELETE") return {
      label: "Excluiu a proposta",
      icon: <Trash2 className="h-3 w-3" />,
      dotClass: "border-destructive/40 bg-destructive/10 text-destructive",
      badgeClass: "bg-destructive/10 text-destructive",
    };
  }
  if (tabela === "proposta_versoes") {
    if (acao === "INSERT") return {
      label: "Gerou modelo da proposta",
      icon: <FileCheck className="h-3 w-3" />,
      dotClass: "border-warning/40 bg-warning/10 text-warning",
      badgeClass: "bg-warning/10 text-warning",
    };
    if (acao === "UPDATE") return {
      label: "Atualizou versão da proposta",
      icon: <RefreshCw className="h-3 w-3" />,
      dotClass: "border-primary/40 bg-primary/10 text-primary",
      badgeClass: "bg-primary/10 text-primary",
    };
    if (acao === "DELETE") return {
      label: "Removeu versão da proposta",
      icon: <Trash2 className="h-3 w-3" />,
      dotClass: "border-destructive/40 bg-destructive/10 text-destructive",
      badgeClass: "bg-destructive/10 text-destructive",
    };
  }
  return {
    label: `${acao} em ${tabela}`,
    icon: <Clock className="h-3 w-3" />,
    dotClass: "border-muted-foreground/40 bg-muted text-muted-foreground",
    badgeClass: "bg-muted text-muted-foreground",
  };
}

function DataItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded-lg p-3">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-sm font-bold text-foreground mt-0.5">{value}</p>
    </div>
  );
}

const ICON_MAP = {
  check: <CheckCircle className="h-3.5 w-3.5 text-success shrink-0" />,
  text: <span className="text-[10px] font-bold text-muted-foreground shrink-0 w-3.5 text-center">T</span>,
  dollar: <DollarSign className="h-3.5 w-3.5 text-warning shrink-0" />,
};

function DadosField({ icon, label, value }: { icon: "check" | "text" | "dollar"; label: string; value: string }) {
  return (
    <div className="border-b border-border/20 pb-2.5 last:border-0 last:pb-0">
      <div className="flex items-start gap-2">
        <div className="mt-0.5">{ICON_MAP[icon]}</div>
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground">{label}</p>
          <p className="text-xs font-medium text-foreground mt-0.5">{value}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Bridge: lê templateSelecionado do WizardContext e dispara handleRender do pai
function StepDocumentoBridge({
  onRender,
  rendering,
  html,
  propostaId,
  versaoId,
  outputPdfPath,
  outputDocxPath,
  externalPdfUrl,
  generationStatusOverride,
  generationError,
}: {
  onRender: (templateId?: string) => void | Promise<void>;
  rendering: boolean;
  html: string | null;
  propostaId: string;
  versaoId?: string;
  outputPdfPath: string | null;
  outputDocxPath: string | null;
  externalPdfUrl: string | null;
  generationStatusOverride?: string | null;
  generationError?: string | null;
}) {
  const ctx = useWizardContext() as any;
  const tplFromCtx = ctx?.templateSelecionado as string | undefined;
  const hasArtifact = !!outputPdfPath || !!externalPdfUrl || !!outputDocxPath;
  const effectiveGenerating = rendering || (!hasArtifact && generationStatusOverride === "pending");
  const effectiveGenerationStatus = rendering
    ? "generating_docx"
    : outputDocxPath && !outputPdfPath && !externalPdfUrl
      ? "docx_only"
      : hasArtifact
        ? "ready"
        : generationStatusOverride === "error"
          ? "error"
          : (ctx?.generationStatus ?? "idle");

  return (
    <StepDocumento
      onViewDetail={() => {}}
      skipTemplateAutoSelect={true}
      onGenerate={() => onRender(tplFromCtx)}
      generating={effectiveGenerating}
      rendering={effectiveGenerating}
      htmlPreview={html}
      result={versaoId ? { proposta_id: propostaId, versao_id: versaoId } : null}
      outputPdfPath={outputPdfPath}
      outputDocxPath={outputDocxPath}
      externalPdfUrl={externalPdfUrl}
      generationStatusOverride={effectiveGenerationStatus}
      generationError={generationError}
    />
  );
}
