import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader, LoadingState } from "@/components/ui-kit";
import { Users, Download, UserPlus, TrendingUp, ShoppingCart, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { useOrcamentosAdmin } from "@/hooks/useOrcamentosAdmin";
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
  const { orcamentos, statuses, loading, toggleVisto, deleteOrcamento, filters, fetchOrcamentos, page, setPage, totalCount, totalPages } = useOrcamentosAdmin();
  const { hasPermission } = useUserPermissions();
  const canDeleteLeads = hasPermission("delete_leads");
  const { sortOption, updateSort } = useOrcamentoSort("admin_leads");
  const [filteredOrcamentos, setFilteredOrcamentos] = useState<OrcamentoDisplayItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterVisto, setFilterVisto] = useState("nao_visto");
  const [filterVendedor, setFilterVendedor] = useState("todos");
  const [filterEstado, setFilterEstado] = useState("todos");
  const [filterStatus, setFilterStatus] = useState("todos");
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
  }, [searchTerm, filterVisto, filterVendedor, filterEstado, filterStatus, setPage]);

  useEffect(() => {
    let filtered = orcamentos.filter(
      (orc) =>
        orc.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        orc.telefone.includes(searchTerm) ||
        orc.cidade.toLowerCase().includes(searchTerm.toLowerCase()) ||
        orc.estado.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (orc.email && orc.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (orc.orc_code && orc.orc_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (orc.lead_code && orc.lead_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (orc.vendedor_nome && orc.vendedor_nome.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (orc.vendedor && orc.vendedor.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (filterVisto === "visto") {
      filtered = filtered.filter((orc) => orc.visto_admin);
    } else if (filterVisto === "nao_visto") {
      filtered = filtered.filter((orc) => !orc.visto_admin);
    }

    if (filterVendedor === "sem_vendedor") {
      filtered = filtered.filter((orc) => !orc.vendedor_id);
    } else if (filterVendedor !== "todos") {
      filtered = filtered.filter((orc) => orc.vendedor_id === filterVendedor);
    }

    if (filterEstado !== "todos") {
      filtered = filtered.filter((orc) => orc.estado === filterEstado);
    }

    if (filterStatus !== "todos") {
      filtered = filtered.filter((orc) => orc.status_id === filterStatus);
    }

    setFilteredOrcamentos(filtered);
  }, [searchTerm, orcamentos, filterVisto, filterVendedor, filterEstado, filterStatus]);

  // KPI calculations from local data
  const kpis = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const novosEsteMes = orcamentos.filter((orc) => {
      const d = new Date(orc.created_at);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).length;

    const convertidoStatus = statuses.find(s => s.nome === "Convertido");
    const aguardandoStatus = statuses.find(s => s.nome === "Aguardando Validação");
    const convertidos = orcamentos.filter(
      (orc) => (convertidoStatus && orc.status_id === convertidoStatus.id) || (aguardandoStatus && orc.status_id === aguardandoStatus.id)
    ).length;

    const emNegociacaoStatus = statuses.find(s => s.nome === "Em Negociação" || s.nome === "Em negociação");
    const emNegociacao = emNegociacaoStatus
      ? orcamentos.filter((orc) => orc.status_id === emNegociacaoStatus.id).length
      : 0;

    return {
      total: totalCount,
      novosEsteMes,
      emNegociacao,
      convertidos,
    };
  }, [orcamentos, statuses, totalCount]);

  const handleClearFilters = () => {
    setFilterVisto("todos");
    setFilterVendedor("todos");
    setFilterEstado("todos");
    setFilterStatus("todos");
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
            vendedores={filters.vendedores}
            estados={filters.estados}
            statuses={statuses}
            onClearFilters={handleClearFilters}
          />
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingState message="Carregando orçamentos..." className="py-12" />
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
      />

      <ImportarLeadsModal
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onSuccess={fetchOrcamentos}
      />
    </motion.div>
  );
}
