import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings2, DollarSign, Building2, Sliders, ArrowRight } from "lucide-react";
import { PremissasTecnicasTab } from "./tabs/PremissasTecnicasTab";
import { PrecificacaoTab } from "./tabs/PrecificacaoTab";
import { FinanciamentosTab } from "./tabs/FinanciamentosTab";
import { PageHeader } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const TABS = [
  { value: "premissas", label: "Premissas", icon: Settings2 },
  { value: "precificacao", label: "Precificação", icon: DollarSign },
  { value: "financiamentos", label: "Financiamentos", icon: Building2 },
] as const;

export function ConfSolarPage() {
  const [tab, setTab] = useState("premissas");
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Sliders}
        title="Configurações Solar"
        description="Premissas técnicas, regras de precificação e financiamentos."
      />

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
      </Tabs>

      {/* Links para áreas consolidadas */}
      <Card className="border-border/60 bg-muted/30">
        <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <p className="text-xs text-muted-foreground flex-1">
            Templates e variáveis de proposta foram consolidados no Editor de Proposta.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs shrink-0"
            onClick={() => navigate("/admin/proposta-comercial")}
          >
            Ver Templates & Variáveis <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
