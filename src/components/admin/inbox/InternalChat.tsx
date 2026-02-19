import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, ArrowLeft, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TeamMember {
  user_id: string;
  nome: string;
  email: string | null;
  chat_id: string | null;
  last_message_at: string | null;
  unread: boolean;
  tenantId: string;
}

interface ChatMessage {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender_name?: string;
}

/**
 * Hook: fetch team members (profiles in same tenant) with existing chat status
 */
function useTeamMembers() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["internal-chat-team-members", user?.id],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      // Get profiles in the same tenant (RLS handles tenant isolation)
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("user_id, nome, telefone")
        .eq("ativo", true)
        .neq("user_id", user!.id)
        .order("nome");

      if (error) throw error;

      // Get user's tenant_id for creating chats
      const { data: myProfile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", user!.id)
        .single();

      const tenantId = myProfile?.tenant_id;

      // Get existing direct chats for this user
      const { data: myChats } = await supabase
        .from("internal_chat_members")
        .select("chat_id")
        .eq("user_id", user!.id);

      const myChatIds = (myChats || []).map((c) => c.chat_id);

      // For each chat, get other members + last message
      const memberMap = new Map<string, { chat_id: string; last_message_at: string | null }>();

      if (myChatIds.length > 0) {
        // Get other members of my chats (direct chats only)
        const { data: otherMembers } = await supabase
          .from("internal_chat_members")
          .select("chat_id, user_id")
          .in("chat_id", myChatIds)
          .neq("user_id", user!.id);

        // Get chats info
        const { data: chats } = await supabase
          .from("internal_chats")
          .select("id, updated_at")
          .in("id", myChatIds)
          .eq("chat_type", "direct");

        const chatUpdated = new Map((chats || []).map((c) => [c.id, c.updated_at]));

        for (const m of otherMembers || []) {
          if (chatUpdated.has(m.chat_id)) {
            memberMap.set(m.user_id, {
              chat_id: m.chat_id,
              last_message_at: chatUpdated.get(m.chat_id) || null,
            });
          }
        }
      }

      const members: TeamMember[] = (profiles || []).map((p) => {
        const existing = memberMap.get(p.user_id);
        return {
          user_id: p.user_id,
          nome: p.nome || "Sem nome",
          email: p.telefone,
          chat_id: existing?.chat_id || null,
          last_message_at: existing?.last_message_at || null,
          unread: false,
          tenantId: tenantId || "",
        };
      });

      // Sort: those with existing chats first (by last message), then alphabetical
      members.sort((a, b) => {
        if (a.last_message_at && !b.last_message_at) return -1;
        if (!a.last_message_at && b.last_message_at) return 1;
        if (a.last_message_at && b.last_message_at) {
          return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
        }
        return a.nome.localeCompare(b.nome);
      });

      return members;
    },
  });
}

/**
 * Hook: fetch messages for a chat
 */
function useChatMessages(chatId: string | null) {
  return useQuery({
    queryKey: ["internal-chat-messages", chatId],
    enabled: !!chatId,
    staleTime: 5_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("internal_chat_messages")
        .select("id, sender_id, content, created_at")
        .eq("chat_id", chatId!)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data || []) as ChatMessage[];
    },
  });
}

/** Team member list */
function TeamMemberList({
  members,
  search,
  onSelect,
  selectedUserId,
}: {
  members: TeamMember[];
  search: string;
  onSelect: (member: TeamMember) => void;
  selectedUserId: string | null;
}) {
  const filtered = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.toLowerCase();
    return members.filter(
      (m) => m.nome.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q)
    );
  }, [members, search]);

  if (filtered.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Nenhum membro encontrado
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/30">
      {filtered.map((member) => (
        <button
          key={member.user_id}
          onClick={() => onSelect(member)}
          className={`w-full flex items-center gap-3 p-3 text-left transition-colors hover:bg-accent/50 active:bg-accent/70 ${
            selectedUserId === member.user_id ? "bg-accent/60" : ""
          }`}
        >
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
              {member.nome.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{member.nome}</p>
            {member.email && (
              <p className="text-xs text-muted-foreground truncate">{member.email}</p>
            )}
          </div>
          {member.last_message_at && (
            <span className="text-[10px] text-muted-foreground shrink-0">
              {formatDistanceToNow(new Date(member.last_message_at), {
                addSuffix: false,
                locale: ptBR,
              })}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/** Chat conversation view */
function ChatView({
  chatId,
  otherName,
  onBack,
}: {
  chatId: string;
  otherName: string;
  onBack: () => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: messages = [], isLoading } = useChatMessages(chatId);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`internal-chat-${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "internal_chat_messages",
          filter: `chat_id=eq.${chatId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["internal-chat-messages", chatId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, queryClient]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const { data: myProfile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", user!.id)
        .single();
      const { error } = await supabase.from("internal_chat_messages").insert({
        chat_id: chatId,
        sender_id: user!.id,
        content,
        tenant_id: myProfile!.tenant_id,
      });
      if (error) throw error;
      // Update chat's updated_at
      await supabase.from("internal_chats").update({ updated_at: new Date().toISOString() }).eq("id", chatId);
    },
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey: ["internal-chat-messages", chatId] });
      queryClient.invalidateQueries({ queryKey: ["internal-chat-team-members"] });
    },
  });

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || sendMutation.isPending) return;
    sendMutation.mutate(trimmed);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b border-border/40 shrink-0">
        <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
            {otherName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <h3 className="text-sm font-semibold truncate">{otherName}</h3>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-3">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            Nenhuma mensagem ainda. Diga olá! 👋
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((msg) => {
              const isMe = msg.sender_id === user?.id;
              return (
                <div
                  key={msg.id}
                  className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                      isMe
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted text-foreground rounded-bl-md"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    <p
                      className={`text-[10px] mt-0.5 ${
                        isMe ? "text-primary-foreground/60" : "text-muted-foreground"
                      }`}
                    >
                      {new Date(msg.created_at).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      {/* Composer */}
      <div className="p-3 border-t border-border/40 shrink-0">
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Digite uma mensagem..."
            className="flex-1"
            autoComplete="off"
            name="internal-chat-input"
          />
          <Button type="submit" size="icon" disabled={!text.trim() || sendMutation.isPending}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

/** Main Internal Chat component */
export function InternalChat() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: members = [], isLoading } = useTeamMembers();
  const [search, setSearch] = useState("");
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeMember, setActiveMember] = useState<TeamMember | null>(null);
  const [creating, setCreating] = useState(false);

  const handleSelectMember = async (member: TeamMember) => {
    setActiveMember(member);

    if (member.chat_id) {
      // Existing chat
      setActiveChatId(member.chat_id);
      return;
    }

    // Create new direct chat
    setCreating(true);
    try {
      // Get tenant_id
      const { data: myProfile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", user!.id)
        .single();
      const tid = myProfile!.tenant_id;

      const { data: chat, error: chatError } = await supabase
        .from("internal_chats")
        .insert({ chat_type: "direct", created_by: user!.id, tenant_id: tid })
        .select("id")
        .single();
      if (chatError) throw chatError;

      // Add both members
      const { error: membersError } = await supabase.from("internal_chat_members").insert([
        { chat_id: chat.id, user_id: user!.id, role: "owner" as const, tenant_id: tid },
        { chat_id: chat.id, user_id: member.user_id, role: "member" as const, tenant_id: tid },
      ]);
      if (membersError) throw membersError;

      setActiveChatId(chat.id);
      member.chat_id = chat.id;
      queryClient.invalidateQueries({ queryKey: ["internal-chat-team-members"] });
    } catch (err) {
      console.error("[InternalChat] Error creating chat:", err);
    } finally {
      setCreating(false);
    }
  };

  // Mobile: show chat view when active
  const showChat = activeChatId && activeMember;

  return (
    <div className="flex h-full">
      {/* Member list (hidden on mobile when chat is open) */}
      <div className={`w-full md:w-80 md:border-r border-border/40 flex flex-col ${showChat ? "hidden md:flex" : "flex"}`}>
        <div className="p-3 border-b border-border/40 shrink-0">
          <Input
            placeholder="Buscar equipe..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9"
            autoComplete="off"
            name="team-search"
          />
        </div>
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <TeamMemberList
              members={members}
              search={search}
              onSelect={handleSelectMember}
              selectedUserId={activeMember?.user_id || null}
            />
          )}
        </ScrollArea>
      </div>

      {/* Chat view */}
      <div className={`flex-1 ${showChat ? "flex flex-col" : "hidden md:flex md:items-center md:justify-center"}`}>
        {showChat ? (
          creating ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ChatView
              chatId={activeChatId}
              otherName={activeMember.nome}
              onBack={() => {
                setActiveChatId(null);
                setActiveMember(null);
              }}
            />
          )
        ) : (
          <p className="text-sm text-muted-foreground">Selecione um membro da equipe</p>
        )}
      </div>
    </div>
  );
}
