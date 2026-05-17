/**
 * useConcessionarias — Hook for concessionarias select data.
 * §16: Queries only in hooks. §23: staleTime mandatory.
 */
import { useQuery } from "@tanstack/react-query";
import { solarMetadataService, type ConcessionariaOption } from "@/services/solar/solarMetadataService";

export type { ConcessionariaOption };

export function useConcessionarias() {
  return useQuery({
    queryKey: ["concessionarias_select"],
    queryFn: () => solarMetadataService.fetchConcessionarias(),
    staleTime: 1000 * 60 * 15,
  });
}
