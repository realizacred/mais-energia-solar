import { AiFollowupSettingsPanel } from "@/components/admin/AiFollowupSettingsPanel";
import { FollowupAnalyticsDashboard } from "@/components/admin/FollowupAnalyticsDashboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/ui-kit";
import { Settings, BarChart3, Brain } from "lucide-react";

export default function AiConfigPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        icon={Brain}
        title="Configuração de IA"
        description="Modelo, temperatura, limites e gate inteligente de follow-up"
      />

      <Tabs defaultValue="settings" className="w-full">
        <TabsList>
          <TabsTrigger value="settings" className="gap-1.5">
            <Settings className="h-4 w-4" />
            Configurações
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1.5">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

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
