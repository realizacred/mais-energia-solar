import { LayoutDashboard, Wallet, TrendingUp, Calendar, AlertCircle } from "lucide-react";
import { LeadAlerts } from "@/components/vendor/LeadAlerts";
import { FollowUpStatsCards } from "@/components/vendor/FollowUpStatsCards";
import { VendorPersonalDashboard } from "@/components/vendor/VendorPersonalDashboard";
import { VendorComissoesDashboard } from "@/components/vendor/VendorComissoesDashboard";
import { VendedorShareLink } from "@/components/vendor/portal";
import { GoalProgressNotifications } from "@/components/vendor/gamification";
import { WhatsAppTemplates, FollowUpCalendar, SmartReminders } from "@/components/vendor/productivity";
import { LeadScoring } from "@/components/vendor/leads";
import { WaAutoMessageToggle } from "@/components/vendor/WaAutoMessageToggle";
import SyncStatusWidget from "@/components/vendor/SyncStatusWidget";
import { WaConnectionCard } from "@/components/vendor/WaConnectionCard";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBRL } from "@/lib/formatters";
import { Skeleton } from "@/components/ui/skeleton";
import { startOfMonth, endOfYear, startOfYear } from "date-fns";


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
    excludeTerminal,
    setExcludeTerminal,
    maxAgeDays,
    setMaxAgeDays,
  } = portal;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <LayoutDashboard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Painel</h1>
            <p className="text-sm text-muted-foreground">Resumo das suas métricas e atividades</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-background/50 p-1 rounded-lg border border-border/40 scale-90 sm:scale-100 origin-right">
          <div className="flex items-center gap-2 px-2 border-r border-border/40 mr-1">
            <WaAutoMessageToggle compact />
          </div>
          <div className="flex items-center gap-4 px-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={excludeTerminal} 
                onChange={(e) => setExcludeTerminal(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-xs font-medium">Ocultar Finalizados</span>
            </label>
            <select 
              value={maxAgeDays || "all"} 
              onChange={(e) => setMaxAgeDays(e.target.value === "all" ? null : Number(e.target.value))}
              className="bg-transparent border-none text-xs font-medium focus:ring-0 cursor-pointer"
            >
              <option value="30">Últimos 30 dias</option>
              <option value="60">Últimos 60 dias</option>
              <option value="90">Últimos 90 dias</option>
              <option value="all">Todo histórico</option>
            </select>
          </div>
        </div>
      </div>

      <VendorComissoesDashboard vendedor={vendedor} />

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

      {/* Operacional filters moved to header */}

      <WaConnectionCard />

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

// §158-270: ComissoesWidget legacy removed in favor of VendorComissoesDashboard


