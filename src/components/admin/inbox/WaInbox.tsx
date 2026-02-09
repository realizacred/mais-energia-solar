import { useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWaConversations, useWaMessages, useWaTags } from "@/hooks/useWaInbox";
import { useWaInstances } from "@/hooks/useWaInstances";
import { useToast } from "@/hooks/use-toast";
import { WaConversationList } from "./WaConversationList";
import { WaChatPanel } from "./WaChatPanel";
import { WaTransferDialog, WaAssignDialog, WaTagsDialog } from "./WaInboxDialogs";
import { WaLinkLeadSearch } from "./WaLinkLeadSearch";
import { WaInboxStats } from "./WaInboxStats";
import type { WaConversation } from "@/hooks/useWaInbox";

interface WaInboxProps {
  vendorMode?: boolean;
}

export function WaInbox({ vendorMode = false }: WaInboxProps) {
  // Filters
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("open");
  const [filterAssigned, setFilterAssigned] = useState("all");
  const [filterInstance, setFilterInstance] = useState("all");
  const [filterTag, setFilterTag] = useState("all");

  // Selected conversation
  const [selectedConv, setSelectedConv] = useState<WaConversation | null>(null);

  // Dialogs
  const [showTransfer, setShowTransfer] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [showLinkLead, setShowLinkLead] = useState(false);

  // Notification sound
  const prevUnreadRef = useRef<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Hooks
  const { instances } = useWaInstances();
  const { toast } = useToast();

  const {
    conversations,
    loading: convsLoading,
    assignConversation,
    transferConversation,
    resolveConversation,
    reopenConversation,
    updateConversation,
  } = useWaConversations({
    status: filterStatus !== "all" ? filterStatus : undefined,
    assigned_to: filterAssigned !== "all" && filterAssigned !== "unassigned" ? filterAssigned : undefined,
    instance_id: filterInstance !== "all" ? filterInstance : undefined,
    search: search || undefined,
  });

  const {
    messages,
    loading: msgsLoading,
    sendMessage,
    isSending,
  } = useWaMessages(selectedConv?.id);

  const { tags, createTag, deleteTag, toggleConversationTag } = useWaTags();

  // Fetch vendedores
  const { data: vendedores = [] } = useQuery({
    queryKey: ["vendedores-wa-inbox"],
    queryFn: async () => {
      const { data } = await supabase.from("vendedores").select("id, nome, user_id").eq("ativo", true);
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Keep selectedConv in sync with query data (e.g. after tag toggle, status change)
  useEffect(() => {
    if (selectedConv) {
      const fresh = conversations.find((c) => c.id === selectedConv.id);
      if (fresh && JSON.stringify(fresh) !== JSON.stringify(selectedConv)) {
        setSelectedConv(fresh);
      }
    }
  }, [conversations]);

  // 🔔 Notification sound on new unread messages
  useEffect(() => {
    const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0);
    if (totalUnread > prevUnreadRef.current && prevUnreadRef.current > 0) {
      // Play notification sound
      try {
        if (!audioRef.current) {
          // Create a simple notification beep using AudioContext
          const ctx = new AudioContext();
          const oscillator = ctx.createOscillator();
          const gain = ctx.createGain();
          oscillator.connect(gain);
          gain.connect(ctx.destination);
          oscillator.type = "sine";
          oscillator.frequency.setValueAtTime(880, ctx.currentTime); // A5
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + 0.5);
        }
      } catch {
        // Audio not available
      }
    }
    prevUnreadRef.current = totalUnread;
  }, [conversations]);

  // Filter unassigned + tags
  const filteredConvs = conversations.filter((c) => {
    if (filterAssigned === "unassigned" && c.assigned_to) return false;
    if (filterTag !== "all") {
      const hasTag = c.tags?.some((ct) => ct.tag_id === filterTag);
      if (!hasTag) return false;
    }
    return true;
  });

  const handleSelectConversation = (conv: WaConversation) => {
    setSelectedConv(conv);
    if (conv.unread_count > 0) {
      updateConversation({ id: conv.id, updates: { unread_count: 0 } as any });
    }
  };

  const handleSendMessage = async (content: string, isNote?: boolean) => {
    if (!selectedConv) return;
    await sendMessage({ content, isInternalNote: isNote });
  };

  const handleSendMedia = async (file: File, caption?: string) => {
    if (!selectedConv) return;
    try {
      const ext = file.name.split(".").pop() || "bin";
      const filePath = `${selectedConv.id}/${Date.now()}.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from("wa-attachments")
        .upload(filePath, file);
      
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage
        .from("wa-attachments")
        .getPublicUrl(filePath);
      
      const mediaUrl = urlData.publicUrl;
      const isImage = file.type.startsWith("image/");
      const messageType = isImage ? "image" : "document";
      
      await sendMessage({
        content: caption || file.name,
        messageType,
        mediaUrl,
      });
    } catch (err: any) {
      console.error("Failed to send media:", err);
      toast({ title: "Erro ao enviar arquivo", description: err.message, variant: "destructive" });
    }
  };

  const handleResolve = () => {
    if (!selectedConv) return;
    resolveConversation(selectedConv.id);
    setSelectedConv({ ...selectedConv, status: "resolved" });
  };

  const handleReopen = () => {
    if (!selectedConv) return;
    reopenConversation(selectedConv.id);
    setSelectedConv({ ...selectedConv, status: "open" });
  };

  const handleTransfer = async (toUserId: string, reason?: string) => {
    if (!selectedConv) return;
    await transferConversation({ conversationId: selectedConv.id, toUserId, reason });
    setSelectedConv({ ...selectedConv, assigned_to: toUserId });
  };

  const handleAssign = (userId: string | null) => {
    if (!selectedConv) return;
    assignConversation({ conversationId: selectedConv.id, userId });
    setSelectedConv({ ...selectedConv, assigned_to: userId });
  };

  const handleLinkLead = (leadId: string | null) => {
    if (!selectedConv) return;
    updateConversation({ id: selectedConv.id, updates: { lead_id: leadId } as any });
    setSelectedConv({ ...selectedConv, lead_id: leadId });
  };

  const handleToggleTag = (tagId: string, add: boolean) => {
    if (!selectedConv) return;
    toggleConversationTag({ conversationId: selectedConv.id, tagId, add });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-success/20 to-success/5 border border-success/10">
            <MessageCircle className="h-6 w-6 text-success" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">
              {vendorMode ? "Meu WhatsApp" : "Central WhatsApp"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {instances.length > 0 && `${instances.filter(i => i.status === "connected").length}/${instances.length} instâncias online`}
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <WaInboxStats conversations={conversations} />

      {/* Chat Layout */}
      <div className="bg-card rounded-xl border border-border/40 shadow-sm overflow-hidden" style={{ height: "calc(100vh - 300px)", minHeight: "500px" }}>
        <div className="flex h-full">
          {/* Sidebar - Conversations (Desktop) */}
          <div className="w-[360px] shrink-0 hidden md:flex flex-col">
            <WaConversationList
              conversations={filteredConvs}
              loading={convsLoading}
              selectedId={selectedConv?.id}
              onSelect={handleSelectConversation}
              search={search}
              onSearchChange={setSearch}
              filterStatus={filterStatus}
              onFilterStatusChange={setFilterStatus}
              filterAssigned={vendorMode ? "all" : filterAssigned}
              onFilterAssignedChange={setFilterAssigned}
              filterInstance={filterInstance}
              onFilterInstanceChange={setFilterInstance}
              filterTag={filterTag}
              onFilterTagChange={setFilterTag}
              vendedores={vendedores}
              instances={instances}
              tags={tags}
            />
          </div>

          {/* Mobile */}
          <div className="flex-1 flex flex-col md:hidden">
            {selectedConv ? (
              <>
                <button
                  onClick={() => setSelectedConv(null)}
                  className="px-3 py-2 text-xs text-primary font-medium text-left border-b border-border/40 hover:bg-muted/30"
                >
                  ← Voltar às conversas
                </button>
                <WaChatPanel
                  conversation={selectedConv}
                  messages={messages}
                  loading={msgsLoading}
                  isSending={isSending}
                  onSendMessage={handleSendMessage}
                  onSendMedia={handleSendMedia}
                  onResolve={handleResolve}
                  onReopen={handleReopen}
                  onOpenTransfer={() => setShowTransfer(true)}
                  onOpenTags={() => setShowTags(true)}
                  onOpenAssign={() => setShowAssign(true)}
                  onLinkLead={() => setShowLinkLead(true)}
                  vendedores={vendedores}
                />
              </>
            ) : (
              <WaConversationList
                conversations={filteredConvs}
                loading={convsLoading}
                selectedId={undefined}
                onSelect={handleSelectConversation}
                search={search}
                onSearchChange={setSearch}
                filterStatus={filterStatus}
                onFilterStatusChange={setFilterStatus}
                filterAssigned={vendorMode ? "all" : filterAssigned}
                onFilterAssignedChange={setFilterAssigned}
                filterInstance={filterInstance}
                onFilterInstanceChange={setFilterInstance}
                filterTag={filterTag}
                onFilterTagChange={setFilterTag}
                vendedores={vendedores}
                instances={instances}
                tags={tags}
              />
            )}
          </div>

          {/* Desktop: Chat Panel */}
          <div className="hidden md:flex flex-1">
            <WaChatPanel
              conversation={selectedConv}
              messages={messages}
              loading={msgsLoading}
              isSending={isSending}
              onSendMessage={handleSendMessage}
              onSendMedia={handleSendMedia}
              onResolve={handleResolve}
              onReopen={handleReopen}
              onOpenTransfer={() => setShowTransfer(true)}
              onOpenTags={() => setShowTags(true)}
              onOpenAssign={() => setShowAssign(true)}
              onLinkLead={() => setShowLinkLead(true)}
              vendedores={vendedores}
            />
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <WaTransferDialog open={showTransfer} onOpenChange={setShowTransfer} onTransfer={handleTransfer} vendedores={vendedores} />
      <WaAssignDialog open={showAssign} onOpenChange={setShowAssign} onAssign={handleAssign} vendedores={vendedores} currentAssigned={selectedConv?.assigned_to || null} />
      <WaTagsDialog open={showTags} onOpenChange={setShowTags} conversation={selectedConv} allTags={tags} onToggleTag={handleToggleTag} onCreateTag={createTag} onDeleteTag={deleteTag} />
      <WaLinkLeadSearch open={showLinkLead} onOpenChange={setShowLinkLead} conversation={selectedConv} onLink={handleLinkLead} />
    </div>
  );
}
