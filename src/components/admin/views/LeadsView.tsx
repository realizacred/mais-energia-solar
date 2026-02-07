import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOrcamentosAdmin } from "@/hooks/useOrcamentosAdmin";
import { 
  OrcamentosTable, 
  LeadFilters, 
  OrcamentoViewDialog, 
  OrcamentoDeleteDialog 
} from "@/components/admin/leads";
import { ConvertLeadToClientDialog } from "@/components/leads/ConvertLeadToClientDialog";
import { PendingDocumentationWidget, FollowUpNotifications } from "@/components/admin/widgets";
import type { OrcamentoDisplayItem } from "@/types/orcamento";
import type { Lead } from "@/types/lead";

export function LeadsView() {
  const { orcamentos, statuses, toggleVisto, deleteOrcamento, filters, fetchOrcamentos } = useOrcamentosAdmin();
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
        (orc.vendedor && orc.vendedor.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (filterVisto === "visto") {
      filtered = filtered.filter((orc) => orc.visto_admin);
    } else if (filterVisto === "nao_visto") {
      filtered = filtered.filter((orc) => !orc.visto_admin);
    }

    if (filterVendedor !== "todos") {
      filtered = filtered.filter((orc) => orc.vendedor === filterVendedor);
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
      vendedor: orc.vendedor,
      visto: orc.visto,
      visto_admin: orc.visto_admin,
      status_id: orc.status_id,
      ultimo_contato: orc.ultimo_contato,
      proxima_acao: orc.proxima_acao,
      data_proxima_acao: orc.data_proxima_acao,
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <PendingDocumentationWidget onLeadClick={handleLeadFromWidget} />
        <FollowUpNotifications onLeadClick={handleLeadFromWidget} diasAlerta={3} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-brand-blue">Orçamentos Cadastrados</CardTitle>
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
          <OrcamentosTable
            orcamentos={filteredOrcamentos}
            statuses={statuses}
            onToggleVisto={toggleVisto}
            onView={(orc) => {
              setSelectedOrcamento(orc);
              setIsViewOpen(true);
            }}
            onDelete={(orc) => {
              setOrcamentoToDelete(orc);
              setIsDeleteOpen(true);
            }}
            onConvert={handleConvertOrcamento}
          />
        </CardContent>
      </Card>

      <OrcamentoViewDialog
        orcamento={selectedOrcamento}
        open={isViewOpen}
        onOpenChange={setIsViewOpen}
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
