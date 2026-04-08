/**
 * useProposalViewAlert — Realtime alert when a proposal is viewed.
 * Plays sound + shows toast with device info.
 * Should be mounted once in Admin layout.
 */
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import { useQueryClient } from "@tanstack/react-query";

export function useProposalViewAlert() {
  const { toast } = useToast();
  const { play } = useNotificationSound();
  const queryClient = useQueryClient();
  const mountedAtRef = useRef(Date.now());

  useEffect(() => {
    const channel = supabase
      .channel("proposal-view-alert")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "proposal_notifications", filter: "tipo=eq.view" },
        (payload) => {
          const createdAt = payload.new?.created_at
            ? new Date(payload.new.created_at).getTime()
            : Date.now();
          if (createdAt < mountedAtRef.current - 5000) return;

          const notification = payload.new as {
            titulo?: string;
            descricao?: string;
            proposta_id?: string;
          };

          // 🔔 Sound
          play();

          // 🟢 Toast
          toast({
            title: "👀 " + (notification.titulo || "Proposta visualizada"),
            description: notification.descricao || "Um cliente abriu sua proposta",
            duration: 10000,
          });

          // Invalidate notifications query for instant badge update
          queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast, play, queryClient]);
}
