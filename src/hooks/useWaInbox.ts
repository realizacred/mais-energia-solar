import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

// ── Types ─────────────────────────────────────────────

export interface WaConversation {
  id: string;
  tenant_id: string;
  instance_id: string;
  remote_jid: string;
  cliente_nome: string | null;
  cliente_telefone: string;
  status: "open" | "pending" | "resolved";
  assigned_to: string | null;
  lead_id: string | null;
  cliente_id: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  canal: string;
  profile_picture_url: string | null;
  is_group: boolean;
  created_at: string;
  updated_at: string;
  // joined
  tags?: WaConversationTag[];
  instance_name?: string;
  vendedor_nome?: string;
  lead_nome?: string;
  lead_telefone?: string;
}

export interface WaMessage {
  id: string;
  conversation_id: string;
  evolution_message_id: string | null;
  direction: "in" | "out";
  message_type: string;
  content: string | null;
  media_url: string | null;
  media_mime_type: string | null;
  quoted_message_id: string | null;
  sent_by_user_id: string | null;
  is_internal_note: boolean;
  status: string | null;
  error_message: string | null;
  metadata: any;
  participant_jid: string | null;
  participant_name: string | null;
  created_at: string;
  // joined
  sent_by_name?: string | null;
}

export interface WaTag {
  id: string;
  name: string;
  color: string;
}

export interface WaConversationTag {
  id: string;
  conversation_id: string;
  tag_id: string;
  tag?: WaTag;
}

// ── Conversations Hook ────────────────────────────────

export function useWaConversations(filters?: {
  status?: string;
  assigned_to?: string;
  instance_id?: string;
  search?: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const conversationsQuery = useQuery({
    queryKey: ["wa-conversations", filters],
    queryFn: async () => {
      let query = supabase
        .from("wa_conversations")
        .select("*, wa_instances!inner(nome, vendedores(nome)), leads(nome, telefone)")
        .order("last_message_at", { ascending: false });

      if (filters?.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }
      if (filters?.assigned_to && filters.assigned_to !== "all") {
        query = query.eq("assigned_to", filters.assigned_to);
      }
      if (filters?.instance_id && filters.instance_id !== "all") {
        query = query.eq("instance_id", filters.instance_id);
      }
      if (filters?.search) {
        query = query.or(
          `cliente_nome.ilike.%${filters.search}%,cliente_telefone.ilike.%${filters.search}%,last_message_preview.ilike.%${filters.search}%`
        );
      }

      const { data, error } = await query.limit(200);
      if (error) throw error;

      // Load tags
      const convIds = (data || []).map((c: any) => c.id);
      let tagsMap: Record<string, WaConversationTag[]> = {};
      if (convIds.length > 0) {
        const { data: ctData } = await supabase
          .from("wa_conversation_tags")
          .select("*, wa_tags(*)")
          .in("conversation_id", convIds);
        if (ctData) {
          for (const ct of ctData) {
            if (!tagsMap[ct.conversation_id]) tagsMap[ct.conversation_id] = [];
            tagsMap[ct.conversation_id].push({
              id: ct.id,
              conversation_id: ct.conversation_id,
              tag_id: ct.tag_id,
              tag: ct.wa_tags as any,
            });
          }
        }
      }

      return (data || []).map((c: any) => ({
        ...c,
        instance_name: c.wa_instances?.nome || "—",
        vendedor_nome: c.wa_instances?.vendedores?.nome || null,
        lead_nome: c.leads?.nome || null,
        lead_telefone: c.leads?.telefone || null,
        tags: tagsMap[c.id] || [],
      })) as WaConversation[];
    },
    staleTime: 15 * 1000,
    refetchInterval: 15 * 1000, // Fallback polling every 15s
  });

  // ── Realtime: listen for conversation changes ──
  useEffect(() => {
    const channel = supabase
      .channel("wa-conversations-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wa_conversations" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["wa-conversations"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const updateConversation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<WaConversation> }) => {
      const { error } = await supabase
        .from("wa_conversations")
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wa-conversations"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const assignConversation = useMutation({
    mutationFn: async ({ conversationId, userId }: { conversationId: string; userId: string | null }) => {
      const { error } = await supabase
        .from("wa_conversations")
        .update({ assigned_to: userId, status: userId ? "open" : "pending" })
        .eq("id", conversationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wa-conversations"] });
      toast({ title: "Conversa atribuída" });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

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
      const { data: conv } = await supabase
        .from("wa_conversations")
        .select("assigned_to")
        .eq("id", conversationId)
        .single();

      await supabase.from("wa_transfers").insert({
        conversation_id: conversationId,
        from_user_id: conv?.assigned_to || user?.id,
        to_user_id: toUserId,
        reason,
      });

      // Update assignment AND set status to "open" so vendor sees it immediately
      const { error } = await supabase
        .from("wa_conversations")
        .update({ assigned_to: toUserId, status: "open" })
        .eq("id", conversationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wa-conversations"] });
      toast({ title: "Conversa transferida" });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const resolveConversation = useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from("wa_conversations")
        .update({ status: "resolved" })
        .eq("id", conversationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wa-conversations"] });
      toast({ title: "Conversa resolvida" });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const reopenConversation = useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from("wa_conversations")
        .update({ status: "open" })
        .eq("id", conversationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wa-conversations"] });
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

export function useWaMessages(conversationId?: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  const messagesQuery = useQuery({
    queryKey: ["wa-messages", conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      const { data, error } = await supabase
        .from("wa_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw error;

      // Load attendant names for outgoing messages
      const userIds = [...new Set((data || []).filter(m => m.sent_by_user_id).map(m => m.sent_by_user_id!))];
      let namesMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, nome")
          .in("user_id", userIds);
        if (profiles) {
          for (const p of profiles) {
            if (p.user_id) namesMap[p.user_id] = p.nome || "";
          }
        }
      }

      return (data || []).map((m: any) => ({
        ...m,
        sent_by_name: m.sent_by_user_id ? namesMap[m.sent_by_user_id] || null : null,
      })) as WaMessage[];
    },
    enabled: !!conversationId,
    staleTime: 10 * 1000,
    refetchInterval: 15 * 1000, // Fallback polling every 15s
  });

  // ── Realtime: listen for new messages in current conversation ──
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`wa-messages-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "wa_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["wa-messages", conversationId] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "wa_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["wa-messages", conversationId] });
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
      mediaUrl,
      quotedMessageId,
    }: {
      content: string;
      messageType?: string;
      isInternalNote?: boolean;
      mediaUrl?: string;
      quotedMessageId?: string;
    }) => {
      if (!conversationId) throw new Error("No conversation selected");

      // Get conversation details and sender profile in parallel
      const [convResult, profileResult] = await Promise.all([
        supabase
          .from("wa_conversations")
          .select("instance_id, remote_jid")
          .eq("id", conversationId)
          .single(),
        user?.id
          ? supabase
              .from("profiles")
              .select("nome")
              .eq("user_id", user.id)
              .single()
          : Promise.resolve({ data: null }),
      ]);

      const conv = convResult.data;
      if (!conv) throw new Error("Conversation not found");

      const senderName = profileResult.data?.nome || null;

      // If quoting, get the quoted message's evolution_message_id
      let quotedEvolutionId: string | null = null;
      if (quotedMessageId) {
        const { data: quotedMsg } = await supabase
          .from("wa_messages")
          .select("evolution_message_id")
          .eq("id", quotedMessageId)
          .single();
        quotedEvolutionId = quotedMsg?.evolution_message_id || null;
      }

      // Insert message locally
      const { data: msg, error: msgError } = await supabase
        .from("wa_messages")
        .insert({
          conversation_id: conversationId,
          direction: "out",
          message_type: messageType,
          content,
          media_url: mediaUrl || null,
          sent_by_user_id: user?.id,
          is_internal_note: isInternalNote,
          status: isInternalNote ? "sent" : "pending",
          quoted_message_id: quotedMessageId || null,
        })
        .select()
        .single();

      if (msgError) throw msgError;

      // If not internal note, queue for sending via Evolution API
      // Prepend attendant name so the client sees who is writing
      if (!isInternalNote) {
        const outboxContent =
          senderName && messageType === "text"
            ? `*${senderName}:*\n${content}`
            : content;

        const { error: outboxError } = await supabase
          .from("wa_outbox")
          .insert({
            instance_id: conv.instance_id,
            conversation_id: conversationId,
            message_id: msg.id,
            remote_jid: conv.remote_jid,
            message_type: messageType,
            content: outboxContent,
            media_url: mediaUrl || null,
            status: "pending",
          });

        if (outboxError) {
          console.error("Failed to queue message:", outboxError);
        }

        // Trigger outbox processing
        supabase.functions.invoke("process-wa-outbox").catch((e: any) => {
          console.warn("Failed to trigger outbox processing:", e);
        });
      }

      // Update conversation preview
      await supabase
        .from("wa_conversations")
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: isInternalNote
            ? "[Nota interna]"
            : content.substring(0, 100),
        })
        .eq("id", conversationId);

      return msg;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wa-messages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["wa-conversations"] });
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

export function useWaTags() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const tagsQuery = useQuery({
    queryKey: ["wa-tags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wa_tags")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data || []) as WaTag[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const createTag = useMutation({
    mutationFn: async (tag: { name: string; color: string }) => {
      const { error } = await supabase.from("wa_tags").insert(tag);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wa-tags"] });
      toast({ title: "Tag criada" });
    },
  });

  const deleteTag = useMutation({
    mutationFn: async (tagId: string) => {
      const { error } = await supabase.from("wa_tags").delete().eq("id", tagId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wa-tags"] });
    },
  });

  const toggleConversationTag = useMutation({
    mutationFn: async ({ conversationId, tagId, add }: { conversationId: string; tagId: string; add: boolean }) => {
      if (add) {
        const { error } = await supabase
          .from("wa_conversation_tags")
          .insert({ conversation_id: conversationId, tag_id: tagId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("wa_conversation_tags")
          .delete()
          .eq("conversation_id", conversationId)
          .eq("tag_id", tagId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wa-conversations"] });
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

export function useWaTransfers(conversationId?: string) {
  return useQuery({
    queryKey: ["wa-transfers", conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      const { data, error } = await supabase
        .from("wa_transfers")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!conversationId,
    staleTime: 60 * 1000,
  });
}
