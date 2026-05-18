import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader, TableSkeleton, EmptyState } from "@/components/ui-kit";
import { Users, Download, UserPlus, TrendingUp, ShoppingCart, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { useOrcamentosAdmin } from "@/hooks/useOrcamentosAdmin";
import { useVendedoresList } from "@/hooks/useVendedores";
import { 
  OrcamentosTable, 
  LeadFilters, 
  OrcamentoViewDialog, 
  OrcamentoDeleteDialog 
} from "@/components/admin/leads";
import { ImportarLeadsModal } from "@/components/admin/leads/ImportarLeadsModal";
import { ConvertLeadToClientDialog } from "@/components/leads/ConvertLeadToClientDialog";
import { PendingDocumentationWidget, FollowUpNotifications } from "@/components/admin/widgets";
import { OrcamentoSortSelector } from "@/components/ui/orcamento-sort-selector";
import { useOrcamentoSort } from "@/hooks/useOrcamentoSort";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { OrcamentoDisplayItem } from "@/types/orcamento";
import type { Lead } from "@/types/lead";

export function LeadsView() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterVisto, setFilterVisto] = useState("todos");
  const [filterVendedor, setFilterVendedor] = useState("todos");
  const [filterEstado, setFilterEstado] = useState("todos");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterConversao, setFilterConversao] = useState("todos");

  const { 
    orcamentos, 
    statuses, 
    loading, 
    toggleVisto, 
    deleteOrcamento, 
    filters, 
    fetchOrcamentos, 
    page, 
    setPage, 
    totalCount, 
    totalPages,
    stats: hookStats
  } = useOrcamentosAdmin({
    searchTerm,
    filterVisto,
    filterVendedor,
    filterEstado,
    filterStatus,
    filterConversao
  });
  const { hasPermission } = useUserPermissions();
  const canDeleteLeads = hasPermission("delete_leads");
  const { sortOption, updateSort } = useOrcamentoSort("admin_leads");
  // Phase 1: Consultor dropdown sourced from master table (not derived from current page rows)
  const { data: vendedoresMaster = [] } = useVendedoresList();
  const vendedoresFilterOptions = vendedoresMaster
    .filter((v: any) => v.ativo !== false)
    .map((v: any) => ({ id: v.id, nome: v.nome }));
  const filteredOrcamentos = orcamentos; // Now filtered in backend
  const [selectedOrcamento, setSelectedOrcamento] = useState<OrcamentoDisplayItem | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [orcamentoToDelete, setOrcamentoToDelete] = useState<OrcamentoDisplayItem | null>(null);
  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const [leadToConvert, setLeadToConvert] = useState<Lead | null>(null);
  const [widgetRefreshKey, setWidgetRefreshKey] = useState(0);
  const [isImportOpen, setIsImportOpen] = useState(false);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [searchTerm, filterVisto, filterVendedor, filterEstado, filterStatus, filterConversao, setPage]);

  // KPI calculations — Prefer backend stats if available for accurate tenant-wide numbers
  const kpis = useMemo(() => {
    // If we have conversion stats from the backend, use them for global numbers
    if (hookStats?.conversion) {
      return {
        total: totalCount,
        novosEsteMes: hookStats.conversion.novos_mes,
        emNegociacao: hookStats.conversion.com_proposta - hookStats.conversion.convertidos,
        convertidos: hookStats.conversion.convertidos,
      };
    }

    // Fallback to local calculation (less accurate with pagination)
    const convertidoStatus = statuses.find(s => s.nome === "Convertido");
    const aguardandoStatus = statuses.find(s => s.nome === "Aguardando Validação");
    const convertidosCount = orcamentos.filter(
      (orc) => (convertidoStatus && orc.status_id === convertidoStatus.id) || (aguardandoStatus && orc.status_id === aguardandoStatus.id)
    ).length;

    return {
      total: totalCount,
      novosEsteMes: 0,
      emNegociacao: 0,
      convertidos: convertidosCount,
    };
  }, [hookStats, orcamentos, statuses, totalCount]);

  const handleClearFilters = () => {
    setSearchTerm("");
    setFilterVisto("todos");
    setFilterVendedor("todos");
    setFilterEstado("todos");
    setFilterStatus("todos");
    setFilterConversao("todos");
  };

  const handleDelete = async () => {
    if (orcamentoToDelete) {
      await deleteOrcamento(orcamentoToDelete.id);
      setIsDeleteOpen(false);
      setOrcamentoToDelete(null);
      setWidgetRefreshKey(k => k + 1);
    }
  };

  // Convert orcamento to lead format for conversion dialog
  const handleConvertOrcamento = (orc: OrcamentoDisplayItem) => {
    const leadForConversion: Lead = {
      id: orc.lead_id,
      lead_code: orc.lead_code,
      nome: orc.nome,
      telefone: orc.telefone,
      telefone_normalized: null,
      email: null,
      cep: orc.cep,
      estado: orc.estado,
      cidade: orc.cidade,
      bairro: orc.bairro,
      rua: orc.rua,
      numero: orc.numero,
      complemento: null,
      area: orc.area,
      tipo_telhado: orc.tipo_telhado,
      rede_atendimento: orc.rede_atendimento,
      media_consumo: orc.media_consumo,
      consumo_previsto: orc.consumo_previsto,
      observacoes: orc.observacoes,
      arquivos_urls: orc.arquivos_urls,
      consultor: orc.vendedor_nome || orc.vendedor,
      consultor_id: orc.vendedor_id || null,
      visto: orc.visto,
      visto_admin: orc.visto_admin,
      status_id: orc.status_id,
      ultimo_contato: orc.ultimo_contato,
      proxima_acao: orc.proxima_acao,
      data_proxima_acao: orc.data_proxima_acao,
      valor_estimado: null,
      motivo_perda_id: null,
      motivo_perda_obs: null,
      distribuido_em: null,
      created_at: orc.created_at,
      updated_at: orc.updated_at,
    };
    setLeadToConvert(leadForConversion);
    setSelectedOrcamento(orc); // Garantir que o orcamentoId chegue ao modal
    setIsConvertOpen(true);
  };

  const handleLeadFromWidget = useCallback((lead: any) => {
    const match = orcamentos.find(
      (orc) => orc.lead_id === lead.id || orc.id === lead.id
    );
    if (match) {
      setSelectedOrcamento(match);
      setIsViewOpen(true);
    } else {
      setLeadToConvert(lead as Lead);
      setIsConvertOpen(true);
    }
  }, [orcamentos]);

  const handleExportFiltered = () => {
    try {
      toast.info("Exportando leads filtrados...");
      const rows = filteredOrcamentos.map((orc) => ({
        Código: orc.lead_code || "",
        Nome: orc.nome || "",
        Telefone: orc.telefone || "",
        Email: orc.email || "",
        Cidade: orc.cidade || "",
        Estado: orc.estado || "",
        Consultor: orc.vendedor_nome || orc.vendedor || "",
        "Consumo Médio": orc.media_consumo ?? "",
        "Criado em": orc.created_at ? new Date(orc.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "",
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Leads");
      const today = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `leads-filtrados-${today}.xlsx`);
      toast.success(`${rows.length} leads exportados!`);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao exportar");
    }
  };

  const KPI_CARDS = [
    { label: "Total de Leads", value: kpis.total, icon: Users, variant: "primary" as const },
    { label: "Novos este mês", value: kpis.novosEsteMes, icon: UserPlus, variant: "info" as const },
    { label: "Em negociação", value: kpis.emNegociacao, icon: TrendingUp, variant: "warning" as const },
    { label: "Convertidos", value: kpis.convertidos, icon: ShoppingCart, variant: "success" as const },
  ];

  const VARIANT_CLASSES: Record<string, string> = {
    primary: "border-l-primary bg-primary/10 text-primary",
    info: "border-l-info bg-info/10 text-info",
    warning: "border-l-warning bg-warning/10 text-warning",
    success: "border-l-success bg-success/10 text-success",
  };

  return (
    <motion.div className="space-y-6" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <PageHeader
        icon={Users}
        title="Leads"
        description="Gerencie os orçamentos e leads recebidos"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsImportOpen(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Importar
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportFiltered}>
              <Download className="w-4 h-4 mr-2" />
              Exportar Filtrados
            </Button>
          </div>
        }
      />

      {/* §27 KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {KPI_CARDS.map((kpi) => {
          const Icon = kpi.icon;
          const classes = VARIANT_CLASSES[kpi.variant];
          return (
            <Card key={kpi.label} className={`border-l-[3px] ${classes.split(" ")[0]} bg-card shadow-sm`}>
              <CardContent className="flex items-center gap-4 p-5">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${classes.split(" ").slice(1).join(" ")}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold tracking-tight text-foreground leading-none">
                    {kpi.value.toLocaleString("pt-BR")}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">{kpi.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Notification Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
        <PendingDocumentationWidget onLeadClick={handleLeadFromWidget} onConvertClick={handleLeadFromWidget} refreshKey={widgetRefreshKey} />
        <FollowUpNotifications onLeadClick={handleLeadFromWidget} diasAlerta={3} refreshKey={widgetRefreshKey} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Orçamentos Cadastrados
            </CardTitle>
            <OrcamentoSortSelector value={sortOption} onChange={updateSort} />
          </div>
          <LeadFilters
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            filterVisto={filterVisto}
            onFilterVistoChange={setFilterVisto}
            filterVendedor={filterVendedor}
            onFilterVendedorChange={setFilterVendedor}
            filterEstado={filterEstado}
            onFilterEstadoChange={setFilterEstado}
            filterStatus={filterStatus}
            onFilterStatusChange={setFilterStatus}
            filterConversao={filterConversao}
            onFilterConversaoChange={setFilterConversao}
            vendedores={vendedoresFilterOptions}
            estados={filters.estados}
            statuses={statuses}
            conversionStats={hookStats?.conversion}
            onClearFilters={handleClearFilters}
          />
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton rows={8} columns={6} className="py-4" />
          ) : filteredOrcamentos.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nenhum lead encontrado"
              description={
                searchTerm || filterVisto !== "todos" || filterVendedor !== "todos" || filterEstado !== "todos" || filterStatus !== "todos"
                  ? "Ajuste os filtros para ver mais resultados."
                  : "Importe leads ou aguarde novos orçamentos chegarem."
              }
              action={{
                label: "Importar leads",
                onClick: () => setIsImportOpen(true),
                icon: Upload,
              }}
            />
          ) : (
            <OrcamentosTable
              orcamentos={filteredOrcamentos}
              statuses={statuses}
              sortOption={sortOption}
              onToggleVisto={toggleVisto}
              onView={(orc) => {
                setSelectedOrcamento(orc);
                setIsViewOpen(true);
              }}
              onDelete={canDeleteLeads ? (orc) => {
                setOrcamentoToDelete(orc);
                setIsDeleteOpen(true);
              } : undefined}
              onConvert={handleConvertOrcamento}
              onRefresh={fetchOrcamentos}
            />
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && filteredOrcamentos.length > 0 && (
        <div className="flex items-center justify-between mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="gap-1.5 min-h-[44px] md:min-h-0"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {page + 1} de {totalPages} ({totalCount.toLocaleString()} orçamentos)
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="gap-1.5 min-h-[44px] md:min-h-0"
          >
            Próxima
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <OrcamentoViewDialog
        orcamento={selectedOrcamento}
        open={isViewOpen}
        onOpenChange={setIsViewOpen}
        onRefresh={fetchOrcamentos}
      />

      <OrcamentoDeleteDialog
        orcamento={orcamentoToDelete}
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        onConfirm={handleDelete}
      />

      <ConvertLeadToClientDialog
        lead={leadToConvert}
        open={isConvertOpen}
        onOpenChange={setIsConvertOpen}
        onSuccess={fetchOrcamentos}
        orcamentoId={selectedOrcamento?.id}
      />

      <ImportarLeadsModal
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onSuccess={fetchOrcamentos}
      />
    </motion.div>
  );
}
