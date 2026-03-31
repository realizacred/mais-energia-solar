import { AiFollowupSettingsPanel } from "@/components/admin/AiFollowupSettingsPanel";
import { FollowupAnalyticsDashboard } from "@/components/admin/FollowupAnalyticsDashboard";
import { AiProviderPanel } from "@/components/admin/AiProviderPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/ui-kit";
import { Settings, BarChart3, Brain, Bot } from "lucide-react";

export default function AiConfigPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        icon={Brain}
        title="Configuração de IA"
        description="Modelo, temperatura, limites e gate inteligente de follow-up"
      />

      <Tabs defaultValue="provider" className="w-full">
        <TabsList className="overflow-x-auto flex-wrap h-auto">
          <TabsTrigger value="provider" className="gap-1.5 shrink-0 whitespace-nowrap">
            <Bot className="h-4 w-4" />
            Provedor & Consumo
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5 shrink-0 whitespace-nowrap">
            <Settings className="h-4 w-4" />
            Follow-up IA
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1.5 shrink-0 whitespace-nowrap">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="provider" className="mt-4">
          <AiProviderPanel />
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <AiFollowupSettingsPanel />
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <FollowupAnalyticsDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
