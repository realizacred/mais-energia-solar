import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, Sun, LayoutGrid, SlidersHorizontal, Sliders, Landmark } from "lucide-react";
import { useTenantPremises } from "@/hooks/useTenantPremises";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { TabFinanceiras } from "./tabs/TabFinanceiras";
import { TabSistemaSolar } from "./tabs/TabSistemaSolar";
import { TabAreaTelhado } from "./tabs/TabAreaTelhado";
import { TabValoresPadroes } from "./tabs/TabValoresPadroes";
import { TabTributacao } from "./tabs/TabTributacao";
import { PremissasFooter } from "./PremissasFooter";
import { motion } from "framer-motion";

const TABS = [
  { value: "financeiras", label: "Financeiras", icon: DollarSign },
  { value: "sistema-solar", label: "Sistema solar", icon: Sun },
  { value: "area-telhado", label: "Dados técnicos do telhado", icon: LayoutGrid },
  { value: "valores-padroes", label: "Valores padrões", icon: SlidersHorizontal },
  { value: "tributacao", label: "Tributação", icon: Landmark },
] as const;

export function PremissasPage() {
  const [tab, setTab] = useState("financeiras");
  const ctx = useTenantPremises();

  if (ctx.loading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div>
            <Skeleton className="h-6 w-40 mb-1" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="p-4 md:p-6 space-y-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* §26 Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
          <Sliders className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Premissas</h1>
          <p className="text-sm text-muted-foreground">
            Parâmetros financeiros, técnicos, tributários e valores padrões para dimensionamento e propostas.
          </p>
        </div>
      </div>

      {/* §29 Tabs after header */}
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
        <TabsContent value="tributacao" className="mt-4">
          <TabTributacao />
        </TabsContent>
      </Tabs>

      {tab !== "area-telhado" && tab !== "tributacao" && (
        <PremissasFooter
          isDirty={ctx.isDirty}
          saving={ctx.saving}
          onSave={ctx.save}
          onCancel={ctx.reset}
        />
      )}
    </motion.div>
  );
}
