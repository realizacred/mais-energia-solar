import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Plug, RefreshCw, Trash2, Wifi, WifiOff, Plus, ChevronDown } from "lucide-react";
import { listIntegrations, syncProvider, disconnectProvider } from "@/services/monitoring/monitorService";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { IntegrationPlantsList } from "./IntegrationPlantsList";

const PROVIDER_LABELS: Record<string, string> = {
  solarman: "Solarman",
  deye_cloud: "Deye Cloud",
  solis_cloud: "Solis Cloud",
  growatt: "Growatt",
  huawei_fusionsolar: "Huawei FusionSolar",
  huawei: "Huawei FusionSolar",
  solaredge: "SolarEdge",
  enphase: "Enphase",
  fronius: "Fronius",
  goodwe: "GoodWe",
  abb_fimer: "ABB / FIMER",
  canadian_solar: "Canadian Solar",
};

export default function MonitorSettings() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: integrations = [], isLoading } = useQuery({
    queryKey: ["monitor-integrations"],
    queryFn: listIntegrations,
  });

  const syncMutation = useMutation({
    mutationFn: (provider: string) => syncProvider(provider, "full"),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(`Sincronizado: ${res.plants_synced || 0} usinas, ${res.metrics_synced || 0} métricas`);
        queryClient.invalidateQueries({ queryKey: ["monitor"] });
      } else {
        toast.error(res.error || "Erro na sincronização");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disconnectMutation = useMutation({
    mutationFn: disconnectProvider,
    onSuccess: () => {
      toast.success("Integração desconectada");
      queryClient.invalidateQueries({ queryKey: ["monitor-integrations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <LoadingState message="Carregando integrações..." />;

  const activeIntegrations = integrations.filter((i: any) => i.status === "active" || i.status === "connected");
  const inactiveIntegrations = integrations.filter((i: any) => i.status !== "active" && i.status !== "connected");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrações de Monitoramento"
        description="Gerencie conexões com provedores de monitoramento solar"
        icon={Plug}
        actions={
          <Button size="sm" onClick={() => navigate("/admin/catalogo-integracoes")}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Conectar Provedor
          </Button>
        }
      />

      {integrations.length === 0 ? (
        <EmptyState
          icon={Plug}
          title="Nenhuma integração conectada"
          description="Conecte um provedor de monitoramento (Solarman, Deye, Solis, etc.) para importar usinas automaticamente."
          action={{
            label: "Conectar Provedor",
            onClick: () => navigate("/admin/catalogo-integracoes"),
            icon: Plus,
          }}
        />
      ) : (
        <>
          {activeIntegrations.length > 0 && (
            <SectionCard title={`Conectados (${activeIntegrations.length})`} icon={Wifi}>
              <div className="space-y-2">
                {activeIntegrations.map((integration: any) => (
                  <IntegrationRow
                    key={integration.id}
                    integration={integration}
                    onSync={() => syncMutation.mutate(integration.provider)}
                    onDisconnect={() => disconnectMutation.mutate(integration.id)}
                    isSyncing={syncMutation.isPending}
                  />
                ))}
              </div>
            </SectionCard>
          )}

          {inactiveIntegrations.length > 0 && (
            <SectionCard title={`Desconectados (${inactiveIntegrations.length})`} icon={WifiOff} variant="warning">
              <div className="space-y-2">
                {inactiveIntegrations.map((integration: any) => (
                  <IntegrationRow
                    key={integration.id}
                    integration={integration}
                    onSync={() => syncMutation.mutate(integration.provider)}
                    onDisconnect={() => disconnectMutation.mutate(integration.id)}
                    isSyncing={syncMutation.isPending}
                  />
                ))}
              </div>
            </SectionCard>
          )}
        </>
      )}
    </div>
  );
}

function IntegrationRow({
  integration,
  onSync,
  onDisconnect,
  isSyncing,
}: {
  integration: any;
  onSync: () => void;
  onDisconnect: () => void;
  isSyncing: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isActive = integration.status === "active" || integration.status === "connected";
  const providerLabel = PROVIDER_LABELS[integration.provider] || integration.provider;

  return (
    <div className="rounded-xl border border-border/60 bg-card hover:shadow-sm transition-all">
      <div
        className="flex items-center justify-between gap-3 p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform", expanded && "rotate-180")} />
          <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", isActive ? "bg-success" : "bg-muted-foreground")} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{providerLabel}</p>
            <p className="text-xs text-muted-foreground">
              {integration.last_sync_at
                ? `Última sync ${formatDistanceToNow(new Date(integration.last_sync_at), { addSuffix: true, locale: ptBR })}`
                : "Nunca sincronizado"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <StatusBadge status={isActive ? "Conectado" : "Desconectado"} size="sm" />
          {isActive && (
            <Button size="sm" variant="outline" onClick={onSync} disabled={isSyncing} className="h-7 w-7 p-0">
              <RefreshCw className={cn("h-3.5 w-3.5", isSyncing && "animate-spin")} />
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onDisconnect} className="h-7 w-7 p-0 text-destructive hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4">
          <IntegrationPlantsList integrationId={integration.id} provider={integration.provider} />
        </div>
      )}
    </div>
  );
}
