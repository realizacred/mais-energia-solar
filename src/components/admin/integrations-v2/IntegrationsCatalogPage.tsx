import React, { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Search, Plug, RefreshCw, Info, Power, Sun, Users, HardDrive,
  Calendar, Mail, MessageCircle, Video, CreditCard, ReceiptText, Globe,
  Workflow, FileSignature, Zap, CloudSun, Sprout, Cpu, Gauge, Radio,
  Building2, Calculator, QrCode, Webhook, Instagram, Facebook, Bot,
  LayoutGrid, CheckCircle2, AlertCircle, Clock,
} from "lucide-react";
import {
  listProviders,
  listConnections,
  syncProvider,
  disconnectProvider,
} from "@/services/integrations/integrationService";
import {
  listIntegrations as listLegacyIntegrations,
} from "@/services/monitoring/monitorService";
import type { IntegrationProvider, IntegrationCategory, ConnectionStatus } from "@/services/integrations/types";
import { CATEGORY_LABELS, CATEGORY_ICONS } from "@/services/integrations/types";
import { PROVIDER_REGISTRY, toIntegrationProvider, LEGACY_ID_MAP } from "@/services/monitoring/providerRegistry";
import { IntegrationConnectModal } from "./IntegrationConnectModal";
import { cn } from "@/lib/utils";

// Reverse LEGACY_ID_MAP: canonical → legacy (for looking up legacy monitoring_integrations)
const CANONICAL_TO_LEGACY: Record<string, string> = Object.fromEntries(
  Object.entries(LEGACY_ID_MAP).map(([legacy, canonical]) => [canonical, legacy])
);

const ICON_MAP: Record<string, React.ElementType> = {
  Sun, Zap, CloudSun, Sprout, Cpu, Gauge, Radio, Users, Building2,
  HardDrive, Calendar, Mail, MessageCircle, Video, CreditCard, ReceiptText,
  Globe, Workflow, FileSignature, Calculator, QrCode, Webhook, Instagram,
  Facebook, Bot, Plug, Info, SunDim: Sun, LayoutGrid,
};

function getIcon(key: string | null): React.ElementType {
  return (key && ICON_MAP[key]) || Plug;
}

type TabFilter = "all" | "active" | "inactive";

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

  const { data: dbProviders = [], isLoading: loadingProviders } = useQuery({
    queryKey: ["integration-providers"],
    queryFn: listProviders,
  });

  // SSOT: DB providers (non-monitoring) + PROVIDER_REGISTRY (monitoring)
  const providers = useMemo(() => {
    const nonMonitoring = dbProviders.filter((p) => p.category !== "monitoring");
    const monitoringFromRegistry = PROVIDER_REGISTRY.map(toIntegrationProvider);
    return [...nonMonitoring, ...monitoringFromRegistry];
  }, [dbProviders]);

  const { data: connections = [] } = useQuery({
    queryKey: ["integration-connections"],
    queryFn: listConnections,
  });

  const { data: legacyIntegrations = [] } = useQuery({
    queryKey: ["monitoring-integrations"],
    queryFn: listLegacyIntegrations,
  });

  const { data: plantCounts = {} } = useQuery({
    queryKey: ["integration-plant-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("solar_plants" as any).select("integration_id");
      const counts: Record<string, number> = {};
      ((data as any[]) || []).forEach((p) => {
        if (p.integration_id) counts[p.integration_id] = (counts[p.integration_id] || 0) + 1;
      });
      return counts;
    },
  });

  const getPlantCount = (providerId: string): number => {
    const legacyId = CANONICAL_TO_LEGACY[providerId] || providerId;
    const integration = legacyIntegrations.find((i) => i.provider === legacyId || i.provider === providerId);
    if (integration) return plantCounts[integration.id] || 0;
    return 0;
  };

  const [syncingProviderId, setSyncingProviderId] = useState<string | null>(null);

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
    onSettled: () => setSyncingProviderId(null),
  });

  const disconnectMut = useMutation({
    mutationFn: (providerId: string) => disconnectProvider(providerId),
    onSuccess: () => {
      toast.success("Integração desconectada");
      queryClient.invalidateQueries({ queryKey: ["integration-connections"] });
      queryClient.invalidateQueries({ queryKey: ["monitoring-integrations"] });
    },
  });

  const getConnectionStatus = (providerId: string): ConnectionStatus => {
    const conn = connections.find((c) => c.provider_id === providerId);
    if (conn) return conn.status as ConnectionStatus;
    const legacyId = CANONICAL_TO_LEGACY[providerId];
    if (legacyId) {
      const legacy = legacyIntegrations.find((i) => i.provider === legacyId);
      if (legacy) return legacy.status as ConnectionStatus;
    }
    // Also check by providerId directly in legacy integrations
    const directLegacy = legacyIntegrations.find((i) => i.provider === providerId);
    if (directLegacy) return directLegacy.status as ConnectionStatus;
    return "disconnected";
  };

  const getLastSync = (providerId: string): string | null => {
    const conn = connections.find((c) => c.provider_id === providerId);
    if (conn?.last_sync_at) return conn.last_sync_at;
    const legacyId = CANONICAL_TO_LEGACY[providerId];
    if (legacyId) {
      const legacy = legacyIntegrations.find((i) => i.provider === legacyId);
      if (legacy?.last_sync_at) return legacy.last_sync_at;
    }
    const directLegacy = legacyIntegrations.find((i) => i.provider === providerId);
    if (directLegacy?.last_sync_at) return directLegacy.last_sync_at;
    return null;
  };

  const categories = useMemo(() => {
    const cats = new Set(providers.map((p) => p.category));
    return CATEGORY_ORDER.filter((c) => cats.has(c));
  }, [providers]);

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
        default: return true;
      }
    });
  }, [providers, search, tab, selectedCategory, connections, legacyIntegrations]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    providers.forEach((p) => {
      const q = search.toLowerCase();
      const matchSearch = !q || p.label.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
      if (!matchSearch) return;
      const status = getConnectionStatus(p.id);
      const isActive = status === "connected";
      let passTab = true;
      switch (tab) {
        case "active": passTab = isActive; break;
        case "inactive": passTab = !isActive; break;
      }
      if (passTab) {
        counts[p.category] = (counts[p.category] || 0) + 1;
      }
    });
    return counts;
  }, [providers, search, tab, connections, legacyIntegrations]);

  const activeProviders = filtered.filter((p) => getConnectionStatus(p.id) === "connected");
  const inactiveProviders = filtered.filter((p) => getConnectionStatus(p.id) !== "connected");

  if (loadingProviders) return <LoadingState message="Carregando integrações..." />;

  const renderCard = (provider: IntegrationProvider) => {
    const connStatus = getConnectionStatus(provider.id);
    return (
      <ProviderCard
        key={provider.id}
        provider={provider}
        connStatus={connStatus}
        plantCount={getPlantCount(provider.id)}
        lastSync={getLastSync(provider.id)}
        onConnect={() => setConnectModal(provider)}
        onSync={() => {
          setSyncingProviderId(provider.id);
          const mapped = CANONICAL_TO_LEGACY[provider.id] || provider.id;
          syncMut.mutate(mapped);
        }}
        onDisconnect={() => disconnectMut.mutate(provider.id)}
        syncing={syncingProviderId === provider.id}
      />
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Integrações"
        description="Conecte suas ferramentas e serviços"
        icon={Plug}
        actions={
          <div className="flex gap-2 items-center">
            <div className="relative w-52">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <div className="flex bg-muted rounded-lg p-0.5">
              {([["all", "Todas"], ["active", "Ativas"], ["inactive", "Disponíveis"]] as [TabFilter, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                    tab === key
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <div className="flex gap-6">
        {/* Sidebar */}
        <aside className="hidden md:block w-52 shrink-0">
          <nav className="sticky top-24 space-y-0.5">
            <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-3">Categorias</p>
            <SidebarItem
              icon={LayoutGrid}
              label="Todas"
              count={Object.values(categoryCounts).reduce((a, b) => a + b, 0)}
              active={selectedCategory === "all"}
              onClick={() => setSelectedCategory("all")}
            />
            {categories.map((cat) => {
              const CatIcon = getIcon(CATEGORY_ICONS[cat]);
              return (
                <SidebarItem
                  key={cat}
                  icon={CatIcon}
                  label={CATEGORY_LABELS[cat]}
                  count={categoryCounts[cat] || 0}
                  active={selectedCategory === cat}
                  onClick={() => setSelectedCategory(cat)}
                />
              );
            })}
          </nav>
        </aside>

        {/* Mobile categories */}
        <div className="md:hidden w-full">
          <ScrollArea className="w-full">
            <div className="flex gap-1.5 pb-3">
              <Button size="sm" variant={selectedCategory === "all" ? "default" : "outline"} onClick={() => setSelectedCategory("all")} className="text-xs shrink-0">
                Todas
              </Button>
              {categories.map((cat) => (
                <Button key={cat} size="sm" variant={selectedCategory === cat ? "default" : "outline"} onClick={() => setSelectedCategory(cat)} className="text-xs shrink-0">
                  {CATEGORY_LABELS[cat]}
                </Button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-8">
          {/* Active section */}
          {activeProviders.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-success/15">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                </div>
                <h2 className="text-sm font-semibold text-foreground">
                  Conectadas
                </h2>
                <Badge variant="secondary" className="text-2xs">{activeProviders.length}</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {activeProviders.map(renderCard)}
              </div>
            </section>
          )}

          {/* Inactive section */}
          {inactiveProviders.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-muted">
                  <Plug className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <h2 className="text-sm font-semibold text-muted-foreground">
                  Disponíveis
                </h2>
                <Badge variant="outline" className="text-2xs">{inactiveProviders.length}</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {inactiveProviders.map(renderCard)}
              </div>
            </section>
          )}

          {filtered.length === 0 && (
            <EmptyState icon={Search} title="Nenhuma integração encontrada" description="Tente outro termo de busca ou filtro." />
          )}
        </div>
      </div>

      {connectModal && (
        <IntegrationConnectModal
          key={connectModal.id}
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

/* ─── Sidebar Item ─── */
function SidebarItem({ icon: Icon, label, count, active, onClick }: {
  icon: React.ElementType; label: string; count: number; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left",
        active
          ? "bg-secondary text-secondary-foreground font-medium shadow-sm"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate flex-1">{label}</span>
      <span className={cn("text-2xs tabular-nums font-medium", active ? "text-secondary-foreground/70" : "text-muted-foreground/50")}>
        {count}
      </span>
    </button>
  );
}

/* ─── Provider Card ─── */
function ProviderCard({ provider, connStatus, plantCount, lastSync, onConnect, onSync, onDisconnect, syncing }: {
  provider: IntegrationProvider; connStatus: ConnectionStatus; plantCount: number;
  lastSync: string | null; onConnect: () => void; onSync: () => void;
  onDisconnect: () => void; syncing: boolean;
}) {
  const Icon = getIcon(provider.logo_key);
  const isConnected = connStatus === "connected";
  const hasSyncCapability = provider.capabilities?.sync_plants || provider.capabilities?.sync_deals;
  const isComingSoon = provider.status === "coming_soon";
  const isMaintenance = provider.status === "maintenance";
  // For monitoring providers from the registry: detect real status via capabilities
  const isMonitoring = provider.category === "monitoring";
  const isMonitoringStub = isMonitoring && !provider.capabilities?.sync_plants;
  const isMonitoringActive = isMonitoring && provider.capabilities?.sync_plants && provider.capabilities?.sync_health;
  const isMonitoringBeta = isMonitoring && provider.capabilities?.sync_plants && !provider.capabilities?.sync_health;

  if (isConnected) {
    return (
      <div className="relative border border-border rounded-xl bg-card p-5 space-y-4 shadow-sm hover:shadow-md transition-shadow">
        {/* Status dot */}
        <div className="absolute top-3 right-3">
          <div className="h-2.5 w-2.5 rounded-full bg-success ring-2 ring-success/20" />
        </div>

        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-secondary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-secondary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate">{provider.label}</p>
            <p className="text-2xs text-muted-foreground truncate">{CATEGORY_LABELS[provider.category]}</p>
          </div>
        </div>

        {/* Metrics */}
        <div className="flex items-center gap-4 text-xs">
          {plantCount > 0 && (
            <div className="flex items-center gap-1.5 text-foreground font-medium">
              <Sun className="h-3.5 w-3.5 text-warning" />
              <span>{plantCount} usina{plantCount !== 1 ? "s" : ""}</span>
            </div>
          )}
          {lastSync && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{new Date(lastSync).toLocaleDateString("pt-BR")} {new Date(lastSync).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          {hasSyncCapability && (
            <Button size="sm" variant="outline" onClick={onSync} disabled={syncing} className="flex-1 h-8">
              <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", syncing && "animate-spin")} />
              Sincronizar
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onConnect} className="h-8 text-muted-foreground hover:text-foreground">
            Reconectar
          </Button>
        </div>
      </div>
    );
  }

  // Inactive / Disconnected card
  return (
    <div className={cn(
      "border rounded-xl p-4 space-y-3 transition-all",
      isComingSoon || isMaintenance || isMonitoringStub
        ? "border-border/30 bg-muted/20"
        : "border-border/50 bg-card/50 hover:bg-card hover:border-border hover:shadow-sm",
    )}>
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-muted/60 flex items-center justify-center">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-foreground/80 truncate">{provider.label}</p>
            {isMonitoringActive && (
              <Badge className="text-2xs bg-success/15 text-success border-success/30">Produção</Badge>
            )}
            {isMonitoringBeta && (
              <Badge className="text-2xs bg-warning/15 text-warning border-warning/30">Beta</Badge>
            )}
            {isMonitoringStub && (
              <Badge variant="outline" className="text-2xs border-border/50 text-muted-foreground">Planejado</Badge>
            )}
            {!isMonitoring && isComingSoon && <Badge variant="outline" className="text-2xs border-border/50 text-muted-foreground">Em breve</Badge>}
            {isMaintenance && (
              <Badge variant="outline" className="text-2xs border-warning/30 text-warning">
                <AlertCircle className="h-3 w-3 mr-0.5" />
                Manutenção
              </Badge>
            )}
          </div>
          <p className="text-2xs text-muted-foreground line-clamp-1 mt-0.5">{provider.description}</p>
        </div>
      </div>

      <div>
        {isMonitoringStub ? (
          <Button size="sm" variant="ghost" disabled className="w-full h-8 text-muted-foreground cursor-not-allowed opacity-60">
            <Info className="h-3.5 w-3.5 mr-1.5" />
            API ainda não implementada
          </Button>
        ) : isComingSoon ? (
          <Button size="sm" variant="ghost" onClick={onConnect} className="w-full h-8 text-muted-foreground hover:text-foreground">
            <Info className="h-3.5 w-3.5 mr-1.5" />
            Ver tutorial
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={onConnect} className="w-full h-8">
            <Plug className="h-3.5 w-3.5 mr-1.5" />
            Conectar
          </Button>
        )}
      </div>
    </div>
  );
}
