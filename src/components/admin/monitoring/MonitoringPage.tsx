import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { StatCard } from "@/components/ui-kit/StatCard";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sun, Plug, RefreshCw, Zap, Activity, Battery, MapPin, Search, Info, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { PROVIDER_REGISTRY, resolveProviderId, type ProviderDefinition } from "@/services/monitoring/providerRegistry";
import {
  listIntegrations,
  listSolarPlants as listPlants,
  getTodayMetrics,
  syncProvider,
  discoverPlants,
  type DiscoveredPlant,
} from "@/services/monitoring/monitorService";
import { ConnectProviderModal } from "./ConnectProviderModal";
import { SelectPlantsModal } from "./SelectPlantsModal";
import { PlantsTable } from "./PlantsTable";
import { PlantsMap } from "./PlantsMap";
import { cn } from "@/lib/utils";

type TabFilter = "all" | "active" | "inactive";

const POPULAR_IDS = ["solarman_business_api", "solaredge", "solis_cloud", "growatt"];

export default function MonitoringPage() {
  const queryClient = useQueryClient();
  const [connectProvider, setConnectProvider] = useState<ProviderDefinition | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TabFilter>("all");

  const [selectPlantsData, setSelectPlantsData] = useState<{
    provider: ProviderDefinition;
    plants: DiscoveredPlant[];
  } | null>(null);
  const [syncingSelection, setSyncingSelection] = useState(false);

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

  const discoverMutation = useMutation({
    mutationFn: (provider: string) => discoverPlants(provider),
    onSuccess: (result, providerId) => {
      if (result.success && result.plants && result.plants.length > 0) {
        const prov = PROVIDER_REGISTRY.find((p) => p.id === providerId);
        if (prov) setSelectPlantsData({ provider: prov, plants: result.plants });
      } else if (result.success && (!result.plants || result.plants.length === 0)) {
        toast.info("Nenhuma usina encontrada nesta conta.");
      } else {
        toast.error(result.error || "Erro ao buscar usinas");
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const syncMutation = useMutation({
    mutationFn: ({ provider, selectedIds }: { provider: string; selectedIds?: string[] }) =>
      syncProvider(provider, "full", selectedIds),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`Sincronização concluída: ${result.plants_synced} usinas, ${result.metrics_synced} métricas`);
      } else {
        toast.error(result.error || "Erro na sincronização");
      }
      queryClient.invalidateQueries({ queryKey: ["monitoring-integrations"] });
      queryClient.invalidateQueries({ queryKey: ["monitoring-plants"] });
      queryClient.invalidateQueries({ queryKey: ["monitoring-metrics-today"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleConnectSuccess = (providerId: string) => {
    queryClient.invalidateQueries({ queryKey: ["monitoring-integrations"] });
    setConnectProvider(null);
    discoverMutation.mutate(providerId);
  };

  const handlePlantSelectionConfirm = (selectedIds: string[]) => {
    if (!selectPlantsData) return;
    const providerId = selectPlantsData.provider.id;
    const providerLabel = selectPlantsData.provider.label;
    setSelectPlantsData(null);
    toast.promise(
      syncMutation.mutateAsync({ provider: providerId, selectedIds }),
      {
        loading: `Importando ${selectedIds.length} usina(s) de ${providerLabel}…`,
        success: (result) => result.success ? `${result.plants_synced} usinas e ${result.metrics_synced} métricas importadas!` : result.error || "Erro na importação",
        error: (err: Error) => err.message,
      }
    );
  };

  const handleSyncClick = (providerId: string) => {
    const providerPlants = plants.filter((p) => p.provider === providerId);
    if (providerPlants.length > 0) {
      syncMutation.mutate({ provider: providerId });
    } else {
      discoverMutation.mutate(providerId);
    }
  };

  const hasConnected = integrations.some((i) => i.status === "connected");
  const totalCapacity = plants.reduce((sum, p) => sum + (p.capacity_kw || 0), 0);
  const totalEnergyToday = metrics.reduce((sum, m) => sum + (m.energy_kwh || 0), 0);
  const totalEnergyAll = metrics.reduce((sum, m) => sum + (m.total_energy_kwh || 0), 0);
  const onlinePlants = plants.filter((p) => p.status === "normal").length;
  const plantsWithCoords = plants.filter((p) => p.latitude != null && p.longitude != null);

  const filteredProviders = PROVIDER_REGISTRY.filter((prov) => {
    const matchSearch = !search || prov.label.toLowerCase().includes(search.toLowerCase()) || prov.description.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    const integration = integrations.find((i) => resolveProviderId(i.provider) === prov.id);
    const isActive = integration && (integration.status === "connected" || integration.status === "connected_pending");
    switch (tab) {
      case "active": return isActive;
      case "inactive": return !isActive;
      default: return true;
    }
  });

  const activeProviders = filteredProviders.filter((prov) => {
    const integration = integrations.find((i) => resolveProviderId(i.provider) === prov.id);
    return integration && (integration.status === "connected" || integration.status === "connected_pending");
  });
  const inactiveProviders = filteredProviders.filter((prov) => !activeProviders.includes(prov));

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

      {/* Providers */}
      <SectionCard title="Provedores" icon={Plug}>
        <div className="space-y-5">
          {/* Search + Tabs */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Pesquisar provedor…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
            </div>
            <div className="flex bg-muted rounded-lg p-0.5">
              {([["all", "Todas"], ["active", "Ativas"], ["inactive", "Disponíveis"]] as [TabFilter, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                    tab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Active providers */}
          {activeProviders.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center h-5 w-5 rounded-full bg-success/15">
                  <CheckCircle2 className="h-3 w-3 text-success" />
                </div>
                <span className="text-xs font-semibold text-foreground">Conectadas</span>
                <Badge variant="secondary" className="text-2xs">{activeProviders.length}</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeProviders.map((prov) => {
                  const integration = integrations.find((i) => resolveProviderId(i.provider) === prov.id);
                   const isDiscovering = discoverMutation.isPending && discoverMutation.variables === prov.id;
                   const provPlants = plants.filter((p) => resolveProviderId(p.provider) === prov.id);

                  return (
                    <div key={prov.id} className="relative border border-border rounded-xl bg-card p-5 space-y-4 shadow-sm hover:shadow-md transition-shadow">
                      <div className="absolute top-3 right-3">
                        <div className="h-2.5 w-2.5 rounded-full bg-success ring-2 ring-success/20" />
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                          <Sun className="h-5 w-5 text-secondary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-foreground truncate">{prov.label}</p>
                            {prov.status === "active" && (
                              <Badge className="text-2xs bg-success/15 text-success border-success/30">Produção</Badge>
                            )}
                            {prov.status === "beta" && (
                              <Badge className="text-2xs bg-warning/15 text-warning border-warning/30">Beta</Badge>
                            )}
                          </div>
                          <p className="text-2xs text-muted-foreground truncate">{prov.description}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs">
                        {provPlants.length > 0 && (
                          <div className="flex items-center gap-1.5 text-foreground font-medium">
                            <Sun className="h-3.5 w-3.5 text-warning" />
                            <span>{provPlants.length} usina{provPlants.length !== 1 ? "s" : ""}</span>
                          </div>
                        )}
                        {integration?.last_sync_at && (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{new Date(integration.last_sync_at).toLocaleDateString("pt-BR")}</span>
                          </div>
                        )}
                      </div>

                      {integration?.sync_error && (
                        <p className="text-2xs text-destructive flex items-center gap-1 truncate">
                          <AlertCircle className="h-3 w-3 shrink-0" />
                          {integration.sync_error}
                        </p>
                      )}

                      <div className="flex gap-2 pt-1">
                        {(prov.status === "active" || prov.status === "beta") && (
                          <Button size="sm" variant="outline" onClick={() => handleSyncClick(prov.id)} disabled={syncMutation.isPending || isDiscovering} className="flex-1 h-8">
                            <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", (syncMutation.isPending || isDiscovering) && "animate-spin")} />
                            {isDiscovering ? "Buscando…" : "Sincronizar"}
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setConnectProvider(prov)} className="h-8 text-muted-foreground hover:text-foreground">
                          Reconectar
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Inactive providers */}
          {inactiveProviders.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center h-5 w-5 rounded-full bg-muted">
                  <Plug className="h-3 w-3 text-muted-foreground" />
                </div>
                <span className="text-xs font-semibold text-muted-foreground">Disponíveis</span>
                <Badge variant="outline" className="text-2xs">{inactiveProviders.length}</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {inactiveProviders.map((prov) => (
                  <div
                    key={prov.id}
                    className={cn(
                      "border rounded-xl p-4 space-y-3 transition-all",
                      (prov.status === "coming_soon" || prov.status === "stub")
                        ? "border-border/30 bg-muted/20"
                        : "border-border/50 bg-card/50 hover:bg-card hover:border-border hover:shadow-sm",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-muted/60 flex items-center justify-center">
                        <Sun className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                     <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground/80 truncate">{prov.label}</p>
                          {prov.status === "active" && (
                            <Badge className="text-2xs bg-success/15 text-success border-success/30">Produção</Badge>
                          )}
                          {prov.status === "beta" && (
                            <Badge className="text-2xs bg-warning/15 text-warning border-warning/30">Beta</Badge>
                          )}
                          {(prov.status === "stub" || prov.status === "coming_soon") && (
                            <Badge variant="outline" className="text-2xs border-border/50 text-muted-foreground">Planejado</Badge>
                          )}
                        </div>
                        <p className="text-2xs text-muted-foreground line-clamp-1 mt-0.5">{prov.description}</p>
                      </div>
                    </div>
                    <div>
                      {(prov.status === "stub" || prov.status === "coming_soon") ? (
                        <Button size="sm" variant="ghost" disabled className="w-full h-8 text-muted-foreground cursor-not-allowed opacity-60">
                          <Info className="h-3.5 w-3.5 mr-1.5" />
                          API ainda não implementada
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setConnectProvider(prov)} className="w-full h-8">
                          <Plug className="h-3.5 w-3.5 mr-1.5" />
                          Conectar
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {filteredProviders.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">Nenhuma integração encontrada.</div>
          )}
        </div>
      </SectionCard>

      {/* Map */}
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

      {/* Plants */}
      {hasConnected ? (
        loadingPlants ? (
          <LoadingState message="Carregando usinas..." />
        ) : plants.length === 0 ? (
          <EmptyState icon={Sun} title="Nenhuma usina importada" description='Clique em "Sincronizar" no provedor conectado para selecionar e importar as usinas.' />
        ) : (
          <SectionCard title={`Usinas (${plants.length})`} icon={Sun}>
            <PlantsTable plants={plants} metrics={metrics} />
          </SectionCard>
        )
      ) : (
        <EmptyState icon={Plug} title="Conecte um provedor" description="Conecte sua conta de monitoramento para importar e acompanhar suas usinas solares." />
      )}

      {connectProvider && (
        <ConnectProviderModal
          open={!!connectProvider}
          onOpenChange={(open) => { if (!open) setConnectProvider(null); }}
          provider={connectProvider}
          onSuccess={() => handleConnectSuccess(connectProvider.id)}
        />
      )}

      {selectPlantsData && (
        <SelectPlantsModal
          open={!!selectPlantsData}
          onOpenChange={(open) => { if (!open) setSelectPlantsData(null); }}
          plants={selectPlantsData.plants}
          providerLabel={selectPlantsData.provider.label}
          saving={syncingSelection}
          onConfirm={handlePlantSelectionConfirm}
        />
      )}
    </div>
  );
}
