/**
 * Hook para dados de ConvertLeadToClientDialog.
 * §16: Queries só em hooks — NUNCA em componentes
 * §23: staleTime obrigatório
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCachedEquipment, setCachedEquipment } from "@/hooks/useOfflineConversionSync";

const STALE_TIME = 1000 * 60 * 15;

interface Disjuntor {
  id: string;
  amperagem: number;
  descricao: string | null;
}

interface Transformador {
  id: string;
  potencia_kva: number;
  descricao: string | null;
}

// ─── Equipment (disjuntores + transformadores) with offline cache ──────
export function useConversionEquipment() {
  return useQuery({
    queryKey: ["conversion-equipment"],
    queryFn: async () => {
      // Try cache first for offline support
      const cached = getCachedEquipment();

      if (!navigator.onLine && cached) {
        return {
          disjuntores: cached.disjuntores as Disjuntor[],
          transformadores: cached.transformadores as Transformador[],
        };
      }

      const [disjuntoresRes, transformadoresRes] = await Promise.all([
        supabase
          .from("disjuntores")
          .select("id, amperagem, descricao, ativo")
          .eq("ativo", true)
          .order("amperagem"),
        supabase
          .from("transformadores")
          .select("id, potencia_kva, descricao, ativo")
          .eq("ativo", true)
          .order("potencia_kva"),
      ]);

      const disjuntores = (disjuntoresRes.data || []) as Disjuntor[];
      const transformadores = (transformadoresRes.data || []) as Transformador[];

      // Cache for offline use
      if (disjuntoresRes.data && transformadoresRes.data) {
        setCachedEquipment(disjuntoresRes.data, transformadoresRes.data);
      }

      if (disjuntoresRes.error)
        console.warn("[ConvertLead] disjuntores error:", disjuntoresRes.error);
      if (transformadoresRes.error)
        console.warn("[ConvertLead] transformadores error:", transformadoresRes.error);

      return { disjuntores, transformadores };
    },
    staleTime: STALE_TIME,
  });
}
