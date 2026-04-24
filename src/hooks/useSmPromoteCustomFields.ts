/**
 * useSmPromoteCustomFields — Promove campos customizados (cap_*) do staging
 * SolarMarket para deal_custom_field_values, baixando arquivos das URLs externas
 * para o bucket `imported-files`.
 *
 * Roda em chunks (próximo offset retornado pelo backend) para suportar 1.901 projetos.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PromoteCfResult {
  ok: boolean;
  processed: number;
  upserted: number;
  files_downloaded: number;
  files_skipped: number;
  files_failed: number;
  errors: Array<{ projeto_id?: string; deal_id?: string; error: string }>;
  next_offset: number | null;
  duration_ms: number;
}

export interface PromoteCfTotals {
  processed: number;
  upserted: number;
  files_downloaded: number;
  files_skipped: number;
  files_failed: number;
  errors: PromoteCfResult["errors"];
  chunks: number;
  duration_ms: number;
}

interface RunOpts {
  batch?: number;
  dryRun?: boolean;
  onProgress?: (acc: PromoteCfTotals) => void;
}

export function useSmPromoteCustomFields() {
  const qc = useQueryClient();

  return useMutation<PromoteCfTotals, Error, RunOpts | void>({
    mutationFn: async (opts) => {
      const batch = (opts as RunOpts | undefined)?.batch ?? 25;
      const dryRun = (opts as RunOpts | undefined)?.dryRun === true;
      const onProgress = (opts as RunOpts | undefined)?.onProgress;

      const acc: PromoteCfTotals = {
        processed: 0,
        upserted: 0,
        files_downloaded: 0,
        files_skipped: 0,
        files_failed: 0,
        errors: [],
        chunks: 0,
        duration_ms: 0,
      };

      let offset = 0;
      const startedAt = Date.now();
      const HARD_LIMIT_CHUNKS = 200; // 200 * 25 = 5000 projetos > 1901

      for (let i = 0; i < HARD_LIMIT_CHUNKS; i++) {
        const { data, error } = await supabase.functions.invoke(
          "sm-promote-custom-fields",
          {
            body: {
              action: "promote",
              payload: { batch, offset, dry_run: dryRun },
            },
          },
        );
        if (error) throw new Error(error.message || "Edge function error");
        const r = data as PromoteCfResult;
        if (!r?.ok) throw new Error((r as any)?.error ?? "Promoção retornou erro");

        acc.processed += r.processed;
        acc.upserted += r.upserted;
        acc.files_downloaded += r.files_downloaded;
        acc.files_skipped += r.files_skipped;
        acc.files_failed += r.files_failed;
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
      qc.invalidateQueries({ queryKey: ["deal-custom-field-values"] });
      qc.invalidateQueries({ queryKey: ["deal-custom-fields-important"] });
    },
  });
}
