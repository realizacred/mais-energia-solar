import { LayoutDashboard, Wallet, TrendingUp, Calendar, AlertCircle } from "lucide-react";
import { LeadAlerts } from "@/components/vendor/LeadAlerts";
import { FollowUpStatsCards } from "@/components/vendor/FollowUpStatsCards";
import { VendorPersonalDashboard } from "@/components/vendor/VendorPersonalDashboard";
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
import { startOfMonth } from "date-fns";


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

      <ComissoesWidget vendedor={vendedor} />

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

function ComissoesWidget({ vendedor }: { vendedor: any }) {
  const { user } = useAuth();
  
  const { data: stats, isLoading } = useQuery({
    queryKey: ["vendor-commissions-stats", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const now = new Date();
      const monthStart = startOfMonth(now).toISOString();
      const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();

      // 1. Get closed deals (sales) for this month
      const { data: monthDeals, error: monthErr } = await (supabase as any)
        .from("deals")
        .select("id, value")
        .eq("owner_id", user!.id)
        .eq("status", "ganho")
        .gte("created_at", monthStart);
      
      if (monthErr) throw monthErr;

      // 2. Get closed deals for this year
      const { data: yearDeals, error: yearErr } = await (supabase as any)
        .from("deals")
        .select("id, value")
        .eq("owner_id", user!.id)
        .eq("status", "ganho")
        .gte("created_at", yearStart);

      if (yearErr) throw yearErr;

      const monthValue = monthDeals?.reduce((acc: number, d: any) => acc + (Number(d.value) || 0), 0) || 0;
      const yearValue = yearDeals?.reduce((acc: number, d: any) => acc + (Number(d.value) || 0), 0) || 0;

      
      return {
        monthValue,
        monthCount: monthDeals?.length || 0,
        yearValue,
        yearCount: yearDeals?.length || 0,
        percentual: Number(vendedor?.percentual_comissao) || 0
      };
    }
  });

  if (isLoading) return <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>;

  const comissaoPrevista = stats ? (stats.monthValue * stats.percentual) / 100 : 0;

  return (
    <div className="space-y-3 mb-6">
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <Wallet className="h-4 w-4" />
        Minhas Comissões
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-primary/5 border-primary/10">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Vendas no Mês</p>
                <h3 className="text-xl font-bold mt-1">{formatBRL(stats?.monthValue || 0)}</h3>
                <p className="text-xs text-muted-foreground mt-1">{stats?.monthCount} projetos fechados</p>
              </div>
              <TrendingUp className="h-4 w-4 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-success/5 border-success/10 relative overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-success uppercase font-bold tracking-wider">Comissão Prevista</p>
                <h3 className="text-xl font-bold mt-1 text-success">{formatBRL(comissaoPrevista)}</h3>
                <p className="text-xs text-success/70 mt-1">
                  {stats?.percentual ? `${stats.percentual}% do valor total` : "Percentual não configurado"}
                </p>
              </div>
              <Wallet className="h-4 w-4 text-success opacity-50" />
            </div>
            {!stats?.percentual && (
              <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px] flex items-center justify-center p-4 text-center">
                <p className="text-[10px] font-bold text-muted-foreground leading-tight">
                  <AlertCircle className="h-3 w-3 mx-auto mb-1" />
                  Configure seu percentual com o gestor
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-muted/30 border-muted-foreground/10">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Acumulado no Ano</p>
                <h3 className="text-xl font-bold mt-1">{formatBRL(stats?.yearValue || 0)}</h3>
                <p className="text-xs text-muted-foreground mt-1">{stats?.yearCount} projetos no total</p>
              </div>
              <Calendar className="h-4 w-4 text-muted-foreground opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>
      
      <p className="text-[10px] text-muted-foreground italic text-right">
        * Valores estimados baseados em propostas aceitas. Sujeito a confirmação pelo gestor.
      </p>
    </div>
  );
}

