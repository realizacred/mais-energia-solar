import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { MessageCircle, WifiOff, QrCode } from "lucide-react";
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
  const { get: getSiteSetting } = useSiteSettings();
  const nomeEmpresa = getSiteSetting("nome_empresa") || "nossa empresa";
  // URL sync (only outside vendor mode to avoid conflicts with impersonation views)
  const [searchParams, setSearchParams] = useSearchParams();
  const urlEnabled = !vendorMode;
  const initFrom = (key: string, fallback: string) =>
    (urlEnabled && searchParams.get(key)) || fallback;

  // Filters
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState(() => initFrom("status", "open"));
  const [filterAssigned, setFilterAssigned] = useState(() => initFrom("assigned", "all"));
  const [filterInstance, setFilterInstance] = useState(() => initFrom("instance", "all"));
  const [filterTag, setFilterTag] = useState(() => initFrom("tag", "all"));
  const [filterUnread, setFilterUnread] = useState(() => urlEnabled && searchParams.get("unread") === "1");
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

  // Force stable inbox scroll layout in admin (prevents page-level scroll leaks)
  useEffect(() => {
    if (vendorMode) return;

    document.documentElement.classList.add("wa-inbox-admin");
    document.body.classList.add("wa-inbox-admin");

    return () => {
      document.documentElement.classList.remove("wa-inbox-admin");
      document.body.classList.remove("wa-inbox-admin");
    };
  }, [vendorMode]);

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
  const [pendingNewConvId, setPendingNewConvId] = useState<string | null>(null);
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

  // Fetch vendedores
  const { data: vendedores = [] } = useConsultoresAtivos();

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
    retryMessage,
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
    pauseSla: pauseSlaConversation,
    isEnabled: slaEnabled,
  } = useWaSlaAlerts();

  // Follow-up queue: pending follow-ups for badge indicators
  const { data: pendingFollowups = [] } = useWaFollowupPending();

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
      // Set filter to "all" so the target conversation is never hidden by status filter
      if (filterStatus !== "all") {
        setFilterStatus("all");
      }

      const convId = initialConversationId.split(":")[0]; // strip timestamp suffix
      const target = allConversations.find((c) => c.id === convId);
      if (target) {
        setSelectedConv(target);
        initialConvHandledRef.current = initialConversationId;
        initialConvRetried.current = false;
      } else if (!initialConvRetried.current) {
        // Conversation not in list yet (just created) — retry once after refetch
        initialConvRetried.current = true;
        queryClient.invalidateQueries({ queryKey: ["wa-conversations"] });
      }
    }
  }, [initialConversationId, allConversations, filterStatus, queryClient]);

  // Auto-open newly created conversation (from "Nova conversa" dialog).
  // Waits for the conversation to appear in the list after invalidation.
  useEffect(() => {
    if (!pendingNewConvId) return;
    const target = allConversations.find((c) => c.id === pendingNewConvId);
    if (target) {
      if (filterStatus !== "all") setFilterStatus("all");
      setSelectedConv(target);
      setPendingNewConvId(null);
    }
  }, [pendingNewConvId, allConversations, filterStatus]);

  // Safety: if conversation never shows up (5s), give up silently
  useEffect(() => {
    if (!pendingNewConvId) return;
    const t = setTimeout(() => setPendingNewConvId(null), 5000);
    return () => clearTimeout(t);
  }, [pendingNewConvId]);

  // Keep selectedConv in sync with query data (e.g. after tag toggle, status change)
  // Uses a ref to store the last synced conversation JSON to avoid re-render loops
  const lastSyncedConvRef = useRef<string>("");
  useEffect(() => {
    if (selectedConv) {
      const fresh = allConversations.find((c) => c.id === selectedConv.id);
      if (fresh) {
        const freshJson = JSON.stringify(fresh);
        if (freshJson !== lastSyncedConvRef.current) {
          lastSyncedConvRef.current = freshJson;
          setSelectedConv(fresh);
        }
      }
    }
  }, [allConversations]); // eslint-disable-line react-hooks/exhaustive-deps

  // 🔔 Notification sound + vibration on new unread messages (even when on inbox)
  useEffect(() => {
    const totalUnread = allConversations
      .filter((c) => !mutedIds.has(c.id))
      .reduce((sum, c) => sum + c.unread_count, 0);
    if (totalUnread > prevUnreadRef.current && prevUnreadRef.current > 0) {
      // Play sound
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        if (ctx.state === "suspended") ctx.resume();
        const t = ctx.currentTime;
        // Quick double-chime
        [784, 1047].forEach((freq, i) => {
          const g = ctx.createGain();
          g.connect(ctx.destination);
          g.gain.setValueAtTime(0.5, t + i * 0.15);
          g.gain.exponentialRampToValueAtTime(0.01, t + i * 0.15 + 0.4);
          const o = ctx.createOscillator();
          o.type = "sine";
          o.frequency.setValueAtTime(freq, t + i * 0.15);
          o.connect(g);
          o.start(t + i * 0.15);
          o.stop(t + i * 0.15 + 0.3);
        });
      } catch {
        // Audio not available
      }
      // Vibrate on mobile
      if ("vibrate" in navigator) {
        navigator.vibrate([200, 100, 200]);
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
          parts.push(`Aqui é ${data.consultor_nome || "a equipe"} da ${nomeEmpresa} ☀️`);
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

  // Sync filters → URL (preserve other params, only push when changed)
  useEffect(() => {
    if (!urlEnabled) return;
    const next = new URLSearchParams(searchParams);
    const setOrDel = (k: string, v: string, def: string) => {
      if (v && v !== def) next.set(k, v); else next.delete(k);
    };
    setOrDel("status", filterStatus, "open");
    setOrDel("assigned", filterAssigned, "all");
    setOrDel("instance", filterInstance, "all");
    setOrDel("tag", filterTag, "all");
    if (filterUnread) next.set("unread", "1"); else next.delete("unread");
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [filterStatus, filterAssigned, filterInstance, filterTag, filterUnread, urlEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // KPI click handler
  const handleKpiSelect = useCallback((key: "open" | "pending" | "unread" | "resolved") => {
    if (key === "unread") {
      setFilterUnread((v) => !v);
      return;
    }
    setFilterUnread(false);
    setFilterStatus((prev) => (prev === key ? "all" : key));
  }, []);

  // Single source of truth: filter client-side for status, unassigned, and tags
  const filteredConvs = allConversations.filter((c) => {
    // Status filter
    if (filterStatus !== "all" && c.status !== filterStatus) return false;
    // Unread filter
    if (filterUnread && !(c.unread_count > 0)) return false;
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
    lastSyncedConvRef.current = JSON.stringify(conv);
    setSelectedConv(conv);
    if (conv.unread_count > 0) {
      updateConversation({ id: conv.id, updates: { unread_count: 0 } as any });
    }
  };

  const handleSendMessage = async (content: string, isNote?: boolean, quotedMessageId?: string) => {
    if (!selectedConv) return;
    await sendMessage({ content, isInternalNote: isNote, quotedMessageId });
  };

  const handleSendMedia = useCallback(async (file: File, caption?: string) => {
    if (!selectedConv) return;
    try {
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
        mediaFilename: file.name,
      });
      
    } catch (err: any) {
      console.error("[handleSendMedia] Failed:", err);
      toast({ title: "Erro ao enviar arquivo", description: err.message, variant: "destructive" });
    }
  }, [selectedConv, sendMessage, toast]);

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

  const handleLinkLead = ({ leadId, clienteId }: { leadId: string | null; clienteId: string | null }) => {
    if (!selectedConv) return;
    updateConversation({ id: selectedConv.id, updates: { lead_id: leadId, cliente_id: clienteId } });
    setSelectedConv({ ...selectedConv, lead_id: leadId, cliente_id: clienteId });
  };

  const handleToggleTag = (tagId: string, add: boolean) => {
    if (!selectedConv) return;
    toggleConversationTag({ conversationId: selectedConv.id, tagId, add });
  };

  return (
    <div className={`${vendorMode ? "flex flex-col h-full min-h-0 w-full max-w-full overflow-hidden" : "flex flex-col w-full h-full min-h-0 overflow-hidden p-4 pb-0 md:p-6 md:pb-0"}`} data-wa-inbox-active>
      {/* Header — hidden in vendor/standalone mode */}
      {!vendorMode && (
        <div className="shrink-0 mb-2">
          <WaInboxHeader
            instances={instances}
            onNewChat={() => setShowStartChat(true)}
            onSettings={() => setShowSettings(true)}
          />
        </div>
      )}

      {/* Push notification activation / status banner */}
      <WaInboxNotificationBanner />

      {/* Stats + SLA Alert — same row to save vertical space */}
      <div className="shrink-0 mb-2 flex flex-wrap items-center gap-2">
        {!vendorMode && (
          <WaInboxStats
            conversations={allConversations}
            compact
            onSelect={handleKpiSelect}
            activeKey={filterUnread ? "unread" : (filterStatus as any)}
          />
        )}
        {vendorMode && showCompactStats && (
          <WaInboxStats
            conversations={allConversations}
            compact
            onSelect={handleKpiSelect}
            activeKey={filterUnread ? "unread" : (filterStatus as any)}
          />
        )}
        {slaEnabled && (
          <WaSlaAlertBanner
            alerts={isAdminUser ? slaAlerts : mySlaAlerts}
            onOpenConversation={(convId) => {
              const conv = allConversations.find((c) => c.id === convId);
              if (conv) handleSelectConversation(conv);
            }}
            onAcknowledge={acknowledgeSlaAlert}
            onAcknowledgeAll={acknowledgeAllSla}
            onPauseSla={pauseSlaConversation}
            isAdmin={isAdminUser}
            defaultCollapsed
          />
        )}
      </div>

      {/* WhatsApp disconnection alert */}
      {instances.length > 0 && (() => {
        const disconnected = instances.filter(i => i.status !== "connected");
        if (disconnected.length === 0) return null;
        const allDown = disconnected.length === instances.length;
        return (
          <div className={`shrink-0 mb-2 flex items-center gap-3 px-4 py-3 rounded-lg border text-sm ${allDown ? "bg-destructive/10 border-destructive/20" : "bg-warning/10 border-warning/20"}`}>
            <WifiOff className={`h-4 w-4 shrink-0 ${allDown ? "text-destructive" : "text-warning"}`} />
            <span className={`flex-1 min-w-0 ${allDown ? "text-destructive" : "text-warning"}`}>
              {allDown
                ? "WhatsApp desconectado — mensagens não serão enviadas ou recebidas."
                : `${disconnected.length} instância${disconnected.length > 1 ? "s" : ""} desconectada${disconnected.length > 1 ? "s" : ""}. Algumas mensagens podem não funcionar.`}
            </span>
          </div>
        );
      })()}

      {/* Follow-up Widget */}
      <div className="shrink-0">
        <WaFollowupWidget
          vendorUserId={vendorMode ? effectiveUserId : undefined}
          onOpenConversation={(convId) => {
            const conv = allConversations.find((c) => c.id === convId);
            if (conv) {
              handleSelectConversation(conv);
            } else {
              supabase
                .from("wa_conversations")
                .select("id, remote_jid, cliente_telefone, cliente_nome, cliente_id, lead_id, assigned_to, instance_id, canal, status, is_group, profile_picture_url, telefone_normalized, last_message_at, last_message_preview, last_message_direction, last_message_id, unread_count, version, created_at, updated_at")
                .eq("id", convId)
                .maybeSingle()
                .then(({ data }) => {
                  if (data) handleSelectConversation(data as any);
                });
            }
          }}
        />
      </div>

      {/* Chat Layout */}
      <div
        className="bg-card rounded-xl border border-border/40 shadow-sm flex-1 min-h-0 overflow-hidden"
      >
        <div className="flex h-full min-h-0 min-w-0 w-full max-w-full overflow-hidden">
          {/* Sidebar - Conversations (Desktop) */}
          <div className={`${vendorMode ? "w-[320px]" : "w-[360px]"} shrink-0 hidden md:flex flex-col min-h-0 overflow-hidden`}>
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
          <div
            className="flex-1 flex flex-col md:hidden min-h-0 min-w-0 max-w-full overflow-hidden"
            onTouchStart={(e) => {
              const t = e.currentTarget;
              (t as any)._swipeStartX = e.touches[0].clientX;
              (t as any)._swipeStartY = e.touches[0].clientY;
            }}
            onTouchEnd={(e) => {
              const t = e.currentTarget;
              const startX = (t as any)._swipeStartX;
              const startY = (t as any)._swipeStartY;
              if (startX == null) return;
              const dx = e.changedTouches[0].clientX - startX;
              const dy = Math.abs(e.changedTouches[0].clientY - startY);
              if (dx > 80 && dy < 60 && selectedConv) {
                setSelectedConv(null);
              }
              (t as any)._swipeStartX = null;
              (t as any)._swipeStartY = null;
            }}
          >
            {selectedConv ? (
              <>
                <WaChatPanel
                  onBack={() => setSelectedConv(null)}
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
                  onRetryMessage={(msg) => retryMessage(msg)}
                  isAdmin={isAdminUser}
                />
              </>
            ) : preContactData ? (
              <WaPreContactCard
                nome={preContactData.nome}
                phone={preContactData.phone}
                onClose={() => setPreContactData(null)}
                compact
              />
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
          <div className="hidden md:flex flex-1 min-h-0 min-w-0 overflow-hidden">
            {!selectedConv && preContactData ? (
              <WaPreContactCard
                nome={preContactData.nome}
                phone={preContactData.phone}
                onClose={() => setPreContactData(null)}
              />
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
                onRetryMessage={(msg) => retryMessage(msg)}
                isAdmin={isAdminUser}
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
          setShowStartChat(false);
          setPendingNewConvId(convId);
          await queryClient.invalidateQueries({ queryKey: ["wa-conversations"] });
        }}
      />
    </div>
  );
}
