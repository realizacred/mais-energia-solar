import { useState } from "react";
import { MessageCircle, Loader2, Inbox } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  useConversations,
  useConversationMessages,
  useWhatsAppTags,
} from "@/hooks/useWhatsAppInbox";
import { ConversationList } from "./ConversationList";
import { ChatPanel } from "./ChatPanel";
import { TransferDialog, AssignDialog, TagsDialog, LinkLeadDialog } from "./InboxDialogs";
import type { Conversation } from "@/hooks/useWhatsAppInbox";

interface WhatsAppInboxProps {
  /** If true, only shows conversations assigned to current user */
  vendorMode?: boolean;
}

export function WhatsAppInbox({ vendorMode = false }: WhatsAppInboxProps) {
  // Filters
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("open");
  const [filterAssigned, setFilterAssigned] = useState("all");

  // Selected conversation
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);

  // Dialogs
  const [showTransfer, setShowTransfer] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [showLinkLead, setShowLinkLead] = useState(false);

  // Hooks
  const {
    conversations,
    loading: convsLoading,
    assignConversation,
    transferConversation,
    resolveConversation,
    reopenConversation,
    updateConversation,
  } = useConversations({
    status: filterStatus !== "all" ? filterStatus : undefined,
    assigned_to: filterAssigned !== "all" && filterAssigned !== "unassigned" ? filterAssigned : undefined,
    search: search || undefined,
  });

  const {
    messages,
    loading: msgsLoading,
    sendMessage,
    isSending,
  } = useConversationMessages(selectedConv?.id);

  const { tags, createTag, deleteTag, toggleConversationTag } = useWhatsAppTags();

  // Fetch vendedores
  const { data: vendedores = [] } = useQuery({
    queryKey: ["vendedores-inbox"],
    queryFn: async () => {
      const { data } = await supabase.from("vendedores").select("id, nome, user_id").eq("ativo", true);
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Filter unassigned if selected
  const filteredConvs = conversations.filter((c) => {
    if (filterAssigned === "unassigned" && c.assigned_to) return false;
    return true;
  });

  const handleSelectConversation = (conv: Conversation) => {
    setSelectedConv(conv);
    // Mark as read
    if (conv.unread_count > 0) {
      updateConversation({ id: conv.id, updates: { unread_count: 0 } as any });
    }
  };

  const handleSendMessage = async (content: string, isNote?: boolean) => {
    if (!selectedConv) return;
    await sendMessage({ content, isInternalNote: isNote });
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
    await transferConversation({
      conversationId: selectedConv.id,
      toUserId,
      reason,
    });
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

  // SLA: Find conversations without response
  const openWithoutResponse = conversations.filter(
    (c) => c.status === "open" && c.unread_count > 0
  ).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-success/20 to-success/5 border border-success/10">
          <MessageCircle className="h-6 w-6 text-success" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">
            {vendorMode ? "Meu WhatsApp" : "Central WhatsApp"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {filteredConvs.length} conversas
            {openWithoutResponse > 0 && (
              <span className="text-destructive font-medium"> · {openWithoutResponse} sem resposta</span>
            )}
          </p>
        </div>
      </div>

      {/* Chat Layout */}
      <div className="bg-card rounded-xl border border-border/40 shadow-sm overflow-hidden" style={{ height: "calc(100vh - 220px)", minHeight: "500px" }}>
        <div className="flex h-full">
          {/* Sidebar - Conversations */}
          <div className="w-[340px] shrink-0 hidden md:flex flex-col">
            <ConversationList
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
              vendedores={vendedores}
            />
          </div>

          {/* Mobile: show list or chat */}
          <div className="flex-1 flex flex-col md:hidden">
            {selectedConv ? (
              <>
                <button
                  onClick={() => setSelectedConv(null)}
                  className="px-3 py-2 text-xs text-primary font-medium text-left border-b border-border/40 hover:bg-muted/30"
                >
                  ← Voltar às conversas
                </button>
                <ChatPanel
                  conversation={selectedConv}
                  messages={messages}
                  loading={msgsLoading}
                  isSending={isSending}
                  onSendMessage={handleSendMessage}
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
              <ConversationList
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
                vendedores={vendedores}
              />
            )}
          </div>

          {/* Desktop: Chat Panel */}
          <div className="hidden md:flex flex-1">
            <ChatPanel
              conversation={selectedConv}
              messages={messages}
              loading={msgsLoading}
              isSending={isSending}
              onSendMessage={handleSendMessage}
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
      <TransferDialog
        open={showTransfer}
        onOpenChange={setShowTransfer}
        onTransfer={handleTransfer}
        vendedores={vendedores}
      />
      <AssignDialog
        open={showAssign}
        onOpenChange={setShowAssign}
        onAssign={handleAssign}
        vendedores={vendedores}
        currentAssigned={selectedConv?.assigned_to || null}
      />
      <TagsDialog
        open={showTags}
        onOpenChange={setShowTags}
        conversation={selectedConv}
        allTags={tags}
        onToggleTag={handleToggleTag}
        onCreateTag={createTag}
        onDeleteTag={deleteTag}
      />
      <LinkLeadDialog
        open={showLinkLead}
        onOpenChange={setShowLinkLead}
        conversation={selectedConv}
        onLink={handleLinkLead}
      />
    </div>
  );
}
