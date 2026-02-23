import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNotificationSound } from "@/hooks/useNotificationSound";

/**
 * Realtime hook that plays a sound and shows a toast
 * whenever a new lead is inserted (INSERT event).
 * 
 * Should be mounted once in Admin / Gerente layout.
 */
export function useNewLeadAlert() {
  const { toast } = useToast();
  const { play } = useNotificationSound();
  const mountedAtRef = useRef(Date.now());

  useEffect(() => {
    const channel = supabase
      .channel("new-lead-alert")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "leads" },
        (payload) => {
          // Ignore INSERTs that happened before mount (initial sync edge case)
          const createdAt = payload.new?.created_at
            ? new Date(payload.new.created_at).getTime()
            : Date.now();
          if (createdAt < mountedAtRef.current - 5000) return;

          const lead = payload.new as {
            nome?: string;
            cidade?: string;
            estado?: string;
          };

          // 🔔 Sound alert
          play();

          // 🟢 Visual alert (toast)
          toast({
            title: "🎯 Novo Lead!",
            description: `${lead.nome || "Sem nome"} — ${lead.cidade || ""}/${lead.estado || ""}`,
            duration: 8000,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast, play]);
}
