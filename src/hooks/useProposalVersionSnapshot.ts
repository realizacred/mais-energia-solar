/**
 * useProposalVersionSnapshot.ts
 *
 * Hook para buscar o snapshot de uma versão de proposta.
 * §16: Queries só em hooks — NUNCA em componentes
 * §23: staleTime obrigatório
 *
 * Enriquece o snapshot com dados canônicos das tabelas:
 *  - proposta_kit_itens (via proposta_kits) → itens/módulos/inversores
 *  - proposta_versao_ucs                    → consumo mensal somado
 *  - proposta_versoes.consumo_mensal        → fallback
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5; // 5 min
const QUERY_KEY = "proposal-version-snapshot" as const;

export function useProposalVersionSnapshot(versaoId: string | null) {
  return useQuery({
    queryKey: [QUERY_KEY, versaoId],
    queryFn: async () => {
      if (!versaoId) return null;

      const [versaoRes, kitsRes, ucsRes] = await Promise.all([
        supabase
          .from("proposta_versoes")
          .select("snapshot, consumo_mensal")
          .eq("id", versaoId)
          .maybeSingle(),
        supabase
          .from("proposta_kits")
          .select("id, proposta_kit_itens(categoria, descricao, fabricante, modelo, quantidade, potencia_w)")
          .eq("versao_id", versaoId),
        supabase
          .from("proposta_versao_ucs")
          .select("consumo_mensal_kwh")
          .eq("versao_id", versaoId),
      ]);

      if (versaoRes.error) throw versaoRes.error;

      const snapshot = (versaoRes.data?.snapshot as Record<string, any>) || {};

      // Itens canônicos via kit (sobrescreve snapshot.itens se houver dados)
      const canonicalItens = (kitsRes.data || []).flatMap(
        (k: any) => k.proposta_kit_itens || []
      );
      if (canonicalItens.length > 0) {
        snapshot.itens = canonicalItens;
      }

      // UCs canônicas (sobrescreve snapshot.ucs se houver dados)
      const canonicalUcs = ucsRes.data || [];
      if (canonicalUcs.length > 0) {
        snapshot.ucs = canonicalUcs;
      }

      // Fallback de consumo mensal direto na versão
      if (versaoRes.data?.consumo_mensal != null) {
        snapshot._consumo_mensal_versao = versaoRes.data.consumo_mensal;
      }

      return snapshot;
    },
    staleTime: STALE_TIME,
    enabled: !!versaoId,
  });
}
