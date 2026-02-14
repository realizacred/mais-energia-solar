import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings2, DollarSign, Building2, FileText, Variable, Sliders } from "lucide-react";
import { PremissasTecnicasTab } from "./tabs/PremissasTecnicasTab";
import { PrecificacaoTab } from "./tabs/PrecificacaoTab";
import { FinanciamentosTab } from "./tabs/FinanciamentosTab";
import { TemplatesTab } from "./tabs/TemplatesTab";
import { VariaveisTab } from "./tabs/VariaveisTab";

const TABS = [
  { value: "premissas", label: "Premissas", icon: Settings2 },
  { value: "precificacao", label: "Precificação", icon: DollarSign },
  { value: "financiamentos", label: "Financiamentos", icon: Building2 },
  { value: "templates", label: "Templates", icon: FileText },
  { value: "variaveis", label: "Variáveis", icon: Variable },
] as const;

export function ConfSolarPage() {
  const [tab, setTab] = useState("premissas");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Sliders className="h-5 w-5 text-primary" />
          Configurações Solar
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Premissas técnicas, regras de precificação, financiamentos, templates e variáveis.
        </p>
      </div>

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

        <TabsContent value="premissas" className="mt-4">
          <PremissasTecnicasTab />
        </TabsContent>
        <TabsContent value="precificacao" className="mt-4">
          <PrecificacaoTab />
        </TabsContent>
        <TabsContent value="financiamentos" className="mt-4">
          <FinanciamentosTab />
        </TabsContent>
        <TabsContent value="templates" className="mt-4">
          <TemplatesTab />
        </TabsContent>
        <TabsContent value="variaveis" className="mt-4">
          <VariaveisTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
