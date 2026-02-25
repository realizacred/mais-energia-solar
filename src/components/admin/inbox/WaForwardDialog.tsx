import { useState, useMemo } from "react";
import { WaProfileAvatar } from "./WaProfileAvatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Forward, User, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { WaMessage } from "@/hooks/useWaInbox";

interface WaForwardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: WaMessage | null;
  currentConversationId?: string;
}

export function WaForwardDialog({ open, onOpenChange, message, currentConversationId }: WaForwardDialogProps) {
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);

  const { data: conversations = [] } = useQuery({
    queryKey: ["wa-forward-conversations"],
    queryFn: async () => {
      const { data } = await supabase
        .from("wa_conversations")
        .select("id, cliente_nome, cliente_telefone, instance_id, remote_jid, is_group, profile_picture_url")
        .neq("status", "resolved")
        .order("last_message_at", { ascending: false })
        .limit(100);
      return data || [];
    },
    enabled: open,
    staleTime: 30 * 1000,
  });

  const filtered = useMemo(() => {
    return conversations
      .filter((c) => c.id !== currentConversationId)
      .filter((c) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (c.cliente_nome?.toLowerCase().includes(q) || c.cliente_telefone?.includes(q));
      });
  }, [conversations, search, currentConversationId]);

  const handleForward = async (targetConv: typeof conversations[0]) => {
    if (!message) return;
    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const forwardedContent = `↪️ *Encaminhada*\n${message.content || ""}`;

      // Insert message
      const { data: msg } = await supabase
        .from("wa_messages")
        .insert({
          conversation_id: targetConv.id,
          direction: "out",
          message_type: message.message_type,
          content: forwardedContent,
          media_url: message.media_url || null,
          sent_by_user_id: user?.id,
          is_internal_note: false,
          status: "pending",
        })
        .select()
        .single();

      if (msg) {
        // Resolve tenant_id from user profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("tenant_id")
          .eq("id", user?.id)
          .single();
        const tenantId = profile?.tenant_id;

        // Queue via canonical RPC
        const idempKey = `forward_${message.id}_${targetConv.id}_${msg.id}`;
        if (tenantId) {
          await supabase.rpc("enqueue_wa_outbox_item", {
            p_tenant_id: tenantId,
            p_instance_id: targetConv.instance_id,
            p_remote_jid: targetConv.remote_jid,
            p_message_type: message.message_type,
            p_content: forwardedContent,
            p_media_url: message.media_url || null,
            p_conversation_id: targetConv.id,
            p_message_id: msg.id,
            p_idempotency_key: idempKey,
          });
        }

        // Update conversation preview
        await supabase
          .from("wa_conversations")
          .update({
            last_message_at: new Date().toISOString(),
            last_message_preview: forwardedContent.substring(0, 100),
          })
          .eq("id", targetConv.id);

        // Trigger outbox
        supabase.functions.invoke("process-wa-outbox").catch(() => {});
      }

      onOpenChange(false);
      const { toast } = await import("@/hooks/use-toast");
      toast({ title: "Mensagem encaminhada", description: `Enviada para ${targetConv.cliente_nome || targetConv.cliente_telefone}` });
    } catch (err: any) {
      console.error("Forward failed:", err);
      const { toast } = await import("@/hooks/use-toast");
      toast({ title: "Erro ao encaminhar", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Forward className="h-5 w-5" />
            Encaminhar Mensagem
          </DialogTitle>
        </DialogHeader>

        {/* Message preview */}
        {message && (
          <div className="p-3 rounded-lg bg-muted/50 border border-border/30 text-sm">
            <p className="text-xs text-muted-foreground mb-1 font-medium">Mensagem:</p>
            <p className="text-foreground line-clamp-3">
              {message.content || `[${message.message_type}]`}
            </p>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conversa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Conversations list */}
        <ScrollArea className="max-h-[300px]">
          <div className="space-y-1">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma conversa encontrada</p>
            ) : (
              filtered.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => handleForward(conv)}
                  disabled={sending}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/60 transition-colors text-left disabled:opacity-50"
                >
                  <WaProfileAvatar
                    profilePictureUrl={conv.profile_picture_url}
                    isGroup={conv.is_group}
                    name={conv.cliente_nome}
                    size="md"
                    className="bg-muted/80 text-muted-foreground"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{conv.cliente_nome || conv.cliente_telefone}</p>
                    <p className="text-xs text-muted-foreground truncate">{conv.cliente_telefone}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
