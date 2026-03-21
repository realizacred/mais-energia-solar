import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader, LoadingState } from "@/components/ui-kit";
import { Users, Download } from "lucide-react";
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
  const [selectedOrcamento, setSelectedOrcamento] = useState<OrcamentoDisplayItem | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [orcamentoToDelete, setOrcamentoToDelete] = useState<OrcamentoDisplayItem | null>(null);
  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const [leadToConvert, setLeadToConvert] = useState<Lead | null>(null);
  const [widgetRefreshKey, setWidgetRefreshKey] = useState(0);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [searchTerm, filterVisto, filterVendedor, filterEstado, setPage]);

  useEffect(() => {
    let filtered = orcamentos.filter(
      (orc) =>
        orc.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        orc.telefone.includes(searchTerm) ||
        orc.cidade.toLowerCase().includes(searchTerm.toLowerCase()) ||
        orc.estado.toLowerCase().includes(searchTerm.toLowerCase()) ||
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

    setFilteredOrcamentos(filtered);
  }, [searchTerm, orcamentos, filterVisto, filterVendedor, filterEstado]);

  const handleClearFilters = () => {
    setFilterVisto("todos");
    setFilterVendedor("todos");
    setFilterEstado("todos");
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
    // Try to find the matching orcamento in the already-loaded list
    const match = orcamentos.find(
      (orc) => orc.lead_id === lead.id || orc.id === lead.id
    );
    if (match) {
      setSelectedOrcamento(match);
      setIsViewOpen(true);
    } else {
      // Fallback: open convert dialog with partial data
      setLeadToConvert(lead as Lead);
      setIsConvertOpen(true);
    }
  }, [orcamentos]);

  const handleExportExcel = async () => {
    try {
      toast.info("Exportando leads...");
      const { data: leads, error } = await supabase
        .from("leads")
        .select("nome, telefone, email, cidade, estado, consultor, media_consumo, created_at, ultimo_contato")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const rows = (leads || []).map((l: any) => ({
        Nome: l.nome || "",
        Telefone: l.telefone || "",
        "E-mail": l.email || "",
        Cidade: l.cidade || "",
        Estado: l.estado || "",
        Consultor: l.consultor || "",
        "Consumo Médio": l.media_consumo ?? "",
        "Criado em": l.created_at ? new Date(l.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "",
        "Último contato": l.ultimo_contato ? new Date(l.ultimo_contato).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "",
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Leads");
      const today = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `leads-export-${today}.xlsx`);
      toast.success(`${rows.length} leads exportados!`);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao exportar");
    }
  };

  return (
    <motion.div className="space-y-6" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <PageHeader
        icon={Users}
        title="Leads"
        description="Gerencie os orçamentos e leads recebidos"
        actions={
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <Download className="w-4 h-4 mr-2" />
            Exportar Excel
          </Button>
        }
      />

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
            vendedores={filters.vendedores}
            estados={filters.estados}
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

      {/* Pagination — hide when filters produce no results */}
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
    </motion.div>
  );
}
