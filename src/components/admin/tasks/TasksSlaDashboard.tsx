import { useState } from "react";
import { ClipboardCheck, BarChart3, Settings } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TasksManager } from "./TasksManager";
import { SlaDashboard } from "./SlaDashboard";
import { SlaRulesManager } from "./SlaRulesManager";

export function TasksSlaDashboard() {
  const [activeTab, setActiveTab] = useState("tasks");

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
          <ClipboardCheck className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Tarefas & SLA</h1>
          <p className="text-sm text-muted-foreground">Gestão operacional com prazos e escalonamento</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full h-12 bg-muted/50 p-1 rounded-xl grid grid-cols-3 gap-1">
          <TabsTrigger value="tasks" className="flex items-center gap-2 rounded-lg text-xs sm:text-sm font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <ClipboardCheck className="h-4 w-4 text-primary" />
            <span className="hidden sm:inline">Tarefas</span>
          </TabsTrigger>
          <TabsTrigger value="sla" className="flex items-center gap-2 rounded-lg text-xs sm:text-sm font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <BarChart3 className="h-4 w-4 text-info" />
            <span className="hidden sm:inline">Dashboard SLA</span>
          </TabsTrigger>
          <TabsTrigger value="rules" className="flex items-center gap-2 rounded-lg text-xs sm:text-sm font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <Settings className="h-4 w-4 text-secondary" />
            <span className="hidden sm:inline">Regras SLA</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-4">
          <TasksManager />
        </TabsContent>
        <TabsContent value="sla" className="mt-4">
          <SlaDashboard />
        </TabsContent>
        <TabsContent value="rules" className="mt-4">
          <SlaRulesManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
