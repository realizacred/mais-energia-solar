import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";
import { useNavigate } from "react-router-dom";
import { ProposalSnapshotView } from "@/components/admin/propostas-nativas/ProposalSnapshotView";
import { StepDocumento } from "@/components/admin/propostas-nativas/wizard/StepDocumento";
import {
  Zap, SunMedium, DollarSign, FileText, Eye, Pencil, Copy, Trash2, Download,
  ChevronDown, MoreVertical, ExternalLink, AlertCircle, CheckCircle, Loader2,
  Link2, MessageCircle, Mail, CalendarCheck, RefreshCw, Home, Building2, Star, FolderOpen, MessageSquareText,
  FilePlus, FileCheck, Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import { renderProposal, sendProposal } from "@/services/proposalApi";
import { formatDateTime, formatDate, formatTime, formatDateShort } from "@/lib/dateUtils";
import { ProposalMessageDrawer } from "./ProposalMessageDrawer";
import { ProposalMessageHistory } from "./ProposalMessageHistory";
import { ClonePropostaModal } from "./ClonePropostaModal";
import { useExcluirProposta } from "@/hooks/usePropostasProjetoTab";
import { usePropostaExpandedSnapshot, usePropostaExpandedUcs, usePropostaAuditLogs, type UCDetailData } from "@/hooks/usePropostaExpandedData";

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
  public_slug: string | null;
  gerado_em: string | null;
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

// ─── Status Badge (SSOT from proposalStatusConfig) ───
import { getProposalStatusConfig } from "@/lib/proposalStatusConfig";

function StatusBadge({ status }: { status: string }) {
  const s = getProposalStatusConfig(status);
  return <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap", s.className)}>{s.label}</span>;
}

function StatusIcon({ status, isPrincipal }: { status: string; isPrincipal: boolean }) {
  const s = getProposalStatusConfig(status);
  const colorCls = s?.iconCls || (isPrincipal ? "text-primary" : "text-muted-foreground");
  const isAccepted = ["aceita", "ganha"].includes(status);
  const isRejected = ["rejeitada", "recusada", "perdida"].includes(status);
  
  if (isAccepted) return <CheckCircle className={cn("h-6 w-6 shrink-0 mr-3", colorCls)} />;
  if (isRejected) return <AlertCircle className={cn("h-6 w-6 shrink-0 mr-3", colorCls)} />;
  return <FileText className={cn("h-6 w-6 shrink-0 mr-3", colorCls)} />;
}

// ─── SM (legacy_import) Tab Components ──────────────

function SmResumoTab({ snapshot, latestVersao, wpPrice }: { snapshot: any; latestVersao: VersaoData | undefined; wpPrice: string | null }) {
  const totalFinal = latestVersao?.valor_total || 0;
  const equipCost = snapshot.equipment_cost || 0;
  const installCost = snapshot.installation_cost || 0;
  const equipPct = totalFinal > 0 ? (equipCost / totalFinal) * 100 : 0;
  const installPct = totalFinal > 0 ? (installCost / totalFinal) * 100 : 0;

  return (
    <div className="flex gap-5 mt-3">
      {/* Left: Unidades */}
      <div className="w-[280px] shrink-0">
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
        <div className="border rounded-lg overflow-hidden">
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
  );
}

function SmArquivoTab({ snapshot }: { snapshot: any }) {
  const pdfUrl = snapshot.link_pdf;
  return (
    <div className="flex gap-5 mt-3">
      <div className="w-[220px] shrink-0 space-y-3">
        <p className="text-sm font-bold text-foreground">Opções</p>
        {pdfUrl && (
          <div className="space-y-1">
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-primary hover:underline py-1">
              <FileText className="h-3.5 w-3.5" /> Baixar PDF
            </a>
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-primary hover:underline py-1">
              <ExternalLink className="h-3.5 w-3.5" /> Abrir em nova aba
            </a>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 border rounded-lg overflow-hidden bg-muted/20">
        {pdfUrl ? (
          <iframe src={pdfUrl} className="w-full h-[500px] border-0" title="Preview do PDF" />
        ) : (
          <div className="flex flex-col items-center justify-center h-[500px] text-muted-foreground">
            <FileText className="h-10 w-10 opacity-20 mb-3" />
            <p className="text-sm font-medium">Nenhum PDF disponível</p>
            <p className="text-xs mt-1">Esta proposta não possui arquivo PDF vinculado</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SmDadosTab({ snapshot, latestVersao }: { snapshot: any; latestVersao: VersaoData | undefined }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-3">
      {/* Sistema */}
      <div className="border rounded-lg p-4 space-y-3">
        <h4 className="text-sm font-bold text-foreground">Sistema</h4>
        <DadosField icon="check" label="Telhado" value={snapshot.roof_type || "—"} />
        <DadosField icon="text" label="Estrutura" value={snapshot.structure_type || "—"} />
        <DadosField icon="text" label="Módulo" value={snapshot.panel_model || "—"} />
        <DadosField icon="text" label="Qtd Módulos" value={snapshot.panel_quantity?.toString() || "—"} />
        <DadosField icon="text" label="Inversor" value={snapshot.inverter_model || "—"} />
        <DadosField icon="text" label="Qtd Inversores" value={snapshot.inverter_quantity?.toString() || "—"} />
        <DadosField icon="text" label="Garantia" value={snapshot.warranty || "—"} />
      </div>

      {/* Financeiro */}
      <div className="border rounded-lg p-4 space-y-3">
        <h4 className="text-sm font-bold text-foreground">Financeiro</h4>
        <DadosField icon="dollar" label="Custo Equipamento" value={snapshot.equipment_cost ? formatBRL(snapshot.equipment_cost) : "—"} />
        <DadosField icon="dollar" label="Custo Instalação" value={snapshot.installation_cost ? formatBRL(snapshot.installation_cost) : "—"} />
        <DadosField icon="dollar" label="Desconto" value={snapshot.discount ? formatBRL(snapshot.discount) : "—"} />
        <DadosField icon="dollar" label="TIR" value={snapshot.tir ? `${formatNumberBR(snapshot.tir * 100)}%` : "—"} />
        <DadosField icon="dollar" label="VPL" value={snapshot.vpl ? formatBRL(snapshot.vpl) : "—"} />
        <DadosField icon="text" label="Payback" value={snapshot.payback_original || "—"} />
      </div>

      {/* Energia */}
      <div className="border rounded-lg p-4 space-y-3">
        <h4 className="text-sm font-bold text-foreground">Energia</h4>
        <DadosField icon="text" label="Consumo Mensal" value={snapshot.consumo_mensal ? `${formatNumberBR(snapshot.consumo_mensal)} kWh` : "—"} />
        <DadosField icon="text" label="Geração Anual" value={snapshot.geracao_anual ? `${formatNumberBR(Number(snapshot.geracao_anual))} kWh` : "—"} />
        <DadosField icon="text" label="Economia %" value={snapshot.economia_mensal_percent ? `${formatNumberBR(snapshot.economia_mensal_percent)}%` : "—"} />
        <DadosField icon="dollar" label="Tarifa Distribuidora" value={snapshot.tarifa_distribuidora ? `R$ ${Number(snapshot.tarifa_distribuidora).toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4, timeZone: "America/Sao_Paulo" })}` : "—"} />
        <DadosField icon="dollar" label="Custo Disponibilidade" value={snapshot.custo_disponibilidade ? formatBRL(snapshot.custo_disponibilidade) : "—"} />
        <DadosField icon="text" label="Sobredimensionamento" value={snapshot.sobredimensionamento ? `${formatNumberBR(snapshot.sobredimensionamento * 100)}%` : "—"} />
        <DadosField icon="text" label="Perda Eficiência/Ano" value={snapshot.perda_eficiencia_anual ? `${formatNumberBR(snapshot.perda_eficiencia_anual * 100)}%` : "—"} />
        <DadosField icon="text" label="Inflação Energética" value={snapshot.inflacao_energetica ? `${formatNumberBR(snapshot.inflacao_energetica * 100)}%` : "—"} />
      </div>

      {/* Pagamento */}
      <div className="border rounded-lg p-4 space-y-3">
        <h4 className="text-sm font-bold text-foreground">Pagamento</h4>
        <div className="pb-3 border-b border-border/30">
          <p className="text-xs font-bold text-primary">À vista</p>
          <p className="text-sm font-bold text-foreground">{formatBRL(latestVersao?.valor_total || 0)}</p>
        </div>
        {snapshot.payment_conditions ? (
          <DadosField icon="text" label="Condições" value={snapshot.payment_conditions} />
        ) : (
          <p className="text-xs text-muted-foreground">Sem opções de financiamento</p>
        )}
      </div>
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
  const geracaoMensal = latestVersao?.geracao_mensal || (snapshot as Record<string, any>)?.geracaoMensalEstimada || 0;
  const economiaMensal = latestVersao?.economia_mensal || 0;
  return (
    <div className="flex gap-5 mt-3">
      {/* Left: Unidades */}
      <div className="w-[280px] shrink-0">
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
        <div className="border rounded-lg overflow-hidden">
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
                  <span className="font-bold text-foreground text-sm">{formatBRL(latestVersao?.valor_total || 0)}</span>
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
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
  customerId: string | null;
  onRefresh: () => void;
  isOutdated?: boolean;
  onSetPrincipal?: () => void;
  onArchive?: () => void;
}

export function PropostaExpandedDetail({ proposta: p, isPrincipal, isExpanded, onToggle, dealId, customerId, onRefresh, isOutdated, onSetPrincipal, onArchive }: Props) {
  const navigate = useNavigate();
  const { data: tenantCtx } = useQuery({ queryKey: ["current-tenant-id"], queryFn: getCurrentTenantId, staleTime: 1000 * 60 * 15 });
  const latestVersao = p.versoes[0];
  const wpPrice = latestVersao?.valor_total && latestVersao?.potencia_kwp
    ? (latestVersao.valor_total / (latestVersao.potencia_kwp * 1000)).toFixed(2)
    : null;

  // §16: Queries in hooks — AP-01 fix
  const versaoIds = p.versoes.map(v => v.id);
  const { data: snapshotData } = usePropostaExpandedSnapshot(latestVersao?.id || null, isExpanded);
  const { data: ucsDetail = [] } = usePropostaExpandedUcs(latestVersao?.id || null, isExpanded);
  const { data: auditLogs = [] } = usePropostaAuditLogs(p.id, versaoIds, isExpanded);
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
  const [templateSelecionado, setTemplateSelecionado] = useState("");

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

  // Fetch signed URL when expanded and PDF path exists
  useEffect(() => {
    if (!isExpanded || !latestVersao?.output_pdf_path) {
      setPdfSignedUrl(null);
      setPdfError(false);
      return;
    }
    setPdfLoading(true);
    setPdfError(false);
    supabase.storage.from("proposta-documentos").createSignedUrl(latestVersao.output_pdf_path, 3600)
      .then(({ data, error }) => {
        if (error || !data?.signedUrl) {
          setPdfError(true);
          setPdfSignedUrl(null);
        } else {
          setPdfSignedUrl(data.signedUrl);
        }
      })
      .finally(() => setPdfLoading(false));
  }, [isExpanded, latestVersao?.output_pdf_path]);

  // ─── Accept / Reject handler ───
  const updatePropostaStatus = async (newStatus: string, extra?: Record<string, any>) => {
    setUpdatingStatus(true);
    try {
      // Use RPC for status transitions — tenant validation, state machine, and audit in backend
      const { data: rpcResult, error } = await supabase.rpc("proposal_update_status" as any, {
        p_proposta_id: p.id,
        p_new_status: newStatus,
        p_motivo: extra?.motivo || null,
      });
      if (error) throw error;
      if ((rpcResult as any)?.error) throw new Error((rpcResult as any).error);

      // ── Gerar comissão ao aceitar ──
      if (newStatus === "aceita" && latestVersao && customerId) {
        try {
          let consultorId: string | null = null;
          const { data: propData } = await supabase
            .from("propostas_nativas")
            .select("lead_id")
            .eq("id", p.id)
            .maybeSingle();
          if (propData?.lead_id) {
            const { data: lead } = await supabase
              .from("leads")
              .select("consultor_id")
              .eq("id", propData.lead_id)
              .maybeSingle();
            consultorId = lead?.consultor_id || null;
          }
          if (consultorId && latestVersao.valor_total > 0) {
            const { data: plan } = await supabase
              .from("commission_plans")
              .select("parameters")
              .eq("is_active", true)
              .limit(1)
              .maybeSingle();
            const percentual = (plan?.parameters as any)?.percentual ?? 5;
            const now = new Date();
            await supabase.from("comissoes").insert({
              consultor_id: consultorId,
              cliente_id: customerId,
              projeto_id: dealId || null,
              descricao: `Proposta aceita - ${p.cliente_nome || "Cliente"} (${latestVersao.potencia_kwp || 0}kWp)`,
              valor_base: latestVersao.valor_total,
              percentual_comissao: percentual,
              valor_comissao: (latestVersao.valor_total * percentual) / 100,
              mes_referencia: now.getMonth() + 1,
              ano_referencia: now.getFullYear(),
              status: "pendente",
            });
          }
        } catch (comErr: any) {
          console.error("Erro ao gerar comissão:", comErr);
          toast({ title: "Proposta aceita, mas erro na comissão", description: comErr.message, variant: "destructive" });
        }
      }

      // ── Cancelar comissão se recusada ──
      if (newStatus === "recusada" && dealId) {
        await supabase.from("comissoes")
          .update({ status: "cancelada", observacoes: `Proposta ${newStatus}` })
          .eq("projeto_id", dealId)
          .eq("status", "pendente");
      }

      toast({ title: `Proposta marcada como "${getProposalStatusConfig(newStatus).label}"` });
      onRefresh();
    } catch (e: any) {
      toast({ title: "Erro ao atualizar status", description: e.message, variant: "destructive" });
    } finally {
      setUpdatingStatus(false);
    }
  };

  // §16: Queries moved to hooks (usePropostaExpandedData) — AP-01 fix

  // Auto-populate publicUrl from public_slug
  useEffect(() => {
    if (!isExpanded || publicUrl) return;
    const slug = latestVersao?.public_slug;
    if (slug) {
      setPublicUrl(`${window.location.origin}/p/${slug}`);
    }
  }, [isExpanded, latestVersao?.public_slug]);

  // Auto-render ONLY when no persisted PDF exists and status indicates generation happened
  // If output_pdf_path exists, the Arquivo tab will use signed URL instead
  useEffect(() => {
    if (!isExpanded || activeTab !== "arquivo" || html || rendering) return;
    if (!latestVersao?.id) return;
    // Skip auto-render if persisted PDF exists
    if (latestVersao.output_pdf_path) return;
    const vStatus = latestVersao.status?.toLowerCase();
    const pStatus = p.status?.toLowerCase();
    if (vStatus === "generated" || vStatus === "gerada" || vStatus === "ativa" ||
        pStatus === "gerada" || pStatus === "generated" || pStatus === "enviada" || pStatus === "aceita") {
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

  // Render proposal HTML
  const handleRender = async () => {
    if (!latestVersao?.id) return;
    setRendering(true);
    try {
      const result = await renderProposal(latestVersao.id);
      if (result.html) setHtml(result.html);
      else toast({ title: "Proposta renderizada, mas sem HTML retornado." });
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
      if (!pdfPath) {
        toast({ title: "PDF não disponível", description: "Gere o arquivo DOCX/PDF primeiro na aba de documentos.", variant: "destructive" });
        return;
      }
      const { data } = await supabase.storage.from("proposta-documentos").createSignedUrl(pdfPath, 3600);
      if (!data?.signedUrl) {
        toast({ title: "Erro ao obter URL do PDF", variant: "destructive" });
        return;
      }
      const resp = await fetch(data.signedUrl);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = (p.codigo || p.titulo || "proposta")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9-]+/g, "_")
        .replace(/_+/g, "_").replace(/^_+|_+$/g, "");
      a.download = `Proposta_${safeName}_v${latestVersao?.versao_numero || 1}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "PDF baixado!" });
    } catch (e: any) {
      toast({ title: "Erro ao baixar PDF", description: e.message, variant: "destructive" });
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
      const { data } = await supabase.storage.from("proposta-documentos").createSignedUrl(docxPath, 3600);
      if (!data?.signedUrl) {
        toast({ title: "Erro ao obter URL do DOCX", variant: "destructive" });
        return;
      }
      const resp = await fetch(data.signedUrl);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = (p.codigo || p.titulo || "proposta")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9-]+/g, "_")
        .replace(/_+/g, "_").replace(/^_+|_+$/g, "");
      a.download = `Proposta_${safeName}_v${latestVersao?.versao_numero || 1}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "DOCX baixado!" });
    } catch (e: any) {
      toast({ title: "Erro ao baixar DOCX", description: e.message, variant: "destructive" });
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
      setPublicUrl(result.public_url);
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

  // Copy public link (token-based, no tracking)
  const copyPublicLink = async () => {
    if (!p.id || !latestVersao?.id) {
      toast({ title: "Link público não disponível", description: "Gere a proposta primeiro.", variant: "destructive" });
      return;
    }
    try {
      const slug = latestVersao?.public_slug;
      if (slug) {
        const url = `${window.location.origin}/p/${slug}`;
        await navigator.clipboard.writeText(url);
        toast({ title: "Link público copiado!" });
        return;
      }
      // Fallback: create/get a public token
      const { getOrCreateProposalToken } = await import("@/services/proposal/proposalDetail.service");
      const token = await getOrCreateProposalToken(p.id, latestVersao.id, "public");
      const url = `${window.location.origin}/proposta/${token}`;
      await navigator.clipboard.writeText(url);
      toast({ title: "Link público copiado!" });
    } catch (e: any) {
      toast({ title: "Erro ao gerar link público", description: e.message, variant: "destructive" });
    }
  };

  // Generate/copy tracked link (token-based)
  const copyTrackedLink = async () => {
    if (!p.id || !latestVersao?.id) return;
    try {
      // Try to find existing valid token
      const { data: existingToken } = await (supabase as any)
        .from("proposta_aceite_tokens")
        .select("token")
        .eq("proposta_id", p.id)
        .eq("versao_id", latestVersao.id)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let token = existingToken?.token;

      if (!token) {
        // Generate new token
        const { data: newToken, error } = await (supabase as any)
          .from("proposta_aceite_tokens")
          .insert({
            proposta_id: p.id,
            versao_id: latestVersao.id,
            tenant_id: tenantCtx?.tenantId,
            token: crypto.randomUUID(),
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
            tipo: "tracked",
          })
          .select("token")
          .single();
        if (error) throw error;
        token = newToken.token;
      }

      const url = `${window.location.origin}/proposta/${token}`;
      navigator.clipboard.writeText(url);
      toast({ title: "Link rastreável copiado!" });
    } catch (e: any) {
      toast({ title: "Erro ao gerar link rastreável", description: e.message, variant: "destructive" });
    }
  };

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
    const totalFinal = latestVersao?.valor_total || 0;
    const servicos = snapshot.servicos || [];

    // Kit items
    const kitItems = snapshot.itens || [];
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
        isPrincipal ? "bg-card border-primary/20 shadow-sm" : "bg-card border-border/40 hover:border-border/70"
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
              <StatusBadge status={p.status} />
              {isPrincipal && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap bg-warning/10 text-warning">
                  <Star className="h-2.5 w-2.5 inline mr-0.5 -mt-0.5" />Principal
                </span>
              )}
              {isOutdated && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap bg-warning/10 text-warning border border-warning/20">
                  Desatualizada
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Criada em {formatDate(p.created_at)}
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
                {latestVersao?.geracao_mensal ? `${latestVersao.geracao_mensal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWh` : "—"}
              </p>
            </div>
          </div>

          {/* Col 4: Preço do Projeto - hidden on mobile */}
          <div className="hidden md:flex items-center gap-2 border-l border-border/40 pl-4 pr-3">
            <DollarSign className="h-4 w-4 text-warning shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground leading-tight">Preço do Projeto</p>
              <p className="text-sm font-bold text-foreground">
                {latestVersao?.valor_total ? formatBRL(latestVersao.valor_total) : "—"}
                {wpPrice && <span className="text-[10px] font-normal text-muted-foreground ml-1.5">R$ {wpPrice.replace('.', ',')} / Wp</span>}
              </p>
            </div>
          </div>

          {/* Expand + Menu */}
          <div className="flex items-center gap-1 shrink-0 ml-auto">
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => e.stopPropagation()}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52" onClick={e => e.stopPropagation()}>
                {!isPrincipal && onSetPrincipal && (
                  <DropdownMenuItem onClick={onSetPrincipal}>
                    <Star className="h-3.5 w-3.5 mr-2 text-warning" /> Definir como principal
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => {
                  if (latestVersao) navigate(`/admin/propostas-nativas/${p.id}/versoes/${latestVersao.id}`);
                }}>
                  <Eye className="h-3.5 w-3.5 mr-2 text-primary" /> Visualizar detalhes
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  if (latestVersao) {
                    const params = new URLSearchParams({
                      proposta_id: p.id,
                      versao_id: latestVersao.id,
                    });
                    if (dealId) params.set("deal_id", dealId);
                    if (customerId) params.set("customer_id", customerId);
                    navigate(`/admin/propostas-nativas/nova?${params.toString()}`);
                  } else {
                    const params = new URLSearchParams({ deal_id: dealId });
                    if (customerId) params.set("customer_id", customerId);
                    navigate(`/admin/propostas-nativas/nova?${params.toString()}`);
                  }
                }}>
                  <Pencil className="h-3.5 w-3.5 mr-2 text-warning" /> Editar dimensionamento
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleDownloadPdf} disabled={!latestVersao?.output_pdf_path}>
                  <Download className="h-3.5 w-3.5 mr-2 text-success" /> Baixar PDF
                </DropdownMenuItem>
                {latestVersao?.output_docx_path && (
                  <DropdownMenuItem onClick={handleDownloadDocx}>
                    <Download className="h-3.5 w-3.5 mr-2 text-info" /> Baixar DOCX
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={copyPublicLink} disabled={!latestVersao}>
                  <Link2 className="h-3.5 w-3.5 mr-2 text-muted-foreground" /> Copiar link público
                </DropdownMenuItem>
                <DropdownMenuItem onClick={copyTrackedLink} disabled={!latestVersao}>
                  <Link2 className="h-3.5 w-3.5 mr-2 text-primary" /> Gerar/Copiar link rastreável
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setMessageDrawerOpen(true)} disabled={!latestVersao}>
                  <MessageSquareText className="h-3.5 w-3.5 mr-2 text-primary" /> Gerar mensagem
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setCloneModalOpen(true)}>
                  <Copy className="h-3.5 w-3.5 mr-2 text-primary" /> Clonar proposta
                </DropdownMenuItem>
                {onArchive && p.status !== "arquivada" && (
                  <DropdownMenuItem onClick={onArchive}>
                    <FolderOpen className="h-3.5 w-3.5 mr-2 text-muted-foreground" /> Arquivar
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir proposta
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Mobile metrics */}
        <div className="md:hidden px-4 pb-3 grid grid-cols-3 gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <Zap className="h-3 w-3 text-warning" />
            <div>
              <p className="text-[9px] text-muted-foreground">Potência</p>
              <p className="font-bold">{latestVersao?.potencia_kwp ? `${latestVersao.potencia_kwp.toFixed(2)} kWp` : "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <SunMedium className="h-3 w-3 text-muted-foreground" />
            <div>
              <p className="text-[9px] text-muted-foreground">Geração</p>
              <p className="font-bold">{latestVersao?.geracao_mensal ? `${latestVersao.geracao_mensal.toFixed(0)} kWh` : "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <DollarSign className="h-3 w-3 text-warning" />
            <div>
              <p className="text-[9px] text-muted-foreground">Preço</p>
              <p className="font-bold">{latestVersao?.valor_total ? formatBRL(latestVersao.valor_total) : "—"}</p>
            </div>
          </div>
        </div>

        {/* ── Expanded detail ────────────────── */}
        {isExpanded && (
          <div className="border-t border-border/30">
            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="flex items-center justify-between px-4 pt-3">
                <TabsList className="h-8 bg-transparent p-0 gap-4">
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
                </TabsList>

                {/* Accept / Reject buttons */}
                {(p.status === "gerada" || p.status === "generated" || p.status === "enviada" || p.status === "sent" || p.status === "vista") && (
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-success text-success hover:bg-success/10" onClick={() => updatePropostaStatus("aceita")} disabled={updatingStatus}>
                      <CheckCircle className="h-3 w-3" /> Aceitar
                    </Button>
                    <AlertDialog open={recusaDialogOpen} onOpenChange={setRecusaDialogOpen}>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-destructive text-destructive hover:bg-destructive/10" disabled={updatingStatus}>
                          <AlertCircle className="h-3 w-3" /> Rejeitar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="w-[90vw] max-w-md">
                        <AlertDialogHeader>
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                              <AlertCircle className="w-5 h-5 text-destructive" />
                            </div>
                            <AlertDialogTitle>Recusar proposta?</AlertDialogTitle>
                          </div>
                          <AlertDialogDescription>Informe o motivo da recusa (opcional).</AlertDialogDescription>
                        </AlertDialogHeader>
                        <textarea placeholder="Motivo da recusa..." value={recusaMotivo} onChange={(e) => setRecusaMotivo(e.target.value)} className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { updatePropostaStatus("recusada", { motivo: recusaMotivo }); setRecusaMotivo(""); setRecusaDialogOpen(false); }}>
                            Confirmar Recusa
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>

              {loadingDetail ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span className="text-xs">Carregando dados...</span>
                </div>
              ) : (
                <>
                  {/* ─ Resumo Tab ─────────────── */}
                  <TabsContent value="resumo" className="px-4 pb-4 mt-0">
                    {(snapshot as Record<string, any>)?.source === "legacy_import" ? (
                      <SmResumoTab snapshot={snapshot as Record<string, any>} latestVersao={latestVersao} wpPrice={wpPrice} />
                    ) : (
                      <NativeResumoTab snapshot={snapshot} ucsDetail={ucsDetail} latestVersao={latestVersao} wpPrice={wpPrice} buildSummaryRows={buildSummaryRows} />
                    )}
                  </TabsContent>

                  {/* ─ Arquivo Tab — uses same StepDocumento as the wizard (SSOT) ─ */}
                  <TabsContent value="arquivo" className="px-4 pb-4 mt-0">
                    {(snapshot as Record<string, any>)?.source === "legacy_import" ? (
                      <SmArquivoTab snapshot={snapshot as Record<string, any>} />
                    ) : (
                      <div className="mt-3">
                        <StepDocumento
                          clienteNome={p.cliente_nome || ""}
                          empresaNome={(snapshot as any)?.clienteEmpresa || p.cliente_nome || ""}
                          clienteTelefone={(snapshot as any)?.clienteCelular || ""}
                          clienteEmail={(snapshot as any)?.clienteEmail || ""}
                          potenciaKwp={latestVersao?.potencia_kwp || 0}
                          geracaoMensalKwh={latestVersao?.geracao_mensal || 0}
                          numUcs={((snapshot as any)?.ucs || []).length || 1}
                          precoFinal={latestVersao?.valor_total || 0}
                          templateSelecionado={templateSelecionado}
                          onTemplateSelecionado={setTemplateSelecionado}
                          generating={false}
                          rendering={rendering}
                          result={latestVersao ? {
                            proposta_id: p.id,
                            versao_id: latestVersao.id,
                            success: true,
                          } : null}
                          htmlPreview={html}
                          pdfBlobUrl={pdfSignedUrl}
                          outputDocxPath={latestVersao?.output_docx_path || undefined}
                          outputPdfPath={latestVersao?.output_pdf_path || undefined}
                          generationStatus={
                            pdfSignedUrl || latestVersao?.output_pdf_path ? "ready" :
                            html ? "ready" : "idle"
                          }
                          generationError={null}
                          missingVars={[]}
                          onGenerate={handleRender}
                          onNewVersion={() => {
                            navigate(`/admin/propostas-nativas?edit=${p.id}`);
                          }}
                          onViewDetail={() => {}}
                        />
                      </div>
                    )}
                  </TabsContent>

                  {/* ─ Dados Tab — unified via ProposalSnapshotView (SSOT) ─ */}
                  <TabsContent value="dados" className="px-4 pb-4 mt-0">
                    {(snapshot as Record<string, any>)?.source === "legacy_import" ? (
                      <SmDadosTab snapshot={snapshot as Record<string, any>} latestVersao={latestVersao} />
                    ) : (
                      <div className="mt-3">
                        <ProposalSnapshotView
                          snapshot={snapshot as Record<string, unknown> | null}
                          valorTotal={latestVersao?.valor_total}
                          geracaoMensal={latestVersao?.geracao_mensal ?? undefined}
                          economiaMensal={latestVersao?.economia_mensal ?? undefined}
                        />
                      </div>
                    )}
                  </TabsContent>

                  {/* ─ Histórico Tab ──────────── */}
                  <TabsContent value="historico" className="px-4 pb-4 mt-0">
                    <div className="mt-3">
                      {auditLogs.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-8">Nenhum registro de histórico encontrado</p>
                      ) : (
                        <div className="relative pl-6">
                          {/* Timeline line */}
                          <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-primary/20" />

                          {auditLogs.map((log) => {
                            const audit = getAuditMeta(log.acao, log.tabela);
                            const userName = log.user_email === "sistema"
                              ? "SISTEMA"
                              : log.user_email?.split("@")[0]?.toUpperCase() || "SISTEMA";
                            const dateStr = formatDate(log.created_at);
                            const timeStr = formatTime(log.created_at);

                            return (
                              <div key={log.id} className="relative flex gap-3 pb-5 last:pb-0">
                                {/* Timeline dot */}
                                <div className="absolute -left-6 mt-1">
                                  <div className={cn("h-5 w-5 rounded-full border-2 flex items-center justify-center", audit.dotClass)}>
                                    {audit.icon}
                                  </div>
                                </div>

                                {/* Content */}
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-foreground">{userName}</p>
                                  <p className="text-[10px] text-muted-foreground">{dateStr} às {timeStr}</p>
                                  <p className="text-xs mt-0.5 flex items-center gap-1.5">
                                    <span className={cn("h-4 w-4 rounded-full flex items-center justify-center shrink-0", audit.badgeClass)}>
                                      {audit.icon}
                                    </span>
                                    <span className="text-foreground">{audit.label}</span>
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </>
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
              Esta proposta será removida da listagem. O histórico de envios e visualizações será preservado.
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
