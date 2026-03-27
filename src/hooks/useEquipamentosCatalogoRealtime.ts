/**
 * Realtime subscription for Equipment Catalog tables.
 * Invalidates React Query caches on any change with 700ms debounce.
 * Must be called once in each equipment manager component.
 */
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DEBOUNCE_MS = 700;

const EQUIPAMENTOS_QUERY_KEYS = [
  "modulos-solares",
  "inversores-catalogo",
  "otimizadores-catalogo",
  "baterias",
];

const TABLES = [
  "modulos_solares",
  "inversores_catalogo",
  "otimizadores_catalogo",
  "baterias",
] as const;

export function useEquipamentosCatalogoRealtime() {
  const queryClient = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const invalidateAll = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        EQUIPAMENTOS_QUERY_KEYS.forEach((key) =>
          queryClient.invalidateQueries({ queryKey: [key] })
        );
      }, DEBOUNCE_MS);
    };

    let channel = supabase.channel("equipamentos-catalogo-realtime");

    for (const table of TABLES) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        invalidateAll
      );
    }

    channel.subscribe();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
