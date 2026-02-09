import { useEffect, useRef, useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface WaNewMessage {
  conversationId: string;
  clienteNome: string | null;
  clienteTelefone: string;
  preview: string | null;
  timestamp: string;
}

const STORAGE_KEY_ENABLED = "wa_notifications_enabled";
const STORAGE_KEY_SOUND = "wa_notifications_sound_enabled";

function getStoredPref(key: string, defaultVal: boolean): boolean {
  try {
    const val = localStorage.getItem(key);
    if (val === null) return defaultVal;
    return val === "true";
  } catch {
    return defaultVal;
  }
}

/**
 * Global hook that monitors unread WhatsApp messages and emits notifications.
 * Should be mounted once at app root level.
 */
export function useWaNotifications() {
  const { user } = useAuth();
  const prevSnapshotRef = useRef<Map<string, number>>(new Map());
  const initialLoadRef = useRef(true);

  const [enabled, setEnabledState] = useState(() => getStoredPref(STORAGE_KEY_ENABLED, true));
  const [soundEnabled, setSoundEnabledState] = useState(() => getStoredPref(STORAGE_KEY_SOUND, true));
  const [pendingNotifications, setPendingNotifications] = useState<WaNewMessage[]>([]);
  const [isOnInbox, setIsOnInbox] = useState(false);

  // Persist prefs
  const setEnabled = useCallback((val: boolean) => {
    setEnabledState(val);
    localStorage.setItem(STORAGE_KEY_ENABLED, String(val));
  }, []);

  const setSoundEnabled = useCallback((val: boolean) => {
    setSoundEnabledState(val);
    localStorage.setItem(STORAGE_KEY_SOUND, String(val));
  }, []);

  // Lightweight poll: only fetch id, unread_count, name, phone, preview
  const { data: snapshot } = useQuery({
    queryKey: ["wa-notification-poll"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wa_conversations")
        .select("id, unread_count, cliente_nome, cliente_telefone, last_message_preview, last_message_at")
        .gt("unread_count", 0)
        .order("last_message_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as Array<{
        id: string;
        unread_count: number;
        cliente_nome: string | null;
        cliente_telefone: string;
        last_message_preview: string | null;
        last_message_at: string | null;
      }>;
    },
    enabled: !!user && enabled,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  // Detect new messages by comparing snapshots
  useEffect(() => {
    if (!snapshot || !enabled) return;

    const newMap = new Map<string, number>();
    snapshot.forEach((c) => newMap.set(c.id, c.unread_count));

    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      prevSnapshotRef.current = newMap;
      return;
    }

    const prev = prevSnapshotRef.current;
    const newMessages: WaNewMessage[] = [];

    snapshot.forEach((c) => {
      const prevCount = prev.get(c.id) || 0;
      if (c.unread_count > prevCount) {
        newMessages.push({
          conversationId: c.id,
          clienteNome: c.cliente_nome,
          clienteTelefone: c.cliente_telefone,
          preview: c.last_message_preview,
          timestamp: c.last_message_at || new Date().toISOString(),
        });
      }
    });

    prevSnapshotRef.current = newMap;

    if (newMessages.length > 0 && !isOnInbox) {
      setPendingNotifications((prev) => [...newMessages, ...prev].slice(0, 10));

      if (soundEnabled) {
        playNotificationSound();
      }
    }
  }, [snapshot, enabled, soundEnabled, isOnInbox]);

  const dismissNotification = useCallback((conversationId: string) => {
    setPendingNotifications((prev) => prev.filter((n) => n.conversationId !== conversationId));
  }, []);

  const dismissAll = useCallback(() => {
    setPendingNotifications([]);
  }, []);

  // Total unread count for badge
  const totalUnread = snapshot?.reduce((sum, c) => sum + c.unread_count, 0) ?? 0;

  return {
    enabled,
    setEnabled,
    soundEnabled,
    setSoundEnabled,
    pendingNotifications,
    dismissNotification,
    dismissAll,
    totalUnread,
    setIsOnInbox,
  };
}

// ── Audio ─────────────────────────────────────────────
let audioCtx: AudioContext | null = null;
let lastPlayedAt = 0;

function playNotificationSound() {
  const now = Date.now();
  if (now - lastPlayedAt < 2500) return;
  lastPlayedAt = now;

  try {
    if (!audioCtx) audioCtx = new AudioContext();
    const ctx = audioCtx;
    if (ctx.state === "suspended") ctx.resume();

    const t = ctx.currentTime;

    // Chime 1
    const g1 = ctx.createGain();
    g1.connect(ctx.destination);
    g1.gain.setValueAtTime(0.18, t);
    g1.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
    const o1 = ctx.createOscillator();
    o1.type = "sine";
    o1.frequency.setValueAtTime(784, t); // G5
    o1.connect(g1);
    o1.start(t);
    o1.stop(t + 0.15);

    // Chime 2
    const g2 = ctx.createGain();
    g2.connect(ctx.destination);
    g2.gain.setValueAtTime(0.15, t + 0.12);
    g2.gain.exponentialRampToValueAtTime(0.01, t + 0.55);
    const o2 = ctx.createOscillator();
    o2.type = "sine";
    o2.frequency.setValueAtTime(1047, t + 0.12); // C6
    o2.connect(g2);
    o2.start(t + 0.12);
    o2.stop(t + 0.35);

    // Chime 3
    const g3 = ctx.createGain();
    g3.connect(ctx.destination);
    g3.gain.setValueAtTime(0.12, t + 0.25);
    g3.gain.exponentialRampToValueAtTime(0.01, t + 0.65);
    const o3 = ctx.createOscillator();
    o3.type = "sine";
    o3.frequency.setValueAtTime(1319, t + 0.25); // E6
    o3.connect(g3);
    o3.start(t + 0.25);
    o3.stop(t + 0.5);
  } catch {
    // Audio not available
  }
}
