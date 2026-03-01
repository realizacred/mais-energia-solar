import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { StatCard } from "@/components/ui-kit/StatCard";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Sun, Plug, RefreshCw, Zap, Activity, Battery } from "lucide-react";
import { toast } from "sonner";
import { PROVIDER_REGISTRY, type MonitoringProvider } from "@/services/monitoring/types";
import {
  listIntegrations,
  listPlants,
  getTodayMetrics,
  syncProvider,
} from "@/services/monitoring/monitoringService";
import { ConnectSolarmanModal } from "./ConnectSolarmanModal";
import { PlantsTable } from "./PlantsTable";

export default function MonitoringPage() {
  const queryClient = useQueryClient();
  const [connectModalOpen, setConnectModalOpen] = useState(false);

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
    mutationFn: (provider: MonitoringProvider) => syncProvider(provider, "full"),
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

  const solarmanIntegration = integrations.find((i) => i.provider === "solarman_business");
  const isConnected = solarmanIntegration?.status === "connected";

  // Aggregate stats
  const totalCapacity = plants.reduce((sum, p) => sum + (p.capacity_kw || 0), 0);
  const totalEnergyToday = metrics.reduce((sum, m) => sum + (m.energy_kwh || 0), 0);
  const totalEnergyAll = metrics.reduce((sum, m) => sum + (m.total_energy_kwh || 0), 0);
  const onlinePlants = plants.filter((p) => p.status === "normal").length;

  if (loadingInt) return <LoadingState message="Carregando integrações..." />;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Monitoramento Solar"
        description="Monitore suas usinas fotovoltaicas em tempo real"
        icon={Sun}
      />

      {/* Provider cards */}
      <SectionCard title="Provedores" icon={Plug}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PROVIDER_REGISTRY.map((prov) => {
            const integration = integrations.find((i) => i.provider === prov.id);
            const status = integration?.status || "disconnected";

            return (
              <div
                key={prov.id}
                className="border border-border rounded-lg p-4 space-y-3 bg-card"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sun className="h-5 w-5 text-warning" />
                    <span className="font-semibold text-sm">{prov.label}</span>
                  </div>
                  <StatusBadge
                    status={
                      status === "connected"
                        ? "Conectado"
                        : status === "error"
                        ? "Erro"
                        : "Desconectado"
                    }
                  />
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

                <div className="flex gap-2">
                  {!prov.available ? (
                    <Button size="sm" variant="outline" disabled>
                      Em breve
                    </Button>
                  ) : status === "disconnected" ? (
                    <Button size="sm" onClick={() => setConnectModalOpen(true)}>
                      <Plug className="h-3.5 w-3.5 mr-1" />
                      Conectar
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => syncMutation.mutate(prov.id)}
                        disabled={syncMutation.isPending}
                      >
                        <RefreshCw
                          className={`h-3.5 w-3.5 mr-1 ${syncMutation.isPending ? "animate-spin" : ""}`}
                        />
                        Sincronizar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConnectModalOpen(true)}
                      >
                        Gerenciar
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Dashboard stats */}
      {isConnected && plants.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Potência Instalada"
            value={`${totalCapacity.toFixed(1)} kW`}
            icon={Zap}
          />
          <StatCard
            label="Produção Hoje"
            value={`${totalEnergyToday.toFixed(1)} kWh`}
            icon={Activity}
          />
          <StatCard
            label="Produção Total"
            value={`${(totalEnergyAll / 1000).toFixed(1)} MWh`}
            icon={Battery}
          />
          <StatCard
            label="Usinas Online"
            value={`${onlinePlants}/${plants.length}`}
            icon={Sun}
          />
        </div>
      )}

      {/* Plants table or empty state */}
      {isConnected ? (
        loadingPlants ? (
          <LoadingState message="Carregando usinas..." />
        ) : plants.length === 0 ? (
          <EmptyState
            icon={Sun}
            title="Nenhuma usina importada"
            description='Clique em "Sincronizar" para importar as usinas do Solarman.'
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
          description="Conecte sua conta Solarman Business para importar e monitorar suas usinas."
        />
      )}

      <ConnectSolarmanModal
        open={connectModalOpen}
        onOpenChange={setConnectModalOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["monitoring-integrations"] });
        }}
      />
    </div>
  );
}
