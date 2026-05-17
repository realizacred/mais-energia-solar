import { useNavigate } from "react-router-dom";
import { MessageCircle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    excludeTerminal,
    setExcludeTerminal,
    maxAgeDays,
    setMaxAgeDays,
    handleClearFilters,
    operationalStatus,
    setOperationalStatus,
    selectedOrcamento,
    setSelectedOrcamento,
    isConvertOpen,
    setIsConvertOpen,
    orcamentoToConvert,
    setOrcamentoToConvert,
    fetchOrcamentos,
    loadMore,
    hasMore,
    totalCount,
    loadingMore,
    toggleVisto,
    updateStatus,
    deleteOrcamento,
    copyLink,
    orcamentoToLead,
  } = portal;

  const navigate = useNavigate();

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Leads</h1>
            <p className="text-sm text-muted-foreground">Oportunidades e solicitações de orçamento</p>
          </div>
        </div>
        <div className="flex md:hidden">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 min-h-[44px]"
            onClick={() => navigate("/consultor/whatsapp")}
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </Button>
        </div>
      </div>
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
        showAll={!excludeTerminal}
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
              <CardTitle>Meus Leads</CardTitle>
              <CardDescription>
                Exibindo {filteredOrcamentos.length} {filteredOrcamentos.length === 1 ? 'lead' : 'leads'} 
                {totalCount > filteredOrcamentos.length ? ` (Página ${portal.page + 1})` : ""} de {totalCount} filtrados
              </CardDescription>
              {(excludeTerminal || maxAgeDays !== null) && (
                <div className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-100 dark:border-yellow-900/30 rounded-md text-[11px] text-yellow-700 dark:text-yellow-400 font-medium animate-in fade-in slide-in-from-top-1">
                  <span className="flex h-1.5 w-1.5 rounded-full bg-yellow-500 animate-pulse" />
                  Alguns orçamentos estão ocultos por filtros operacionais.
                  <button 
                    onClick={handleClearFilters}
                    className="ml-auto underline hover:no-underline"
                  >
                    Mostrar todos
                  </button>
                </div>
              )}
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
            excludeTerminal={excludeTerminal}
            onExcludeTerminalChange={setExcludeTerminal}
            maxAgeDays={maxAgeDays}
            onMaxAgeDaysChange={setMaxAgeDays}
            operationalStatus={operationalStatus}
            onOperationalStatusChange={setOperationalStatus}
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
            onRefresh={fetchOrcamentos}
          />

          {hasMore && (
            <div className="flex justify-center pt-6 pb-2">
              <Button 
                variant="outline" 
                onClick={loadMore} 
                disabled={loadingMore}
                className="w-full sm:w-auto min-w-[200px]"
              >
                {loadingMore ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Carregando...
                  </>
                ) : (
                  "Carregar mais leads"
                )}
              </Button>
            </div>
          )}
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
