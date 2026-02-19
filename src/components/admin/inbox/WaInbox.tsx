import { useState, useEffect, useRef, useMemo } from "react";
import { MessageCircle, MessageCirclePlus, Settings } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWaConversations, useWaMessages, useWaTags, useWaReadTracking } from "@/hooks/useWaInbox";
import { useWaInstances } from "@/hooks/useWaInstances";
import { useWaConversationPreferences } from "@/hooks/useWaConversationPreferences";
import { useAuth } from "@/hooks/useAuth";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useToast } from "@/hooks/use-toast";
import { useWaSlaAlerts } from "@/hooks/useWaSlaAlerts";
import { WaConversationList } from "./WaConversationList";
import { WaChatPanel } from "./WaChatPanel";
import { WaTransferDialog, WaAssignDialog, WaTagsDialog } from "./WaInboxDialogs";
import { WaLinkLeadSearch } from "./WaLinkLeadSearch";
import { WaInboxStats } from "./WaInboxStats";
import { WaResolveDialog } from "./WaResolveDialog";
import { WaSlaAlertBanner } from "./WaSlaAlertBanner";
import { WaFollowupWidget } from "@/components/admin/widgets/WaFollowupWidget";
import { WaSettingsDialog } from "./WaSettingsDialog";
import { WaStartConversationDialog } from "./WaStartConversationDialog";
import { Button } from "@/components/ui/button";
import type { WaConversation } from "@/hooks/useWaInbox";

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
  /** Custom prefill message — skips default template when provided */
  prefillMessage?: string;
}

interface WaInboxProps {
  vendorMode?: boolean;
  vendorUserId?: string | null;
  showCompactStats?: boolean;
  initialConversationId?: string | null;
}

export function WaInbox({ vendorMode = false, vendorUserId, showCompactStats = false, initialConversationId }: WaInboxProps) {
  // Filters
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("open");
  const [filterAssigned, setFilterAssigned] = useState("all");
  const [filterInstance, setFilterInstance] = useState("all");
  const [filterTag, setFilterTag] = useState("all");
  // In vendor mode with impersonation, check permissions of the target vendor, not the admin
  const permissionTargetId = vendorMode && vendorUserId ? vendorUserId : undefined;
  const { hasPermission, isAdmin: isAdminUser, loading: permissionsLoading } = useUserPermissions(permissionTargetId);
  const canViewGroups = hasPermission("view_groups");
  const canViewHidden = hasPermission("view_hidden");
  // Default to false for non-admins to prevent flash of group content while loading
  const [showGroups, setShowGroups] = useState(false);
  const [showHidden, setShowHidden] = useState(false);

  // Once permissions load, if user can view groups, default toggle to ON
  useEffect(() => {
    if (!permissionsLoading && canViewGroups) {
      setShowGroups(true);
    }
  }, [permissionsLoading, canViewGroups]);

  // Selected conversation
  const [selectedConv, setSelectedConv] = useState<WaConversation | null>(null);

  // Dialogs
  const [showTransfer, setShowTransfer] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [showLinkLead, setShowLinkLead] = useState(false);
  const [showResolve, setShowResolve] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showStartChat, setShowStartChat] = useState(false);
  const [prefillMessage, setPrefillMessage] = useState<string | null>(null);
  const [preContactData, setPreContactData] = useState<LeadAutoOpenData | null>(null);
  const autoOpenProcessedRef = useRef(false);

  // Notification sound
  const prevUnreadRef = useRef<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Hooks
  const { instances } = useWaInstances();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Determine the effective user for vendor mode
  const effectiveUserId = vendorUserId || (vendorMode ? user?.id : undefined);

  // Fetch vendedores (moved up so vendorInstanceIds can reference it)
  const { data: vendedores = [] } = useQuery({
    queryKey: ["vendedores-wa-inbox"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("consultores").select("id, nome, user_id").eq("ativo", true);
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const effectiveAssigned = vendorMode ? "all" : filterAssigned;

  // RLS handles vendor visibility at DB level — do NOT filter by status in the query
  // so stats and list share the same data source (single source of truth)
  // ⚠️ IMPORTANT: In vendor mode, we MUST filter by vendorUserId because an admin
  // impersonating a vendor still has admin RLS (sees everything). The client-side
  // filter ensures only the vendor's conversations are shown.
  const conversationFilters = {
    assigned_to: vendorMode && effectiveUserId
      ? effectiveUserId
      : (!vendorMode && effectiveAssigned !== "all" && effectiveAssigned !== "unassigned" ? effectiveAssigned : undefined),
    instance_id: filterInstance !== "all" ? filterInstance : undefined,
    search: search || undefined,
    vendor_user_id: vendorMode ? effectiveUserId : undefined,
  };

  const {
    conversations: allConversations,
    loading: convsLoading,
    assignConversation,
    assignConversationAsync,
    isAccepting,
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
  const { mutedIds, hiddenIds, isMuted, isHidden, toggleMute, toggleHide } = useWaConversationPreferences();

  // SLA Alerts
  const {
    alerts: slaAlerts,
    myAlerts: mySlaAlerts,
    unacknowledgedCount: slaUnackedCount,
    acknowledgeAlert: acknowledgeSlaAlert,
    acknowledgeAll: acknowledgeAllSla,
    isEnabled: slaEnabled,
  } = useWaSlaAlerts();

  // Follow-up queue: pending follow-ups for badge indicators
  const { data: pendingFollowups = [] } = useQuery({
    queryKey: ["wa-followup-pending-inbox"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wa_followup_queue")
        .select("id, conversation_id, assigned_to, rule_id")
        .eq("status", "pendente");
      if (error) throw error;
      return data || [];
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const followupConvIds = useMemo(
    () => new Set(pendingFollowups.map((f) => f.conversation_id)),
    [pendingFollowups]
  );

  // Realtime listener for new follow-ups → toast notification (tenant-scoped)
  const [followupTenantId, setFollowupTenantId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    import("@/lib/storagePaths").then(({ getCurrentTenantId }) =>
      getCurrentTenantId().then((tid) => { if (!cancelled) setFollowupTenantId(tid); })
    );
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!followupTenantId) return;
    const channel = supabase
      .channel("followup-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "wa_followup_queue", filter: `tenant_id=eq.${followupTenantId}` },
        (payload) => {
          const newFU = payload.new as any;
          if (newFU.assigned_to === user?.id) {
            toast({
              title: "⏰ Novo Follow-up",
              description: "Uma conversa precisa de atenção!",
            });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [followupTenantId, user?.id, toast]);

  // Auto-select conversation from initialConversationId (e.g. from Contacts recall)
  // Format: "uuid" or "uuid:timestamp" (timestamp used to force re-trigger)
  const initialConvHandledRef = useRef<string | null>(null);
  const initialConvRetried = useRef(false);
  useEffect(() => {
    if (
      initialConversationId &&
      initialConversationId !== initialConvHandledRef.current &&
      allConversations.length > 0
    ) {
      const convId = initialConversationId.split(":")[0]; // strip timestamp suffix
      const target = allConversations.find((c) => c.id === convId);
      if (target) {
        setSelectedConv(target);
        initialConvHandledRef.current = initialConversationId;
        initialConvRetried.current = false;
        // Switch filter to show the conversation regardless of current status filter
        if (target.status !== filterStatus && filterStatus !== "all") {
          setFilterStatus(target.status || "open");
        }
      } else if (!initialConvRetried.current) {
        // Conversation not in list yet (just created) — retry once after refetch
        initialConvRetried.current = true;
        queryClient.invalidateQueries({ queryKey: ["wa-conversations"] });
      }
    }
  }, [initialConversationId, allConversations, queryClient]);

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
    const totalUnread = allConversations
      .filter((c) => !mutedIds.has(c.id))
      .reduce((sum, c) => sum + c.unread_count, 0);
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

  // 🚀 Auto-open conversation from lead creation (sessionStorage signal)
  useEffect(() => {
    if (autoOpenProcessedRef.current || convsLoading || allConversations.length === 0) return;

    const raw = sessionStorage.getItem("wa_auto_open_lead");
    if (!raw) return;

    autoOpenProcessedRef.current = true;
    sessionStorage.removeItem("wa_auto_open_lead");

    try {
      const data: LeadAutoOpenData = JSON.parse(raw);
      const phoneDigits = data.phone.replace(/\D/g, "");
      if (phoneDigits.length < 10) return;

      // Prefer direct match by assignedConvId (already assigned via DB function)
      let match: WaConversation | undefined;
      if (data.assignedConvId) {
        match = allConversations.find((c) => c.id === data.assignedConvId);
      }

      // Fallback: match by phone digits
      if (!match) {
        match = allConversations.find((c) => {
          const remoteDigits = c.remote_jid?.replace(/\D/g, "") || "";
          const telDigits = c.cliente_telefone?.replace(/\D/g, "") || "";
          return remoteDigits.includes(phoneDigits) || telDigits.includes(phoneDigits)
            || phoneDigits.includes(remoteDigits.slice(-10)) || phoneDigits.includes(telDigits.slice(-10));
        });
      }

      if (match) {
        // Open existing conversation (already assigned to vendor via DB function)
        handleSelectConversation(match);
        // Ensure status filter shows this conversation
        if (match.status !== filterStatus && filterStatus !== "all") {
          setFilterStatus("all");
        }
      } else {
        // No conversation found — show pre-contact card
        setPreContactData(data);
      }

      // Build prefill message: use custom if provided, otherwise build default
      if (data.prefillMessage) {
        setPrefillMessage(data.prefillMessage);
      } else {
        const autoMsg = localStorage.getItem("wa_auto_message_enabled");
        if (autoMsg !== "false") {
          const parts: string[] = [];
          parts.push(`Olá ${data.nome || ""}! 👋`);
          parts.push(`Aqui é ${data.consultor_nome || "a equipe"} da Mais Energia Solar ☀️`);
          parts.push("");
          parts.push("Recebi sua solicitação e já estou preparando sua simulação.");
          parts.push("");
          if (data.cidade && data.estado) {
            parts.push(`📍 Localização: ${data.cidade}/${data.estado}`);
          } else if (data.cidade) {
            parts.push(`📍 Cidade: ${data.cidade}`);
          }
          if (data.consumo) parts.push(`⚡ Consumo médio: ${data.consumo} kWh`);
          if (data.tipo_telhado) parts.push(`🏠 Tipo de telhado: ${data.tipo_telhado}`);
          if (data.rede_atendimento) parts.push(`🔌 Rede: ${data.rede_atendimento}`);
          parts.push("");
          parts.push("Vou te fazer algumas perguntas rápidas e já te envio um estudo completo 🙂");
          setPrefillMessage(parts.filter((p) => p !== undefined).join("\n"));
        }
      }
    } catch (err) {
      console.warn("[WaInbox] Failed to parse auto-open lead data:", err);
    }
  }, [allConversations, convsLoading]);

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
    // Group filter - if user has no permission, always hide groups
    if (!canViewGroups && c.is_group) return false;
    if (canViewGroups && !showGroups && c.is_group) return false;
    // Hidden filter - if user has no permission, always hide
    if (!canViewHidden && hiddenIds.has(c.id)) return false;
    if (canViewHidden && !showHidden && hiddenIds.has(c.id)) return false;
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
          // Queue via canonical RPC
          const idempKey = `satisfaction_${selectedConv.id}_${msg.id}`;
          await supabase.rpc("enqueue_wa_outbox_item", {
            p_tenant_id: conv.tenant_id,
            p_instance_id: conv.instance_id,
            p_remote_jid: conv.remote_jid,
            p_message_type: "text",
            p_content: surveyMessage,
            p_conversation_id: selectedConv.id,
            p_message_id: msg.id,
            p_idempotency_key: idempKey,
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
    setSelectedConv(null);
  };

  const handleAssign = (userId: string | null) => {
    if (!selectedConv) return;
    assignConversation({ conversationId: selectedConv.id, userId });
    setSelectedConv({ ...selectedConv, assigned_to: userId });
  };

  const handleAccept = async () => {
    if (!selectedConv || !user) return;
    const result = await assignConversationAsync({ conversationId: selectedConv.id, userId: user.id, requireUnassigned: true });
    if (result?.accepted) {
      setSelectedConv({ ...selectedConv, assigned_to: user.id });
    } else {
      // Race lost — refresh list to remove the conversation
      setSelectedConv(null);
    }
  };

  const handleRelease = () => {
    if (!selectedConv) return;
    assignConversation({ conversationId: selectedConv.id, userId: null });
    setSelectedConv({ ...selectedConv, assigned_to: null });
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
    <div className={`${vendorMode ? "flex flex-col h-full w-full max-w-full overflow-x-hidden" : "space-y-4"}`} data-wa-inbox-active>
      {/* Header — hidden in vendor/standalone mode */}
      {!vendorMode && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-success/10 border border-success/20">
              <MessageCircle className="h-6 w-6 text-success" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Central de Atendimento</h2>
              <p className="text-sm text-muted-foreground">
                {instances.length > 0 && (
                  <span className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${instances.some(i => i.status === "connected") ? "bg-success animate-pulse" : "bg-destructive"}`} />
                    {instances.filter(i => i.status === "connected").length}/{instances.length} instâncias online
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowStartChat(true)}
              title="Iniciar nova conversa"
            >
              <MessageCirclePlus className="h-4 w-4 mr-1" />
              Nova conversa
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowSettings(true)}
              title="Configurações WhatsApp"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Stats - only in admin mode */}
      {!vendorMode && <WaInboxStats conversations={allConversations} />}

      {/* Compact stats for vendor/mobile mode */}
      {vendorMode && showCompactStats && <WaInboxStats conversations={allConversations} compact />}

      {/* SLA Alerts Banner */}
      {slaEnabled && (
        <WaSlaAlertBanner
          alerts={isAdminUser ? slaAlerts : mySlaAlerts}
          onOpenConversation={(convId) => {
            const conv = allConversations.find((c) => c.id === convId);
            if (conv) handleSelectConversation(conv);
          }}
          onAcknowledge={acknowledgeSlaAlert}
          onAcknowledgeAll={acknowledgeAllSla}
          isAdmin={isAdminUser}
        />
      )}

      {/* Follow-up Widget */}
      <WaFollowupWidget
        vendorUserId={vendorMode ? effectiveUserId : undefined}
        onOpenConversation={(convId) => {
          const conv = allConversations.find((c) => c.id === convId);
          if (conv) {
            handleSelectConversation(conv);
          } else {
            supabase
              .from("wa_conversations")
              .select("*")
              .eq("id", convId)
              .maybeSingle()
              .then(({ data }) => {
                if (data) handleSelectConversation(data as any);
              });
          }
        }}
      />

      {/* Chat Layout */}
      <div
        className={`bg-card rounded-xl border border-border/40 shadow-sm overflow-hidden ${
          vendorMode ? "flex-1 min-h-0" : ""
        }`}
        style={vendorMode ? undefined : { height: "calc(100vh - 300px)", minHeight: "500px" }}
      >
        <div className="flex h-full min-w-0 w-full max-w-full overflow-x-hidden">
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
              hideAssignedFilter={vendorMode}
              showGroups={showGroups}
              onShowGroupsChange={canViewGroups ? setShowGroups : undefined}
              showHidden={showHidden}
              onShowHiddenChange={canViewHidden ? setShowHidden : undefined}
              mutedIds={mutedIds}
              hiddenIds={hiddenIds}
              followupConvIds={followupConvIds}
            />
          </div>

          {/* Mobile */}
          <div className="flex-1 flex flex-col md:hidden min-w-0 max-w-full overflow-x-hidden">
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
                  onAccept={handleAccept}
                  onRelease={handleRelease}
                  isAccepting={isAccepting}
                  isReleasing={isAccepting}
                  currentUserId={user?.id}
                  vendedores={vendedores}
                  lastReadMessageId={lastReadMessageId}
                  onMarkAsRead={markAsRead}
                  isMuted={selectedConv ? isMuted(selectedConv.id) : false}
                  isHidden={selectedConv ? isHidden(selectedConv.id) : false}
                  onToggleMute={selectedConv ? () => toggleMute(selectedConv.id) : undefined}
                  onToggleHide={selectedConv ? () => toggleHide(selectedConv.id) : undefined}
                  prefillMessage={prefillMessage}
                />
              </>
            ) : preContactData ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 gap-3">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-warning/15 to-warning/5 border border-warning/10 flex items-center justify-center">
                  <MessageCircle className="h-7 w-7 text-warning/60" />
                </div>
                <h3 className="text-base font-semibold text-foreground/70">Pré-Contato</h3>
                <p className="text-sm text-muted-foreground">
                  <strong>{preContactData.nome}</strong> ainda não iniciou conversa.
                </p>
                <a
                  href={`https://wa.me/${preContactData.phone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-success text-white font-medium rounded-lg hover:bg-success/90 transition-colors"
                  onClick={() => setPreContactData(null)}
                >
                  <MessageCircle className="h-4 w-4" />
                  Iniciar Conversa
                </a>
                <button onClick={() => setPreContactData(null)} className="text-xs text-muted-foreground hover:text-foreground">
                  Voltar
                </button>
              </div>
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
                hideAssignedFilter={vendorMode}
                showGroups={showGroups}
                onShowGroupsChange={canViewGroups ? setShowGroups : undefined}
                showHidden={showHidden}
                onShowHiddenChange={canViewHidden ? setShowHidden : undefined}
                mutedIds={mutedIds}
                hiddenIds={hiddenIds}
                followupConvIds={followupConvIds}
              />
            )}
          </div>

          {/* Desktop: Chat Panel or Pre-Contact Card */}
          <div className="hidden md:flex flex-1 min-w-0 overflow-x-hidden">
            {!selectedConv && preContactData ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-gradient-to-b from-muted/5 to-muted/20 gap-4">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-warning/15 to-warning/5 border border-warning/10 flex items-center justify-center shadow-lg shadow-warning/5">
                  <MessageCircle className="h-9 w-9 text-warning/60" />
                </div>
                <h3 className="text-lg font-semibold text-foreground/70">Novo Lead — Pré-Contato</h3>
                <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                  <strong>{preContactData.nome}</strong> ainda não iniciou conversa no WhatsApp.
                </p>
                <p className="text-xs text-muted-foreground">{preContactData.phone}</p>
                <a
                  href={`https://wa.me/${preContactData.phone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-success text-white font-medium rounded-lg hover:bg-success/90 transition-colors shadow-md"
                  onClick={() => setPreContactData(null)}
                >
                  <MessageCircle className="h-4 w-4" />
                  Iniciar Conversa no WhatsApp
                </a>
                <button
                  onClick={() => setPreContactData(null)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Fechar
                </button>
              </div>
            ) : (
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
                onAccept={handleAccept}
                onRelease={handleRelease}
                isAccepting={isAccepting}
                isReleasing={isAccepting}
                currentUserId={user?.id}
                vendedores={vendedores}
                lastReadMessageId={lastReadMessageId}
                onMarkAsRead={markAsRead}
                isMuted={selectedConv ? isMuted(selectedConv.id) : false}
                isHidden={selectedConv ? isHidden(selectedConv.id) : false}
                onToggleMute={selectedConv ? () => toggleMute(selectedConv.id) : undefined}
                onToggleHide={selectedConv ? () => toggleHide(selectedConv.id) : undefined}
                prefillMessage={prefillMessage}
              />
            )}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <WaTransferDialog open={showTransfer} onOpenChange={setShowTransfer} onTransfer={handleTransfer} vendedores={vendedores} currentAssigned={selectedConv?.assigned_to} />
      <WaAssignDialog open={showAssign} onOpenChange={setShowAssign} onAssign={handleAssign} vendedores={vendedores} currentAssigned={selectedConv?.assigned_to || null} />
      <WaTagsDialog open={showTags} onOpenChange={setShowTags} conversation={selectedConv} allTags={tags} onToggleTag={handleToggleTag} onCreateTag={createTag} onDeleteTag={deleteTag} />
      <WaLinkLeadSearch open={showLinkLead} onOpenChange={setShowLinkLead} conversation={selectedConv} onLink={handleLinkLead} />
      <WaResolveDialog open={showResolve} onOpenChange={setShowResolve} onConfirm={handleResolve} clienteName={selectedConv?.cliente_nome || undefined} />
      <WaSettingsDialog open={showSettings} onOpenChange={setShowSettings} />
      <WaStartConversationDialog
        open={showStartChat}
        onOpenChange={setShowStartChat}
        instances={instances}
        onConversationStarted={async (convId) => {
          await queryClient.invalidateQueries({ queryKey: ["wa-conversations"] });
          setTimeout(() => {
            const conv = allConversations.find((c) => c.id === convId);
            if (conv) handleSelectConversation(conv);
          }, 500);
        }}
      />
    </div>
  );
}
