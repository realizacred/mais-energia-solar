import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Zap, SunMedium, DollarSign, FileText, Eye, Pencil, Copy, Trash2, Download,
  ChevronDown, MoreVertical, ExternalLink, AlertCircle, CheckCircle, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatBRLInteger as formatBRL } from "@/lib/formatters";
import { cn } from "@/lib/utils";

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
const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  rascunho: { label: "Rascunho", cls: "bg-muted text-muted-foreground" },
  gerada: { label: "Gerada", cls: "bg-primary/10 text-primary" },
  generated: { label: "Gerada", cls: "bg-primary/10 text-primary" },
  enviada: { label: "Enviada", cls: "bg-info/10 text-info" },
  sent: { label: "Enviada", cls: "bg-info/10 text-info" },
  aceita: { label: "Aceita", cls: "bg-success/10 text-success" },
  ganha: { label: "Ganha", cls: "bg-success/10 text-success" },
  rejeitada: { label: "Rejeitada", cls: "bg-destructive/10 text-destructive" },
  recusada: { label: "Recusada", cls: "bg-destructive/10 text-destructive" },
  perdida: { label: "Perdida", cls: "bg-destructive/10 text-destructive" },
  arquivada: { label: "Arquivada", cls: "bg-muted text-muted-foreground" },
  expirada: { label: "Expirada", cls: "bg-warning/10 text-warning" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] || { label: status, cls: "bg-muted text-muted-foreground" };
  return <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap", s.cls)}>{s.label}</span>;
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

  // Load expanded data when expanded
  useEffect(() => {
    if (!isExpanded || !latestVersao?.id) return;
    setLoadingDetail(true);

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
    ]).then(([snapRes, ucsRes]) => {
      if (snapRes.data?.snapshot) {
        setSnapshot(snapRes.data.snapshot as any);
      }
      setUcsDetail((ucsRes.data as UCDetailData[]) || []);
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
      label: `Margem (Markup ${marginPct.toFixed(2)}%)`,
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
          className="flex items-center gap-4 py-3.5 px-4 cursor-pointer"
          onClick={onToggle}
        >
          <FileText className={cn("h-5 w-5 shrink-0", isPrincipal ? "text-primary" : "text-muted-foreground")} />

          <div className="min-w-0 flex-shrink-0 w-[200px]">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground truncate">
                {p.titulo || p.codigo || `Proposta #${p.proposta_num}`}
              </p>
              <StatusBadge status={p.status} />
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Criada em {new Date(p.created_at).toLocaleDateString("pt-BR")}
            </p>
          </div>

          {/* Metrics */}
          <div className="hidden md:flex flex-1 items-center gap-6 ml-4">
            {latestVersao?.potencia_kwp != null && latestVersao.potencia_kwp > 0 && (
              <div className="flex items-center gap-2 border-l border-dashed border-border pl-4">
                <Zap className="h-3.5 w-3.5 text-warning shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground">Potência Total</p>
                  <p className="text-sm font-bold text-foreground">{latestVersao.potencia_kwp.toFixed(2)} kWp</p>
                </div>
              </div>
            )}

            {latestVersao?.geracao_mensal != null && latestVersao.geracao_mensal > 0 && (
              <div className="flex items-center gap-2 border-l border-dashed border-border pl-4">
                <SunMedium className="h-3.5 w-3.5 text-info shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground">Geração Mensal</p>
                  <p className="text-sm font-bold text-foreground">{latestVersao.geracao_mensal.toFixed(0)} kWh</p>
                </div>
              </div>
            )}

            {latestVersao?.valor_total != null && latestVersao.valor_total > 0 && (
              <div className="flex items-center gap-2 border-l border-dashed border-border pl-4">
                <DollarSign className="h-3.5 w-3.5 text-success shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground">Preço do Projeto</p>
                  <p className="text-sm font-bold text-foreground">
                    {formatBRL(latestVersao.valor_total)}
                    {wpPrice && <span className="text-[10px] font-normal text-muted-foreground ml-1">R$ {wpPrice} / Wp</span>}
                  </p>
                </div>
              </div>
            )}
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
        <div className="md:hidden px-4 pb-2 flex flex-wrap gap-3 text-xs">
          {latestVersao?.potencia_kwp != null && latestVersao.potencia_kwp > 0 && (
            <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-warning" />{latestVersao.potencia_kwp.toFixed(2)} kWp</span>
          )}
          {latestVersao?.geracao_mensal != null && latestVersao.geracao_mensal > 0 && (
            <span className="flex items-center gap-1"><SunMedium className="h-3 w-3 text-info" />{latestVersao.geracao_mensal.toFixed(0)} kWh</span>
          )}
          {latestVersao?.valor_total != null && (
            <span className="flex items-center gap-1 font-bold"><DollarSign className="h-3 w-3 text-success" />{formatBRL(latestVersao.valor_total)}</span>
          )}
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
                  <TabsTrigger value="dados" className="text-xs h-7 px-0 pb-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                    Dados
                  </TabsTrigger>
                  <TabsTrigger value="historico" className="text-xs h-7 px-0 pb-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                    Histórico
                  </TabsTrigger>
                </TabsList>

                {/* Accept / Reject buttons */}
                {(p.status === "gerada" || p.status === "generated" || p.status === "enviada" || p.status === "sent") && (
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-success text-success hover:bg-success/10">
                      <CheckCircle className="h-3 w-3" /> Aceitar
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-destructive text-destructive hover:bg-destructive/10">
                      <AlertCircle className="h-3 w-3" /> Rejeitar
                    </Button>
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
                    <div className="flex gap-5 mt-3">
                      {/* Left: Unidades */}
                      <div className="w-[280px] shrink-0">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-bold text-foreground">Unidades</h4>
                        </div>
                        <div className="border rounded-lg p-3 space-y-3">
                          {(snapshot?.ucs || ucsDetail).length > 0 ? (
                            (snapshot?.ucs || []).map((uc, idx) => (
                              <div key={idx} className="flex items-start gap-3">
                                <div className={cn(
                                  "mt-0.5 h-2.5 w-2.5 rounded-full shrink-0",
                                  uc.is_geradora ? "bg-success" : "bg-info"
                                )} />
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-foreground">{uc.nome}</p>
                                  {uc.tarifa_distribuidora && uc.consumo_mensal && (
                                    <p className="text-[10px] text-muted-foreground">
                                      Economia: {formatBRL(uc.tarifa_distribuidora * uc.consumo_mensal * 0.7)} ({((uc.consumo_mensal > 0 ? 0.7 : 0) * 100).toFixed(0)}%)
                                    </p>
                                  )}
                                  <p className="text-[10px] text-muted-foreground">
                                    Consumo Total: {uc.consumo_mensal} kWh
                                  </p>
                                </div>
                              </div>
                            ))
                          ) : ucsDetail.length > 0 ? (
                            ucsDetail.map(uc => (
                              <div key={uc.id} className="flex items-start gap-3">
                                <div className="mt-0.5 h-2.5 w-2.5 rounded-full shrink-0 bg-success" />
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
                                    <td className="py-2 px-3 text-right text-muted-foreground">{row.pct.toFixed(2)}%</td>
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
                                  {wpPrice && (
                                    <span className="text-[10px] text-primary font-semibold block">R$ {wpPrice} / Wp</span>
                                  )}
                                  <span className="font-bold text-foreground text-sm">{formatBRL(latestVersao?.valor_total || 0)}</span>
                                </td>
                                <td />
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* ─ Dados Tab ─────────────── */}
                  <TabsContent value="dados" className="px-4 pb-4 mt-0">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                      <DataItem label="Potência" value={latestVersao?.potencia_kwp ? `${latestVersao.potencia_kwp.toFixed(2)} kWp` : "—"} />
                      <DataItem label="Geração Mensal" value={latestVersao?.geracao_mensal ? `${latestVersao.geracao_mensal.toFixed(0)} kWh` : "—"} />
                      <DataItem label="Economia Mensal" value={latestVersao?.economia_mensal ? formatBRL(latestVersao.economia_mensal) : "—"} />
                      <DataItem label="Payback" value={latestVersao?.payback_meses ? `${latestVersao.payback_meses} meses` : "—"} />
                      <DataItem label="Valor Total" value={formatBRL(latestVersao?.valor_total || 0)} />
                      <DataItem label="R$/Wp" value={wpPrice ? `R$ ${wpPrice}` : "—"} />
                      <DataItem label="Status" value={STATUS_MAP[p.status]?.label || p.status} />
                      <DataItem label="Versão" value={`v${latestVersao?.versao_numero || 1}`} />
                    </div>
                  </TabsContent>

                  {/* ─ Histórico Tab ──────────── */}
                  <TabsContent value="historico" className="px-4 pb-4 mt-0">
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                        {p.versoes.length} versão(ões)
                      </p>
                      {p.versoes.map(v => (
                        <div
                          key={v.id}
                          onClick={() => navigate(`/admin/propostas-nativas/${p.id}/versoes/${v.id}`)}
                          className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/60 cursor-pointer transition-colors border border-border/30"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-muted-foreground w-8">v{v.versao_numero}</span>
                            <StatusBadge status={v.status} />
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(v.created_at).toLocaleDateString("pt-BR")}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            {v.potencia_kwp && v.potencia_kwp > 0 && (
                              <span className="flex items-center gap-0.5">
                                <Zap className="h-3 w-3 text-warning" />{v.potencia_kwp} kWp
                              </span>
                            )}
                            <span className="font-bold text-foreground">{formatBRL(v.valor_total)}</span>
                            <ExternalLink className="h-3 w-3" />
                          </div>
                        </div>
                      ))}
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

function DataItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded-lg p-3">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-sm font-bold text-foreground mt-0.5">{value}</p>
    </div>
  );
}
