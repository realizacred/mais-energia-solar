import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, Sun, LayoutGrid, SlidersHorizontal, Sliders } from "lucide-react";
import { useTenantPremises } from "@/hooks/useTenantPremises";
import { Loader2 } from "lucide-react";
import { TabFinanceiras } from "./tabs/TabFinanceiras";
import { TabSistemaSolar } from "./tabs/TabSistemaSolar";
import { TabAreaTelhado } from "./tabs/TabAreaTelhado";
import { TabValoresPadroes } from "./tabs/TabValoresPadroes";
import { PremissasFooter } from "./PremissasFooter";

const TABS = [
  { value: "financeiras", label: "Financeiras", icon: DollarSign },
  { value: "sistema-solar", label: "Sistema solar", icon: Sun },
  { value: "area-telhado", label: "Área útil por tipo de telhado", icon: LayoutGrid },
  { value: "valores-padroes", label: "Valores padrões", icon: SlidersHorizontal },
] as const;

export function PremissasPage() {
  const [tab, setTab] = useState("financeiras");
  const ctx = useTenantPremises();

  if (ctx.loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Sliders className="h-5 w-5 text-primary" />
          Premissas
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Parâmetros financeiros, técnicos e valores padrões para dimensionamento e propostas.
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

        <TabsContent value="financeiras" className="mt-4">
          <TabFinanceiras premises={ctx.premises} onChange={ctx.setPremises} />
        </TabsContent>
        <TabsContent value="sistema-solar" className="mt-4">
          <TabSistemaSolar premises={ctx.premises} onChange={ctx.setPremises} />
        </TabsContent>
        <TabsContent value="area-telhado" className="mt-4">
          <TabAreaTelhado
            roofFactors={ctx.roofFactors}
            onSave={ctx.saveRoofFactors}
            saving={ctx.saving}
          />
        </TabsContent>
        <TabsContent value="valores-padroes" className="mt-4">
          <TabValoresPadroes premises={ctx.premises} onChange={ctx.setPremises} onAutoSave={ctx.save} />
        </TabsContent>
      </Tabs>

      {tab !== "area-telhado" && (
        <PremissasFooter
          isDirty={ctx.isDirty}
          saving={ctx.saving}
          onSave={ctx.save}
          onCancel={ctx.reset}
        />
      )}
    </div>
  );
}
