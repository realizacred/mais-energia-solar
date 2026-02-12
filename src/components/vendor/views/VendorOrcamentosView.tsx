import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { VendorFollowUpManager } from "@/components/vendor/VendorFollowUpManager";
import { VendorPendingDocumentation } from "@/components/vendor/VendorPendingDocumentation";
import { VendorLeadFilters, VendorOrcamentosTable, VendorLeadViewDialog } from "@/components/vendor/leads";
import { ConvertLeadToClientDialog } from "@/components/leads/ConvertLeadToClientDialog";
import { OfflineConversionsManager } from "@/components/leads/OfflineConversionsManager";
import { OfflineDuplicateResolver } from "@/components/vendor/OfflineDuplicateResolver";
import { VendedorShareLink } from "@/components/vendor/portal";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useOrcamentoSort } from "@/hooks/useOrcamentoSort";
import { OrcamentoSortSelector } from "@/components/ui/orcamento-sort-selector";

interface Props {
  portal: ReturnType<typeof import("@/hooks/useVendedorPortal").useVendedorPortal>;
}

export default function VendorOrcamentosView({ portal }: Props) {
  const { sortOption, updateSort } = useOrcamentoSort("vendedor_portal");
  const { hasPermission } = useUserPermissions();
  const canDeleteLeads = hasPermission("delete_leads");

  const {
    vendedor,
    isAdminMode,
    isViewingAsVendedor,
    orcamentos,
    filteredOrcamentos,
    statuses,
    estados,
    leadsForAlerts,
    searchTerm,
    setSearchTerm,
    filterVisto,
    setFilterVisto,
    filterEstado,
    setFilterEstado,
    filterStatus,
    setFilterStatus,
    handleClearFilters,
    selectedOrcamento,
    setSelectedOrcamento,
    isConvertOpen,
    setIsConvertOpen,
    orcamentoToConvert,
    setOrcamentoToConvert,
    fetchOrcamentos,
    toggleVisto,
    updateStatus,
    deleteOrcamento,
    copyLink,
    orcamentoToLead,
  } = portal;

  return (
    <div className="space-y-4 sm:space-y-6">
      <VendorFollowUpManager
        leads={leadsForAlerts}
        diasAlerta={3}
        onViewLead={(lead) => {
          const orc = orcamentos.find((o) => o.lead_id === lead.id);
          if (orc) setSelectedOrcamento(orc);
        }}
      />

      <VendorPendingDocumentation
        leads={leadsForAlerts}
        statuses={statuses}
        onConvertClick={(lead) => {
          const orc = orcamentos.find((o) => o.lead_id === lead.id);
          if (orc) {
            setOrcamentoToConvert(orc);
            setIsConvertOpen(true);
          }
        }}
      />

      <OfflineDuplicateResolver vendedorNome={vendedor?.nome} />
      <OfflineConversionsManager />

      {(!isAdminMode || isViewingAsVendedor) && vendedor && (
        <VendedorShareLink slug={vendedor.slug || vendedor.codigo} onCopy={copyLink} />
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Meus Orçamentos</CardTitle>
              <CardDescription>
                Lista de todos os orçamentos captados através do seu link
              </CardDescription>
            </div>
            <OrcamentoSortSelector value={sortOption} onChange={updateSort} />
          </div>
          <VendorLeadFilters
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            filterVisto={filterVisto}
            onFilterVistoChange={setFilterVisto}
            filterEstado={filterEstado}
            onFilterEstadoChange={setFilterEstado}
            filterStatus={filterStatus}
            onFilterStatusChange={setFilterStatus}
            estados={estados}
            statuses={statuses}
            onClearFilters={handleClearFilters}
          />
        </CardHeader>
        <CardContent>
          <VendorOrcamentosTable
            orcamentos={filteredOrcamentos}
            statuses={statuses}
            sortOption={sortOption}
            onToggleVisto={toggleVisto}
            onView={(orc) => setSelectedOrcamento(orc)}
            onStatusChange={updateStatus}
            onDelete={canDeleteLeads ? (orc) => deleteOrcamento(orc.id) : undefined}
            onConvert={(orc) => {
              setOrcamentoToConvert(orc);
              setIsConvertOpen(true);
            }}
          />
        </CardContent>
      </Card>

      <ConvertLeadToClientDialog
        lead={orcamentoToConvert ? orcamentoToLead(orcamentoToConvert) : null}
        open={isConvertOpen}
        onOpenChange={setIsConvertOpen}
        orcamentoId={orcamentoToConvert?.id ?? null}
        onSuccess={fetchOrcamentos}
      />

      <VendorLeadViewDialog
        lead={selectedOrcamento ? orcamentoToLead(selectedOrcamento) : null}
        open={!!selectedOrcamento}
        onOpenChange={(open) => {
          if (!open) setSelectedOrcamento(null);
        }}
      />
    </div>
  );
}
