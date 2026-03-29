/**
 * Hook for testing proposal variables against real proposals.
 * §16: Queries only in hooks — NEVER in components
 * §23: staleTime obrigatório
 */
import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction } from "@/lib/edgeFunctionAuth";

const STALE_TIME = 1000 * 60 * 5;
const HISTORY_KEY = "variable-tester-history";
const MAX_HISTORY = 5;

export interface PropostaSearchResult {
  id: string;
  titulo: string;
  codigo: string;
  created_at: string;
  cliente_nome: string | null;
}

export interface TestResult {
  variableKey: string;
  value: string | null;
  status: "resolved" | "null" | "empty" | "not_found";
  propostaId: string;
  propostaTitulo: string;
  testedAt: string;
}

/** Search propostas_nativas for autocomplete */
export function usePropostaSearch(search: string) {
  return useQuery({
    queryKey: ["propostas-search", search],
    queryFn: async () => {
      let query = (supabase as any)
        .from("propostas_nativas")
        .select("id, titulo, codigo, created_at, clientes(nome)")
        .neq("status", "excluida")
        .order("created_at", { ascending: false })
        .limit(10);

      if (search.trim()) {
        query = query.or(
          `titulo.ilike.%${search}%,codigo.ilike.%${search}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((p: any) => ({
        id: p.id,
        titulo: p.titulo || "Sem título",
        codigo: p.codigo || "",
        created_at: p.created_at,
        cliente_nome: p.clientes?.nome || null,
      })) as PropostaSearchResult[];
    },
    staleTime: STALE_TIME,
    enabled: true,
  });
}

/** Test a variable against a real proposal via template-preview */
export function useVariableTester() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const testVariable = useCallback(
    async (propostaId: string, propostaTitulo: string, variableKey: string) => {
      setTesting(true);
      setError(null);
      setResult(null);

      try {
        // Normalize variable key — strip brackets/braces
        const cleanKey = variableKey
          .replace(/^\[|\]$/g, "")
          .replace(/^\{\{|\}\}$/g, "")
          .replace(/\./g, "_");

        // Call template-preview to resolve variables
        const data = await invokeEdgeFunction<any>("template-preview", {
          body: {
            proposta_id: propostaId,
            mode: "resolve_variables",
            variables: [cleanKey],
          },
          headers: { "x-client-timeout": "30" },
        });

        const resolvedVars = data?.resolved_variables || data?.variables || {};
        const value = resolvedVars[cleanKey] ?? null;

        let status: TestResult["status"] = "resolved";
        if (value === null || value === undefined) {
          status = "null";
        } else if (value === "") {
          status = "empty";
        }

        const testResult: TestResult = {
          variableKey: cleanKey,
          value: value !== null && value !== undefined ? String(value) : null,
          status,
          propostaId,
          propostaTitulo,
          testedAt: new Date().toISOString(),
        };

        setResult(testResult);
        addToHistory(testResult);
      } catch (e: any) {
        setError(e.message || "Erro ao testar variável");
      } finally {
        setTesting(false);
      }
    },
    []
  );

  return { testVariable, testing, result, error };
}

/** localStorage history helpers */
export function getTestHistory(): TestResult[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addToHistory(result: TestResult) {
  try {
    const history = getTestHistory();
    const updated = [result, ...history.filter((h) => h.variableKey !== result.variableKey || h.propostaId !== result.propostaId)].slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}
