import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Zap, SunMedium, DollarSign, FileText, Eye, Pencil, Copy, Trash2, Download,
  ChevronDown, MoreVertical, ExternalLink, AlertCircle, CheckCircle, Loader2,
  Link2, MessageCircle, Mail, CalendarCheck, RefreshCw, Home, Building2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
    valor: number;
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

interface UCDetailData {
  id: string;
  nome: string;
  consumo_mensal_kwh: number;
  geracao_mensal_estimada: number | null;
  tarifa_energia: number | null;
  percentual_atendimento: number | null;
}

// ─── Status Badge ───────────────────────────────────
const STATUS_MAP: Record<string, { label: string; cls: string; iconCls: string }> = {
  rascunho: { label: "Rascunho", cls: "bg-muted text-muted-foreground", iconCls: "text-muted-foreground" },
  gerada: { label: "Gerada", cls: "bg-primary/10 text-primary", iconCls: "text-primary" },
  generated: { label: "Gerada", cls: "bg-primary/10 text-primary", iconCls: "text-primary" },
  enviada: { label: "Enviada", cls: "bg-info/10 text-info", iconCls: "text-info" },
  sent: { label: "Enviada", cls: "bg-info/10 text-info", iconCls: "text-info" },
  aceita: { label: "Aceita", cls: "bg-success/10 text-success", iconCls: "text-success" },
  ganha: { label: "Ganha", cls: "bg-success/10 text-success", iconCls: "text-success" },
  rejeitada: { label: "Rejeitada", cls: "bg-destructive/10 text-destructive", iconCls: "text-destructive" },
  recusada: { label: "Recusada", cls: "bg-destructive/10 text-destructive", iconCls: "text-destructive" },
  perdida: { label: "Perdida", cls: "bg-destructive/10 text-destructive", iconCls: "text-destructive" },
  arquivada: { label: "Arquivada", cls: "bg-muted text-muted-foreground", iconCls: "text-muted-foreground" },
  expirada: { label: "Expirada", cls: "bg-warning/10 text-warning", iconCls: "text-warning" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] || { label: status, cls: "bg-muted text-muted-foreground" };
  return <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap", s.cls)}>{s.label}</span>;
}

function StatusIcon({ status, isPrincipal }: { status: string; isPrincipal: boolean }) {
  const s = STATUS_MAP[status];
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
              {snapshot.economia_mensal_percent && (
                <p className="text-[10px] text-muted-foreground">
                  Economia: {formatBRL((snapshot.tarifa_distribuidora || 0) * (snapshot.consumo_mensal || 0) * (snapshot.economia_mensal_percent / 100))} ({formatNumberBR(snapshot.economia_mensal_percent)}%)
                </p>
              )}
              <p className="text-[10px] text-muted-foreground">
                Consumo Total: {snapshot.consumo_mensal || 0} kWh
              </p>
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
        <DadosField icon="dollar" label="Tarifa Distribuidora" value={snapshot.tarifa_distribuidora ? `R$ ${Number(snapshot.tarifa_distribuidora).toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}` : "—"} />
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
                  {uc.tarifa_distribuidora && uc.consumo_mensal && (
                    <p className="text-[10px] text-muted-foreground">
                      Economia: {formatBRL(uc.tarifa_distribuidora * uc.consumo_mensal * 0.7)} ({((uc.consumo_mensal > 0 ? 0.7 : 0) * 100).toFixed(0)}%)
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground">Consumo Total: {uc.consumo_mensal} kWh</p>
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

function NativeArquivoTab({ snapshot, html, rendering, downloadingPdf, sending, publicUrl, validadeDate, handleRender, handleDownloadPdf, handleSend, copyLink }: {
  snapshot: SnapshotData | null;
  html: string | null;
  rendering: boolean;
  downloadingPdf: boolean;
  sending: boolean;
  publicUrl: string | null;
  validadeDate: string | null;
  handleRender: () => void;
  handleDownloadPdf: () => void;
  handleSend: (canal: "link" | "whatsapp") => void;
  copyLink: (withTracking: boolean) => void;
}) {
  return (
    <>
      {snapshot && html && (
        <div className="flex items-center gap-2 mt-3 mb-3 py-2 px-3 bg-warning/10 border border-warning/30 rounded-lg text-xs text-warning">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>Atenção! Houve atualização na proposta e seu arquivo pode não estar atualizado. Gere um novo arquivo, se necessário.</span>
        </div>
      )}
      <div className="flex gap-5 mt-3">
        <div className="w-[220px] shrink-0 space-y-3">
          <p className="text-sm font-bold text-foreground">Opções</p>
          <Button size="sm" className="w-full justify-start gap-2 h-8 text-xs" onClick={handleRender} disabled={rendering}>
            {rendering ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Gerar outro arquivo
          </Button>
          <div className="space-y-1">
            <button onClick={handleDownloadPdf} disabled={!html || downloadingPdf} className="flex items-center gap-2 text-xs text-primary hover:underline disabled:text-muted-foreground disabled:no-underline py-1">
              <FileText className="h-3.5 w-3.5" />
              {downloadingPdf ? "Gerando..." : "Baixar PDF"}
            </button>
            <button onClick={() => copyLink(true)} className="flex items-center gap-2 text-xs text-primary hover:underline py-1">
              <Link2 className="h-3.5 w-3.5" /> Copiar link com rastreio
            </button>
            <button onClick={() => copyLink(false)} className="flex items-center gap-2 text-xs text-primary hover:underline py-1">
              <Link2 className="h-3.5 w-3.5" /> Copiar link sem rastreio
            </button>
            {validadeDate && (
              <div className="flex items-center gap-2 text-xs text-primary py-1">
                <CalendarCheck className="h-3.5 w-3.5" /> Validade da proposta: {validadeDate}
              </div>
            )}
          </div>
          <div className="space-y-2 pt-1">
            <Button size="sm" variant="outline" className="w-full justify-start gap-2 h-8 text-xs border-success text-success hover:bg-success/10" onClick={() => handleSend("whatsapp")} disabled={sending || !html}>
              <MessageCircle className="h-3.5 w-3.5" /> Enviar por whatsapp
            </Button>
            <Button size="sm" variant="outline" className="w-full justify-start gap-2 h-8 text-xs border-primary text-primary hover:bg-primary/10" disabled={!html}>
              <Mail className="h-3.5 w-3.5" /> Enviar por e-mail
            </Button>
          </div>
        </div>
        <div className="flex-1 min-w-0 border rounded-lg overflow-hidden bg-muted/20">
          {html ? (
            <iframe srcDoc={html} className="w-full h-[500px] border-0" title="Preview da proposta" sandbox="allow-same-origin" />
          ) : (
            <div className="flex flex-col items-center justify-center h-[500px] text-muted-foreground">
              <FileText className="h-10 w-10 opacity-20 mb-3" />
              <p className="text-sm font-medium">Nenhum arquivo gerado</p>
              <p className="text-xs mt-1">Clique em "Gerar outro arquivo" para visualizar</p>
              <Button size="sm" variant="outline" className="mt-3 gap-1.5 text-xs" onClick={handleRender} disabled={rendering}>
                {rendering ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Gerar arquivo
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function NativeDadosTab({ snapshot, latestVersao }: { snapshot: SnapshotData | null; latestVersao: VersaoData | undefined }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-3">
      {/* Pré dimensionamento */}
      <div className="border rounded-lg p-4 space-y-4">
        <h4 className="text-sm font-bold text-foreground">Pré dimensionamento</h4>
        {(() => {
          const pre = (snapshot as any)?.preDimensionamento || {};
          const loc = snapshot as any;
          return (
            <div className="space-y-3">
              <DadosField icon="check" label="Telhado" value={loc?.locTipoTelhado || "—"} />
              <DadosField icon="text" label="Topologia" value={pre.topologias?.join(", ") || "—"} />
              <DadosField icon="text" label="Sistema" value={pre.sistema || "—"} />
              <DadosField icon="text" label="Inclinação" value={pre.inclinacao != null ? `${pre.inclinacao}°` : "—"} />
              <DadosField icon="text" label="Desvio Azimutal" value={pre.desvio_azimutal != null ? `${pre.desvio_azimutal}°` : "—"} />
              <DadosField icon="text" label="Sombreamento" value={pre.sombreamento || "—"} />
              <DadosField icon="text" label="Fator de Geração" value={pre.fator_geracao ? `${pre.fator_geracao}` : "—"} />
              <DadosField icon="text" label="Desempenho" value={pre.desempenho ? `${pre.desempenho}%` : "—"} />
            </div>
          );
        })()}
      </div>

      {/* Pós dimensionamento */}
      <div className="border rounded-lg p-4 space-y-4">
        <h4 className="text-sm font-bold text-foreground">Pós dimensionamento</h4>
        {(() => {
          const venda = (snapshot as any)?.venda || {};
          const adicionais = (snapshot as any)?.adicionais || [];
          const customFields = (snapshot as any)?.customFieldValues || {};
          return (
            <div className="space-y-3">
               <DadosField icon="dollar" label="Margem" value={venda.margem_percentual ? `${formatNumberBR(venda.margem_percentual)}%` : "—"} />
               <DadosField icon="dollar" label="Desconto" value={venda.desconto_percentual ? `${formatNumberBR(venda.desconto_percentual)}%` : "—"} />
              <DadosField icon="text" label="Observações" value={venda.observacoes || "—"} />
              {Object.entries(customFields).map(([key, val]) => (
                <DadosField key={key} icon="text" label={key} value={String(val) || "—"} />
              ))}
              {adicionais.map((add: any, i: number) => (
                <DadosField key={i} icon="check" label={add.descricao || add.nome || `Adicional ${i + 1}`} value={add.valor ? formatBRL(add.valor) : add.incluso ? "Grátis" : "—"} />
              ))}
            </div>
          );
        })()}
      </div>

      {/* Serviços */}
      <div className="border rounded-lg p-4 space-y-4">
        <h4 className="text-sm font-bold text-foreground">Serviços</h4>
        {(() => {
          const servicos = (snapshot as any)?.servicos || (snapshot as any)?.preDimensionamento?.servicos || [];
          if (!servicos || servicos.length === 0) {
            return (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <AlertCircle className="h-8 w-8 text-warning/50 mb-2" />
                <p className="text-xs">Nenhum serviço selecionado</p>
              </div>
            );
          }
          return (
            <div className="space-y-3">
              {servicos.map((s: any, i: number) => (
                <DadosField key={i} icon="check" label={s.descricao || s.nome} value={s.valor ? formatBRL(s.valor) : s.incluso ? "Incluso" : "—"} />
              ))}
            </div>
          );
        })()}
      </div>

      {/* Formas de pagamento */}
      <div className="border rounded-lg p-4 space-y-4">
        <h4 className="text-sm font-bold text-foreground">Formas de pagamento</h4>
        <div className="pb-3 border-b border-border/30">
          <p className="text-xs font-bold text-primary">À vista</p>
          <p className="text-sm font-bold text-foreground">{formatBRL(latestVersao?.valor_total || 0)}</p>
        </div>
        {(() => {
          const opcoes = (snapshot as any)?.pagamentoOpcoes || [];
          if (opcoes.length === 0) {
            return <p className="text-xs text-muted-foreground">Sem opções de financiamento</p>;
          }
          return opcoes.map((op: any, i: number) => (
            <div key={i} className="pb-3 border-b border-border/30 last:border-0 space-y-0.5">
              <p className="text-xs font-bold text-primary">{op.banco || op.nome || `Opção ${i + 1}`}</p>
              {op.valor_parcela && <p className="text-[11px] text-muted-foreground">Valor da parcela: <span className="text-foreground font-medium">{formatBRL(op.valor_parcela)}</span></p>}
              {op.parcelas && <p className="text-[11px] text-muted-foreground">Parcelas: <span className="text-foreground font-medium">{op.parcelas}x</span></p>}
              {op.carencia_meses && <p className="text-[11px] text-muted-foreground">Carência: <span className="text-foreground font-medium">{op.carencia_meses} meses</span></p>}
              {op.taxa_mensal && <p className="text-[11px] text-muted-foreground">Taxa: <span className="text-foreground font-medium">{op.taxa_mensal}% a.m.</span></p>}
            </div>
          ));
        })()}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────
interface Props {
  proposta: PropostaData;
  isPrincipal: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  dealId: string;
  customerId: string | null;
  onRefresh: () => void;
}

export function PropostaExpandedDetail({ proposta: p, isPrincipal, isExpanded, onToggle, dealId, customerId, onRefresh }: Props) {
  const navigate = useNavigate();
  const latestVersao = p.versoes[0];
  const wpPrice = latestVersao?.valor_total && latestVersao?.potencia_kwp
    ? (latestVersao.valor_total / (latestVersao.potencia_kwp * 1000)).toFixed(2)
    : null;

  // Expanded data
  const [snapshot, setSnapshot] = useState<SnapshotData | null>(null);
  const [ucsDetail, setUcsDetail] = useState<UCDetailData[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeTab, setActiveTab] = useState("resumo");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [html, setHtml] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [auditLogs, setAuditLogs] = useState<Array<{ id: string; acao: string; tabela: string; user_email: string | null; created_at: string }>>([]);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [recusaMotivo, setRecusaMotivo] = useState("");
  const [recusaDialogOpen, setRecusaDialogOpen] = useState(false);

  // ─── Accept / Reject handler ───
  const updatePropostaStatus = async (newStatus: string, extra?: Record<string, any>) => {
    setUpdatingStatus(true);
    try {
      const updateData: Record<string, any> = { status: newStatus };
      if (newStatus === "aceita") updateData.aceita_at = new Date().toISOString();
      if (newStatus === "recusada") {
        updateData.recusada_at = new Date().toISOString();
        updateData.recusa_motivo = extra?.motivo || null;
      }
      const { error } = await supabase
        .from("propostas_nativas")
        .update(updateData)
        .eq("id", p.id);
      if (error) throw error;

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

      toast({ title: `Proposta marcada como "${STATUS_MAP[newStatus]?.label || newStatus}"` });
      onRefresh();
    } catch (e: any) {
      toast({ title: "Erro ao atualizar status", description: e.message, variant: "destructive" });
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Load expanded data when expanded
  useEffect(() => {
    if (!isExpanded || !latestVersao?.id) return;
    setLoadingDetail(true);

    const versaoIds = p.versoes.map(v => v.id);

    Promise.all([
      supabase
        .from("proposta_versoes")
        .select("snapshot")
        .eq("id", latestVersao.id)
        .single(),
      supabase
        .from("proposta_versao_ucs")
        .select("id, nome, consumo_mensal_kwh, geracao_mensal_estimada, tarifa_energia, percentual_atendimento")
        .eq("versao_id", latestVersao.id)
        .order("ordem"),
      // Audit logs for proposta + all versoes
      supabase
        .from("audit_logs")
        .select("id, acao, tabela, user_email, created_at")
        .or(`and(tabela.eq.propostas_nativas,registro_id.eq.${p.id}),and(tabela.eq.proposta_versoes,registro_id.in.(${versaoIds.join(",")}))`)
        .order("created_at", { ascending: false })
        .limit(50),
    ]).then(([snapRes, ucsRes, auditRes]) => {
      if (snapRes.data?.snapshot) {
        setSnapshot(snapRes.data.snapshot as any);
      }
      setUcsDetail((ucsRes.data as UCDetailData[]) || []);
      setAuditLogs((auditRes.data as any[]) || []);
      setLoadingDetail(false);
    });
  }, [isExpanded, latestVersao?.id]);

  // Delete handler
  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.from("propostas_nativas").delete().eq("id", p.id);
      if (error) throw error;
      toast({ title: "Proposta excluída" });
      onRefresh();
    } catch (e: any) {
      toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" });
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
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
    if (!html) { toast({ title: "Gere o arquivo primeiro", variant: "destructive" }); return; }
    setDownloadingPdf(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const container = document.createElement("div");
      container.innerHTML = html;
      container.style.width = "800px";
      container.style.position = "absolute";
      container.style.left = "-9999px";
      document.body.appendChild(container);
      await doc.html(container, {
        callback: (pdf) => {
          pdf.save(`${p.codigo || p.titulo || "proposta"}_v${latestVersao?.versao_numero || 1}.pdf`);
          document.body.removeChild(container);
        },
        x: 10, y: 10, width: 190, windowWidth: 800,
      });
      toast({ title: "PDF gerado!" });
    } catch (e: any) {
      toast({ title: "Erro ao gerar PDF", description: e.message, variant: "destructive" });
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Send proposal
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

  const copyLink = (withTracking: boolean) => {
    if (!publicUrl) {
      toast({ title: "Gere e envie a proposta primeiro", variant: "destructive" });
      return;
    }
    const url = withTracking ? publicUrl : publicUrl.replace(/\?.*$/, "");
    navigator.clipboard.writeText(url);
    toast({ title: `Link ${withTracking ? "com" : "sem"} rastreio copiado!` });
  };

  const validadeDate = latestVersao ? (() => {
    const snap = snapshot as any;
    if (snap?.validade_dias) {
      const d = new Date(latestVersao.created_at);
      d.setDate(d.getDate() + snap.validade_dias);
      return d.toLocaleDateString("pt-BR");
    }
    return null;
  })() : null;

  // Build summary table from snapshot
  const buildSummaryRows = () => {
    if (!snapshot) return [];
    const rows: Array<{ label: string; qty: number; value: number; pct: number; children?: Array<{ label: string; qty: number }> }> = [];
    const venda = snapshot.venda;
    const totalFinal = latestVersao?.valor_total || 0;

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

    // Installation
    if (venda?.custo_instalacao) {
      rows.push({
        label: "Instalação",
        qty: 1,
        value: venda.custo_instalacao,
        pct: totalFinal > 0 ? (venda.custo_instalacao / totalFinal) * 100 : 0,
      });
    }

    // Commission
    if (venda?.custo_comissao) {
      rows.push({
        label: "Comissão",
        qty: 1,
        value: venda.custo_comissao,
        pct: totalFinal > 0 ? (venda.custo_comissao / totalFinal) * 100 : 0,
      });
    }

    // Margin
    const marginPct = venda?.margem_percentual || 0;
    const marginValue = totalFinal > 0 ? totalFinal * marginPct / (100 + marginPct) : 0;
    rows.push({
      label: `Margem (Markup ${formatNumberBR(marginPct)}%)`,
      qty: 1,
      value: marginValue,
      pct: totalFinal > 0 ? (marginValue / totalFinal) * 100 : 0,
    });

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
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground truncate">
                {p.cliente_nome || p.titulo || p.codigo || `Proposta #${p.proposta_num}`}
              </p>
              <StatusBadge status={p.status} />
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Criada em {new Date(p.created_at).toLocaleDateString("pt-BR")}
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
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => {
                  if (latestVersao) navigate(`/admin/propostas-nativas/${p.id}/versoes/${latestVersao.id}`);
                }}>
                  <Eye className="h-3.5 w-3.5 mr-2 text-primary" /> Visualizar detalhes
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  const params = new URLSearchParams({ deal_id: dealId });
                  if (customerId) params.set("customer_id", customerId);
                  params.set("orc_id", p.id);
                  navigate(`/admin/propostas-nativas/nova?${params.toString()}`);
                }}>
                  <Pencil className="h-3.5 w-3.5 mr-2 text-warning" /> Editar dimensionamento
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  toast({ title: "Clonar proposta", description: "Funcionalidade em desenvolvimento." });
                }}>
                  <Copy className="h-3.5 w-3.5 mr-2 text-info" /> Clonar proposta
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  if (latestVersao) navigate(`/admin/propostas-nativas/${p.id}/versoes/${latestVersao.id}?tab=arquivo`);
                }}>
                  <Download className="h-3.5 w-3.5 mr-2 text-success" /> Visualizar o PDF
                </DropdownMenuItem>
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
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Recusar proposta?</AlertDialogTitle>
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
                    {(snapshot as any)?.source === "legacy_import" ? (
                      <SmResumoTab snapshot={snapshot as any} latestVersao={latestVersao} wpPrice={wpPrice} />
                    ) : (
                      <NativeResumoTab snapshot={snapshot} ucsDetail={ucsDetail} latestVersao={latestVersao} wpPrice={wpPrice} buildSummaryRows={buildSummaryRows} />
                    )}
                  </TabsContent>

                  {/* ─ Arquivo Tab ─────────────── */}
                  <TabsContent value="arquivo" className="px-4 pb-4 mt-0">
                    {(snapshot as any)?.source === "legacy_import" ? (
                      <SmArquivoTab snapshot={snapshot as any} />
                    ) : (
                      <NativeArquivoTab
                        snapshot={snapshot}
                        html={html}
                        rendering={rendering}
                        downloadingPdf={downloadingPdf}
                        sending={sending}
                        publicUrl={publicUrl}
                        validadeDate={validadeDate}
                        handleRender={handleRender}
                        handleDownloadPdf={handleDownloadPdf}
                        handleSend={handleSend}
                        copyLink={copyLink}
                      />
                    )}
                  </TabsContent>

                  <TabsContent value="dados" className="px-4 pb-4 mt-0">
                    {(snapshot as any)?.source === "legacy_import" ? (
                      <SmDadosTab snapshot={snapshot as any} latestVersao={latestVersao} />
                    ) : (
                      <NativeDadosTab snapshot={snapshot} latestVersao={latestVersao} />
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
                            const actionLabel = getAuditLabel(log.acao, log.tabela);
                            const userName = log.user_email?.split("@")[0]?.toUpperCase() || "SISTEMA";
                            const dateStr = new Date(log.created_at).toLocaleDateString("pt-BR");
                            const timeStr = new Date(log.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

                            return (
                              <div key={log.id} className="relative flex gap-3 pb-5 last:pb-0">
                                {/* Timeline dot */}
                                <div className="absolute -left-6 mt-1">
                                  <div className="h-5 w-5 rounded-full bg-muted border-2 border-primary/30 flex items-center justify-center">
                                    <div className="h-2 w-2 rounded-full bg-primary/60" />
                                  </div>
                                </div>

                                {/* Content */}
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-foreground">{userName}</p>
                                  <p className="text-[10px] text-muted-foreground">{dateStr} às {timeStr}</p>
                                  <p className="text-xs text-primary mt-0.5 flex items-center gap-1.5">
                                    <span className="h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary shrink-0">P</span>
                                    {actionLabel}
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir proposta</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta proposta? Esta ação não pode ser desfeita.
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
    </>
  );
}

function getAuditLabel(acao: string, tabela: string): string {
  if (tabela === "propostas_nativas") {
    if (acao === "INSERT") return "Criou a proposta";
    if (acao === "UPDATE") return "Editou a proposta";
    if (acao === "DELETE") return "Excluiu a proposta";
  }
  if (tabela === "proposta_versoes") {
    if (acao === "INSERT") return "Gerou modelo da proposta";
    if (acao === "UPDATE") return "Atualizou versão da proposta";
    if (acao === "DELETE") return "Removeu versão da proposta";
  }
  return `${acao} em ${tabela}`;
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
