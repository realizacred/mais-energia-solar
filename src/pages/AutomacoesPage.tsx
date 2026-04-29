/**
 * AutomacoesPage — Central de automações do CRM.
 * Abas: Pipeline | WhatsApp | Webhooks
 * §DS-01: text-xl font-bold. RB-06: LoadingState. RB-19: TabsList overflow.
 */
import { lazy, Suspense } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { Zap, Kanban, MessageCircle, Webhook, History } from "lucide-react";

const PipelineAutomations = lazy(() =>
  import("@/components/admin/pipeline/PipelineAutomations").then((m) => ({
    default: m.PipelineAutomations,
  }))
);

const WhatsAppAutomationTemplates = lazy(() =>
  import("@/components/admin/WhatsAppAutomationTemplates").then((m) => ({
    default: m.WhatsAppAutomationTemplates,
  }))
);

const WebhookManager = lazy(() =>
  import("@/components/admin/WebhookManager")
);

const AutomationHistoryPanel = lazy(() =>
  import("@/components/admin/automacoes/AutomationHistoryPanel").then((m) => ({
    default: m.AutomationHistoryPanel,
  }))
);

export default function AutomacoesPage() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header — §DS-03 */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
          <Zap className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Automações</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie regras automáticas de pipeline, mensagens e webhooks
          </p>
        </div>
      </div>

      {/* Tabs — RB-19 */}
      <Tabs defaultValue="pipeline" className="space-y-4">
        <TabsList className="overflow-x-auto flex-wrap h-auto">
          <TabsTrigger value="pipeline" className="gap-2 shrink-0 whitespace-nowrap">
            <Kanban className="h-4 w-4" />
            Funil
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-2 shrink-0 whitespace-nowrap">
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="gap-2 shrink-0 whitespace-nowrap">
            <Webhook className="h-4 w-4" />
            Webhooks
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-2 shrink-0 whitespace-nowrap">
            <History className="h-4 w-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="mt-0">
          <Suspense fallback={<LoadingState message="Carregando automações de funil..." />}>
            <PipelineAutomations />
          </Suspense>
        </TabsContent>

        <TabsContent value="whatsapp" className="mt-0">
          <Suspense fallback={<LoadingState message="Carregando automações WhatsApp..." />}>
            <WhatsAppAutomationTemplates />
          </Suspense>
        </TabsContent>

        <TabsContent value="webhooks" className="mt-0">
          <Suspense fallback={<LoadingState message="Carregando webhooks..." />}>
            <WebhookManager />
          </Suspense>
        </TabsContent>

        <TabsContent value="historico" className="mt-0">
          <Suspense fallback={<LoadingState message="Carregando histórico..." />}>
            <AutomationHistoryPanel />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
