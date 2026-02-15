import { useState, useEffect } from "react";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui-kit";
import { useOrcamentosAdmin } from "@/hooks/useOrcamentosAdmin";
import { 
  OrcamentosTable, 
  LeadFilters, 
  OrcamentoViewDialog, 
  OrcamentoDeleteDialog 
} from "@/components/admin/leads";
import { ConvertLeadToClientDialog } from "@/components/leads/ConvertLeadToClientDialog";
import { PendingDocumentationWidget, FollowUpNotifications } from "@/components/admin/widgets";
import { WaAutoMessageToggle } from "@/components/vendor/WaAutoMessageToggle";
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

  const handleLeadFromWidget = (lead: Lead) => {
    setLeadToConvert(lead);
    setIsConvertOpen(true);
  };

  return (
    <>
      {/* Notification Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <PendingDocumentationWidget onLeadClick={handleLeadFromWidget} />
        <FollowUpNotifications onLeadClick={handleLeadFromWidget} diasAlerta={3} />
        <WaAutoMessageToggle />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-brand-blue">Orçamentos Cadastrados</CardTitle>
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="gap-1.5"
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
            className="gap-1.5"
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
    </>
  );
}
