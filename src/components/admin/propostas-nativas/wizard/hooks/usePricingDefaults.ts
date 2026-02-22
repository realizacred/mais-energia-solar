import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PricingDefault {
  margem_percentual: number | null;
  comissao_por_kwp: number | null;
  outros_por_kwp: number | null;
  instalacao_por_kwp: number | null;
}

/**
 * Loads median pricing per kWp from the tenant's proposal history.
 * Returns suggested values adjusted to the current system's potência.
 */
export function usePricingDefaults(potenciaKwp: number) {
  const [defaults, setDefaults] = useState<PricingDefault | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (potenciaKwp <= 0) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const { data, error } = await supabase
          .from("pricing_defaults_history")
          .select("categoria, valor_por_kwp, percentual")
          .order("created_at", { ascending: false })
          .limit(50);

        if (error || !data || data.length === 0) {
          setLoading(false);
          return;
        }

        // Group by category and compute median
        const grouped: Record<string, number[]> = {};
        const percentuals: Record<string, number[]> = {};
        
        for (const row of data) {
          const cat = row.categoria;
          if (!grouped[cat]) grouped[cat] = [];
          grouped[cat].push(Number(row.valor_por_kwp) || 0);
          
          if (row.percentual != null) {
            if (!percentuals[cat]) percentuals[cat] = [];
            percentuals[cat].push(Number(row.percentual));
          }
        }

        const median = (arr: number[]): number => {
          if (arr.length === 0) return 0;
          const sorted = [...arr].sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
        };

        setDefaults({
          margem_percentual: percentuals["kit_margem"]
            ? median(percentuals["kit_margem"])
            : null,
          comissao_por_kwp: grouped["comissao"]
            ? median(grouped["comissao"])
            : null,
          outros_por_kwp: grouped["outros"]
            ? median(grouped["outros"])
            : null,
          instalacao_por_kwp: grouped["instalacao"]
            ? median(grouped["instalacao"])
            : null,
        });
      } catch (e) {
        console.error("Error loading pricing defaults:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [potenciaKwp]);

  // Return computed values for the current kWp
  const suggested = defaults
    ? {
        margem_percentual: defaults.margem_percentual,
        custo_comissao: defaults.comissao_por_kwp != null
          ? Math.round(defaults.comissao_por_kwp * potenciaKwp * 100) / 100
          : null,
        custo_outros: defaults.outros_por_kwp != null
          ? Math.round(defaults.outros_por_kwp * potenciaKwp * 100) / 100
          : null,
        custo_instalacao: defaults.instalacao_por_kwp != null
          ? Math.round(defaults.instalacao_por_kwp * potenciaKwp * 100) / 100
          : null,
      }
    : null;

  return { suggested, loading, hasHistory: defaults !== null };
}

/**
 * Saves pricing data to history for future smart defaults.
 */
export async function savePricingHistory(params: {
  potenciaKwp: number;
  margemPercentual: number;
  custoComissao: number;
  custoOutros: number;
  custoInstalacao: number;
  propostaId?: string;
}) {
  const { potenciaKwp, margemPercentual, custoComissao, custoOutros, custoInstalacao, propostaId } = params;
  if (potenciaKwp <= 0) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id, user_id")
    .single();

  if (!profile?.tenant_id) return;

  const rows = [
    {
      tenant_id: profile.tenant_id,
      proposta_id: propostaId || null,
      categoria: "kit_margem",
      potencia_kwp: potenciaKwp,
      valor_total: 0,
      valor_por_kwp: 0,
      percentual: margemPercentual,
      created_by: profile.user_id,
    },
    {
      tenant_id: profile.tenant_id,
      proposta_id: propostaId || null,
      categoria: "comissao",
      potencia_kwp: potenciaKwp,
      valor_total: custoComissao,
      valor_por_kwp: potenciaKwp > 0 ? custoComissao / potenciaKwp : 0,
      percentual: null,
      created_by: profile.user_id,
    },
    {
      tenant_id: profile.tenant_id,
      proposta_id: propostaId || null,
      categoria: "outros",
      potencia_kwp: potenciaKwp,
      valor_total: custoOutros,
      valor_por_kwp: potenciaKwp > 0 ? custoOutros / potenciaKwp : 0,
      percentual: null,
      created_by: profile.user_id,
    },
    {
      tenant_id: profile.tenant_id,
      proposta_id: propostaId || null,
      categoria: "instalacao",
      potencia_kwp: potenciaKwp,
      valor_total: custoInstalacao,
      valor_por_kwp: potenciaKwp > 0 ? custoInstalacao / potenciaKwp : 0,
      percentual: null,
      created_by: profile.user_id,
    },
  ].filter(r => r.valor_total > 0 || r.percentual != null);

  if (rows.length === 0) return;

  const { error } = await supabase
    .from("pricing_defaults_history")
    .insert(rows as any);

  if (error) console.error("Error saving pricing history:", error);
}
