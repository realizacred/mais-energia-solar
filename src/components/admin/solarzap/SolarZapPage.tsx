import { useState } from "react";
import { Settings, MessageCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { SolarZapConversationList, type SolarZapConversation } from "./SolarZapConversationList";
import { SolarZapChatPanel } from "./SolarZapChatPanel";
import { SolarZapContextPanel } from "./SolarZapContextPanel";
import { SolarZapSettings } from "./SolarZapSettings";

// Demo conversations
const DEMO_CONVERSATIONS: SolarZapConversation[] = [
  { id: "a1b2", nome: "João Mendes", telefone: "(32) 99844-1234", lastMessage: "Quanto custa um sistema para R$500 de conta?", lastMessageAt: "09:32", unreadCount: 3, channel: "whatsapp", status: "online" },
  { id: "c3d4", nome: "Maria Clara", telefone: "(21) 98765-4321", lastMessage: "Recebi a proposta, vou analisar.", lastMessageAt: "08:50", unreadCount: 0, channel: "whatsapp", status: "offline" },
  { id: "e5f6", nome: "Pedro Henrique", telefone: "(11) 97654-3210", lastMessage: "Vocês fazem instalação em SP?", lastMessageAt: "Ontem", unreadCount: 1, channel: "instagram", status: "offline" },
  { id: "g7h8", nome: "Ana Beatriz", telefone: "(31) 98543-2109", lastMessage: "Enviei as fotos do telhado", lastMessageAt: "Ontem", unreadCount: 0, channel: "whatsapp", status: "online" },
  { id: "i9j0", nome: "Lucas Ferreira", telefone: "(34) 97432-1098", lastMessage: "Pode me ligar amanhã?", lastMessageAt: "12/02", unreadCount: 2, channel: "whatsapp", status: "offline" },
  { id: "k1l2", nome: "Carla Dias", telefone: "(35) 96321-0987", lastMessage: "Vou fechar! Quando fazem a instalação?", lastMessageAt: "11/02", unreadCount: 0, channel: "whatsapp", status: "offline" },
  { id: "m3n4", nome: "Ricardo Santos", telefone: "(32) 95210-9876", lastMessage: "Aceito a proposta do financiamento", lastMessageAt: "10/02", unreadCount: 0, channel: "phone", status: "offline" },
];

export function SolarZapPage() {
  const isMobile = useIsMobile();
  const [selectedConv, setSelectedConv] = useState<SolarZapConversation | null>(null);
  const [showContext, setShowContext] = useState(!isMobile);
  const [activeTab, setActiveTab] = useState("chat");

  const handleSelectConversation = (conv: SolarZapConversation) => {
    setSelectedConv(conv);
    if (!isMobile) {
      setShowContext(true);
    }
  };

  const handleBack = () => {
    setSelectedConv(null);
  };

  // Mobile: show only list or chat
  if (isMobile) {
    return (
      <div className="h-[calc(100vh-120px)] flex flex-col -m-4 md:-m-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="mx-3 mt-2 h-8 shrink-0">
            <TabsTrigger value="chat" className="text-xs h-6 px-3 gap-1">
              <MessageCircle className="h-3 w-3" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="config" className="text-xs h-6 px-3 gap-1">
              <Settings className="h-3 w-3" />
              Config
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="flex-1 mt-0 overflow-hidden">
            {selectedConv ? (
              <SolarZapChatPanel
                conversation={selectedConv}
                onBack={handleBack}
                showBackButton
              />
            ) : (
              <SolarZapConversationList
                conversations={DEMO_CONVERSATIONS}
                selectedId={null}
                onSelect={handleSelectConversation}
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
        </div>

        <TabsContent value="chat" className="flex-1 mt-0 overflow-hidden">
          <div className="flex h-full">
            {/* Left: Conversation List */}
            <div className="w-80 shrink-0">
              <SolarZapConversationList
                conversations={DEMO_CONVERSATIONS}
                selectedId={selectedConv?.id || null}
                onSelect={handleSelectConversation}
              />
            </div>

            {/* Center: Chat */}
            <SolarZapChatPanel conversation={selectedConv} />

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
