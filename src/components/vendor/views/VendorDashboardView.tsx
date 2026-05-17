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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-primary shadow-lg shadow-primary/20 rotate-3 hover:rotate-0 transition-transform duration-300">
            <LayoutDashboard className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground tracking-tight">Painel de Controle</h1>
            <p className="text-sm font-medium text-muted-foreground/80">Gestão centralizada e métricas de desempenho</p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-card/40 backdrop-blur-md p-1.5 rounded-2xl border border-border/40 shadow-sm">
          <div className="flex items-center gap-2 px-3 border-r border-border/40 mr-1">
            <WaAutoMessageToggle compact />
          </div>
          <div className="flex items-center gap-4 px-3 pr-4">
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <div className="relative flex items-center">
                <input 
                  type="checkbox" 
                  checked={excludeTerminal} 
                  onChange={(e) => setExcludeTerminal(e.target.checked)}
                  className="w-4.5 h-4.5 rounded-md border-muted-foreground/30 text-primary focus:ring-primary/30 transition-all"
                />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 group-hover:text-primary transition-colors">Finalizados</span>
            </label>
            <div className="h-4 w-px bg-border/40" />
            <select 
              value={maxAgeDays || "all"} 
              onChange={(e) => setMaxAgeDays(e.target.value === "all" ? null : Number(e.target.value))}
              className="bg-transparent border-none text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 focus:ring-0 cursor-pointer hover:text-primary transition-colors pr-2"
            >
              <option value="30">30 dias</option>
              <option value="60">60 dias</option>
              <option value="90">90 dias</option>
              <option value="all">Sempre</option>
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


