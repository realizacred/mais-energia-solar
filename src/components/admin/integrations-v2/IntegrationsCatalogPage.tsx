import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Search, Plug, RefreshCw, Info, Settings, Power, Sun, Users, HardDrive,
  Calendar, Mail, MessageCircle, Video, CreditCard, ReceiptText, Globe,
  Workflow, FileSignature, Zap, CloudSun, Sprout, Cpu, Gauge, Radio,
  Building2, Calculator, QrCode, Webhook, Instagram, Facebook, Bot,
} from "lucide-react";
import {
  listProviders,
  listConnections,
  connectProvider,
  syncProvider,
  disconnectProvider,
} from "@/services/integrations/integrationService";
import {
  listIntegrations as listLegacyIntegrations,
} from "@/services/monitoring/monitoringService";
import type { IntegrationProvider, IntegrationCategory, ConnectionStatus } from "@/services/integrations/types";
import { CATEGORY_LABELS } from "@/services/integrations/types";
import { IntegrationConnectModal } from "./IntegrationConnectModal";

// Icon resolver
const ICON_MAP: Record<string, React.ElementType> = {
  Sun, Zap, CloudSun, Sprout, Cpu, Gauge, Radio, Users, Building2,
  HardDrive, Calendar, Mail, MessageCircle, Video, CreditCard, ReceiptText,
  Globe, Workflow, FileSignature, Calculator, QrCode, Webhook, Instagram,
  Facebook, Bot, Settings, Plug, Info, SunDim: Sun,
};

function getIcon(key: string | null): React.ElementType {
  return (key && ICON_MAP[key]) || Plug;
}

type TabFilter = "all" | "active" | "inactive" | "popular";

const CATEGORY_ORDER: IntegrationCategory[] = [
  "monitoring", "crm", "billing", "messaging", "calendar", "email",
  "storage", "meetings", "nf", "api", "automation", "signature",
];

export default function IntegrationsCatalogPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TabFilter>("all");
  const [selectedCategory, setSelectedCategory] = useState<IntegrationCategory | "all">("all");
  const [connectModal, setConnectModal] = useState<IntegrationProvider | null>(null);

  const { data: providers = [], isLoading: loadingProviders } = useQuery({
    queryKey: ["integration-providers"],
    queryFn: listProviders,
  });

  const { data: connections = [] } = useQuery({
    queryKey: ["integration-connections"],
    queryFn: listConnections,
  });

  // Also load legacy monitoring_integrations for backward compat
  const { data: legacyIntegrations = [] } = useQuery({
    queryKey: ["monitoring-integrations"],
    queryFn: listLegacyIntegrations,
  });

  const syncMut = useMutation({
    mutationFn: (providerId: string) => syncProvider(providerId),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`Sincronizado: ${result.plants_synced ?? 0} usinas, ${result.metrics_synced ?? 0} métricas`);
      } else {
        toast.error(result.error || "Erro na sincronização");
      }
      queryClient.invalidateQueries({ queryKey: ["integration-connections"] });
      queryClient.invalidateQueries({ queryKey: ["monitoring-integrations"] });
      queryClient.invalidateQueries({ queryKey: ["monitoring-plants"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disconnectMut = useMutation({
    mutationFn: (providerId: string) => disconnectProvider(providerId),
    onSuccess: () => {
      toast.success("Integração desconectada");
      queryClient.invalidateQueries({ queryKey: ["integration-connections"] });
      queryClient.invalidateQueries({ queryKey: ["monitoring-integrations"] });
    },
  });

  // Resolve connection status for a provider
  const getConnectionStatus = (providerId: string): ConnectionStatus => {
    const conn = connections.find((c) => c.provider_id === providerId);
    if (conn) return conn.status as ConnectionStatus;
    // Fallback to legacy monitoring_integrations
    const legacyMap: Record<string, string> = {
      solarman_business: "solarman_business_api",
      solaredge: "solaredge",
      solis_cloud: "solis_cloud",
    };
    const legacyId = legacyMap[providerId];
    if (legacyId) {
      const legacy = legacyIntegrations.find((i) => i.provider === legacyId);
      if (legacy) return legacy.status as ConnectionStatus;
    }
    return "disconnected";
  };

  const getLastSync = (providerId: string): string | null => {
    const conn = connections.find((c) => c.provider_id === providerId);
    if (conn?.last_sync_at) return conn.last_sync_at;
    const legacyMap: Record<string, string> = {
      solarman_business: "solarman_business_api",
      solaredge: "solaredge",
      solis_cloud: "solis_cloud",
    };
    const legacyId = legacyMap[providerId];
    if (legacyId) {
      const legacy = legacyIntegrations.find((i) => i.provider === legacyId);
      if (legacy?.last_sync_at) return legacy.last_sync_at;
    }
    return null;
  };

  // Categories that exist in data
  const categories = useMemo(() => {
    const cats = new Set(providers.map((p) => p.category));
    return CATEGORY_ORDER.filter((c) => cats.has(c));
  }, [providers]);

  // Filter
  const filtered = useMemo(() => {
    return providers.filter((p) => {
      const q = search.toLowerCase();
      const matchSearch = !q || p.label.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
      if (!matchSearch) return false;

      if (selectedCategory !== "all" && p.category !== selectedCategory) return false;

      const status = getConnectionStatus(p.id);
      const isActive = status === "connected";
      switch (tab) {
        case "active": return isActive;
        case "inactive": return !isActive;
        case "popular": return p.popularity >= 70;
        default: return true;
      }
    });
  }, [providers, search, tab, selectedCategory, connections, legacyIntegrations]);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, IntegrationProvider[]>();
    for (const p of filtered) {
      const list = map.get(p.category) || [];
      list.push(p);
      map.set(p.category, list);
    }
    return map;
  }, [filtered]);

  if (loadingProviders) return <LoadingState message="Carregando integrações..." />;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Integrações"
        description="Conecte suas ferramentas e serviços ao sistema"
        icon={Plug}
      />

      {/* Search + Tabs */}
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
        <div className="flex gap-1 flex-wrap">
          {([["all", "Todas"], ["active", "Ativas"], ["inactive", "Inativas"], ["popular", "Populares"]] as [TabFilter, string][]).map(([key, label]) => (
            <Button key={key} size="sm" variant={tab === key ? "default" : "outline"} onClick={() => setTab(key)} className="text-xs">
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Category pills */}
      <div className="flex gap-2 flex-wrap">
        <Button
          size="sm"
          variant={selectedCategory === "all" ? "default" : "ghost"}
          onClick={() => setSelectedCategory("all")}
          className="text-xs h-7"
        >
          Todas
        </Button>
        {categories.map((cat) => (
          <Button
            key={cat}
            size="sm"
            variant={selectedCategory === cat ? "default" : "ghost"}
            onClick={() => setSelectedCategory(cat)}
            className="text-xs h-7"
          >
            {CATEGORY_LABELS[cat]}
          </Button>
        ))}
      </div>

      {/* Provider cards grouped by category */}
      {CATEGORY_ORDER.filter((cat) => grouped.has(cat)).map((cat) => (
        <SectionCard key={cat} title={CATEGORY_LABELS[cat]} icon={Plug}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {grouped.get(cat)!.map((provider) => {
              const connStatus = getConnectionStatus(provider.id);
              const lastSync = getLastSync(provider.id);
              const Icon = getIcon(provider.logo_key);
              const isConnected = connStatus === "connected";
              const hasSyncCapability = provider.capabilities?.sync_plants || provider.capabilities?.sync_deals;
              const isComingSoon = provider.status === "coming_soon";
              const isMaintenance = provider.status === "maintenance";

              // Map provider_id to legacy provider string for sync
              const legacySyncMap: Record<string, string> = {
                solarman_business: "solarman_business_api",
                solaredge: "solaredge",
                solis_cloud: "solis_cloud",
              };

              return (
                <div key={provider.id} className="border border-border rounded-lg p-4 space-y-3 bg-card">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5 text-primary" />
                      <span className="font-semibold text-sm">{provider.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isComingSoon && <Badge variant="outline" className="text-2xs">Em breve</Badge>}
                      {isMaintenance && <Badge variant="destructive" className="text-2xs">Manutenção</Badge>}
                      {!isComingSoon && !isMaintenance && (
                        <StatusBadge
                          status={
                            connStatus === "connected" ? "Conectado"
                              : connStatus === "error" ? "Erro"
                              : "Desconectado"
                          }
                        />
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{provider.description}</p>

                  {lastSync && (
                    <p className="text-2xs text-muted-foreground">
                      Última sync: {new Date(lastSync).toLocaleString("pt-BR")}
                    </p>
                  )}

                  <div className="flex gap-2 flex-wrap">
                    {isComingSoon ? (
                      <Button size="sm" variant="outline" onClick={() => setConnectModal(provider)}>
                        <Info className="h-3.5 w-3.5 mr-1" />
                        Ver tutorial
                      </Button>
                    ) : connStatus === "disconnected" || connStatus === "error" ? (
                      <Button size="sm" onClick={() => setConnectModal(provider)}>
                        <Plug className="h-3.5 w-3.5 mr-1" />
                        Conectar
                      </Button>
                    ) : (
                      <>
                        {hasSyncCapability && legacySyncMap[provider.id] && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => syncMut.mutate(legacySyncMap[provider.id])}
                            disabled={syncMut.isPending}
                          >
                            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${syncMut.isPending ? "animate-spin" : ""}`} />
                            Sincronizar
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setConnectModal(provider)}>
                          <Settings className="h-3.5 w-3.5 mr-1" />
                          Gerenciar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => disconnectMut.mutate(provider.id)}
                          disabled={disconnectMut.isPending}
                        >
                          <Power className="h-3.5 w-3.5 mr-1" />
                          Desconectar
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      ))}

      {filtered.length === 0 && (
        <EmptyState
          icon={Search}
          title="Nenhuma integração encontrada"
          description="Tente outro termo de busca ou filtro."
        />
      )}

      {/* Connect Modal */}
      {connectModal && (
        <IntegrationConnectModal
          open={!!connectModal}
          onOpenChange={(open) => { if (!open) setConnectModal(null); }}
          provider={connectModal}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["integration-connections"] });
            queryClient.invalidateQueries({ queryKey: ["monitoring-integrations"] });
            setConnectModal(null);
          }}
        />
      )}
    </div>
  );
}
