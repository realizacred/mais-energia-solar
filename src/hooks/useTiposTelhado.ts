import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ROOF_LABELS, getRoofLabel, type RoofAreaFactor } from "@/hooks/useTenantPremises";

/** Fallback list when no tenant data loaded yet */
const FALLBACK_LABELS = Object.values(ROOF_LABELS);

/**
 * Returns the list of enabled roof type labels for the current tenant.
 * Used in lead/ORC forms and proposal wizard to populate dropdowns.
 */
export function useTiposTelhado() {
  const [labels, setLabels] = useState<string[]>(FALLBACK_LABELS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("tenant_roof_area_factors")
          .select("tipo_telhado, label, enabled")
          .eq("enabled", true)
          .order("tipo_telhado");
        if (cancelled) return;
        if (data && data.length > 0) {
          setLabels(data.map((d: any) => getRoofLabel(d as RoofAreaFactor)));
        }
      } catch {
        // keep fallback
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { tiposTelhado: labels, loading };
}
