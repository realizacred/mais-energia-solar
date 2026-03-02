import React, { useState, useMemo, useRef, useEffect, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Search, Plug, Sun, Users, HardDrive,
  Calendar, Mail, MessageCircle, Video, CreditCard, ReceiptText, Globe,
  Workflow, FileSignature, Zap, CloudSun, Sprout, Cpu, Gauge, Radio,
  Building2, Calculator, QrCode, Webhook, LayoutGrid, Power, ArrowLeft,
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
import { IntegrationProviderCard } from "./IntegrationProviderCard";
import { IntegrationProviderDrawer } from "./IntegrationProviderDrawer";
import { cn } from "@/lib/utils";

/**
 * Providers that have dedicated configuration components.
 * Rendered inline inside the catalog instead of navigating away.
 */
const DEDICATED_COMPONENTS: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
  whatsapp_evolution: lazy(() => import("@/components/admin/WaInstancesManager").then(m => ({ default: m.WaInstancesManager }))),
  meta_facebook: lazy(() => import("@/pages/admin/MetaFacebookConfigPage")),
  instagram_api: lazy(() => import("@/components/admin/InstagramConfig").then(m => ({ default: m.InstagramConfig }))),
  google_calendar: lazy(() => import("@/components/admin/integrations/IntegrationsPage")),
  webhooks_generic: lazy(() => import("@/components/admin/WebhookManager")),
  asaas: lazy(() => import("@/components/admin/settings/PaymentGatewayConfig").then(m => ({ default: m.PaymentGatewayConfig }))),
  public_api: lazy(() => import("@/pages/admin/OpenAIConfigPage")),
};

const CANONICAL_TO_LEGACY: Record<string, string> = Object.fromEntries(
  Object.entries(LEGACY_ID_MAP).map(([legacy, canonical]) => [canonical, legacy])
);

const ICON_MAP: Record<string, React.ElementType> = {
  Sun, Zap, CloudSun, Sprout, Cpu, Gauge, Radio, Users, Building2,
  HardDrive, Calendar, Mail, MessageCircle, Video, CreditCard, ReceiptText,
  Globe, Workflow, FileSignature, Calculator, QrCode, Webhook,
  Plug, LayoutGrid, Power,
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
  const [drawerProvider, setDrawerProvider] = useState<IntegrationProvider | null>(null);
  const [inlineProviderId, setInlineProviderId] = useState<string | null>(null);

  /** Open dedicated inline view or generic drawer */
  const handleConfigure = (provider: IntegrationProvider) => {
    if (DEDICATED_COMPONENTS[provider.id]) {
      setInlineProviderId(provider.id);
    } else {
      setDrawerProvider(provider);
    }
  };

  const handleBackToCatalog = () => setInlineProviderId(null);

  const { data: dbProviders = [], isLoading: loadingProviders } = useQuery({
    queryKey: ["integration-providers"],
    queryFn: listProviders,
  });

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

  if (loadingProviders) return <LoadingState message="Carregando integrações..." />;

  const totalFiltered = Object.values(categoryCounts).reduce((a, b) => a + b, 0);
  const connectedCount = providers.filter(p => getConnectionStatus(p.id) === "connected").length;

  // ── Inline dedicated view ──
  const InlineComponent = inlineProviderId ? DEDICATED_COMPONENTS[inlineProviderId] : null;
  const inlineProvider = inlineProviderId ? providers.find(p => p.id === inlineProviderId) : null;

  if (InlineComponent && inlineProvider) {
    return (
      <div className="space-y-4 w-full max-w-none">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBackToCatalog}
          className="gap-2 text-muted-foreground hover:text-foreground -ml-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao catálogo
        </Button>
        <Suspense fallback={<LoadingState message={`Carregando ${inlineProvider.label}…`} />}>
          <InlineComponent />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-none">
      {/* ─── Header ─── */}
      <PageHeader
        title="Integrações"
        description={`Conecte inversores, monitoramento, CRM e serviços externos. ${connectedCount} integração(ões) ativa(s).`}
        icon={Plug}
      />

      {/* ─── Toolbar ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar integração…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 text-sm bg-card border-border"
          />
        </div>
        <div className="flex bg-muted rounded-xl p-1 gap-0.5">
          {([
            ["all", "Todas"],
            ["active", "Ativas"],
            ["inactive", "Disponíveis"],
          ] as [TabFilter, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-lg transition-all",
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

      {/* ─── Mobile category chips ─── */}
      <div className="lg:hidden">
        <ScrollArea className="w-full">
          <div className="flex gap-2 pb-4">
            <Button
              size="sm"
              variant={selectedCategory === "all" ? "default" : "outline"}
              onClick={() => setSelectedCategory("all")}
              className="text-xs shrink-0 h-8 rounded-full"
            >
              Todas
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat}
                size="sm"
                variant={selectedCategory === cat ? "default" : "outline"}
                onClick={() => setSelectedCategory(cat)}
                className="text-xs shrink-0 h-8 rounded-full"
              >
                {CATEGORY_LABELS[cat]}
              </Button>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="flex gap-6">
        {/* ─── Sidebar ─── */}
        <aside className="hidden lg:block w-56 shrink-0">
          <nav className="sticky top-24 space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-3 mb-3">
              Categorias
            </p>
            <SidebarItem
              icon={LayoutGrid}
              label="Todas"
              count={totalFiltered}
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

        {/* ─── Main Grid ─── */}
        <div className="flex-1 min-w-0">
          {filtered.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Nenhuma integração encontrada"
              description="Tente outro termo de busca ou filtro."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((provider) => (
                <IntegrationProviderCard
                  key={provider.id}
                  provider={provider}
                  connStatus={getConnectionStatus(provider.id)}
                  plantCount={getPlantCount(provider.id)}
                  lastSync={getLastSync(provider.id)}
                  onConfigure={() => handleConfigure(provider)}
                  onSync={() => {
                    setSyncingProviderId(provider.id);
                    const mapped = CANONICAL_TO_LEGACY[provider.id] || provider.id;
                    syncMut.mutate(mapped);
                  }}
                  onDisconnect={() => disconnectMut.mutate(provider.id)}
                  syncing={syncingProviderId === provider.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Drawer ─── */}
      {drawerProvider && (
        <IntegrationProviderDrawer
          key={drawerProvider.id}
          open={!!drawerProvider}
          onOpenChange={(open) => { if (!open) setDrawerProvider(null); }}
          provider={drawerProvider}
          connStatus={getConnectionStatus(drawerProvider.id)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["integration-connections"] });
            queryClient.invalidateQueries({ queryKey: ["monitoring-integrations"] });
            setDrawerProvider(null);
          }}
          onDisconnect={() => {
            disconnectMut.mutate(drawerProvider.id);
            setDrawerProvider(null);
          }}
          onSync={() => {
            setSyncingProviderId(drawerProvider.id);
            const mapped = CANONICAL_TO_LEGACY[drawerProvider.id] || drawerProvider.id;
            syncMut.mutate(mapped);
          }}
          syncing={syncingProviderId === drawerProvider.id}
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
        "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all text-left",
        active
          ? "bg-primary/10 text-primary font-semibold shadow-sm"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate flex-1">{label}</span>
      <span className={cn(
        "text-xs tabular-nums font-medium min-w-[1.25rem] text-center rounded-full px-1.5",
        active ? "bg-primary/20 text-primary" : "text-muted-foreground/50"
      )}>
        {count}
      </span>
    </button>
  );
}
