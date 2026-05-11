import { useMemo, useState } from "react";
import { Layers, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { PreventiveScenarioCard } from "./PreventiveScenarioCard";
import type { PreventiveScenario } from "@/hooks/usePreventiveScenarios";

interface Props {
  scenarios: PreventiveScenario[];
}

const DOMAINS = [
  { value: "todos", label: "Todos" },
  { value: "comercial", label: "Comercial" },
  { value: "pos_venda", label: "Pós-Venda" },
  { value: "engenharia", label: "Engenharia" },
  { value: "financeiro", label: "Financeiro" },
] as const;

export function PreventiveScenarioCatalog({ scenarios }: Props) {
  const [tab, setTab] = useState<string>("todos");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return scenarios.filter((s) => {
      if (tab !== "todos" && s.dominio !== tab) return false;
      if (!term) return true;
      return (
        s.nome.toLowerCase().includes(term) ||
        (s.descricao ?? "").toLowerCase().includes(term) ||
        (s.gatilho ?? "").toLowerCase().includes(term)
      );
    });
  }, [scenarios, tab, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { todos: scenarios.length };
    for (const s of scenarios) c[s.dominio] = (c[s.dominio] ?? 0) + 1;
    return c;
  }, [scenarios]);

  return (
    <Card className="border border-border bg-card shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Layers className="h-4 w-4 text-primary" />
            </div>
            Cenários Preventivos
            <span className="text-xs font-normal text-muted-foreground tabular-nums">
              ({scenarios.length})
            </span>
          </CardTitle>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar cenário…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex flex-wrap h-auto">
            {DOMAINS.map((d) => (
              <TabsTrigger key={d.value} value={d.value} className="gap-1.5">
                {d.label}
                <span className="text-[10px] tabular-nums opacity-70">
                  {counts[d.value] ?? 0}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="Nenhum cenário encontrado"
            description="Configure regras em Comunicação → Regras de Follow-up ou em Pipeline → Automações para popular o catálogo."
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {filtered.map((s) => (
              <PreventiveScenarioCard key={`${s.executor}-${s.scenario_id}`} scenario={s} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
