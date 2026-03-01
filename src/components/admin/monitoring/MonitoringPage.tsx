import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { StatCard } from "@/components/ui-kit/StatCard";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sun, Plug, RefreshCw, Zap, Activity, Battery, MapPin, Search, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { PROVIDER_REGISTRY, type ProviderDefinition } from "@/services/monitoring/providerRegistry";
import {
  listIntegrations,
  listPlants,
  getTodayMetrics,
  syncProvider,
} from "@/services/monitoring/monitoringService";
import { ConnectProviderModal } from "./ConnectProviderModal";
import { PlantsTable } from "./PlantsTable";
import { PlantsMap } from "./PlantsMap";

type TabFilter = "all" | "active" | "inactive" | "popular";

const POPULAR_IDS = ["solarman_business_api", "solaredge", "solis_cloud", "growatt"];

export default function MonitoringPage() {
  const queryClient = useQueryClient();
  const [connectProvider, setConnectProvider] = useState<ProviderDefinition | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TabFilter>("all");

  const { data: integrations = [], isLoading: loadingInt } = useQuery({
    queryKey: ["monitoring-integrations"],
    queryFn: listIntegrations,
  });

  const { data: plants = [], isLoading: loadingPlants } = useQuery({
    queryKey: ["monitoring-plants"],
    queryFn: listPlants,
  });

  const { data: metrics = [] } = useQuery({
    queryKey: ["monitoring-metrics-today"],
    queryFn: getTodayMetrics,
  });

  const syncMutation = useMutation({
    mutationFn: (provider: string) => syncProvider(provider, "full"),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(
          `Sincronização concluída: ${result.plants_synced} usinas, ${result.metrics_synced} métricas`
        );
      } else {
        toast.error(result.error || "Erro na sincronização");
      }
      queryClient.invalidateQueries({ queryKey: ["monitoring-integrations"] });
      queryClient.invalidateQueries({ queryKey: ["monitoring-plants"] });
      queryClient.invalidateQueries({ queryKey: ["monitoring-metrics-today"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const hasConnected = integrations.some((i) => i.status === "connected");

  // Aggregate stats
  const totalCapacity = plants.reduce((sum, p) => sum + (p.capacity_kw || 0), 0);
  const totalEnergyToday = metrics.reduce((sum, m) => sum + (m.energy_kwh || 0), 0);
  const totalEnergyAll = metrics.reduce((sum, m) => sum + (m.total_energy_kwh || 0), 0);
  const onlinePlants = plants.filter((p) => p.status === "normal").length;
  const plantsWithCoords = plants.filter((p) => p.latitude != null && p.longitude != null);

  // Filter providers
  const filteredProviders = PROVIDER_REGISTRY.filter((prov) => {
    const matchSearch = !search || prov.label.toLowerCase().includes(search.toLowerCase()) || prov.description.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;

    const integration = integrations.find((i) => i.provider === prov.id);
    const isActive = integration && (integration.status === "connected" || integration.status === "connected_pending");

    switch (tab) {
      case "active": return isActive;
      case "inactive": return !isActive;
      case "popular": return POPULAR_IDS.includes(prov.id);
      default: return true;
    }
  });

  if (loadingInt) return <LoadingState message="Carregando integrações..." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monitoramento Solar"
        description="Monitore suas usinas fotovoltaicas em tempo real"
        icon={Sun}
      />

      {/* Dashboard stats */}
      {hasConnected && plants.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Potência Instalada" value={`${totalCapacity.toFixed(1)} kW`} icon={Zap} color="warning" />
          <StatCard label="Produção Hoje" value={`${totalEnergyToday.toFixed(1)} kWh`} icon={Activity} color="success" />
          <StatCard label="Produção Total" value={`${(totalEnergyAll / 1000).toFixed(1)} MWh`} icon={Battery} color="info" />
          <StatCard label="Usinas Online" value={`${onlinePlants}/${plants.length}`} icon={Sun} color="primary" />
        </div>
      )}

      {/* Search + Tabs */}
      <SectionCard title="Provedores" icon={Plug}>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar integração…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-1">
              {([["all", "Todas"], ["active", "Ativas"], ["inactive", "Inativas"], ["popular", "Mais populares"]] as [TabFilter, string][]).map(([key, label]) => (
                <Button
                  key={key}
                  size="sm"
                  variant={tab === key ? "default" : "outline"}
                  onClick={() => setTab(key)}
                  className="text-xs"
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {/* Provider cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProviders.map((prov) => {
              const integration = integrations.find((i) => i.provider === prov.id);
              const status = integration?.status || "disconnected";

              return (
                <div key={prov.id} className="border border-border rounded-lg p-4 space-y-3 bg-card">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sun className="h-5 w-5 text-warning" />
                      <span className="font-semibold text-sm">{prov.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {(prov.status === "coming_soon" || prov.status === "stub") && (
                        <Badge variant="outline" className="text-2xs">Em breve</Badge>
                      )}
                      <StatusBadge
                        status={
                          status === "connected" ? "Conectado"
                            : status === "connected_pending" ? "Pendente"
                            : status === "error" ? "Erro"
                            : "Desconectado"
                        }
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{prov.description}</p>

                  {integration?.last_sync_at && (
                    <p className="text-2xs text-muted-foreground">
                      Última sync: {new Date(integration.last_sync_at).toLocaleString("pt-BR")}
                    </p>
                  )}
                  {integration?.sync_error && (
                    <p className="text-2xs text-destructive truncate">{integration.sync_error}</p>
                  )}

                  <div className="flex gap-2 flex-wrap">
                    {(prov.status === "coming_soon" || prov.status === "stub") ? (
                      <Button size="sm" variant="outline" onClick={() => setConnectProvider(prov)}>
                        <Info className="h-3.5 w-3.5 mr-1" />
                        Ver tutorial
                      </Button>
                    ) : status === "disconnected" || status === "error" ? (
                      <Button size="sm" onClick={() => setConnectProvider(prov)}>
                        <Plug className="h-3.5 w-3.5 mr-1" />
                        Conectar
                      </Button>
                    ) : (
                      <>
                        {(prov.status === "active" || prov.status === "beta") ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => syncMutation.mutate(prov.id)}
                            disabled={syncMutation.isPending}
                          >
                            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                            Sincronizar
                          </Button>
                        ) : (
                          <Badge variant="secondary" className="text-2xs py-1">Sync em breve</Badge>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setConnectProvider(prov)}>
                          Reconectar
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            {filteredProviders.length === 0 && (
              <div className="col-span-full text-center py-8 text-sm text-muted-foreground">
                Nenhuma integração encontrada.
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      {/* Map toggle */}
      {hasConnected && plantsWithCoords.length > 0 && (
        <div className="flex justify-end">
          <Button size="sm" variant={showMap ? "default" : "outline"} onClick={() => setShowMap(!showMap)}>
            <MapPin className="h-3.5 w-3.5 mr-1" />
            {showMap ? "Ocultar Mapa" : "Ver Mapa"}
          </Button>
        </div>
      )}

      {showMap && plantsWithCoords.length > 0 && (
        <SectionCard title="Localização das Usinas" icon={MapPin}>
          <PlantsMap plants={plantsWithCoords} />
        </SectionCard>
      )}

      {/* Plants table or empty state */}
      {hasConnected ? (
        loadingPlants ? (
          <LoadingState message="Carregando usinas..." />
        ) : plants.length === 0 ? (
          <EmptyState
            icon={Sun}
            title="Nenhuma usina importada"
            description='Clique em "Sincronizar" no provedor conectado para importar as usinas.'
          />
        ) : (
          <SectionCard title={`Usinas (${plants.length})`} icon={Sun}>
            <PlantsTable plants={plants} metrics={metrics} />
          </SectionCard>
        )
      ) : (
        <EmptyState
          icon={Plug}
          title="Conecte um provedor"
          description="Conecte sua conta de monitoramento para importar e acompanhar suas usinas solares."
        />
      )}

      {/* Dynamic connect modal */}
      {connectProvider && (
        <ConnectProviderModal
          open={!!connectProvider}
          onOpenChange={(open) => { if (!open) setConnectProvider(null); }}
          provider={connectProvider}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["monitoring-integrations"] });
            setConnectProvider(null);
          }}
        />
      )}
    </div>
  );
}
