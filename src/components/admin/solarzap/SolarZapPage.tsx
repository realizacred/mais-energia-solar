import { useState, useEffect } from "react";
import { Settings, MessageCircle, Wifi, WifiOff, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWaConversations, useWaMessages, useWaReadTracking } from "@/hooks/useWaInbox";
import { useWaInstances } from "@/hooks/useWaInstances";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { SolarZapConversationList } from "./SolarZapConversationList";
import { SolarZapChatPanel } from "./SolarZapChatPanel";
import { SolarZapContextPanel } from "./SolarZapContextPanel";
import { SolarZapSettings } from "./SolarZapSettings";
import type { WaConversation } from "@/hooks/useWaInbox";

export function SolarZapPage() {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { toast } = useToast();
  const { instances } = useWaInstances();

  const [selectedConv, setSelectedConv] = useState<WaConversation | null>(null);
  const [showContext, setShowContext] = useState(!isMobile);
  const [activeTab, setActiveTab] = useState("chat");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("open");
  const [filterAssigned, setFilterAssigned] = useState("all");

  // Real conversations from Supabase + Realtime
  const {
    conversations,
    loading: convsLoading,
    assignConversation,
    resolveConversation,
    reopenConversation,
    updateConversation,
  } = useWaConversations({
    search: search || undefined,
  });

  // Real messages for selected conversation
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

  const { markAsRead } = useWaReadTracking(selectedConv?.id, user?.id);

  // Mark as read when selecting conversation
  const handleMarkRead = (conv: WaConversation) => {
    if (conv.unread_count > 0) {
      // Get the latest message id if available
      const latestMsg = messages.length > 0 ? messages[messages.length - 1] : null;
      if (latestMsg) markAsRead(latestMsg.id);
    }
  };

  // Filter conversations client-side
  const filteredConvs = conversations.filter((c) => {
    if (filterStatus !== "all" && c.status !== filterStatus) return false;
    if (filterAssigned === "meus" && c.assigned_to !== user?.id) return false;
    if (filterAssigned === "nao_lidos" && c.unread_count === 0) return false;
    if (c.is_group) return false;
    return true;
  });

  // Keep selectedConv in sync with fresh data
  useEffect(() => {
    if (selectedConv) {
      const fresh = conversations.find((c) => c.id === selectedConv.id);
      if (fresh) setSelectedConv(fresh);
    }
  }, [conversations]);

  // Instance connection status
  const connectedInstances = instances.filter((i: any) => i.status === "connected" || i.connection_status === "open");
  const hasConnection = connectedInstances.length > 0;

  const handleSelectConversation = (conv: WaConversation) => {
    setSelectedConv(conv);
    if (conv.unread_count > 0) {
      updateConversation({ id: conv.id, updates: { unread_count: 0 } as any });
    }
    if (!isMobile) setShowContext(true);
  };

  const handleSendMessage = async (content: string, isNote?: boolean) => {
    if (!selectedConv || !content.trim()) return;
    try {
      await sendMessage({ content, isInternalNote: isNote });
    } catch (err: any) {
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    }
  };

  const handleBack = () => setSelectedConv(null);

  // Connection status badge
  const ConnectionBadge = () => (
    <Badge
      variant="outline"
      className={`text-[9px] gap-1 ${hasConnection ? "text-success border-success/30" : "text-destructive border-destructive/30"}`}
    >
      {hasConnection ? <Wifi className="h-2.5 w-2.5" /> : <WifiOff className="h-2.5 w-2.5" />}
      {hasConnection ? "Conectado" : "Desconectado"}
    </Badge>
  );

  // Mobile: show only list or chat
  if (isMobile) {
    return (
      <div className="h-[calc(100vh-120px)] flex flex-col -m-4 md:-m-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="flex items-center justify-between px-3 pt-2">
            <TabsList className="h-8">
              <TabsTrigger value="chat" className="text-xs h-6 px-3 gap-1">
                <MessageCircle className="h-3 w-3" />
                Chat
              </TabsTrigger>
              <TabsTrigger value="config" className="text-xs h-6 px-3 gap-1">
                <Settings className="h-3 w-3" />
                Config
              </TabsTrigger>
            </TabsList>
            <ConnectionBadge />
          </div>

          <TabsContent value="chat" className="flex-1 mt-0 overflow-hidden">
            {selectedConv ? (
              <SolarZapChatPanel
                conversation={selectedConv}
                messages={messages}
                loading={msgsLoading}
                isSending={isSending}
                onSendMessage={handleSendMessage}
                onBack={handleBack}
                showBackButton
              />
            ) : (
              <SolarZapConversationList
                conversations={filteredConvs}
                selectedId={null}
                onSelect={handleSelectConversation}
                loading={convsLoading}
                search={search}
                onSearchChange={setSearch}
                filter={filterAssigned}
                onFilterChange={setFilterAssigned}
              />
            )}
          </TabsContent>

          <TabsContent value="config" className="flex-1 mt-0 overflow-auto p-4">
            <SolarZapSettings />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Desktop: triple-panel layout
  return (
    <div className="h-[calc(100vh-120px)] -m-4 md:-m-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-card shrink-0">
          <TabsList className="h-8">
            <TabsTrigger value="chat" className="text-xs h-6 px-3 gap-1.5">
              <MessageCircle className="h-3.5 w-3.5" />
              Central de Atendimento
            </TabsTrigger>
            <TabsTrigger value="config" className="text-xs h-6 px-3 gap-1.5">
              <Settings className="h-3.5 w-3.5" />
              Configurações
            </TabsTrigger>
          </TabsList>
          <ConnectionBadge />
        </div>

        <TabsContent value="chat" className="flex-1 mt-0 overflow-hidden">
          <div className="flex h-full">
            {/* Left: Conversation List */}
            <div className="w-80 shrink-0">
              <SolarZapConversationList
                conversations={filteredConvs}
                selectedId={selectedConv?.id || null}
                onSelect={handleSelectConversation}
                loading={convsLoading}
                search={search}
                onSearchChange={setSearch}
                filter={filterAssigned}
                onFilterChange={setFilterAssigned}
              />
            </div>

            {/* Center: Chat */}
            <SolarZapChatPanel
              conversation={selectedConv}
              messages={messages}
              loading={msgsLoading}
              isSending={isSending}
              onSendMessage={handleSendMessage}
            />

            {/* Right: Context Panel */}
            {showContext && selectedConv && (
              <SolarZapContextPanel
                conversation={selectedConv}
                onClose={() => setShowContext(false)}
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="config" className="flex-1 mt-0 overflow-auto p-6">
          <SolarZapSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
