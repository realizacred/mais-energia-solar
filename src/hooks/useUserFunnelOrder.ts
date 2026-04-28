/**
 * useUserFunnelOrder — preferência pessoal de ordem dos funis.
 *
 * Armazena em localStorage uma ordem customizada por usuário/contexto,
 * sobrescrevendo a ordem canônica global apenas para quem reordenou.
 * Não afeta outros usuários nem o banco de dados.
 *
 * Estratégia de matching:
 * - Kanban principal (projeto_funis): usa ID direto.
 * - Aba "Funis do Projeto" (pipelines comerciais): usa ID direto (pipelines.id).
 * - A ordenação é feita pelo scope fornecido (ex: "projeto-funis", "deal-pipelines").
 *
 * Se o usuário não tem preferência, retorna a lista na ordem canônica recebida.
 * Novos itens (não presentes na preferência) vão para o fim, mantendo sua ordem canônica.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const storageKey = (userId: string | null, scope: string) =>
  `funnel-order:${userId ?? "anon"}:${scope}`;

function loadOrder(userId: string | null, scope: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey(userId, scope));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function saveOrder(userId: string | null, scope: string, ids: string[]) {
  try {
    localStorage.setItem(storageKey(userId, scope), JSON.stringify(ids));
  } catch {
    /* ignore quota */
  }
}

export function useUserFunnelOrder(scope: string) {
  const [userId, setUserId] = useState<string | null>(null);
  const [version, setVersion] = useState(0); // força recomputação ao salvar

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) setUserId(data.user?.id ?? null);
    });
    return () => {
      active = false;
    };
  }, []);

  /** Aplica ordem pessoal; itens não salvos vão ao final preservando ordem canônica. */
  const sortByUserOrder = useCallback(
    <T extends { id: string }>(items: T[]): T[] => {
      const saved = loadOrder(userId, scope);
      if (saved.length === 0) return items;
      const pos = new Map<string, number>();
      saved.forEach((id, i) => pos.set(id, i));
      return [...items].sort((a, b) => {
        const pa = pos.has(a.id) ? pos.get(a.id)! : Number.POSITIVE_INFINITY;
        const pb = pos.has(b.id) ? pos.get(b.id)! : Number.POSITIVE_INFINITY;
        if (pa !== pb) return pa - pb;
        return items.indexOf(a) - items.indexOf(b); // estável pela ordem canônica
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [userId, scope, version],
  );

  /** Persiste uma nova ordem (apenas para este usuário). */
  const setOrder = useCallback(
    (orderedIds: string[]) => {
      saveOrder(userId, scope, orderedIds);
      setVersion((v) => v + 1);
    },
    [userId, scope],
  );

  /** Limpa a preferência pessoal — volta à ordem canônica. */
  const resetOrder = useCallback(() => {
    try {
      localStorage.removeItem(storageKey(userId, scope));
    } catch {
      /* ignore */
    }
    setVersion((v) => v + 1);
  }, [userId, scope]);

  return useMemo(
    () => ({ sortByUserOrder, setOrder, resetOrder }),
    [sortByUserOrder, setOrder, resetOrder],
  );
}
