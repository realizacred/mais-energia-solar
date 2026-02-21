import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Brain, AlertTriangle, ClipboardList, FileBarChart, Sparkles } from "lucide-react";
import { DirectorOverview } from "./DirectorOverview";
import { DirectorAlerts } from "./DirectorAlerts";
import { DirectorActionPlan } from "./DirectorActionPlan";
import { DirectorReports } from "./DirectorReports";
import { useAiInsights } from "@/hooks/useAiInsights";

const tabs = [
  { id: "overview", label: "Visão Geral", icon: Brain, color: "text-info" },
  { id: "alerts", label: "Alertas & Riscos", icon: AlertTriangle, color: "text-destructive" },
  { id: "actions", label: "Plano de Ação", icon: ClipboardList, color: "text-primary" },
  { id: "reports", label: "Relatórios", icon: FileBarChart, color: "text-success" },
] as const;

export function CommercialDirectorDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const insights = useAiInsights();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Diretor Comercial IA</h2>
          <p className="text-sm text-muted-foreground">
            Análise inteligente do seu CRM com recomendações acionáveis
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full h-12 bg-muted/50 p-1 rounded-xl grid grid-cols-4 gap-1">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="flex items-center gap-2 rounded-lg text-xs sm:text-sm font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-foreground transition-all"
            >
              <tab.icon className={cn("h-4 w-4", tab.color)} />
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <DirectorOverview insights={insights} />
        </TabsContent>
        <TabsContent value="alerts" className="mt-4">
          <DirectorAlerts insights={insights} />
        </TabsContent>
        <TabsContent value="actions" className="mt-4">
          <DirectorActionPlan insights={insights} />
        </TabsContent>
        <TabsContent value="reports" className="mt-4">
          <DirectorReports insights={insights} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
