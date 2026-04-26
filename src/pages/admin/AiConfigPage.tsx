import { AiFollowupSettingsPanel } from "@/components/admin/AiFollowupSettingsPanel";
import { FollowupAnalyticsDashboard } from "@/components/admin/FollowupAnalyticsDashboard";
import { AiProviderPanel } from "@/components/admin/AiProviderPanel";
import { FunnelHealthPanel } from "@/components/admin/ai/FunnelHealthPanel";
import { FunnelRolesPanel } from "@/components/admin/ai/FunnelRolesPanel";
import { FunnelRulesPanel } from "@/components/admin/ai/FunnelRulesPanel";
import { AiFeaturesPanel } from "@/components/admin/ai/AiFeaturesPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/ui-kit";
import { Settings, BarChart3, Brain, Bot, Activity, GitBranch, Sparkles, Scale } from "lucide-react";

export default function AiConfigPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        icon={Brain}
        title="Configuração de IA"
        description="Modelo, limites, coerência de funis e gate inteligente de follow-up"
      />

      <Tabs defaultValue="provider" className="w-full">
        <TabsList className="overflow-x-auto flex-wrap h-auto">
          <TabsTrigger value="provider" className="gap-1.5 shrink-0 whitespace-nowrap">
            <Bot className="h-4 w-4" />
            Provedor & Consumo
          </TabsTrigger>
          <TabsTrigger value="features" className="gap-1.5 shrink-0 whitespace-nowrap">
            <Sparkles className="h-4 w-4" />
            Recursos de IA
          </TabsTrigger>
          <TabsTrigger value="health" className="gap-1.5 shrink-0 whitespace-nowrap">
            <Activity className="h-4 w-4" />
            Saúde dos Funis
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-1.5 shrink-0 whitespace-nowrap">
            <GitBranch className="h-4 w-4" />
            Papéis dos Funis
          </TabsTrigger>
          <TabsTrigger value="rules" className="gap-1.5 shrink-0 whitespace-nowrap">
            <Scale className="h-4 w-4" />
            Regras de Coerência
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

        <TabsContent value="features" className="mt-4">
          <AiFeaturesPanel />
        </TabsContent>

        <TabsContent value="health" className="mt-4">
          <FunnelHealthPanel />
        </TabsContent>

        <TabsContent value="roles" className="mt-4">
          <FunnelRolesPanel />
        </TabsContent>

        <TabsContent value="rules" className="mt-4">
          <FunnelRulesPanel />
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
