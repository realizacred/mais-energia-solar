import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, LayoutDashboard, FileText } from "lucide-react";
import { LeadAlerts } from "@/components/vendor/LeadAlerts";
import { FollowUpStatsCards } from "@/components/vendor/FollowUpStatsCards";
 import { VendorPersonalDashboard } from "@/components/vendor/VendorPersonalDashboard";
import { VendorFollowUpManager } from "@/components/vendor/VendorFollowUpManager";
import { VendorPendingDocumentation } from "@/components/vendor/VendorPendingDocumentation";
import { WhatsAppTemplates, FollowUpCalendar, SmartReminders } from "@/components/vendor/productivity";
 import { VendorLeadFilters, VendorOrcamentosTable, VendorLeadViewDialog, LeadScoring } from "@/components/vendor/leads";
 import { VendorAchievements, VendorGoals, AdvancedMetricsCard, GoalProgressNotifications } from "@/components/vendor/gamification";
import { ConvertLeadToClientDialog } from "@/components/leads/ConvertLeadToClientDialog";
import { OfflineConversionsManager } from "@/components/leads/OfflineConversionsManager";
import { OfflineDuplicateResolver } from "@/components/vendor/OfflineDuplicateResolver";
import NotificationSettings from "@/components/vendor/NotificationSettings";
import SyncStatusWidget from "@/components/vendor/SyncStatusWidget";
import { VendedorHeader, VendedorShareLink } from "@/components/vendor/portal";
import { useVendedorPortal, orcamentoToLead } from "@/hooks/useVendedorPortal";

export default function VendedorPortal() {
   const {
     // Profile
     vendedor,
     isAdminMode,
     isViewingAsVendedor,
     loading,
     // Filters
     searchTerm,
     setSearchTerm,
     filterVisto,
     setFilterVisto,
     filterEstado,
     setFilterEstado,
     filterStatus,
     setFilterStatus,
     handleClearFilters,
     // Dialogs
     selectedOrcamento,
     setSelectedOrcamento,
     isConvertOpen,
     setIsConvertOpen,
     orcamentoToConvert,
     setOrcamentoToConvert,
     // Orcamentos
    orcamentos,
     filteredOrcamentos,
    statuses,
    estados,
    fetchOrcamentos,
    toggleVisto,
    updateStatus,
    deleteOrcamento,
     // Gamification
     achievements,
     goals,
     totalPoints,
     // Advanced Metrics
     advancedMetrics,
     metricsLoading,
     goalNotifications,
     markNotificationAsRead,
     // Actions
     handleSignOut,
     copyLink,
     leadsForAlerts,
   } = useVendedorPortal();

  const [activeTab, setActiveTab] = useState("dashboard");

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
       <VendedorHeader
         vendedorNome={vendedor?.nome || ""}
         isAdminMode={isAdminMode}
         isViewingAsVendedor={isViewingAsVendedor}
         onSignOut={handleSignOut}
       />

      <main className="container mx-auto px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="dashboard" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard Pessoal
            </TabsTrigger>
            <TabsTrigger value="orcamentos" className="gap-2">
              <FileText className="h-4 w-4" />
              Meus Orçamentos
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-4 sm:space-y-6 mt-4">
           {/* Goal Progress Notifications */}
           {goalNotifications.length > 0 && (
             <GoalProgressNotifications
               notifications={goalNotifications}
               onDismiss={markNotificationAsRead}
             />
           )}
 
            {/* Personal Dashboard */}
            {vendedor && (
              <VendorPersonalDashboard
                orcamentos={orcamentos}
                statuses={statuses}
                vendedorNome={vendedor.nome}
              />
            )}

            {/* Gamification Section */}
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <VendorGoals goals={goals} />
              <VendorAchievements
                achievements={achievements}
                totalPoints={totalPoints}
              />
            </div>
 
           {/* Advanced Performance Metrics */}
           <AdvancedMetricsCard 
             metrics={advancedMetrics} 
             loading={metricsLoading} 
           />

            {/* Sync Status & Notifications Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SyncStatusWidget />
              {vendedor && <NotificationSettings vendedorNome={vendedor.nome} />}
            </div>

            {/* Productivity Tools Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
              {vendedor && (
                <div className="lg:col-span-1 flex lg:h-[560px] min-h-0 overflow-hidden">
                  <SmartReminders 
                    leads={leadsForAlerts} 
                    orcamentos={orcamentos}
                    vendedorNome={vendedor.nome}
                  />
                </div>
              )}
              {vendedor && (
                <div className="lg:col-span-1 flex lg:h-[560px] min-h-0 overflow-hidden">
                  <WhatsAppTemplates vendedorNome={vendedor.nome} />
                </div>
              )}
            </div>

            {/* Stats Cards */}
            <div className="w-full">
              <FollowUpStatsCards leads={leadsForAlerts} />
            </div>

            {/* Follow-Up Calendar */}
            <FollowUpCalendar 
              leads={leadsForAlerts}
              onSelectLead={(lead) => {
                const orc = orcamentos.find(o => o.lead_id === lead.id);
                if (orc) setSelectedOrcamento(orc);
              }}
            />

            {/* AI Lead Scoring */}
            <LeadScoring
              leads={leadsForAlerts}
              statuses={statuses}
              onSelectLead={(lead) => {
                const orc = orcamentos.find(o => o.lead_id === lead.id);
                if (orc) setSelectedOrcamento(orc);
              }}
            />
          </TabsContent>

          {/* Orçamentos Tab */}
          <TabsContent value="orcamentos" className="space-y-4 sm:space-y-6 mt-4">
            {/* AI Assistant Alerts */}
            <LeadAlerts leads={leadsForAlerts} diasAlerta={3} />

            {/* Follow-Up Manager */}
            <VendorFollowUpManager 
              leads={leadsForAlerts} 
              diasAlerta={3}
              onViewLead={(lead) => {
                const orc = orcamentos.find(o => o.lead_id === lead.id);
                if (orc) setSelectedOrcamento(orc);
              }}
            />

            {/* Pending Documentation Widget */}
            <VendorPendingDocumentation 
              leads={leadsForAlerts}
              statuses={statuses}
              onConvertClick={(lead) => {
                const orc = orcamentos.find(o => o.lead_id === lead.id);
                if (orc) {
                  setOrcamentoToConvert(orc);
                  setIsConvertOpen(true);
                }
              }}
            />

            {/* Offline Duplicate Resolver */}
            <OfflineDuplicateResolver vendedorNome={vendedor?.nome} />

            {/* Offline Conversions Manager */}
            <OfflineConversionsManager />

            {/* Share Link Card - only show for actual vendedores, not admin mode */}
             {!isAdminMode && vendedor && (
               <VendedorShareLink codigo={vendedor.codigo} onCopy={copyLink} />
            )}

            {/* Orcamentos Table */}
            <Card>
              <CardHeader>
                <CardTitle>Meus Orçamentos</CardTitle>
                <CardDescription>
                  Lista de todos os orçamentos captados através do seu link
                </CardDescription>
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
                  onToggleVisto={toggleVisto}
                  onView={(orc) => setSelectedOrcamento(orc)}
                  onStatusChange={updateStatus}
                  onDelete={(orc) => deleteOrcamento(orc.id)}
                  onConvert={(orc) => {
                    setOrcamentoToConvert(orc);
                    setIsConvertOpen(true);
                  }}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <ConvertLeadToClientDialog
        lead={orcamentoToConvert ? orcamentoToLead(orcamentoToConvert) : null}
        open={isConvertOpen}
        onOpenChange={setIsConvertOpen}
        orcamentoId={orcamentoToConvert?.id ?? null}
        onSuccess={fetchOrcamentos}
      />

      {/* Detalhes (botão do olho) */}
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
