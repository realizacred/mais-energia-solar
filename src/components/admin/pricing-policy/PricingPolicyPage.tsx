import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Layers, Percent, DollarSign, CreditCard } from "lucide-react";
import { CostComponentsTab } from "./tabs/CostComponentsTab";
import { InterestRatesTab } from "./tabs/InterestRatesTab";
import { MarginCommissionTab } from "./tabs/MarginCommissionTab";
import { PricingMethodTab } from "./tabs/PricingMethodTab";
import { PolicyVersionSelector } from "./PolicyVersionSelector";
import { usePricingPolicy } from "./hooks/usePricingPolicy";

const TABS = [
  { value: "interest", label: "Taxas de Juros", icon: CreditCard, global: true },
  { value: "costs", label: "Componentes de Custo", icon: Layers, global: false },
  { value: "margins", label: "Margens & Comissões", icon: Percent, global: false },
  { value: "method", label: "Método de Precificação", icon: DollarSign, global: false },
] as const;

export function PricingPolicyPage() {
  const [tab, setTab] = useState("interest");
  const policy = usePricingPolicy();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Política de Precificação</h1>
              <p className="text-sm text-muted-foreground">
                Regras financeiras versionadas que controlam o cálculo de propostas.
              </p>
            </div>
          </div>
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
        onDeleteVersion={policy.deleteVersion}
        onDeletePolicy={policy.deletePolicy}
        onSeedTemplate={policy.seedSolarTemplate}
        loading={policy.loading}
        activeVersionStatus={policy.activeVersionStatus}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full justify-start gap-1 bg-muted/50 p-1 rounded-xl flex-wrap">
          {TABS.filter((t) => t.global || policy.selectedVersionId).map((t) => {
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

        <TabsContent value="interest" className="mt-4">
          <InterestRatesTab />
        </TabsContent>

        {policy.selectedVersionId && (
          <>
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
          </>
        )}
      </Tabs>
    </div>
  );
}
