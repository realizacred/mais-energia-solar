import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, LayoutDashboard, FileText, ClipboardCheck, MessageCircle, ChevronDown, Trophy, Smartphone, Bell } from "lucide-react";
import { LeadAlerts } from "@/components/vendor/LeadAlerts";
import { FollowUpStatsCards } from "@/components/vendor/FollowUpStatsCards";
 import { VendorPersonalDashboard } from "@/components/vendor/VendorPersonalDashboard";
import { VendorFollowUpManager } from "@/components/vendor/VendorFollowUpManager";
import { VendorPendingDocumentation } from "@/components/vendor/VendorPendingDocumentation";
import { WhatsAppTemplates, FollowUpCalendar, SmartReminders } from "@/components/vendor/productivity";
 import { VendorLeadFilters, VendorOrcamentosTable, VendorLeadViewDialog, LeadScoring } from "@/components/vendor/leads";
 import { VendorAchievements, VendorGoals, VendorLeaderboard, AdvancedMetricsCard, GoalProgressNotifications } from "@/components/vendor/gamification";
import { ConvertLeadToClientDialog } from "@/components/leads/ConvertLeadToClientDialog";
import { OfflineConversionsManager } from "@/components/leads/OfflineConversionsManager";
import { OfflineDuplicateResolver } from "@/components/vendor/OfflineDuplicateResolver";
import NotificationSettings from "@/components/vendor/NotificationSettings";
import SyncStatusWidget from "@/components/vendor/SyncStatusWidget";
import { VendorTaskAgenda } from "@/components/vendor/VendorTaskAgenda";
import { WaInbox } from "@/components/admin/inbox/WaInbox";
import { LinksInstalacaoPage } from "@/components/admin/LinksInstalacaoPage";
import { lazy, Suspense } from "react";
const PushNotificationSettings = lazy(() => import("@/components/admin/PushNotificationSettings").then(m => ({ default: m.PushNotificationSettings })));
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
      ranking,
      myRankPosition,
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
        {/* Unseen badge count */}
        {(() => {
          const unseenCount = orcamentos.filter(o => !o.visto).length;
          return (
             <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full max-w-3xl grid-cols-5">
                <TabsTrigger value="dashboard" className="gap-2">
                  <LayoutDashboard className="h-4 w-4" />
                  <span className="hidden sm:inline">Dashboard</span>
                </TabsTrigger>
                <TabsTrigger value="whatsapp" className="gap-2">
                  <MessageCircle className="h-4 w-4" />
                  <span className="hidden sm:inline">WhatsApp</span>
                </TabsTrigger>
                <TabsTrigger value="agenda" className="gap-2">
                  <ClipboardCheck className="h-4 w-4" />
                  <span className="hidden sm:inline">Agenda</span>
                </TabsTrigger>
                <TabsTrigger value="orcamentos" className="gap-2 relative">
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Orçamentos</span>
                  {unseenCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-bold px-1">
                      {unseenCount}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="links" className="gap-2">
                  <Smartphone className="h-4 w-4" />
                  <span className="hidden sm:inline">Links</span>
                </TabsTrigger>
              </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-4 sm:space-y-6 mt-4">
            {/* Urgent Alerts at Top */}
            <LeadAlerts leads={leadsForAlerts} diasAlerta={3} />

            {/* Share Link Card */}
            {(!isAdminMode || isViewingAsVendedor) && vendedor && (
              <VendedorShareLink slug={vendedor.slug || vendedor.codigo} onCopy={copyLink} />
            )}

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

            {/* Gamification Section — Collapsible */}
            <Collapsible defaultOpen={false}>
              <CollapsibleTrigger className="flex items-center gap-2 w-full text-left text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors group">
                <Trophy className="h-4 w-4" />
                Gamificação & Ranking
                <ChevronDown className="h-4 w-4 ml-auto transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-3">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <VendorGoals goals={goals} />
                  <VendorAchievements
                    achievements={achievements}
                    totalPoints={totalPoints}
                  />
                </div>

                {/* Leaderboard */}
                <VendorLeaderboard
                  ranking={ranking}
                  currentVendedorId={vendedor?.id || null}
                  myRankPosition={myRankPosition}
                />
              </CollapsibleContent>
            </Collapsible>

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

            {/* Push Notification Settings */}
            <Collapsible defaultOpen={false}>
              <CollapsibleTrigger className="flex items-center gap-2 w-full text-left text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors group">
                <Bell className="h-4 w-4" />
                Notificações Push
                <ChevronDown className="h-4 w-4 ml-auto transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3">
                <Suspense fallback={<Loader2 className="h-5 w-5 animate-spin" />}>
                  <PushNotificationSettings />
                </Suspense>
              </CollapsibleContent>
            </Collapsible>

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

          {/* WhatsApp Tab */}
          <TabsContent value="whatsapp" className="mt-4" style={{ height: "calc(100vh - 200px)", minHeight: "500px" }}>
            <WaInbox vendorMode vendorUserId={vendedor?.user_id || undefined} />
          </TabsContent>

          {/* Agenda Tab */}
          <TabsContent value="agenda" className="space-y-4 sm:space-y-6 mt-4">
            <VendorTaskAgenda />
          </TabsContent>

          {/* Orçamentos Tab */}
          <TabsContent value="orcamentos" className="space-y-4 sm:space-y-6 mt-4">
            {/* Follow-Up Manager — alerts already shown in dashboard */}

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

            {/* Share Link Card */}
             {(!isAdminMode || isViewingAsVendedor) && vendedor && (
               <VendedorShareLink slug={vendedor.slug || vendedor.codigo} onCopy={copyLink} />
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

          {/* Links & Instalação Tab */}
          <TabsContent value="links" className="mt-4">
            {vendedor && (
              <LinksInstalacaoPage
                vendedor={{
                  nome: vendedor.nome,
                  slug: vendedor.slug || vendedor.codigo,
                  codigo: vendedor.codigo,
                }}
              />
            )}
          </TabsContent>
            </Tabs>
          );
        })()}
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
