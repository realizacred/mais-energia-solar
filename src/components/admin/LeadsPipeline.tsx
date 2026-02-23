import { useState, useEffect, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LayoutGrid, BarChart3, Settings2 } from "lucide-react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { subDays, isAfter } from "date-fns";
import { PipelineFilters, KanbanCard, PipelineAutomations, EnhancedFunnel } from "./pipeline";
import { WhatsAppSendDialog } from "./WhatsAppSendDialog";
import { PageHeader, LoadingState } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { formatBRLCompact } from "@/lib/formatters";
import confetti from "canvas-confetti";

const LEADS_PAGE_SIZE = 25;

const LEADS_SELECT = "id, lead_code, nome, telefone, cidade, estado, media_consumo, consultor, status_id, created_at, ultimo_contato, visto";

const LOSS_REASONS = [
  "Preço (Concorrência)",
  "Falta de financiamento",
  "Desistência do cliente",
  "Lead desqualificado",
  "Prazo de instalação",
];

interface LeadStatus {
  id: string;
  nome: string;
  ordem: number;
  cor: string;
}

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

function estimateKwp(consumo: number): number {
  return Math.round((consumo / 130) * 10) / 10;
}

function estimateValue(kwp: number): number {
  return kwp * 5000;
}

export default function LeadsPipeline() {
  const [statuses, setStatuses] = useState<LeadStatus[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  const [activeTab, setActiveTab] = useState("kanban");
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [selectedLeadForWhatsApp, setSelectedLeadForWhatsApp] = useState<Lead | null>(null);

  // Loss dialog
  const [lossDialogOpen, setLossDialogOpen] = useState(false);
  const [lossLead, setLossLead] = useState<Lead | null>(null);
  const [lossReason, setLossReason] = useState("");
  const [lossNotes, setLossNotes] = useState("");

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVendedor, setSelectedVendedor] = useState("all");
  const [selectedEstado, setSelectedEstado] = useState("all");
  const [selectedCidade, setSelectedCidade] = useState("all");
  const [consumoRange, setConsumoRange] = useState("all");
  const [dateRange, setDateRange] = useState("all");

  const { toast } = useToast();

  const fetchData = useCallback(async (append = false) => {
    try {
      if (append) setLoadingMore(true);
      else setLoading(true);

      const from = append ? leads.length : 0;
      const to = from + LEADS_PAGE_SIZE - 1;

      const leadsPromise = supabase.from("leads")
        .select(LEADS_SELECT, { count: "exact" })
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (append) {
        const leadsRes = await leadsPromise;
        if (leadsRes.error) throw leadsRes.error;
        const newLeads = leadsRes.data || [];
        const totalCount = leadsRes.count || 0;
        setLeads(prev => [...prev, ...newLeads]);
        setHasMore(leads.length + newLeads.length < totalCount);
      } else {
        const [leadsRes, statusRes] = await Promise.all([
          leadsPromise,
          supabase.from("lead_status").select("id, nome, ordem, cor").order("ordem"),
        ]);
        if (leadsRes.error) throw leadsRes.error;
        if (statusRes.error) throw statusRes.error;
        const newLeads = leadsRes.data || [];
        const totalCount = leadsRes.count || 0;
        setLeads(newLeads);
        setStatuses(statusRes.data || []);
        setHasMore(newLeads.length < totalCount);
      }
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
      toast({ title: "Erro", description: "Não foi possível carregar o pipeline.", variant: "destructive" });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [leads.length, toast]);

  useEffect(() => { fetchData(); }, []);

  // Enrich leads with status name
  const enrichedLeads = useMemo(() => {
    const statusMap = new Map(statuses.map(s => [s.id, s.nome]));
    return leads.map(l => ({ ...l, status_nome: l.status_id ? statusMap.get(l.status_id) || null : null }));
  }, [leads, statuses]);

  const vendedores = useMemo(() => {
    const unique = [...new Set(enrichedLeads.map(l => l.consultor).filter(Boolean))];
    return unique.map(nome => ({ nome: nome as string }));
  }, [enrichedLeads]);

  const estados = useMemo(() => [...new Set(enrichedLeads.map(l => l.estado))].sort(), [enrichedLeads]);

  const cidades = useMemo(() => {
    let pool = enrichedLeads;
    if (selectedEstado !== "all") pool = pool.filter(l => l.estado === selectedEstado);
    return [...new Set(pool.map(l => l.cidade).filter(Boolean))].sort();
  }, [enrichedLeads, selectedEstado]);

  const filteredLeads = useMemo(() => {
    return enrichedLeads.filter(lead => {
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        if (!(lead.nome.toLowerCase().includes(s) || lead.telefone.includes(s) || (lead.lead_code && lead.lead_code.toLowerCase().includes(s)))) return false;
      }
      if (selectedVendedor !== "all" && lead.consultor !== selectedVendedor) return false;
      if (selectedEstado !== "all" && lead.estado !== selectedEstado) return false;
      if (selectedCidade !== "all" && lead.cidade !== selectedCidade) return false;
      if (consumoRange !== "all") {
        const c = lead.media_consumo;
        if (consumoRange === "0-300" && c > 300) return false;
        if (consumoRange === "300-600" && (c <= 300 || c > 600)) return false;
        if (consumoRange === "600-1000" && (c <= 600 || c > 1000)) return false;
        if (consumoRange === "1000+" && c <= 1000) return false;
      }
      if (dateRange !== "all") {
        const d = new Date(lead.created_at);
        const now = new Date();
        if (dateRange === "today" && !isAfter(d, subDays(now, 1))) return false;
        if (dateRange === "7days" && !isAfter(d, subDays(now, 7))) return false;
        if (dateRange === "30days" && !isAfter(d, subDays(now, 30))) return false;
        if (dateRange === "90days" && !isAfter(d, subDays(now, 90))) return false;
      }
      return true;
    });
  }, [enrichedLeads, searchTerm, selectedVendedor, selectedEstado, selectedCidade, consumoRange, dateRange]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedVendedor !== "all") count++;
    if (selectedEstado !== "all") count++;
    if (selectedCidade !== "all") count++;
    if (consumoRange !== "all") count++;
    if (dateRange !== "all") count++;
    return count;
  }, [selectedVendedor, selectedEstado, selectedCidade, consumoRange, dateRange]);

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedVendedor("all");
    setSelectedEstado("all");
    setSelectedCidade("all");
    setConsumoRange("all");
    setDateRange("all");
  };

  const handleDragStart = (e: React.DragEvent, lead: Lead) => {
    setDraggedLead(lead);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, statusId: string) => {
    e.preventDefault();
    if (!draggedLead || draggedLead.status_id === statusId) {
      setDraggedLead(null);
      return;
    }
    setLeads(prev => prev.map(l => l.id === draggedLead.id ? { ...l, status_id: statusId } : l));
    try {
      const { error } = await supabase.from("leads").update({ status_id: statusId }).eq("id", draggedLead.id);
      if (error) throw error;
      toast({ title: "Lead movido!", description: `${draggedLead.nome} foi movido para a nova etapa.` });
    } catch {
      setLeads(prev => prev.map(l => l.id === draggedLead.id ? { ...l, status_id: draggedLead.status_id } : l));
      toast({ title: "Erro", description: "Não foi possível mover o lead.", variant: "destructive" });
    } finally {
      setDraggedLead(null);
    }
  };

  const getLeadsByStatus = (statusId: string | null): Lead[] => {
    if (statusId === null) return filteredLeads.filter(l => !l.status_id);
    return filteredLeads.filter(l => l.status_id === statusId);
  };

  // Column value sum
  const getColumnValue = (statusId: string | null) => {
    const columnLeads = getLeadsByStatus(statusId);
    return columnLeads.reduce((sum, l) => {
      const kwp = l.potencia_kwp || estimateKwp(l.media_consumo);
      return sum + estimateValue(kwp);
    }, 0);
  };

  const handleViewDetails = (lead: Lead) => {
    toast({ title: "Ver detalhes", description: `Abrindo detalhes de ${lead.nome}` });
  };

  const handleQuickAction = async (lead: Lead, action: string) => {
    switch (action) {
      case "whatsapp":
        setSelectedLeadForWhatsApp(lead);
        setWhatsappOpen(true);
        break;
      case "call":
        window.open(`tel:${lead.telefone}`, "_self");
        break;
      case "markContacted": {
        const { error } = await supabase.from("leads").update({ ultimo_contato: new Date().toISOString() }).eq("id", lead.id);
        if (!error) {
          setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, ultimo_contato: new Date().toISOString() } : l));
          toast({ title: "Contato registrado" });
        }
        break;
      }
    }
  };

  // ── Win: confetti + move to last stage ──
  const handleWin = async (lead: Lead) => {
    confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    const lastStatus = statuses.length > 0 ? statuses[statuses.length - 1] : null;
    if (lastStatus && lead.status_id !== lastStatus.id) {
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status_id: lastStatus.id } : l));
      await supabase.from("leads").update({ status_id: lastStatus.id }).eq("id", lead.id);
    }
    toast({ title: "🎉 Venda ganha!", description: `${lead.nome} movido para implementação.` });
  };

  // ── Lose: open dialog ──
  const handleLose = (lead: Lead) => {
    setLossLead(lead);
    setLossReason("");
    setLossNotes("");
    setLossDialogOpen(true);
  };

  const confirmLoss = async () => {
    if (!lossLead || !lossReason) return;
    // Record the loss (update observacoes with reason)
    const obs = `Motivo: ${lossReason}${lossNotes ? ` | Obs: ${lossNotes}` : ""}`;
    await supabase.from("leads").update({ observacoes: obs } as any).eq("id", lossLead.id);
    toast({ title: "Lead descartado", description: `${lossLead.nome}: ${lossReason}` });
    setLossDialogOpen(false);
    setLossLead(null);
  };

  if (loading) return <LoadingState message="Carregando pipeline..." />;

  return (
    <div className="space-y-4">
      <PageHeader
        icon={LayoutGrid}
        title="Funil comercial"
        description="Acompanhe e gerencie seus leads no funil de vendas"
      />

      {/* Filters */}
      <Card className="rounded-xl">
        <CardContent className="pt-4 pb-3">
          <PipelineFilters
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            selectedVendedor={selectedVendedor}
            onVendedorChange={setSelectedVendedor}
            selectedEstado={selectedEstado}
            onEstadoChange={setSelectedEstado}
            selectedCidade={selectedCidade}
            onCidadeChange={setSelectedCidade}
            consumoRange={consumoRange}
            onConsumoRangeChange={setConsumoRange}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            vendedores={vendedores}
            estados={estados}
            cidades={cidades}
            activeFiltersCount={activeFiltersCount}
            onClearFilters={clearFilters}
          />
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between mb-3">
          <TabsList>
            <TabsTrigger value="kanban" className="gap-2">
              <LayoutGrid className="h-4 w-4" /> Kanban
            </TabsTrigger>
            <TabsTrigger value="funnel" className="gap-2">
              <BarChart3 className="h-4 w-4" /> Funil
            </TabsTrigger>
            <TabsTrigger value="automations" className="gap-2">
              <Settings2 className="h-4 w-4" /> Automações
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{filteredLeads.length} leads</Badge>
            {activeFiltersCount > 0 && <Badge variant="secondary">{activeFiltersCount} filtros ativos</Badge>}
          </div>
        </div>

        <TabsContent value="kanban" className="mt-0">
          <ScrollArea className="w-full">
            <div className="flex gap-4 pb-4" style={{ minWidth: "max-content" }}>
              {/* Sem status */}
              <div className="w-72 flex-shrink-0" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, "")}>
                <ColumnHeader name="Sem status" count={getLeadsByStatus(null).length} value={getColumnValue(null)} />
                <div className="rounded-b-lg p-2 min-h-[500px] space-y-2.5 border border-t-0 border-border/40 bg-muted/10">
                  {getLeadsByStatus(null).map(lead => (
                    <KanbanCard key={lead.id} lead={lead} onDragStart={handleDragStart} isDragging={draggedLead?.id === lead.id} onViewDetails={handleViewDetails} onQuickAction={handleQuickAction} onWin={handleWin} onLose={handleLose} />
                  ))}
                </div>
              </div>

              {statuses.map(status => {
                const columnLeads = getLeadsByStatus(status.id);
                return (
                  <div key={status.id} className="w-72 flex-shrink-0" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, status.id)}>
                    <ColumnHeader name={status.nome} count={columnLeads.length} value={getColumnValue(status.id)} color={status.cor} />
                    <div className="rounded-b-lg p-2 min-h-[500px] space-y-2.5 border border-t-0 border-border/40 bg-muted/10">
                      {columnLeads.map(lead => (
                        <KanbanCard key={lead.id} lead={lead} onDragStart={handleDragStart} isDragging={draggedLead?.id === lead.id} onViewDetails={handleViewDetails} onQuickAction={handleQuickAction} onWin={handleWin} onLose={handleLose} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          {hasMore && (
            <div className="flex justify-center py-3">
              <Button variant="outline" onClick={() => fetchData(true)} disabled={loadingMore} className="gap-2">
                {loadingMore && <Spinner size="sm" />}
                Carregar mais leads ({leads.length} carregados)
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="funnel" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <EnhancedFunnel leads={filteredLeads} statuses={statuses} />
            <Card className="rounded-xl">
              <CardHeader>
                <CardTitle className="text-base">Métricas por status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {statuses.map(status => {
                    const statusLeads = getLeadsByStatus(status.id);
                    const avgConsumo = statusLeads.length > 0 ? Math.round(statusLeads.reduce((sum, l) => sum + l.media_consumo, 0) / statusLeads.length) : 0;
                    return (
                      <div key={status.id} className="flex items-center justify-between p-3 rounded-md border border-slate-200">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: status.cor }} />
                          <div>
                            <p className="font-medium text-sm">{status.nome}</p>
                            <p className="text-xs text-muted-foreground">{statusLeads.length} leads</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{avgConsumo} kWh</p>
                          <p className="text-xs text-muted-foreground">consumo médio</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="automations" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PipelineAutomations
              statuses={statuses}
              onApplyAutomation={(rule) => {
                toast({ title: "Automação aplicada", description: `Regra "${rule.name}" executada com sucesso.` });
              }}
            />
            <Card className="rounded-xl">
              <CardHeader>
                <CardTitle className="text-base">Alertas ativos</CardTitle>
                <CardDescription>Leads que precisam de atenção</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {filteredLeads
                    .filter(l => {
                      if (!l.ultimo_contato) return true;
                      return Math.floor((Date.now() - new Date(l.ultimo_contato).getTime()) / (1000 * 60 * 60 * 24)) >= 3;
                    })
                    .slice(0, 5)
                    .map(lead => {
                      const daysSince = lead.ultimo_contato
                        ? Math.floor((Date.now() - new Date(lead.ultimo_contato).getTime()) / (1000 * 60 * 60 * 24))
                        : null;
                      return (
                        <div key={lead.id} className="flex items-center justify-between p-2.5 rounded-md border border-slate-200 bg-muted/30 gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{lead.nome}</p>
                            <p className="text-xs text-muted-foreground">{lead.telefone}{lead.cidade && ` · ${lead.cidade}`}</p>
                          </div>
                          <Badge variant="destructive" className="text-[10px] shrink-0">
                            {daysSince === null ? "Nunca contatado" : `${daysSince}d sem contato`}
                          </Badge>
                        </div>
                      );
                    })}
                  {filteredLeads.filter(l => !l.ultimo_contato || Math.floor((Date.now() - new Date(l.ultimo_contato).getTime()) / (1000 * 60 * 60 * 24)) >= 3).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum alerta ativo</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* WhatsApp Dialog */}
      {selectedLeadForWhatsApp && (
        <WhatsAppSendDialog
          open={whatsappOpen}
          onOpenChange={setWhatsappOpen}
          telefone={selectedLeadForWhatsApp.telefone}
          nome={selectedLeadForWhatsApp.nome}
          leadId={selectedLeadForWhatsApp.id}
          tipo="lead"
        />
      )}

      {/* Loss Dialog */}
      <Dialog open={lossDialogOpen} onOpenChange={setLossDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Motivo do descarte</DialogTitle>
            <DialogDescription>
              Informe o motivo pelo qual o lead <strong>{lossLead?.nome}</strong> foi descartado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Motivo</label>
              <Select value={lossReason} onValueChange={setLossReason}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Selecione o motivo" />
                </SelectTrigger>
                <SelectContent>
                  {LOSS_REASONS.map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Observações do descarte</label>
              <Textarea
                value={lossNotes}
                onChange={e => setLossNotes(e.target.value)}
                placeholder="Detalhes adicionais sobre o descarte..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLossDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmLoss} disabled={!lossReason}>Confirmar descarte</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Column Header ──
function ColumnHeader({ name, count, value, color }: { name: string; count: number; value: number; color?: string }) {
  return (
    <div
      className={cn(
        "rounded-t-md px-3 py-2 font-semibold text-sm flex items-center justify-between",
        !color && "bg-muted text-muted-foreground"
      )}
      style={color ? { backgroundColor: color, color: "white" } : undefined}
    >
      <span className="truncate">
        {name} ({count})
      </span>
      <span className="text-xs font-medium opacity-80 ml-2 whitespace-nowrap">
        {formatBRLCompact(value)}
      </span>
    </div>
  );
}
