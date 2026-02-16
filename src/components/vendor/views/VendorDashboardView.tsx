import { LeadAlerts } from "@/components/vendor/LeadAlerts";
import { FollowUpStatsCards } from "@/components/vendor/FollowUpStatsCards";
import { VendorPersonalDashboard } from "@/components/vendor/VendorPersonalDashboard";
import { VendedorShareLink } from "@/components/vendor/portal";
import { GoalProgressNotifications } from "@/components/vendor/gamification";
import { WhatsAppTemplates, FollowUpCalendar, SmartReminders } from "@/components/vendor/productivity";
import { LeadScoring } from "@/components/vendor/leads";
import { WaAutoMessageToggle } from "@/components/vendor/WaAutoMessageToggle";
import SyncStatusWidget from "@/components/vendor/SyncStatusWidget";


interface Props {
  portal: ReturnType<typeof import("@/hooks/useVendedorPortal").useVendedorPortal>;
}

export default function VendorDashboardView({ portal }: Props) {
  const {
    vendedor,
    isAdminMode,
    isViewingAsVendedor,
    orcamentos,
    statuses,
    leadsForAlerts,
    copyLink,
    goalNotifications,
    markNotificationAsRead,
    advancedMetrics,
    metricsLoading,
    selectedOrcamento,
    setSelectedOrcamento,
  } = portal;

  return (
    <div className="space-y-4 sm:space-y-6">
      <LeadAlerts leads={leadsForAlerts} diasAlerta={3} />

      {(!isAdminMode || isViewingAsVendedor) && vendedor && (
        <VendedorShareLink slug={vendedor.slug || vendedor.codigo} onCopy={copyLink} />
      )}

      {goalNotifications.length > 0 && (
        <GoalProgressNotifications
          notifications={goalNotifications}
          onDismiss={markNotificationAsRead}
        />
      )}

      {vendedor && (
        <VendorPersonalDashboard
          orcamentos={orcamentos}
          statuses={statuses}
          vendedorNome={vendedor.nome}
        />
      )}

      <WaAutoMessageToggle />

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

      <div className="w-full">
        <FollowUpStatsCards leads={leadsForAlerts} />
      </div>

      <FollowUpCalendar
        leads={leadsForAlerts}
        onSelectLead={(lead) => {
          const orc = orcamentos.find((o) => o.lead_id === lead.id);
          if (orc) setSelectedOrcamento(orc);
        }}
      />

      <LeadScoring
        leads={leadsForAlerts}
        statuses={statuses}
        onSelectLead={(lead) => {
          const orc = orcamentos.find((o) => o.lead_id === lead.id);
          if (orc) setSelectedOrcamento(orc);
        }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SyncStatusWidget />
      </div>
    </div>
  );
}
