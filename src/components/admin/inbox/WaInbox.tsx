import { useState, useEffect, useRef } from "react";
import { MessageCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWaConversations, useWaMessages, useWaTags, useWaReadTracking } from "@/hooks/useWaInbox";
import { useWaInstances } from "@/hooks/useWaInstances";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { WaConversationList } from "./WaConversationList";
import { WaChatPanel } from "./WaChatPanel";
import { WaTransferDialog, WaAssignDialog, WaTagsDialog } from "./WaInboxDialogs";
import { WaLinkLeadSearch } from "./WaLinkLeadSearch";
import { WaInboxStats } from "./WaInboxStats";
import { WaResolveDialog } from "./WaResolveDialog";
import { WaFollowupWidget } from "@/components/admin/widgets/WaFollowupWidget";
import type { WaConversation } from "@/hooks/useWaInbox";

interface WaInboxProps {
  vendorMode?: boolean;
  vendorUserId?: string | null;
}

export function WaInbox({ vendorMode = false, vendorUserId }: WaInboxProps) {
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
  const [showResolve, setShowResolve] = useState(false);

  // Notification sound
  const prevUnreadRef = useRef<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Hooks
  const { instances } = useWaInstances();
  const { user } = useAuth();
  const { toast } = useToast();

  // Determine the effective user for vendor mode
  const effectiveUserId = vendorUserId || (vendorMode ? user?.id : undefined);

  // Fetch vendedores (moved up so vendorInstanceIds can reference it)
  const { data: vendedores = [] } = useQuery({
    queryKey: ["vendedores-wa-inbox"],
    queryFn: async () => {
      const { data } = await supabase.from("vendedores").select("id, nome, user_id").eq("ativo", true);
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const effectiveAssigned = vendorMode ? "all" : filterAssigned;

  // RLS handles vendor visibility at DB level — do NOT filter by status in the query
  // so stats and list share the same data source (single source of truth)
  const conversationFilters = {
    assigned_to: !vendorMode && effectiveAssigned !== "all" && effectiveAssigned !== "unassigned" ? effectiveAssigned : undefined,
    instance_id: filterInstance !== "all" ? filterInstance : undefined,
    search: search || undefined,
  };

  const {
    conversations: allConversations,
    loading: convsLoading,
    assignConversation,
    transferConversation,
    resolveConversation,
    reopenConversation,
    updateConversation,
  } = useWaConversations(conversationFilters);

  const {
    messages,
    loading: msgsLoading,
    sendMessage,
    isSending,
    initialLoadDone,
    isLoadingMore,
    hasOlderMessages,
    loadOlderMessages,
  } = useWaMessages(selectedConv?.id);

  const { lastReadMessageId, markAsRead } = useWaReadTracking(selectedConv?.id, user?.id);

  const { tags, createTag, deleteTag, toggleConversationTag } = useWaTags();
  // Keep selectedConv in sync with query data (e.g. after tag toggle, status change)
  useEffect(() => {
    if (selectedConv) {
      const fresh = allConversations.find((c) => c.id === selectedConv.id);
      if (fresh && JSON.stringify(fresh) !== JSON.stringify(selectedConv)) {
        setSelectedConv(fresh);
      }
    }
  }, [allConversations]);

  // 🔔 Notification sound on new unread messages
  useEffect(() => {
    const totalUnread = allConversations.reduce((sum, c) => sum + c.unread_count, 0);
    if (totalUnread > prevUnreadRef.current && prevUnreadRef.current > 0) {
      try {
        if (!audioRef.current) {
          const ctx = new AudioContext();
          const oscillator = ctx.createOscillator();
          const gain = ctx.createGain();
          oscillator.connect(gain);
          gain.connect(ctx.destination);
          oscillator.type = "sine";
          oscillator.frequency.setValueAtTime(880, ctx.currentTime);
          gain.gain.setValueAtTime(0.7, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + 0.5);
        }
      } catch {
        // Audio not available
      }
    }
    prevUnreadRef.current = totalUnread;
  }, [allConversations]);

  // Single source of truth: filter client-side for status, unassigned, and tags
  const filteredConvs = allConversations.filter((c) => {
    // Status filter
    if (filterStatus !== "all" && c.status !== filterStatus) return false;
    // Unassigned filter
    if (filterAssigned === "unassigned" && c.assigned_to) return false;
    // Tag filter
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

  const handleSendMessage = async (content: string, isNote?: boolean, quotedMessageId?: string) => {
    if (!selectedConv) return;
    await sendMessage({ content, isInternalNote: isNote, quotedMessageId });
  };

  const handleSendMedia = async (file: File, caption?: string) => {
    if (!selectedConv) return;
    try {
      const { getCurrentTenantId, tenantPath } = await import("@/lib/storagePaths");
      const tid = await getCurrentTenantId();
      if (!tid) throw new Error("Tenant não encontrado");
      const ext = file.name.split(".").pop() || "bin";
      const filePath = tenantPath(tid, selectedConv.id, `${Date.now()}.${ext}`);
      
      const { error: uploadError } = await supabase.storage
        .from("wa-attachments")
        .upload(filePath, file);
      
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage
        .from("wa-attachments")
        .getPublicUrl(filePath);
      
      const mediaUrl = urlData.publicUrl;
      let messageType = "document";
      if (file.type.startsWith("image/")) messageType = "image";
      else if (file.type.startsWith("video/")) messageType = "video";
      else if (file.type.startsWith("audio/")) messageType = "audio";
      
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

  const handleSendReaction = async (messageId: string, reaction: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessão inválida");

      const response = await supabase.functions.invoke("send-wa-reaction", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { message_id: messageId, reaction },
      });

      if (response.error) throw new Error(response.error.message || "Erro ao reagir");
      if (response.data?.error) throw new Error(String(response.data.error));
    } catch (err: any) {
      console.error("Failed to send reaction:", err);
      toast({ title: "Erro ao reagir", description: err.message, variant: "destructive" });
    }
  };

  const openResolveDialog = () => {
    if (!selectedConv) return;
    setShowResolve(true);
  };

  const handleResolve = async (sendSurvey: boolean) => {
    if (!selectedConv) return;
    setShowResolve(false);
    resolveConversation(selectedConv.id);
    setSelectedConv({ ...selectedConv, status: "resolved" });

    if (!sendSurvey) return;

    // Send satisfaction survey message
    try {
      const surveyMessage = "Olá! Seu atendimento foi finalizado. 😊\n\nPor favor, avalie nosso atendimento de 1 a 5:\n⭐ 1 - Péssimo\n⭐⭐ 2 - Ruim\n⭐⭐⭐ 3 - Regular\n⭐⭐⭐⭐ 4 - Bom\n⭐⭐⭐⭐⭐ 5 - Excelente\n\nResponda apenas com o número (1 a 5).";

      // Get conversation details for outbox
      const { data: conv } = await supabase
        .from("wa_conversations")
        .select("instance_id, remote_jid, tenant_id")
        .eq("id", selectedConv.id)
        .single();

      if (conv) {
        // Insert the satisfaction survey message
        const { data: msg } = await supabase
          .from("wa_messages")
          .insert({
            conversation_id: selectedConv.id,
            direction: "out",
            message_type: "text",
            content: surveyMessage,
            sent_by_user_id: user?.id,
            is_internal_note: false,
            status: "pending",
          })
          .select()
          .single();

        if (msg) {
          // Queue for sending
          await supabase.from("wa_outbox").insert({
            instance_id: conv.instance_id,
            conversation_id: selectedConv.id,
            message_id: msg.id,
            remote_jid: conv.remote_jid,
            message_type: "text",
            content: surveyMessage,
            status: "pending",
          });

          // Create satisfaction record
          await supabase.from("wa_satisfaction_ratings").insert({
            tenant_id: conv.tenant_id,
            conversation_id: selectedConv.id,
            attendant_user_id: selectedConv.assigned_to || user?.id,
          });

          // Trigger outbox
          supabase.functions.invoke("process-wa-outbox").catch(() => {});
        }
      }
    } catch (err) {
      console.error("Failed to send satisfaction survey:", err);
    }
  };

  const handleReopen = () => {
    if (!selectedConv) return;
    reopenConversation(selectedConv.id);
    setSelectedConv({ ...selectedConv, status: "open" });
  };

  const handleTransfer = async (toUserId: string, reason?: string) => {
    if (!selectedConv) return;
    
    // Find the name of the person being transferred to
    const targetVendedor = vendedores.find((v) => v.user_id === toUserId || v.id === toUserId);
    const targetName = targetVendedor?.nome || "outro atendente";

    // Send automated transfer notification to the client
    try {
      const transferMsg = `🔄 Você está sendo transferido para *${targetName}*.${reason ? `\n\n📝 Motivo: ${reason}` : ""}\n\nEm instantes, ${targetName} continuará seu atendimento.`;
      await sendMessage({ content: transferMsg, isInternalNote: false });
    } catch (err) {
      console.error("Failed to send transfer notification:", err);
    }

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
    <div className={`${vendorMode ? "flex flex-col h-full" : "space-y-4"}`} data-wa-inbox-active>
      {/* Header — hidden in vendor/standalone mode */}
      {!vendorMode && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-success/20 to-success/5 border border-success/10">
              <MessageCircle className="h-6 w-6 text-success" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Central WhatsApp</h2>
              <p className="text-sm text-muted-foreground">
                {instances.length > 0 && `${instances.filter(i => i.status === "connected").length}/${instances.length} instâncias online`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats - only in admin mode */}
      {!vendorMode && <WaInboxStats conversations={allConversations} />}

      {/* Follow-up Widget */}
      {!vendorMode && <WaFollowupWidget />}

      {/* Chat Layout */}
      <div
        className={`bg-card rounded-xl border border-border/40 shadow-sm overflow-hidden ${
          vendorMode ? "flex-1 min-h-0" : ""
        }`}
        style={vendorMode ? undefined : { height: "calc(100vh - 300px)", minHeight: "500px" }}
      >
        <div className="flex h-full">
          {/* Sidebar - Conversations (Desktop) */}
          <div className={`${vendorMode ? "w-[320px]" : "w-[360px]"} shrink-0 hidden md:flex flex-col`}>
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
                  initialLoadDone={initialLoadDone}
                  isLoadingMore={isLoadingMore}
                  hasOlderMessages={hasOlderMessages}
                  onLoadOlder={loadOlderMessages}
                  onSendMessage={handleSendMessage}
                  onSendMedia={handleSendMedia}
                  onSendReaction={handleSendReaction}
                  onResolve={openResolveDialog}
                  onReopen={handleReopen}
                  onOpenTransfer={() => setShowTransfer(true)}
                  onOpenTags={() => setShowTags(true)}
                  onOpenAssign={() => setShowAssign(true)}
                  onLinkLead={() => setShowLinkLead(true)}
                  vendedores={vendedores}
                  lastReadMessageId={lastReadMessageId}
                  onMarkAsRead={markAsRead}
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
              initialLoadDone={initialLoadDone}
              isLoadingMore={isLoadingMore}
              hasOlderMessages={hasOlderMessages}
              onLoadOlder={loadOlderMessages}
              onSendMessage={handleSendMessage}
              onSendMedia={handleSendMedia}
              onSendReaction={handleSendReaction}
              onResolve={openResolveDialog}
              onReopen={handleReopen}
              onOpenTransfer={() => setShowTransfer(true)}
              onOpenTags={() => setShowTags(true)}
              onOpenAssign={() => setShowAssign(true)}
              onLinkLead={() => setShowLinkLead(true)}
              vendedores={vendedores}
              lastReadMessageId={lastReadMessageId}
              onMarkAsRead={markAsRead}
            />
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <WaTransferDialog open={showTransfer} onOpenChange={setShowTransfer} onTransfer={handleTransfer} vendedores={vendedores} />
      <WaAssignDialog open={showAssign} onOpenChange={setShowAssign} onAssign={handleAssign} vendedores={vendedores} currentAssigned={selectedConv?.assigned_to || null} />
      <WaTagsDialog open={showTags} onOpenChange={setShowTags} conversation={selectedConv} allTags={tags} onToggleTag={handleToggleTag} onCreateTag={createTag} onDeleteTag={deleteTag} />
      <WaLinkLeadSearch open={showLinkLead} onOpenChange={setShowLinkLead} conversation={selectedConv} onLink={handleLinkLead} />
      <WaResolveDialog open={showResolve} onOpenChange={setShowResolve} onConfirm={handleResolve} clienteName={selectedConv?.cliente_nome || undefined} />
    </div>
  );
}
