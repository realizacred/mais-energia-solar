import { useQuery } from "@tanstack/react-query";
import { ROOF_LABELS, getRoofLabel, type RoofAreaFactor } from "@/hooks/useTenantPremises";
import { solarMetadataService } from "@/services/solar/solarMetadataService";

/** Fallback list when no tenant data loaded yet */
const FALLBACK_LABELS = Object.values(ROOF_LABELS);

/**
 * Returns the list of enabled roof type labels for the current tenant.
 */
export function useTiposTelhado(consultorCode?: string | null) {
  const { data: rows, isLoading: loading } = useQuery({
    queryKey: ["tipos-telhado", consultorCode],
    queryFn: () => solarMetadataService.fetchRoofTypes(consultorCode),
    staleTime: 1000 * 60 * 15,
  });

  const roofFactors = rows || [];
  const labels = roofFactors.length > 0 
    ? roofFactors.map((d) => getRoofLabel(d as RoofAreaFactor))
    : FALLBACK_LABELS;

  return { tiposTelhado: labels, roofFactors, loading };
}
