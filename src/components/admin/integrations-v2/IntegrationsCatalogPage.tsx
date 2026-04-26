import React, { useState, useMemo, useRef, useEffect, lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { IntegrationTutorialSection } from "./IntegrationTutorialSection";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSolarPlantsCount } from "@/hooks/useSolarPlantsCount";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Search, Plug, Sun, Users, HardDrive, FileText,
  Calendar, Mail, MessageCircle, Video, CreditCard, ReceiptText, Globe,
  Workflow, FileSignature, Zap, CloudSun, Sprout, Cpu, Gauge, Radio,
  Building2, Calculator, QrCode, Webhook, LayoutGrid, Power, ArrowLeft,
  PackageSearch,
} from "lucide-react";
import {
  listProviders,
  listConnections,
  syncProvider,
  syncSupplierProvider,
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
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Wrench } from "lucide-react";

/** IDs of monitoring providers that are actually functional (connect + sync) */
const FUNCTIONAL_MONITORING_IDS = new Set([
  // Tier 1 — canonical adapters
  "solarman_business", "sofar", "solis_cloud", "fox_ess", "solax", "saj", "enphase",
  // Tier 2 — monolith production
  "solaredge", "deye_cloud", "growatt", "growatt_server", "hoymiles",
  "sungrow", "huawei", "goodwe", "fronius", "livoltek", "livoltek_cf",
  // Tier 3 — beta functional
  "shinemonitor", "apsystems", "kstar", "intelbras", "ecosolys",
]);

/**
 * Providers that have dedicated configuration components.
 * Rendered inline inside the catalog instead of navigating away.
 */
const DEDICATED_COMPONENTS: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
  // Evolution Clássica → mostra apenas instâncias api_flavor=classic e trava o seletor
  whatsapp_evolution: lazy(() =>
    import("@/components/admin/WaInstancesManager").then((m) => ({
      default: () => <m.WaInstancesManager apiFlavorFilter="classic" />,
    }))
  ),
  // Evolution GO → mostra apenas instâncias api_flavor=go e trava o seletor
  whatsapp_evolution_go: lazy(() =>
    import("@/components/admin/WaInstancesManager").then((m) => ({
      default: () => <m.WaInstancesManager apiFlavorFilter="go" />,
    }))
  ),
  meta_facebook: lazy(() => import("@/pages/admin/MetaFacebookConfigPage")),
  instagram_api: lazy(() => import("@/components/admin/InstagramConfig").then(m => ({ default: m.InstagramConfig }))),
  google_calendar: lazy(() => import("@/components/admin/integrations/IntegrationsPage")),
  google_contacts: lazy(() => import("@/components/admin/integrations/GoogleContactsCard").then(m => ({ default: m.GoogleContactsCard }))),
  webhooks_generic: lazy(() => import("@/components/admin/WebhookManager")),
  asaas: lazy(() => import("@/components/admin/settings/PaymentGatewayConfig").then(m => ({ default: m.PaymentGatewayConfig }))),
  public_api: lazy(() => import("@/pages/admin/OpenAIConfigPage")),
  tuya_iot: lazy(() => import("@/components/admin/integrations-api/ApisPage")),
  gotenberg: lazy(() => import("@/components/admin/integrations-v2/GotenbergConfigPanel")),
};

/* Tab-level lazy components */
const IntegrationHealthPage = lazy(() => import("@/components/admin/integrations/IntegrationHealthPage"));
const WebhookManagerTab = lazy(() => import("@/components/admin/WebhookManager"));
const WaInstancesManagerTab = lazy(() => import("@/components/admin/WaInstancesManager").then(m => ({ default: m.WaInstancesManager })));
const WhatsAppAutomationConfigTab = lazy(() => import("@/components/admin/WhatsAppAutomationConfig").then(m => ({ default: m.WhatsAppAutomationConfig })));
const IntegrationGuidesManagerTab = lazy(() => import("@/components/admin/integrations-v2/IntegrationGuidesManager"));

const CANONICAL_TO_LEGACY: Record<string, string> = Object.fromEntries(
  Object.entries(LEGACY_ID_MAP).map(([legacy, canonical]) => [canonical, legacy])
);

const ICON_MAP: Record<string, React.ElementType> = {
  Sun, Zap, CloudSun, Sprout, Cpu, Gauge, Radio, Users, Building2,
  HardDrive, Calendar, Mail, MessageCircle, Video, CreditCard, ReceiptText,
  Globe, Workflow, FileSignature, Calculator, QrCode, Webhook,
  Plug, LayoutGrid, Power, FileText, PackageSearch,
};

function getIcon(key: string | null): React.ElementType {
  return (key && ICON_MAP[key]) || Plug;
}

type TabFilter = "all" | "active" | "inactive";

const CATEGORY_ORDER: IntegrationCategory[] = [
  "monitoring", "crm", "billing", "messaging", "calendar", "email",
  "storage", "meetings", "nf", "api", "automation", "signature", "suppliers",
];

export default function IntegrationsCatalogPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get("tab") || "catalogo";
  const integrationParam = searchParams.get("integration");
  const actionParam = searchParams.get("action");

  const [search, setSearch] = useState("");
  const [tabFilter, setTabFilter] = useState<TabFilter>("all");
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

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  // Auto-open integration config from URL params (e.g. ?integration=meta_facebook&action=configure)
  const autoOpenDone = useRef(false);

  const { data: dbProviders = [], isLoading: loadingProviders } = useQuery({
    queryKey: ["integration-providers"],
    queryFn: listProviders,
  });

  const providers = useMemo(() => {
    const nonMonitoring = dbProviders.filter((p) => p.category !== "monitoring");
    const monitoringFromRegistry = PROVIDER_REGISTRY.map(toIntegrationProvider);
    
    const tuyaProvider: IntegrationProvider = {
      id: "tuya_iot",
      category: "api",
      label: "Tuya Smart (IoT)",
      description: "Plataforma IoT para medidores inteligentes",
      status: "available",
      auth_type: "oauth2",
      credential_schema: [],
      tutorial: { steps: [] },
      capabilities: {},
      platform_managed_keys: false,
      popularity: 100,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      logo_key: null,
    };
    
    return [...nonMonitoring, ...monitoringFromRegistry, tuyaProvider];
  }, [dbProviders]);

  const { data: connections = [] } = useQuery({
    queryKey: ["integration-connections"],
    queryFn: listConnections,
  });

  const { data: legacyIntegrations = [] } = useQuery({
    queryKey: ["monitoring-integrations"],
    queryFn: listLegacyIntegrations,
  });

  const { data: plantCounts = {} } = useSolarPlantsCount();

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

  const supplierSyncMut = useMutation({
    mutationFn: (provider: IntegrationProvider) => syncSupplierProvider(provider.id, provider.label),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`Fornecedor sincronizado: ${result.created ?? 0} criados, ${result.updated ?? 0} atualizados`);
      } else {
        toast.error(result.error || "Erro na sincronização do fornecedor");
      }
      queryClient.invalidateQueries({ queryKey: ["integration-connections"] });
      queryClient.invalidateQueries({ queryKey: ["integrations_api_configs"] });
      queryClient.invalidateQueries({ queryKey: ["solar-kit-catalog"] });
      queryClient.invalidateQueries({ queryKey: ["kits"] });
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setSyncingProviderId(null),
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

  const getSyncError = (providerId: string): string | null => {
    const conn = connections.find((c) => c.provider_id === providerId);
    if (conn?.sync_error) return conn.sync_error as string;
    const legacyId = CANONICAL_TO_LEGACY[providerId];
    if (legacyId) {
      const legacy = legacyIntegrations.find((i) => i.provider === legacyId);
      if (legacy?.sync_error) return legacy.sync_error;
    }
    const directLegacy = legacyIntegrations.find((i) => i.provider === providerId);
    if (directLegacy?.sync_error) return directLegacy.sync_error;
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
       switch (tabFilter) {
        case "active": return isActive;
        case "inactive": return !isActive;
        default: return true;
      }
    });
  }, [providers, search, tabFilter, selectedCategory, connections, legacyIntegrations]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    providers.forEach((p) => {
      const q = search.toLowerCase();
      const matchSearch = !q || p.label.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
      if (!matchSearch) return;
      const status = getConnectionStatus(p.id);
      const isActive = status === "connected";
      let passTab = true;
      switch (tabFilter) {
        case "active": passTab = isActive; break;
        case "inactive": passTab = !isActive; break;
      }
      if (passTab) {
        // For monitoring sidebar count, only count functional providers
        if (p.category === "monitoring" && !FUNCTIONAL_MONITORING_IDS.has(p.id)) {
          // Still count for "all" total but not for the monitoring category counter
          counts["_all_monitoring"] = (counts["_all_monitoring"] || 0) + 1;
        } else {
          counts[p.category] = (counts[p.category] || 0) + 1;
        }
      }
    });
    return counts;
  }, [providers, search, tabFilter, connections, legacyIntegrations]);

  // Auto-open integration config from URL params
  useEffect(() => {
    if (autoOpenDone.current || loadingProviders || !integrationParam || actionParam !== "configure") return;
    const provider = providers.find(p => p.id === integrationParam);
    if (provider) {
      autoOpenDone.current = true;
      handleConfigure(provider);
    }
  }, [loadingProviders, providers, integrationParam, actionParam]);

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
        {/* Tutorial from DB if available */}
        {inlineProvider.tutorial && (
          <IntegrationTutorialSection
            tutorial={inlineProvider.tutorial}
            providerLabel={inlineProvider.label}
          />
        )}
        <Suspense fallback={<LoadingState message={`Carregando ${inlineProvider.label}…`} />}>
          <InlineComponent />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-none">
      {/* ─── Header §26 ─── */}
      <PageHeader
        title="Integrações"
        description={`Conecte inversores, monitoramento, CRM e serviços externos. ${connectedCount} integração(ões) ativa(s).`}
        icon={Plug}
      />

      {/* ─── Main Tabs §29 ─── */}
      <Tabs value={urlTab} onValueChange={handleTabChange}>
        <TabsList className="bg-muted overflow-x-auto flex-wrap h-auto">
          <TabsTrigger className="shrink-0 whitespace-nowrap" value="catalogo">Catálogo</TabsTrigger>
          <TabsTrigger className="shrink-0 whitespace-nowrap" value="saude">Saúde</TabsTrigger>
          <TabsTrigger className="shrink-0 whitespace-nowrap" value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger className="shrink-0 whitespace-nowrap" value="instancias">Instâncias WA</TabsTrigger>
          <TabsTrigger className="shrink-0 whitespace-nowrap" value="automacao">Automação</TabsTrigger>
          <TabsTrigger className="shrink-0 whitespace-nowrap" value="tutoriais">Tutoriais</TabsTrigger>
        </TabsList>

        <TabsContent value="catalogo" className="mt-6 space-y-6">
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
                <Button
                  key={key}
                  variant="ghost"
                  size="sm"
                  onClick={() => setTabFilter(key)}
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-lg transition-all",
                    tabFilter === key
                      ? "bg-primary/10 text-primary shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                </Button>
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
                (() => {
                  const isMonitoringView = selectedCategory === "monitoring" || selectedCategory === "all";
                  const monitoringFunctional = filtered.filter(p => p.category === "monitoring" && FUNCTIONAL_MONITORING_IDS.has(p.id));
                  const monitoringStub = filtered.filter(p => p.category === "monitoring" && !FUNCTIONAL_MONITORING_IDS.has(p.id));
                  const nonMonitoring = filtered.filter(p => p.category !== "monitoring");

                  const renderCard = (provider: IntegrationProvider, isStubGroup = false) => (
                    <IntegrationProviderCard
                      key={provider.id}
                      provider={provider}
                      connStatus={getConnectionStatus(provider.id)}
                      plantCount={getPlantCount(provider.id)}
                      lastSync={getLastSync(provider.id)}
                      syncError={getSyncError(provider.id)}
                      onConfigure={() => !isStubGroup && handleConfigure(provider)}
                      onSync={() => {
                        setSyncingProviderId(provider.id);
                        if (provider.category === "suppliers") {
                          supplierSyncMut.mutate(provider);
                          return;
                        }
                        const mapped = CANONICAL_TO_LEGACY[provider.id] || provider.id;
                        syncMut.mutate(mapped);
                      }}
                      onDisconnect={() => disconnectMut.mutate(provider.id)}
                      syncing={syncingProviderId === provider.id}
                    />
                  );

                  return (
                    <div className="space-y-8">
                      {monitoringFunctional.length > 0 && (
                        <div>
                          {isMonitoringView && (monitoringFunctional.length > 0 || monitoringStub.length > 0) && (
                            <div className="flex items-center gap-2 mb-4">
                              <CheckCircle2 className="h-5 w-5 text-success" />
                              <h3 className="text-sm font-semibold text-foreground">Disponíveis agora</h3>
                              <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/20">
                                {monitoringFunctional.length}
                              </Badge>
                            </div>
                          )}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {monitoringFunctional.map(p => renderCard(p))}
                          </div>
                        </div>
                      )}
                      {nonMonitoring.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {nonMonitoring.map(p => renderCard(p))}
                        </div>
                      )}
                      {monitoringStub.length > 0 && isMonitoringView && (
                        <div>
                          <div className="flex items-center gap-2 mb-4">
                            <Wrench className="h-5 w-5 text-muted-foreground" />
                            <h3 className="text-sm font-semibold text-muted-foreground">Em implementação</h3>
                            <Badge variant="outline" className="text-[10px] text-muted-foreground border-border">
                              {monitoringStub.length}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 opacity-60">
                            {monitoringStub.map(p => renderCard(p, true))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="saude" className="mt-6">
          <Suspense fallback={<LoadingState message="Carregando saúde das integrações…" />}>
            <IntegrationHealthPage />
          </Suspense>
        </TabsContent>

        <TabsContent value="webhooks" className="mt-6">
          <Suspense fallback={<LoadingState message="Carregando webhooks…" />}>
            <WebhookManagerTab />
          </Suspense>
        </TabsContent>

        <TabsContent value="instancias" className="mt-6">
          <Suspense fallback={<LoadingState message="Carregando instâncias…" />}>
            <WaInstancesManagerTab />
          </Suspense>
        </TabsContent>

        <TabsContent value="automacao" className="mt-6">
          <Suspense fallback={<LoadingState message="Carregando automação…" />}>
            <WhatsAppAutomationConfigTab />
          </Suspense>
        </TabsContent>

        <TabsContent value="tutoriais" className="mt-6">
          <Suspense fallback={<LoadingState message="Carregando tutoriais…" />}>
            <IntegrationGuidesManagerTab />
          </Suspense>
        </TabsContent>
      </Tabs>

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
            if (drawerProvider.category === "suppliers") {
              supplierSyncMut.mutate(drawerProvider);
              return;
            }
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
    <Button
      variant="ghost"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all justify-start h-auto",
        active
          ? "bg-primary/10 text-primary font-semibold shadow-sm"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate flex-1">{label}</span>
      <span className={cn(
        "text-xs tabular-nums font-bold min-w-[20px] h-5 flex items-center justify-center rounded-full px-1.5",
        active ? "bg-background text-primary" : "bg-primary text-primary-foreground"
      )}>
        {count}
      </span>
    </Button>
  );
}
