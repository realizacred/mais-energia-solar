import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquarePlus, Send, CheckCircle2 } from "lucide-react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface WaInternalThreadProps {
  conversationId: string;
  tenantId: string;
}

export function WaInternalThread({ conversationId, tenantId }: WaInternalThreadProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState("");
  const [creatingThread, setCreatingThread] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Fetch threads for this conversation
  const { data: threads, isLoading: loadingThreads } = useQuery({
    queryKey: ["wa-internal-threads", conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wa_internal_threads")
        .select("id, title, status, created_by, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const activeThread = threads?.find((t) => t.status === "open") || threads?.[0];

  // Fetch messages for active thread
  const { data: messages, isLoading: loadingMessages } = useQuery({
    queryKey: ["wa-internal-messages", activeThread?.id],
    enabled: !!activeThread?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wa_internal_messages")
        .select("id, content, sender_id, created_at")
        .eq("thread_id", activeThread!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;

      // Fetch sender names
      if (!data?.length) return [];
      const senderIds = [...new Set(data.map((m) => m.sender_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, nome")
        .in("user_id", senderIds);
      const nameMap = Object.fromEntries((profiles || []).map((p) => [p.user_id, p.nome]));
      return data.map((m) => ({ ...m, sender_name: nameMap[m.sender_id] || "Usuário" }));
    },
  });

  // Realtime subscription for new messages
  useEffect(() => {
    if (!activeThread?.id) return;
    const channel = supabase
      .channel(`wa-internal-msgs-${activeThread.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "wa_internal_messages",
          filter: `thread_id=eq.${activeThread.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["wa-internal-messages", activeThread.id] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeThread?.id, queryClient]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  // Create thread
  const createThread = async () => {
    if (!user) return;
    setCreatingThread(true);
    try {
      await supabase.from("wa_internal_threads").insert({
        tenant_id: tenantId,
        conversation_id: conversationId,
        created_by: user.id,
        title: "Discussão interna",
      });
      queryClient.invalidateQueries({ queryKey: ["wa-internal-threads", conversationId] });
    } finally {
      setCreatingThread(false);
    }
  };

  // Send message
  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!activeThread || !user) throw new Error("No thread/user");
      const { error } = await supabase.from("wa_internal_messages").insert({
        tenant_id: tenantId,
        thread_id: activeThread.id,
        sender_id: user.id,
        content,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["wa-internal-messages", activeThread?.id] });
    },
  });

  // Resolve thread
  const resolveMutation = useMutation({
    mutationFn: async () => {
      if (!activeThread) return;
      await supabase
        .from("wa_internal_threads")
        .update({ status: "resolved" })
        .eq("id", activeThread.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wa-internal-threads", conversationId] });
    },
  });

  if (loadingThreads) return <div className="flex items-center justify-center p-8"><Spinner /></div>;

  if (!activeThread) {
    return (
      <div className="flex flex-col items-center justify-center p-8 gap-4 text-muted-foreground">
        <MessageSquarePlus className="h-10 w-10" />
        <p className="text-sm text-center">Nenhuma discussão interna.<br />Crie uma para discutir com a equipe.</p>
        <Button onClick={createThread} disabled={creatingThread} size="sm">
          {creatingThread ? <Spinner size="sm" className="mr-2" /> : <MessageSquarePlus className="h-4 w-4 mr-2" />}
          Iniciar discussão
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{activeThread.title || "Discussão interna"}</span>
          <Badge variant={activeThread.status === "open" ? "default" : "secondary"} className="text-xs">
            {activeThread.status === "open" ? "Aberta" : "Resolvida"}
          </Badge>
        </div>
        <div className="flex gap-1">
          {activeThread.status === "open" && (
            <Button variant="ghost" size="sm" onClick={() => resolveMutation.mutate()}>
              <CheckCircle2 className="h-4 w-4 mr-1" /> Resolver
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={createThread} disabled={creatingThread}>
            <MessageSquarePlus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-3">
          {loadingMessages && <Spinner />}
          {messages?.map((msg) => (
            <div key={msg.id} className={`flex flex-col gap-0.5 ${msg.sender_id === user?.id ? "items-end" : "items-start"}`}>
              <span className="text-xs text-muted-foreground">{(msg as any).sender_name}</span>
              <div className={`rounded-lg px-3 py-2 max-w-[80%] text-sm ${
                msg.sender_id === user?.id ? "bg-primary text-primary-foreground" : "bg-muted"
              }`}>
                {msg.content}
              </div>
              <span className="text-[10px] text-muted-foreground">
                {format(new Date(msg.created_at), "HH:mm", { locale: ptBR })}
              </span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Composer */}
      {activeThread.status === "open" && (
        <div className="p-2 border-t flex gap-2">
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Mensagem interna (não vai para o cliente)..."
            rows={1}
            className="min-h-[36px] text-sm resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (newMessage.trim()) sendMutation.mutate(newMessage.trim());
              }
            }}
          />
          <Button
            size="icon"
            disabled={!newMessage.trim() || sendMutation.isPending}
            onClick={() => sendMutation.mutate(newMessage.trim())}
          >
            {sendMutation.isPending ? <Spinner size="sm" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      )}
    </div>
  );
}
