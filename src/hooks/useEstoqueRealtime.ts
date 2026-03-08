/**
 * Realtime subscription for Estoque tables.
 * Invalidates React Query caches on any change with 700ms debounce.
 * Must be called once in a mounted component (e.g. EstoquePage).
 */
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DEBOUNCE_MS = 700;

const ESTOQUE_QUERY_KEYS = [
  "estoque-itens",
  "estoque-saldos",
  "estoque-saldos-local",
  "estoque-movimentos",
  "estoque-reservas",
  "estoque-locais",
  "estoque-locais-all",
  "projeto-materiais",
];

export function useEstoqueRealtime() {
  const queryClient = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const invalidateAll = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        ESTOQUE_QUERY_KEYS.forEach((key) =>
          queryClient.invalidateQueries({ queryKey: [key] })
        );
      }, DEBOUNCE_MS);
    };

    const channel = supabase
      .channel("estoque-realtime-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "estoque_itens" },
        invalidateAll
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "estoque_movimentos" },
        invalidateAll
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "estoque_saldos" },
        invalidateAll
      )
      .subscribe();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
