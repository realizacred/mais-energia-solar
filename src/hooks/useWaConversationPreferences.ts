import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface ConversationPreference {
  id: string;
  user_id: string;
  conversation_id: string;
  muted: boolean;
  hidden: boolean;
}

export function useWaConversationPreferences() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const prefsQuery = useQuery({
    queryKey: ["wa-conversation-preferences", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("wa_conversation_preferences" as any)
        .select("id, user_id, conversation_id, muted, hidden")
        .eq("user_id", user.id);
      if (error) throw error;
      return (data || []) as unknown as ConversationPreference[];
    },
    enabled: !!user?.id,
    staleTime: 60 * 1000,
  });

  const prefs = prefsQuery.data || [];

  const mutedIds = new Set(prefs.filter((p) => p.muted).map((p) => p.conversation_id));
  const hiddenIds = new Set(prefs.filter((p) => p.hidden).map((p) => p.conversation_id));

  const upsertPref = useMutation({
    mutationFn: async (params: { conversationId: string; muted?: boolean; hidden?: boolean }) => {
      if (!user?.id) throw new Error("Not authenticated");
      const existing = prefs.find((p) => p.conversation_id === params.conversationId);

      if (existing) {
        const updates: any = {};
        if (params.muted !== undefined) updates.muted = params.muted;
        if (params.hidden !== undefined) updates.hidden = params.hidden;
        const { error } = await supabase
          .from("wa_conversation_preferences" as any)
          .update(updates)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("wa_conversation_preferences" as any)
          .insert({
            user_id: user.id,
            conversation_id: params.conversationId,
            muted: params.muted ?? false,
            hidden: params.hidden ?? false,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wa-conversation-preferences"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const toggleMute = (conversationId: string) => {
    const isMuted = mutedIds.has(conversationId);
    upsertPref.mutate({ conversationId, muted: !isMuted });
    toast({ title: isMuted ? "Conversa com som" : "Conversa silenciada" });
  };

  const toggleHide = (conversationId: string) => {
    const isHidden = hiddenIds.has(conversationId);
    upsertPref.mutate({ conversationId, hidden: !isHidden });
    toast({ title: isHidden ? "Conversa restaurada" : "Conversa oculta" });
  };

  return {
    mutedIds,
    hiddenIds,
    isMuted: (id: string) => mutedIds.has(id),
    isHidden: (id: string) => hiddenIds.has(id),
    toggleMute,
    toggleHide,
    loading: prefsQuery.isLoading,
  };
}
