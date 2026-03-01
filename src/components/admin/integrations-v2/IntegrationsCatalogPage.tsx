import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Search, Plug, RefreshCw, Info, Settings, Power, Sun, Users, HardDrive,
  Calendar, Mail, MessageCircle, Video, CreditCard, ReceiptText, Globe,
  Workflow, FileSignature, Zap, CloudSun, Sprout, Cpu, Gauge, Radio,
  Building2, Calculator, QrCode, Webhook, Instagram, Facebook, Bot,
  LayoutGrid,
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
import { CATEGORY_LABELS, CATEGORY_ICONS } from "@/services/integrations/types";
import { IntegrationConnectModal } from "./IntegrationConnectModal";
import { cn } from "@/lib/utils";

// Icon resolver
const ICON_MAP: Record<string, React.ElementType> = {
  Sun, Zap, CloudSun, Sprout, Cpu, Gauge, Radio, Users, Building2,
  HardDrive, Calendar, Mail, MessageCircle, Video, CreditCard, ReceiptText,
  Globe, Workflow, FileSignature, Calculator, QrCode, Webhook, Instagram,
  Facebook, Bot, Settings, Plug, Info, SunDim: Sun, LayoutGrid,
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

  const getConnectionStatus = (providerId: string): ConnectionStatus => {
    const conn = connections.find((c) => c.provider_id === providerId);
    if (conn) return conn.status as ConnectionStatus;
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
        case "popular": return p.popularity >= 70;
        default: return true;
      }
    });
  }, [providers, search, tab, selectedCategory, connections, legacyIntegrations]);

  // Group by category for display
  const grouped = useMemo(() => {
    const map = new Map<string, IntegrationProvider[]>();
    for (const p of filtered) {
      const list = map.get(p.category) || [];
      list.push(p);
      map.set(p.category, list);
    }
    return map;
  }, [filtered]);

  // Count per category (unfiltered by category, but filtered by search/tab)
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
        case "popular": passTab = p.popularity >= 70; break;
      }
      if (passTab) {
        counts[p.category] = (counts[p.category] || 0) + 1;
      }
    });
    return counts;
  }, [providers, search, tab, connections, legacyIntegrations]);

  if (loadingProviders) return <LoadingState message="Carregando integrações..." />;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
      <PageHeader
        title="Todas as Integrações"
        description="Conecte suas ferramentas e serviços ao sistema"
        icon={Plug}
        actions={
          <div className="flex gap-3 items-center">
            <div className="relative w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar integração…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <div className="flex gap-1">
              {([["all", "Todas"], ["active", "Ativas"], ["inactive", "Inativas"], ["popular", "Mais populares"]] as [TabFilter, string][]).map(([key, label]) => (
                <Button key={key} size="sm" variant={tab === key ? "default" : "outline"} onClick={() => setTab(key)} className="text-xs">
                  {label}
                </Button>
              ))}
            </div>
          </div>
        }
      />

      {/* GDASH-style layout: sidebar + grid */}
      <div className="flex gap-6">
        {/* Category sidebar */}
        <aside className="hidden md:block w-56 shrink-0">
          <div className="sticky top-24 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">Categorias</p>
            <CategoryItem
              icon={LayoutGrid}
              label="Todas"
              count={Object.values(categoryCounts).reduce((a, b) => a + b, 0)}
              active={selectedCategory === "all"}
              onClick={() => setSelectedCategory("all")}
            />
            {categories.map((cat) => {
              const CatIcon = getIcon(CATEGORY_ICONS[cat]);
              return (
                <CategoryItem
                  key={cat}
                  icon={CatIcon}
                  label={CATEGORY_LABELS[cat]}
                  count={categoryCounts[cat] || 0}
                  active={selectedCategory === cat}
                  onClick={() => setSelectedCategory(cat)}
                />
              );
            })}
          </div>
        </aside>

        {/* Mobile category selector */}
        <div className="md:hidden w-full">
          <ScrollArea className="w-full">
            <div className="flex gap-1.5 pb-2">
              <Button
                size="sm"
                variant={selectedCategory === "all" ? "default" : "outline"}
                onClick={() => setSelectedCategory("all")}
                className="text-xs shrink-0"
              >
                Todas
              </Button>
              {categories.map((cat) => (
                <Button
                  key={cat}
                  size="sm"
                  variant={selectedCategory === cat ? "default" : "outline"}
                  onClick={() => setSelectedCategory(cat)}
                  className="text-xs shrink-0"
                >
                  {CATEGORY_LABELS[cat]}
                </Button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Main content — provider grid */}
        <div className="flex-1 min-w-0 space-y-8">
          {CATEGORY_ORDER.filter((cat) => grouped.has(cat)).map((cat) => {
            const CatIcon = getIcon(CATEGORY_ICONS[cat]);
            return (
              <section key={cat}>
                <div className="flex items-center gap-2 mb-4">
                  <CatIcon className="h-5 w-5 text-primary" />
                  <h2 className="text-base font-semibold text-foreground">{CATEGORY_LABELS[cat]}</h2>
                  <span className="text-xs text-muted-foreground">
                    {grouped.get(cat)!.length} {grouped.get(cat)!.length === 1 ? "integração" : "integrações"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {grouped.get(cat)!.map((provider) => (
                    <ProviderCard
                      key={provider.id}
                      provider={provider}
                      connStatus={getConnectionStatus(provider.id)}
                      lastSync={getLastSync(provider.id)}
                      onConnect={() => setConnectModal(provider)}
                      onSync={() => {
                        const legacySyncMap: Record<string, string> = {
                          solarman_business: "solarman_business_api",
                          solaredge: "solaredge",
                          solis_cloud: "solis_cloud",
                        };
                        syncMut.mutate(legacySyncMap[provider.id] || provider.id);
                      }}
                      onDisconnect={() => disconnectMut.mutate(provider.id)}
                      syncing={syncMut.isPending}
                    />
                  ))}
                </div>
              </section>
            );
          })}

          {filtered.length === 0 && (
            <EmptyState
              icon={Search}
              title="Nenhuma integração encontrada"
              description="Tente outro termo de busca ou filtro."
            />
          )}
        </div>
      </div>

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

/* ─── Category sidebar item ─── */

function CategoryItem({
  icon: Icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left",
        active
          ? "bg-primary text-primary-foreground font-medium"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate flex-1">{label}</span>
      <span className={cn(
        "text-xs tabular-nums",
        active ? "text-primary-foreground/70" : "text-muted-foreground/60"
      )}>
        {count}
      </span>
    </button>
  );
}

/* ─── Provider card ─── */

function ProviderCard({
  provider,
  connStatus,
  lastSync,
  onConnect,
  onSync,
  onDisconnect,
  syncing,
}: {
  provider: IntegrationProvider;
  connStatus: ConnectionStatus;
  lastSync: string | null;
  onConnect: () => void;
  onSync: () => void;
  onDisconnect: () => void;
  syncing: boolean;
}) {
  const Icon = getIcon(provider.logo_key);
  const isConnected = connStatus === "connected";
  const hasSyncCapability = provider.capabilities?.sync_plants || provider.capabilities?.sync_deals;
  const isComingSoon = provider.status === "coming_soon";
  const isMaintenance = provider.status === "maintenance";

  return (
    <div className="group border border-border rounded-xl p-4 bg-card hover:shadow-md hover:border-primary/20 transition-all space-y-3">
      {/* Header: icon + name */}
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate">{provider.label}</p>
          <p className="text-2xs text-muted-foreground line-clamp-2 mt-0.5">{provider.description}</p>
        </div>
      </div>

      {/* Status + last sync */}
      <div className="flex items-center justify-between">
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
              size="sm"
            />
          )}
        </div>
        {lastSync && (
          <span className="text-2xs text-muted-foreground">
            {new Date(lastSync).toLocaleDateString("pt-BR")}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap pt-1">
        {isComingSoon ? (
          <Button size="sm" variant="outline" onClick={onConnect} className="w-full">
            <Info className="h-3.5 w-3.5 mr-1" />
            Ver tutorial
          </Button>
        ) : connStatus === "disconnected" || connStatus === "error" ? (
          <Button size="sm" onClick={onConnect} className="w-full">
            <Plug className="h-3.5 w-3.5 mr-1" />
            Conectar
          </Button>
        ) : (
          <>
            {hasSyncCapability && (
              <Button size="sm" variant="outline" onClick={onSync} disabled={syncing} className="flex-1">
                <RefreshCw className={cn("h-3.5 w-3.5 mr-1", syncing && "animate-spin")} />
                Sync
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={onConnect}>
              <Settings className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={onDisconnect}>
              <Power className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
