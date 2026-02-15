import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Layers, Percent, DollarSign } from "lucide-react";
import { CostComponentsTab } from "./tabs/CostComponentsTab";
import { MarginCommissionTab } from "./tabs/MarginCommissionTab";
import { PricingMethodTab } from "./tabs/PricingMethodTab";
import { PolicyVersionSelector } from "./PolicyVersionSelector";
import { usePricingPolicy } from "./hooks/usePricingPolicy";

const TABS = [
  { value: "costs", label: "Componentes de Custo", icon: Layers },
  { value: "margins", label: "Margens & Comissões", icon: Percent },
  { value: "method", label: "Método de Precificação", icon: DollarSign },
] as const;

export function PricingPolicyPage() {
  const [tab, setTab] = useState("costs");
  const policy = usePricingPolicy();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Política de Precificação
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Regras financeiras versionadas que controlam o cálculo de propostas.
          </p>
        </div>
      </div>

      <PolicyVersionSelector
        policies={policy.policies}
        versions={policy.versions}
        selectedPolicyId={policy.selectedPolicyId}
        selectedVersionId={policy.selectedVersionId}
        onPolicyChange={policy.setSelectedPolicyId}
        onVersionChange={policy.setSelectedVersionId}
        onCreatePolicy={policy.createPolicy}
        onCreateVersion={policy.createVersion}
        onPublishVersion={policy.publishVersion}
        onArchiveVersion={policy.archiveVersion}
        loading={policy.loading}
        activeVersionStatus={policy.activeVersionStatus}
      />

      {policy.selectedVersionId && (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full justify-start gap-1 bg-muted/50 p-1 rounded-xl flex-wrap">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  className="gap-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg px-3 py-2"
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="costs" className="mt-4">
            <CostComponentsTab
              versionId={policy.selectedVersionId}
              isReadOnly={policy.activeVersionStatus !== "draft"}
            />
          </TabsContent>
          <TabsContent value="margins" className="mt-4">
            <MarginCommissionTab />
          </TabsContent>
          <TabsContent value="method" className="mt-4">
            <PricingMethodTab
              versionId={policy.selectedVersionId}
              isReadOnly={policy.activeVersionStatus !== "draft"}
            />
          </TabsContent>
        </Tabs>
      )}

      {!policy.selectedVersionId && !policy.loading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
          Selecione ou crie uma política para configurar as regras de precificação.
        </div>
      )}
    </div>
  );
}
