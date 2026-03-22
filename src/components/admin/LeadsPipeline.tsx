import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { formatPhoneBR } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { LayoutGrid, BarChart3, Settings2, XCircle } from "lucide-react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { subDays, isAfter } from "date-fns";
import { PipelineFilters, KanbanCard, PipelineAutomations, EnhancedFunnel } from "./pipeline";
import { WhatsAppSendDialog } from "./WhatsAppSendDialog";
import { PageHeader, LoadingState } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { formatBRLCompact } from "@/lib/formatters";
import confetti from "canvas-confetti";
import {
  usePipelineLeads,
  usePipelineStatuses,
  usePipelineMotivosPerda,
  useUpdatePipelineLead,
  useBulkUpdateLeadStatus,
  LEADS_PAGE_SIZE,
  type PipelineLead,
} from "@/hooks/useLeadsPipeline";

function estimateKwp(consumo: number): number {
  return Math.round((consumo / 130) * 10) / 10;
}

function estimateValue(kwp: number): number {
  return kwp * 5000;
}

export default function LeadsPipeline() {
  const [page, setPage] = useState(0);
  const [allLeads, setAllLeads] = useState<PipelineLead[]>([]);
  const [draggedLead, setDraggedLead] = useState<PipelineLead | null>(null);
  const [activeTab, setActiveTab] = useState("kanban");
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [selectedLeadForWhatsApp, setSelectedLeadForWhatsApp] = useState<PipelineLead | null>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatusId, setBulkStatusId] = useState("");

  // Loss dialog
  const [lossDialogOpen, setLossDialogOpen] = useState(false);
  const [lossLead, setLossLead] = useState<PipelineLead | null>(null);
  const [lossReasonId, setLossReasonId] = useState("");
  const [lossNotes, setLossNotes] = useState("");

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVendedor, setSelectedVendedor] = useState("all");
  const [selectedEstado, setSelectedEstado] = useState("all");
  const [selectedCidade, setSelectedCidade] = useState("all");
  const [consumoRange, setConsumoRange] = useState("all");
  const [dateRange, setDateRange] = useState("all");

  const { toast } = useToast();

  // §16: Queries in hooks
  const { data: leadsData, isLoading: loadingLeads } = usePipelineLeads(page);
  const { data: statuses = [], isLoading: loadingStatuses } = usePipelineStatuses();
  const { data: motivosPerda = [] } = usePipelineMotivosPerda();
  const updateLeadMutation = useUpdatePipelineLead();
  const bulkUpdateMutation = useBulkUpdateLeadStatus();

  // Merge paginated results into allLeads
  const leads = useMemo(() => {
    if (!leadsData) return allLeads;
    if (page === 0) return leadsData.leads;
    // For subsequent pages, append new leads (dedup by id)
    const existingIds = new Set(allLeads.map(l => l.id));
    const newLeads = leadsData.leads.filter(l => !existingIds.has(l.id));
    return [...allLeads, ...newLeads];
  }, [leadsData, page, allLeads]);

  // Keep allLeads in sync for pagination
  useMemo(() => {
    if (leadsData) {
      if (page === 0) {
        setAllLeads(leadsData.leads);
      } else {
        setAllLeads(prev => {
          const existingIds = new Set(prev.map(l => l.id));
          const newLeads = leadsData.leads.filter(l => !existingIds.has(l.id));
          return [...prev, ...newLeads];
        });
      }
    }
  }, [leadsData, page]);

  const hasMore = leadsData ? leads.length < leadsData.totalCount : false;
  const loading = loadingLeads && page === 0 && allLeads.length === 0;
  const loadingMore = loadingLeads && page > 0;

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

  const handleDragStart = (e: React.DragEvent, lead: PipelineLead) => {
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
    // Optimistic update
    setAllLeads(prev => prev.map(l => l.id === draggedLead.id ? { ...l, status_id: statusId } : l));
    try {
      await updateLeadMutation.mutateAsync({ id: draggedLead.id, updates: { status_id: statusId } });
      toast({ title: "Lead movido!", description: `${draggedLead.nome} foi movido para a nova etapa.` });
    } catch {
      // Rollback
      setAllLeads(prev => prev.map(l => l.id === draggedLead.id ? { ...l, status_id: draggedLead.status_id } : l));
      toast({ title: "Erro", description: "Não foi possível mover o lead.", variant: "destructive" });
    } finally {
      setDraggedLead(null);
    }
  };

  const getLeadsByStatus = (statusId: string | null): PipelineLead[] => {
    if (statusId === null) return filteredLeads.filter(l => !l.status_id);
    return filteredLeads.filter(l => l.status_id === statusId);
  };

  const getColumnValue = (statusId: string | null) => {
    const columnLeads = getLeadsByStatus(statusId);
    return columnLeads.reduce((sum, l) => {
      const kwp = l.potencia_kwp || estimateKwp(l.media_consumo);
      return sum + estimateValue(kwp);
    }, 0);
  };

  const handleViewDetails = (lead: PipelineLead) => {
    toast({ title: "Ver detalhes", description: `Abrindo detalhes de ${lead.nome}` });
  };

  const handleQuickAction = async (lead: PipelineLead, action: string) => {
    switch (action) {
      case "whatsapp":
        setSelectedLeadForWhatsApp(lead);
        setWhatsappOpen(true);
        break;
      case "call":
        window.open(`tel:${lead.telefone}`, "_self");
        break;
      case "markContacted": {
        const now = new Date().toISOString();
        setAllLeads(prev => prev.map(l => l.id === lead.id ? { ...l, ultimo_contato: now } : l));
        try {
          await updateLeadMutation.mutateAsync({ id: lead.id, updates: { ultimo_contato: now } });
          toast({ title: "Contato registrado" });
        } catch {
          // Rollback handled by invalidation
        }
        break;
      }
    }
  };

  const handleWin = async (lead: PipelineLead) => {
    confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    const lastStatus = statuses.length > 0 ? statuses[statuses.length - 1] : null;
    if (lastStatus && lead.status_id !== lastStatus.id) {
      setAllLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status_id: lastStatus.id } : l));
      await updateLeadMutation.mutateAsync({ id: lead.id, updates: { status_id: lastStatus.id } });
    }
    toast({ title: "🎉 Venda ganha!", description: `${lead.nome} movido para implementação.` });
  };

  const handleLose = (lead: PipelineLead) => {
    setLossLead(lead);
    setLossReasonId("");
    setLossNotes("");
    setLossDialogOpen(true);
  };

  const confirmLoss = async () => {
    if (!lossLead || !lossReasonId) return;
    const perdidoStatus = statuses.find(s => s.nome.toLowerCase().includes("perdido"));
    const updateData: Record<string, any> = {
      motivo_perda_id: lossReasonId,
      motivo_perda_obs: lossNotes || null,
    };
    if (perdidoStatus) {
      updateData.status_id = perdidoStatus.id;
    }
    setAllLeads(prev => prev.map(l => l.id === lossLead.id ? { ...l, ...updateData } : l));
    await updateLeadMutation.mutateAsync({ id: lossLead.id, updates: updateData });
    const motivoNome = motivosPerda.find(m => m.id === lossReasonId)?.nome;
    toast({ title: "Lead marcado como perdido", description: `${lossLead.nome}: ${motivoNome}` });
    setLossDialogOpen(false);
    setLossLead(null);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBulkAssign = async () => {
    if (!bulkStatusId || selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    setAllLeads(prev => prev.map(l => ids.includes(l.id) ? { ...l, status_id: bulkStatusId } : l));
    try {
      await bulkUpdateMutation.mutateAsync({ ids, status_id: bulkStatusId });
      toast({ title: "Status atualizado", description: `${ids.length} lead(s) classificados.` });
      setSelectedIds(new Set());
      setBulkStatusId("");
    } catch {
      toast({ title: "Erro", description: "Não foi possível atualizar.", variant: "destructive" });
    }
  };

  if (loading || loadingStatuses) return <LoadingState message="Carregando pipeline..." />;

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
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <TabsList>
            <TabsTrigger value="kanban" className="gap-2 min-h-[44px] md:min-h-0">
              <LayoutGrid className="h-4 w-4" /> Kanban
            </TabsTrigger>
            <TabsTrigger value="funnel" className="gap-2 min-h-[44px] md:min-h-0">
              <BarChart3 className="h-4 w-4" /> Funil
            </TabsTrigger>
            <TabsTrigger value="automations" className="gap-2 min-h-[44px] md:min-h-0">
              <Settings2 className="h-4 w-4" /> Automações
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{filteredLeads.length} leads</Badge>
            {activeFiltersCount > 0 && <Badge variant="secondary">{activeFiltersCount} filtros ativos</Badge>}
          </div>
        </div>

        <TabsContent value="kanban" className="mt-0">
          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 p-3 mb-3 rounded-lg border border-primary/30 bg-primary/5">
              <Badge variant="outline" className="text-xs">{selectedIds.size} selecionado(s)</Badge>
              <Select value={bulkStatusId} onValueChange={setBulkStatusId}>
                <SelectTrigger className="h-8 w-48">
                  <SelectValue placeholder="Atribuir status..." />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={handleBulkAssign} disabled={!bulkStatusId || bulkUpdateMutation.isPending}>
                {bulkUpdateMutation.isPending ? "Aplicando..." : "Aplicar"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setSelectedIds(new Set()); setBulkStatusId(""); }}>
                Cancelar
              </Button>
            </div>
          )}

          <ScrollArea className="w-full">
            <div className="flex gap-4 pb-4" style={{ minWidth: "max-content" }}>
              {/* Sem status — highlighted */}
              <div className="w-64 md:w-72 lg:w-80 flex-shrink-0" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, "")}>
                <ColumnHeader name="⚠ Sem status" count={getLeadsByStatus(null).length} value={getColumnValue(null)} />
                <div className="rounded-b-lg p-2 min-h-[500px] space-y-2.5 border border-t-0 border-warning/40 bg-warning/5">
                  {getLeadsByStatus(null).map(lead => (
                    <div key={lead.id} className="relative">
                      <div className="absolute top-2 left-2 z-10">
                        <Checkbox
                          checked={selectedIds.has(lead.id)}
                          onCheckedChange={() => toggleSelect(lead.id)}
                          className="bg-card"
                        />
                      </div>
                      <div className={cn("pl-7", selectedIds.has(lead.id) && "ring-1 ring-primary/40 rounded-lg")}>
                        <KanbanCard key={lead.id} lead={lead} onDragStart={handleDragStart} isDragging={draggedLead?.id === lead.id} onViewDetails={handleViewDetails} onQuickAction={handleQuickAction} onWin={handleWin} onLose={handleLose} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {statuses.map(status => {
                const columnLeads = getLeadsByStatus(status.id);
                return (
                  <div key={status.id} className="w-64 md:w-72 lg:w-80 flex-shrink-0" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, status.id)}>
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
              <Button variant="outline" onClick={() => setPage(p => p + 1)} disabled={loadingMore} className="gap-2">
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
                      <div key={status.id} className="flex items-center justify-between p-3 rounded-md border border-border/60">
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
            <PipelineAutomations />
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
                        <div key={lead.id} className="flex items-center justify-between p-2.5 rounded-md border border-border/60 bg-muted/30 gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate" title={lead.nome}>{lead.nome}</p>

                            <p className="text-xs text-muted-foreground">{formatPhoneBR(lead.telefone)}{lead.cidade && ` · ${lead.cidade}`}</p>
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
        <DialogContent className="w-[90vw] max-w-md p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
          <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <XCircle className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base font-semibold text-foreground">Motivo do descarte</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Informe o motivo pelo qual o lead <strong>{lossLead?.nome}</strong> foi descartado
              </p>
            </div>
          </DialogHeader>
          <div className="p-5 space-y-4 flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Motivo</label>
           <Select value={lossReasonId} onValueChange={setLossReasonId}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Selecione o motivo" />
                </SelectTrigger>
                <SelectContent>
                  {motivosPerda.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
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
          <div className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30">
            <Button variant="outline" onClick={() => setLossDialogOpen(false)}>Cancelar</Button>
            <Button variant="default" onClick={confirmLoss} disabled={!lossReasonId}>Confirmar descarte</Button>
          </div>
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
