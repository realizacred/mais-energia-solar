import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { MessageCircle, WifiOff, QrCode, MessageCirclePlus, Settings } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useConsultoresAtivos } from "@/hooks/useConsultoresAtivos";
import { useWaFollowupPending } from "@/hooks/useWaFollowupPending";
import { useWaConversations, useWaMessages, useWaTags, useWaReadTracking } from "@/hooks/useWaInbox";
import { useWaInstances } from "@/hooks/useWaInstances";
import { useWaConversationPreferences } from "@/hooks/useWaConversationPreferences";
import { useWaPinnedConversations } from "@/hooks/useWaPinnedConversations";
import { WaConversationContextMenu, type WaConvContextMenuState } from "./WaConversationContextMenu";
import { useAuth } from "@/hooks/useAuth";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useToast } from "@/hooks/use-toast";
import { getCurrentTenantId, tenantPath } from "@/lib/storagePaths";
import { useWaSlaAlerts } from "@/hooks/useWaSlaAlerts";
import { WaConversationList } from "./WaConversationList";
import { WaChatPanel } from "./WaChatPanel";
import { WaTransferDialog, WaAssignDialog, WaTagsDialog } from "./WaInboxDialogs";
import { WaLinkLeadSearch } from "./WaLinkLeadSearch";
import { WaSaveContactModal } from "./WaSaveContactModal";
import { WaInboxStats } from "./WaInboxStats";
import { WaResolveDialog } from "./WaResolveDialog";
import { WaSlaAlertBanner } from "./WaSlaAlertBanner";
import { WaFollowupWidget } from "@/components/admin/widgets/WaFollowupWidget";
import { WaSettingsDialog } from "./WaSettingsDialog";
import { WaStartConversationDialog } from "./WaStartConversationDialog";
import { WaPreContactCard } from "./WaPreContactCard";
import { WaInboxHeader } from "./WaInboxHeader";
import { WaInboxNotificationBanner } from "@/components/notifications/WaInboxNotificationBanner";
import { Button } from "@/components/ui/button";
import type { WaConversation } from "@/hooks/useWaInbox";
import { FollowUpIAView } from "./FollowUpIAView";
import { useFollowUpQueue } from "@/hooks/useFollowUpQueue";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles } from "lucide-react";

interface LeadAutoOpenData {
  phone: string;
  nome?: string;
  cidade?: string;
  estado?: string;
  consumo?: number;
  tipo_telhado?: string;
  rede_atendimento?: string;
  consultor_nome?: string;
  assignedConvId?: string;
  prefillMessage?: string;
}

interface WaInboxProps {
  vendorMode?: boolean;
  vendorUserId?: string | null;
  showCompactStats?: boolean;
  initialConversationId?: string | null;
}

export function WaInbox({ vendorMode = false, vendorUserId, showCompactStats = false, initialConversationId }: WaInboxProps) {
  const { get: getSiteSetting } = useSiteSettings();
  const nomeEmpresa = getSiteSetting("nome_empresa") || "nossa empresa";
  const [searchParams, setSearchParams] = useSearchParams();
  const urlEnabled = !vendorMode;
  const initFrom = (key: string, fallback: string) => (urlEnabled && searchParams.get(key)) || fallback;

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState(() => initFrom("status", "open"));
  const [filterAssigned, setFilterAssigned] = useState(() => initFrom("assigned", "all"));
  const [filterInstance, setFilterInstance] = useState(() => initFrom("instance", "all"));
  const [filterTag, setFilterTag] = useState(() => initFrom("tag", "all"));
  const [filterUnread, setFilterUnread] = useState(() => urlEnabled && searchParams.get("unread") === "1");
  const permissionTargetId = vendorMode && vendorUserId ? vendorUserId : undefined;
  const { hasPermission, isAdmin: isAdminUser, loading: permissionsLoading } = useUserPermissions(permissionTargetId);
  const canViewGroups = hasPermission("view_groups");
  const canViewHidden = hasPermission("view_hidden");
  const [showGroups, setShowGroups] = useState(false);
  const [showHidden, setShowHidden] = useState(false);

  useEffect(() => { if (!permissionsLoading && canViewGroups) setShowGroups(true); }, [permissionsLoading, canViewGroups]);

  useEffect(() => {
    if (vendorMode) return;
    document.documentElement.classList.add("wa-inbox-admin");
    document.body.classList.add("wa-inbox-admin");
    return () => {
      document.documentElement.classList.remove("wa-inbox-admin");
      document.body.classList.remove("wa-inbox-admin");
    };
  }, [vendorMode]);

  const [selectedConv, setSelectedConv] = useState<WaConversation | null>(null);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [showLinkLead, setShowLinkLead] = useState(false);
  const [showResolve, setShowResolve] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showStartChat, setShowStartChat] = useState(false);
  const [saveContactFor, setSaveContactFor] = useState<WaConversation | null>(null);
  const [pendingNewConvId, setPendingNewConvId] = useState<string | null>(null);
  const [prefillMessage, setPrefillMessage] = useState<string | null>(null);
  const [preContactData, setPreContactData] = useState<LeadAutoOpenData | null>(null);
  const autoOpenProcessedRef = useRef(false);

  const prevUnreadRef = useRef<number>(0);
  const { instances } = useWaInstances();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'inbox' | 'followup'>('inbox');
  const { data: followUpItems = [] } = useFollowUpQueue();
  const needsAttentionCount = useMemo(() => followUpItems.filter(item => item.ai_context === 'needs_human_review').length, [followUpItems]);

  const effectiveUserId = vendorUserId || (vendorMode ? user?.id : undefined);
  const { data: vendedores = [] } = useConsultoresAtivos();
  const effectiveAssigned = vendorMode ? "all" : filterAssigned;

  const conversationFilters = {
    assigned_to: vendorMode && effectiveUserId ? effectiveUserId : (!vendorMode && effectiveAssigned !== "all" && effectiveAssigned !== "unassigned" ? effectiveAssigned : undefined),
    instance_id: filterInstance !== "all" ? filterInstance : undefined,
    search: search || undefined,
    vendor_user_id: vendorMode ? effectiveUserId : undefined,
  };

  const { conversations: allConversations, loading: convsLoading, assignConversation, assignConversationAsync, isAccepting, transferConversation, resolveConversation, reopenConversation, updateConversation } = useWaConversations(conversationFilters);
  const { messages, loading: msgsLoading, sendMessage, isSending, initialLoadDone, isLoadingMore, hasOlderMessages, loadOlderMessages, retryMessage } = useWaMessages(selectedConv?.id);
  const { lastReadMessageId, markAsRead } = useWaReadTracking(selectedConv?.id, user?.id);
  const { tags, createTag, deleteTag, toggleConversationTag } = useWaTags();
  const { mutedIds, hiddenIds, isMuted, isHidden, toggleMute, toggleHide } = useWaConversationPreferences();
  const { pinnedIds, togglePin } = useWaPinnedConversations();
  const [convContextMenu, setConvContextMenu] = useState<WaConvContextMenuState | null>(null);

  const handleContextMenuConv = useCallback((e: React.MouseEvent, conv: WaConversation) => { setConvContextMenu({ x: e.clientX, y: e.clientY, conversation: conv }); }, []);

  const sortPinned = useCallback((list: WaConversation[]) => {
    if (!pinnedIds.size) return list;
    return [...list].sort((a, b) => (pinnedIds.has(b.id) ? 1 : 0) - (pinnedIds.has(a.id) ? 1 : 0));
  }, [pinnedIds]);

  const { alerts: slaAlerts, myAlerts: mySlaAlerts, acknowledgeAlert: acknowledgeSlaAlert, acknowledgeAll: acknowledgeAllSla, pauseSla: pauseSlaConversation, isEnabled: slaEnabled } = useWaSlaAlerts();
  const { data: pendingFollowups = [] } = useWaFollowupPending();
  const followupConvIds = useMemo(() => new Set(pendingFollowups.map((f) => f.conversation_id)), [pendingFollowups]);

  useEffect(() => {
    const totalUnread = allConversations.filter((c) => !mutedIds.has(c.id)).reduce((sum, c) => sum + c.unread_count, 0);
    if (totalUnread > prevUnreadRef.current && prevUnreadRef.current > 0) {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        if (ctx.state === "suspended") ctx.resume();
        const t = ctx.currentTime;
        [784, 1047].forEach((freq, i) => {
          const g = ctx.createGain(); g.connect(ctx.destination); g.gain.setValueAtTime(0.5, t + i * 0.15); g.gain.exponentialRampToValueAtTime(0.01, t + i * 0.15 + 0.4);
          const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(freq, t + i * 0.15); o.connect(g); o.start(t + i * 0.15); o.stop(t + i * 0.15 + 0.3);
        });
      } catch {}
      if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
    }
    prevUnreadRef.current = totalUnread;
  }, [allConversations, mutedIds]);

  useEffect(() => {
    if (initialConversationId && allConversations.length > 0) {
      if (filterStatus !== "all") setFilterStatus("all");
      const convId = initialConversationId.split(":")[0];
      const target = allConversations.find((c) => c.id === convId);
      if (target) setSelectedConv(target);
    }
  }, [initialConversationId, allConversations, filterStatus]);

  useEffect(() => {
    if (!pendingNewConvId) return;
    const target = allConversations.find((c) => c.id === pendingNewConvId);
    if (target) { if (filterStatus !== "all") setFilterStatus("all"); setSelectedConv(target); setPendingNewConvId(null); }
  }, [pendingNewConvId, allConversations, filterStatus]);

  const lastSyncedConvRef = useRef<string>("");
  useEffect(() => {
    if (selectedConv) {
      const fresh = allConversations.find((c) => c.id === selectedConv.id);
      if (fresh) {
        const freshJson = JSON.stringify(fresh);
        if (freshJson !== lastSyncedConvRef.current) { lastSyncedConvRef.current = freshJson; setSelectedConv(fresh); }
      }
    }
  }, [allConversations, selectedConv]);

  const handleKpiSelect = useCallback((key: "open" | "pending" | "unread" | "resolved") => {
    if (key === "unread") { setFilterUnread((v) => !v); return; }
    setFilterUnread(false);
    setFilterStatus((prev) => (prev === key ? "all" : key));
  }, []);

  const handleSelectConversation = (conv: WaConversation) => {
    lastSyncedConvRef.current = JSON.stringify(conv); setSelectedConv(conv);
    if (conv.unread_count > 0) updateConversation({ id: conv.id, updates: { unread_count: 0 } as any });
  };

  const handleSendMessage = async (content: string, isNote?: boolean, quotedMessageId?: string) => { if (!selectedConv) return; await sendMessage({ content, isInternalNote: isNote, quotedMessageId }); };
  const handleSendMedia = useCallback(async (file: File, caption?: string) => {
    if (!selectedConv) return;
    try {
      const tid = await getCurrentTenantId(); if (!tid) throw new Error("Tenant não encontrado");
      const ext = file.name.split(".").pop() || "bin";
      const filePath = tenantPath(tid, selectedConv.id, `${Date.now()}.${ext}`);
      const { error: uploadError } = await supabase.storage.from("wa-attachments").upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: urlData, error: signErr } = await supabase.storage.from("wa-attachments").createSignedUrl(filePath, 60 * 60 * 24 * 365);
      if (signErr || !urlData?.signedUrl) throw signErr ?? new Error("Falha ao gerar URL");
      let messageType = "document";
      if (file.type.startsWith("image/")) messageType = "image"; else if (file.type.startsWith("video/")) messageType = "video"; else if (file.type.startsWith("audio/")) messageType = "audio";
      await sendMessage({ content: caption || file.name, messageType, mediaUrl: urlData.signedUrl, mediaFilename: file.name });
    } catch (err: any) { toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" }); }
  }, [selectedConv, sendMessage, toast]);

  const handleSendReaction = async (messageId: string, reaction: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession(); if (!session) return;
      await supabase.functions.invoke("send-wa-reaction", { headers: { Authorization: `Bearer ${session.access_token}` }, body: { message_id: messageId, reaction } });
    } catch {}
  };

  const handleResolve = async (sendSurvey: boolean) => {
    if (!selectedConv) return; setShowResolve(false); resolveConversation(selectedConv.id); setSelectedConv({ ...selectedConv, status: "resolved" });
    if (!sendSurvey) return;
    try {
      const surveyMessage = "Olá! Seu atendimento foi finalizado. 😊\n\nPor favor, avalie nosso atendimento de 1 a 5:\n⭐ 1 - Péssimo\n⭐⭐ 2 - Ruim\n⭐⭐⭐ 3 - Regular\n⭐⭐⭐⭐ 4 - Bom\n⭐⭐⭐⭐⭐ 5 - Excelente\n\nResponda apenas com o número (1 a 5).";
      const { data: conv } = await supabase.from("wa_conversations").select("instance_id, remote_jid, tenant_id").eq("id", selectedConv.id).single();
      if (!conv) return;
      const { data: msg } = await supabase.from("wa_messages").insert({ conversation_id: selectedConv.id, direction: "out", message_type: "text", content: surveyMessage, sent_by_user_id: user?.id, is_internal_note: false, status: "pending" }).select().single();
      if (msg) {
        await supabase.rpc("enqueue_wa_outbox_item", { p_tenant_id: conv.tenant_id, p_instance_id: conv.instance_id, p_remote_jid: conv.remote_jid, p_message_type: "text", p_content: surveyMessage, p_conversation_id: selectedConv.id, p_message_id: msg.id, p_idempotency_key: `satisfaction_${selectedConv.id}_${msg.id}` });
        await supabase.from("wa_satisfaction_ratings").insert({ tenant_id: conv.tenant_id, conversation_id: selectedConv.id, attendant_user_id: selectedConv.assigned_to || user?.id });
        supabase.functions.invoke("process-wa-outbox").catch(() => {});
      }
    } catch {}
  };

  const handleReopen = () => { if (selectedConv) { reopenConversation(selectedConv.id); setSelectedConv({ ...selectedConv, status: "open" }); } };

  const handleTransfer = async (toUserId: string, reason?: string) => {
    if (!selectedConv) return;
    const targetVendedor = vendedores.find((v) => v.user_id === toUserId || v.id === toUserId);
    try { await sendMessage({ content: `🔄 Você está sendo transferido para *${targetVendedor?.nome || "outro atendente"}*.${reason ? `\n\n📝 Motivo: ${reason}` : ""}`, isInternalNote: false }); } catch {}
    await transferConversation({ conversationId: selectedConv.id, toUserId, reason }); setSelectedConv(null);
  };

  const handleAssign = (userId: string | null) => { if (selectedConv) { assignConversation({ conversationId: selectedConv.id, userId }); setSelectedConv({ ...selectedConv, assigned_to: userId }); } };
  const handleAccept = async () => { if (selectedConv && user) { const result = await assignConversationAsync({ conversationId: selectedConv.id, userId: user.id, requireUnassigned: true }); if (result?.accepted) setSelectedConv({ ...selectedConv, assigned_to: user.id }); else setSelectedConv(null); } };
  const handleRelease = () => { if (selectedConv) { assignConversation({ conversationId: selectedConv.id, userId: null }); setSelectedConv({ ...selectedConv, assigned_to: null }); } };
  const handleLinkLead = ({ leadId, clienteId }: { leadId: string | null; clienteId: string | null }) => { if (selectedConv) { updateConversation({ id: selectedConv.id, updates: { lead_id: leadId, cliente_id: clienteId } }); setSelectedConv({ ...selectedConv, lead_id: leadId, cliente_id: clienteId }); } };
  const handleToggleTag = (tagId: string, add: boolean) => { if (selectedConv) toggleConversationTag({ conversationId: selectedConv.id, tagId, add }); };

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden relative">
      {/* Header Compact: max 56px */}
      <header className="shrink-0 h-[56px] px-4 border-b border-border/40 bg-card/80 backdrop-blur-md flex items-center justify-between gap-4 z-20">
        <div className="flex items-center gap-3 overflow-hidden">
          <WaInboxHeader instances={instances} onNewChat={() => setShowStartChat(true)} onSettings={() => setShowSettings(true)} compact />
          <div className="hidden md:block h-4 w-px bg-border/40 mx-1" />
          <WaInboxStats conversations={allConversations} compact onSelect={handleKpiSelect} activeKey={filterStatus as any} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setShowSettings(true)}><Settings className="h-4 w-4" /></Button>
          <Button variant="default" size="sm" className="h-8 gap-1.5" onClick={() => setShowStartChat(true)}><MessageCirclePlus className="h-4 w-4" /><span className="hidden sm:inline">Nova conversa</span></Button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 w-full overflow-hidden">
        <aside className="w-[280px] shrink-0 border-r border-border/40 bg-muted/5 flex flex-col min-h-0 overflow-hidden">
          <WaConversationList
            conversations={sortPinned(allConversations)} loading={convsLoading} selectedId={selectedConv?.id} onSelect={handleSelectConversation} search={search} onSearchChange={setSearch}
            filterStatus={filterStatus} onFilterStatusChange={setFilterStatus} filterAssigned={filterAssigned} onFilterAssignedChange={setFilterAssigned}
            filterInstance={filterInstance} onFilterInstanceChange={setFilterInstance} filterTag={filterTag} onFilterTagChange={setFilterTag}
            vendedores={vendedores} instances={instances} tags={tags} hideAssignedFilter={vendorMode} showGroups={showGroups} onShowGroupsChange={setShowGroups}
            showHidden={showHidden} onShowHiddenChange={setShowHidden} mutedIds={mutedIds} hiddenIds={hiddenIds} followupConvIds={followupConvIds} pinnedIds={pinnedIds} onContextMenuConv={handleContextMenuConv}
          />
        </aside>

        <main className="flex-1 min-w-0 bg-background relative flex flex-col">
          <WaChatPanel
            conversation={selectedConv} messages={messages} loading={msgsLoading} isSending={isSending} initialLoadDone={initialLoadDone} isLoadingMore={isLoadingMore}
            hasOlderMessages={hasOlderMessages} onLoadOlder={loadOlderMessages} onSendMessage={handleSendMessage} onSendMedia={handleSendMedia} onSendReaction={handleSendReaction}
            onResolve={() => setShowResolve(true)} onReopen={handleReopen} onOpenTransfer={() => setShowTransfer(true)} onOpenTags={() => setShowTags(true)} onOpenAssign={() => setShowAssign(true)}
            onLinkLead={() => setShowLinkLead(true)} onSaveContact={() => setSaveContactFor(selectedConv)} onAccept={handleAccept} onRelease={handleRelease} isAccepting={isAccepting}
            currentUserId={user?.id} vendedores={vendedores} lastReadMessageId={lastReadMessageId} onMarkAsRead={markAsRead}
            isMuted={selectedConv ? isMuted(selectedConv.id) : false} isHidden={selectedConv ? isHidden(selectedConv.id) : false} onToggleMute={() => selectedConv && toggleMute(selectedConv.id)} onToggleHide={() => selectedConv && toggleHide(selectedConv.id)}
            prefillMessage={prefillMessage} onRetryMessage={retryMessage} isAdmin={isAdminUser} onBack={() => setSelectedConv(null)}
          />
        </main>
      </div>

      <WaTransferDialog open={showTransfer} onOpenChange={setShowTransfer} onTransfer={handleTransfer} vendedores={vendedores} currentAssigned={selectedConv?.assigned_to} />
      <WaAssignDialog open={showAssign} onOpenChange={setShowAssign} onAssign={handleAssign} vendedores={vendedores} currentAssigned={selectedConv?.assigned_to || null} />
      <WaTagsDialog open={showTags} onOpenChange={setShowTags} conversation={selectedConv} allTags={tags} onToggleTag={handleToggleTag} onCreateTag={createTag} onDeleteTag={deleteTag} />
      <WaLinkLeadSearch open={showLinkLead} onOpenChange={setShowLinkLead} conversation={selectedConv} onLink={handleLinkLead} />
      <WaResolveDialog open={showResolve} onOpenChange={setShowResolve} onConfirm={handleResolve} clienteName={selectedConv?.cliente_nome || undefined} />
      <WaSettingsDialog open={showSettings} onOpenChange={setShowSettings} />
      <WaStartConversationDialog open={showStartChat} onOpenChange={setShowStartChat} instances={instances} onConversationStarted={(id) => { setShowStartChat(false); setPendingNewConvId(id); queryClient.invalidateQueries({ queryKey: ["wa-conversations"] }); }} />
      <WaConversationContextMenu state={convContextMenu} onClose={() => setConvContextMenu(null)} isPinned={convContextMenu ? pinnedIds.has(convContextMenu.conversation.id) : false} onTogglePin={() => convContextMenu && togglePin(convContextMenu.conversation.id)} onAssignToMe={() => { if (convContextMenu && user) assignConversation({ conversationId: convContextMenu.conversation.id, userId: user.id }); }} hasUnread={(convContextMenu?.conversation.unread_count ?? 0) > 0} onToggleRead={() => { if (!convContextMenu) return; const c = convContextMenu.conversation; updateConversation({ id: c.id, updates: { unread_count: c.unread_count > 0 ? 0 : 1 } as any }); }} tags={tags} appliedTagIds={new Set((convContextMenu?.conversation.tags || []).map((t) => t.tag_id))} onToggleTag={(tagId) => { if (!convContextMenu) return; const c = convContextMenu.conversation; const applied = (c.tags || []).some((t) => t.tag_id === tagId); toggleConversationTag({ conversationId: c.id, tagId, add: !applied }); }} isResolved={convContextMenu?.conversation.status === "resolved"} onResolve={() => convContextMenu && resolveConversation(convContextMenu.conversation.id)} onReopen={() => convContextMenu && reopenConversation(convContextMenu.conversation.id)} onCreateLead={() => { if (convContextMenu) setSaveContactFor(convContextMenu.conversation); }} onCreateCliente={() => { if (convContextMenu) setSaveContactFor(convContextMenu.conversation); }} onOpenConversation={() => { if (convContextMenu) setSelectedConv(convContextMenu.conversation); }} onCopyPhone={() => { const phone = convContextMenu?.conversation.cliente_telefone; if (phone) navigator.clipboard?.writeText(phone).then(() => toast({ title: "Telefone copiado" })); }} isMuted={convContextMenu ? mutedIds.has(convContextMenu.conversation.id) : false} onToggleMute={() => convContextMenu && toggleMute(convContextMenu.conversation.id)} isHidden={convContextMenu ? hiddenIds.has(convContextMenu.conversation.id) : false} onToggleHide={() => convContextMenu && toggleHide(convContextMenu.conversation.id)} />
      <WaSaveContactModal open={!!saveContactFor} onOpenChange={(o) => { if (!o) setSaveContactFor(null); }} conversationId={saveContactFor?.id ?? null} initialPhone={saveContactFor?.cliente_telefone ?? saveContactFor?.remote_jid ?? null} initialName={saveContactFor?.cliente_nome ?? null} onLinked={({ leadId, clienteId }) => { if (saveContactFor && selectedConv?.id === saveContactFor.id) setSelectedConv({ ...selectedConv, lead_id: leadId, cliente_id: clienteId }); }} />
    </div>
  );
}