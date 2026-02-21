import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ROOF_LABELS, getRoofLabel, type RoofAreaFactor } from "@/hooks/useTenantPremises";

/** Fallback list when no tenant data loaded yet */
const FALLBACK_LABELS = Object.values(ROOF_LABELS);

/**
 * Returns the list of enabled roof type labels for the current tenant.
 * 
 * When a consultorCode is provided (public forms), it uses a SECURITY DEFINER
 * RPC to fetch tenant-specific roof types without requiring authentication.
 * When logged in (no consultorCode), it queries the table directly via RLS.
 * Falls back to FALLBACK_LABELS if no data is returned.
 */
export function useTiposTelhado(consultorCode?: string | null) {
  const [labels, setLabels] = useState<string[]>(FALLBACK_LABELS);
  const [roofFactors, setRoofFactors] = useState<RoofAreaFactor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let rows: RoofAreaFactor[] | null = null;

        if (consultorCode) {
          // Public context: use SECURITY DEFINER RPC
          const { data } = await supabase.rpc("get_roof_types_by_consultor", {
            p_consultor_code: consultorCode,
          });
          rows = data as any;
        } else {
          // Authenticated context: direct query (RLS enforced)
          const { data } = await supabase
            .from("tenant_roof_area_factors")
            .select("tipo_telhado, label, enabled, fator_area, inclinacao_padrao, desvio_azimutal_padrao, topologias_permitidas, tipos_sistema_permitidos")
            .eq("enabled", true)
            .order("tipo_telhado");
          rows = data as any;
        }

        if (cancelled) return;
        if (rows && rows.length > 0) {
          setLabels(rows.map((d) => getRoofLabel(d as RoofAreaFactor)));
          setRoofFactors(rows as RoofAreaFactor[]);
        }
        // else keep fallback
      } catch {
        // keep fallback
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [consultorCode]);

  return { tiposTelhado: labels, roofFactors, loading };
}
