import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PROVIDER_REGISTRY, toIntegrationProvider } from "@/services/monitoring/providerRegistry";
import { IntegrationProviderCard } from "@/components/admin/integrations-v2/IntegrationProviderCard";
import { IntegrationProviderDrawer } from "@/components/admin/integrations-v2/IntegrationProviderDrawer";
import type { IntegrationProvider, ConnectionStatus } from "@/services/integrations/types";

const sandboxQC = new QueryClient();

const MOCK_STATUSES: Record<string, ConnectionStatus> = {
  growatt: "connected",
  solis_cloud: "connected",
  huawei: "error",
};

export default function IntegrationsSandboxRoute() {
  const providers = PROVIDER_REGISTRY.slice(0, 16).map(toIntegrationProvider);
  const [drawerProvider, setDrawerProvider] = useState<IntegrationProvider | null>(null);

  if (!import.meta.env.DEV) return null;

  return (
    <QueryClientProvider client={sandboxQC}>
      <div className="min-h-screen bg-background p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">🧪 Integrations UI Sandbox</h1>
          <p className="text-sm text-muted-foreground">DEV only — mostra cards e drawer com dados mock.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {providers.map((p) => (
            <IntegrationProviderCard
              key={p.id}
              provider={p}
              connStatus={MOCK_STATUSES[p.id] || "disconnected"}
              plantCount={MOCK_STATUSES[p.id] === "connected" ? 5 : 0}
              lastSync={MOCK_STATUSES[p.id] === "connected" ? new Date().toISOString() : null}
              onConfigure={() => setDrawerProvider(p)}
              onSync={() => {}}
              onDisconnect={() => {}}
              syncing={false}
            />
          ))}
        </div>

        {drawerProvider && (
          <IntegrationProviderDrawer
            key={drawerProvider.id}
            open={!!drawerProvider}
            onOpenChange={(open) => { if (!open) setDrawerProvider(null); }}
            provider={drawerProvider}
            connStatus={MOCK_STATUSES[drawerProvider.id] || "disconnected"}
            onSuccess={() => setDrawerProvider(null)}
            onDisconnect={() => setDrawerProvider(null)}
            onSync={() => {}}
            syncing={false}
          />
        )}
      </div>
    </QueryClientProvider>
  );
}
