import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

// ── Types ─────────────────────────────────────────────
export interface Conversation {
  id: string;
  tenant_id: string;
  created_at: string;
  updated_at: string;
  cliente_nome: string | null;
  cliente_telefone: string;
  status: "open" | "pending" | "resolved";
  assigned_to: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  lead_id: string | null;
  canal: string;
  unread_count: number;
  // joined
  tags?: ConversationTag[];
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  direction: "in" | "out";
  message_type: "text" | "image" | "audio" | "video" | "document";
  content: string | null;
  media_url: string | null;
  created_at: string;
  sent_by_user_id: string | null;
  is_internal_note: boolean;
}

export interface WhatsAppTag {
  id: string;
  name: string;
  color: string;
}

export interface ConversationTag {
  id: string;
  conversation_id: string;
  tag_id: string;
  tag?: WhatsAppTag;
}

export interface Transfer {
  id: string;
  conversation_id: string;
  from_user_id: string | null;
  to_user_id: string | null;
  reason: string | null;
  created_at: string;
}

// ── Conversations Hook ────────────────────────────────
export function useConversations(filters?: {
  status?: string;
  assigned_to?: string;
  search?: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const conversationsQuery = useQuery({
    queryKey: ["whatsapp-conversations", filters],
    queryFn: async () => {
      let query = supabase
        .from("whatsapp_conversations")
        .select("*")
        .order("last_message_at", { ascending: false });

      if (filters?.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }
      if (filters?.assigned_to && filters.assigned_to !== "all") {
        query = query.eq("assigned_to", filters.assigned_to);
      }
      if (filters?.search) {
        query = query.or(
          `cliente_nome.ilike.%${filters.search}%,cliente_telefone.ilike.%${filters.search}%,last_message_preview.ilike.%${filters.search}%`
        );
      }

      const { data, error } = await query.limit(200);
      if (error) throw error;

      // Load tags for all conversations
      const convIds = (data || []).map((c: any) => c.id);
      let tagsMap: Record<string, ConversationTag[]> = {};
      if (convIds.length > 0) {
        const { data: ctData } = await supabase
          .from("whatsapp_conversation_tags")
          .select("*, whatsapp_tags(*)")
          .in("conversation_id", convIds);
        if (ctData) {
          for (const ct of ctData) {
            if (!tagsMap[ct.conversation_id]) tagsMap[ct.conversation_id] = [];
            tagsMap[ct.conversation_id].push({
              id: ct.id,
              conversation_id: ct.conversation_id,
              tag_id: ct.tag_id,
              tag: ct.whatsapp_tags as any,
            });
          }
        }
      }

      return (data || []).map((c: any) => ({
        ...c,
        tags: tagsMap[c.id] || [],
      })) as Conversation[];
    },
    staleTime: 15 * 1000,
    refetchInterval: 15 * 1000, // Fallback polling every 15s
  });

  // ── Realtime: listen for conversation changes ──
  useEffect(() => {
    const channel = supabase
      .channel("whatsapp-conversations-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_conversations" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Update conversation status
  const updateConversation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Conversation> }) => {
      const { error } = await supabase
        .from("whatsapp_conversations")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  // Assign conversation
  const assignConversation = useMutation({
    mutationFn: async ({ conversationId, userId }: { conversationId: string; userId: string | null }) => {
      const { error } = await supabase
        .from("whatsapp_conversations")
        .update({ assigned_to: userId, status: userId ? "open" : "pending" })
        .eq("id", conversationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
      toast({ title: "Conversa atribuída" });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  // Transfer conversation
  const transferConversation = useMutation({
    mutationFn: async ({
      conversationId,
      toUserId,
      reason,
    }: {
      conversationId: string;
      toUserId: string;
      reason?: string;
    }) => {
      // Get current assigned
      const { data: conv } = await supabase
        .from("whatsapp_conversations")
        .select("assigned_to")
        .eq("id", conversationId)
        .single();

      // Log transfer
      await supabase.from("whatsapp_transfers").insert({
        conversation_id: conversationId,
        from_user_id: conv?.assigned_to || user?.id,
        to_user_id: toUserId,
        reason,
      });

      // Update assignment
      const { error } = await supabase
        .from("whatsapp_conversations")
        .update({ assigned_to: toUserId })
        .eq("id", conversationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
      toast({ title: "Conversa transferida" });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  // Resolve conversation
  const resolveConversation = useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from("whatsapp_conversations")
        .update({ status: "resolved" })
        .eq("id", conversationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
      toast({ title: "Conversa resolvida" });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  // Reopen conversation
  const reopenConversation = useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from("whatsapp_conversations")
        .update({ status: "open" })
        .eq("id", conversationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
    },
  });

  return {
    conversations: conversationsQuery.data || [],
    loading: conversationsQuery.isLoading,
    refetch: conversationsQuery.refetch,
    updateConversation: updateConversation.mutate,
    assignConversation: assignConversation.mutate,
    transferConversation: transferConversation.mutateAsync,
    resolveConversation: resolveConversation.mutate,
    reopenConversation: reopenConversation.mutate,
  };
}

// ── Messages Hook ─────────────────────────────────────
export function useConversationMessages(conversationId?: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  const messagesQuery = useQuery({
    queryKey: ["whatsapp-messages", conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      const { data, error } = await supabase
        .from("whatsapp_conversation_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data || []) as ConversationMessage[];
    },
    enabled: !!conversationId,
    staleTime: 10 * 1000,
    refetchInterval: 15 * 1000, // Fallback polling every 15s
  });

  // ── Realtime: listen for new messages in current conversation ──
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`whatsapp-messages-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "whatsapp_conversation_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["whatsapp-messages", conversationId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  const sendMessage = useMutation({
    mutationFn: async ({
      content,
      messageType = "text",
      isInternalNote = false,
    }: {
      content: string;
      messageType?: string;
      isInternalNote?: boolean;
    }) => {
      if (!conversationId) throw new Error("No conversation selected");

      const { data, error } = await supabase
        .from("whatsapp_conversation_messages")
        .insert({
          conversation_id: conversationId,
          direction: "out",
          message_type: messageType,
          content,
          sent_by_user_id: user?.id,
          is_internal_note: isInternalNote,
        })
        .select()
        .single();
      if (error) throw error;

      // Update conversation last message
      await supabase
        .from("whatsapp_conversations")
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: isInternalNote
            ? "[Nota interna]"
            : content.substring(0, 100),
        })
        .eq("id", conversationId);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-messages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    },
  });

  return {
    messages: messagesQuery.data || [],
    loading: messagesQuery.isLoading,
    sendMessage: sendMessage.mutateAsync,
    isSending: sendMessage.isPending,
  };
}

// ── Tags Hook ─────────────────────────────────────────
export function useWhatsAppTags() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const tagsQuery = useQuery({
    queryKey: ["whatsapp-tags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_tags")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data || []) as WhatsAppTag[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const createTag = useMutation({
    mutationFn: async (tag: { name: string; color: string }) => {
      const { error } = await supabase.from("whatsapp_tags").insert(tag);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-tags"] });
      toast({ title: "Tag criada" });
    },
  });

  const deleteTag = useMutation({
    mutationFn: async (tagId: string) => {
      const { error } = await supabase.from("whatsapp_tags").delete().eq("id", tagId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-tags"] });
    },
  });

  const toggleConversationTag = useMutation({
    mutationFn: async ({ conversationId, tagId, add }: { conversationId: string; tagId: string; add: boolean }) => {
      if (add) {
        const { error } = await supabase
          .from("whatsapp_conversation_tags")
          .insert({ conversation_id: conversationId, tag_id: tagId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("whatsapp_conversation_tags")
          .delete()
          .eq("conversation_id", conversationId)
          .eq("tag_id", tagId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
    },
  });

  return {
    tags: tagsQuery.data || [],
    loading: tagsQuery.isLoading,
    createTag: createTag.mutateAsync,
    deleteTag: deleteTag.mutate,
    toggleConversationTag: toggleConversationTag.mutate,
  };
}

// ── Transfers Hook ────────────────────────────────────
export function useTransfers(conversationId?: string) {
  return useQuery({
    queryKey: ["whatsapp-transfers", conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      const { data, error } = await supabase
        .from("whatsapp_transfers")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Transfer[];
    },
    enabled: !!conversationId,
    staleTime: 60 * 1000,
  });
}
