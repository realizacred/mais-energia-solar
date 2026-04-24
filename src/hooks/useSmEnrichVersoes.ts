/**
 * useSmEnrichVersoes — Enriquece propostas migradas do SolarMarket com dados completos
 * (kit, financeiro, técnico, UCs, localização) extraídos de sm_propostas_raw.
 *
 * Sobrescreve sempre os dados do SM. Roda em chunks via next_offset.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EnrichResult {
  ok: boolean;
  processed: number;
  versoes_updated: number;
  kit_itens_inserted: number;
  ucs_inserted: number;
  projetos_updated: number;
  errors: Array<{ versao_id?: string; proposta_id?: string; error: string }>;
  next_offset: number | null;
  duration_ms: number;
}

export interface EnrichTotals {
  processed: number;
  versoes_updated: number;
  kit_itens_inserted: number;
  ucs_inserted: number;
  projetos_updated: number;
  errors: EnrichResult["errors"];
  chunks: number;
  duration_ms: number;
}

interface RunOpts {
  batch?: number;
  onProgress?: (acc: EnrichTotals) => void;
}

export function useSmEnrichVersoes() {
  const qc = useQueryClient();

  return useMutation<EnrichTotals, Error, RunOpts | void>({
    mutationFn: async (opts) => {
      const batch = (opts as RunOpts | undefined)?.batch ?? 25;
      const onProgress = (opts as RunOpts | undefined)?.onProgress;

      const acc: EnrichTotals = {
        processed: 0,
        versoes_updated: 0,
        kit_itens_inserted: 0,
        ucs_inserted: 0,
        projetos_updated: 0,
        errors: [],
        chunks: 0,
        duration_ms: 0,
      };

      let offset = 0;
      const startedAt = Date.now();
      const HARD_LIMIT_CHUNKS = 200;

      for (let i = 0; i < HARD_LIMIT_CHUNKS; i++) {
        const { data, error } = await supabase.functions.invoke(
          "sm-enrich-versoes",
          { body: { batch, offset } },
        );
        if (error) throw new Error(error.message || "Edge function error");
        const r = data as EnrichResult;
        if (!r?.ok) throw new Error((r as any)?.error ?? "Enriquecimento retornou erro");

        acc.processed += r.processed;
        acc.versoes_updated += r.versoes_updated;
        acc.kit_itens_inserted += r.kit_itens_inserted;
        acc.ucs_inserted += r.ucs_inserted;
        acc.projetos_updated += r.projetos_updated;
        acc.errors.push(...r.errors);
        acc.chunks += 1;
        acc.duration_ms = Date.now() - startedAt;

        onProgress?.({ ...acc });

        if (r.next_offset == null) break;
        offset = r.next_offset;
      }

      return acc;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proposta-versoes"] });
      qc.invalidateQueries({ queryKey: ["proposta-kit-itens"] });
      qc.invalidateQueries({ queryKey: ["projetos"] });
      qc.invalidateQueries({ queryKey: ["sm-migracao-stats"] });
    },
  });
}
