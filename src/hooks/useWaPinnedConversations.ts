/**
 * useWaPinnedConversations — Pin local (localStorage) por usuário.
 * Sem backend (RB-76: não criar tabela nova).
 */
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

const KEY = (userId: string) => `wa-pinned:${userId}`;

export function useWaPinnedConversations() {
  const { user } = useAuth();
  const [pinned, setPinned] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.id) return;
    try {
      const raw = localStorage.getItem(KEY(user.id));
      setPinned(new Set(raw ? (JSON.parse(raw) as string[]) : []));
    } catch {
      setPinned(new Set());
    }
  }, [user?.id]);

  const persist = useCallback(
    (next: Set<string>) => {
      setPinned(new Set(next));
      if (user?.id) {
        try {
          localStorage.setItem(KEY(user.id), JSON.stringify(Array.from(next)));
        } catch {
          /* ignore quota */
        }
      }
    },
    [user?.id],
  );

  const togglePin = useCallback(
    (conversationId: string) => {
      const next = new Set(pinned);
      if (next.has(conversationId)) next.delete(conversationId);
      else next.add(conversationId);
      persist(next);
    },
    [pinned, persist],
  );

  return {
    pinnedIds: pinned,
    isPinned: (id: string) => pinned.has(id),
    togglePin,
  };
}
