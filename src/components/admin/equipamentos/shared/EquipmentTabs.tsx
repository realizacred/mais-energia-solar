/**
 * Wrapper que embute Cadastro + Auditoria em abas horizontais.
 * Usado por Inversores, Módulos, Baterias e Otimizadores.
 * Mantém URL sincronizada via querystring `?tab=cadastro|auditoria`.
 */
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Package, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

interface Props {
  cadastro: ReactNode;
  auditoria: ReactNode;
  defaultTab?: "cadastro" | "auditoria";
}

export function EquipmentTabs({ cadastro, auditoria, defaultTab = "cadastro" }: Props) {
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as "cadastro" | "auditoria") || defaultTab;

  const setTab = (v: string) => {
    const next = new URLSearchParams(params);
    if (v === "cadastro") next.delete("tab"); else next.set("tab", v);
    setParams(next, { replace: true });
  };

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-4">
      <TabsList>
        <TabsTrigger value="cadastro" className="gap-2"><Package className="w-4 h-4" /> Cadastro</TabsTrigger>
        <TabsTrigger value="auditoria" className="gap-2"><ShieldCheck className="w-4 h-4" /> Auditoria</TabsTrigger>
      </TabsList>
      <TabsContent value="cadastro" className="mt-4">{cadastro}</TabsContent>
      <TabsContent value="auditoria" className="mt-4">{auditoria}</TabsContent>
    </Tabs>
  );
}
