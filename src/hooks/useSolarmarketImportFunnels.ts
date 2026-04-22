/**
 * useSolarmarketImportFunnels — controla a importação dos funis dos projetos SM
 * diretamente pelo front (substitui o cron job sm-import-project-funnels-job).
 *
 * RB-04: queries em hook, RB-17: sem console.log.
 */
import { useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ImportError {
  iteration: number;
  error: string;
}

export interface ImportFunnelsProgress {
  isRunning: boolean;
  iteration: number;
  totalProcessed: number;
  totalVinculos: number;
  pendentesRestantes: number;
  lastMessage: string;
  errors: ImportError[];
}

const INITIAL_PROGRESS: ImportFunnelsProgress = {
  isRunning: false,
  iteration: 0,
  totalProcessed: 0,
  totalVinculos: 0,
  pendentesRestantes: 0,
  lastMessage: "",
  errors: [],
};

export function useSolarmarketImportFunnels(tenantId: string | undefined) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const cancelRef = useRef(false);

  const [progress, setProgress] = useState<ImportFunnelsProgress>(INITIAL_PROGRESS);

  const start = useCallback(async () => {
    if (!tenantId) {
      toast({
        title: "Tenant não identificado",
        description: "Faça login novamente.",
        variant: "destructive",
      });
      return;
    }

    cancelRef.current = false;
    setProgress({
      ...INITIAL_PROGRESS,
      isRunning: true,
      lastMessage: "Iniciando…",
    });

    let iteration = 0;
    let totalProcessed = 0;
    let totalVinculos = 0;
    let hasMore = true;
    const errors: ImportError[] = [];

    while (hasMore && !cancelRef.current && iteration < 200) {
      iteration++;

      try {
        const { data, error } = await supabase.functions.invoke(
          "sm-import-project-funnels",
          {
            body: { tenantId, batchSize: 100, throttleMs: 300 },
          }
        );

        if (error) throw error;

        totalProcessed += data?.processed || 0;
        totalVinculos += data?.total_funnel_vinculos_created || 0;
        hasMore = data?.has_more || false;

        if (Array.isArray(data?.errors) && data.errors.length > 0) {
          for (const e of data.errors) {
            errors.push({ iteration, error: typeof e === "string" ? e : JSON.stringify(e) });
          }
        }

        setProgress({
          isRunning: true,
          iteration,
          totalProcessed,
          totalVinculos,
          pendentesRestantes: data?.pendentes_restantes || 0,
          lastMessage: `Lote ${iteration}: +${data?.processed || 0} projetos`,
          errors: [...errors],
        });

        if (hasMore && !cancelRef.current) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push({ iteration, error: message });
        setProgress((prev) => ({
          ...prev,
          lastMessage: `Erro no lote ${iteration}: ${message}`,
          errors: [...errors],
        }));
        break;
      }
    }

    const cancelled = cancelRef.current;
    setProgress((prev) => ({
      ...prev,
      isRunning: false,
      lastMessage: cancelled
        ? "Cancelado pelo usuário"
        : hasMore
        ? "Interrompido"
        : "Concluído!",
    }));

    queryClient.invalidateQueries({ queryKey: ["sm_projeto_funis_stats"] });
    queryClient.invalidateQueries({ queryKey: ["sm_projeto_funis"] });

    toast({
      title: cancelled
        ? "Importação cancelada"
        : hasMore
        ? "Importação interrompida"
        : "Importação concluída!",
      description: `${totalProcessed} projetos processados · ${totalVinculos} vínculos criados`,
    });
  }, [tenantId, queryClient, toast]);

  const cancel = useCallback(() => {
    cancelRef.current = true;
  }, []);

  return { progress, start, cancel };
}
