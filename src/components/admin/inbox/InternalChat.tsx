import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Send, ArrowLeft, Loader2, Smile, Paperclip, Bold, Italic, Strikethrough,
  Image as ImageIcon, FileText, Download,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

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
  media_url?: string | null;
  media_type?: string | null;
  media_filename?: string | null;
}

const EMOJI_GRID = [
  "😀","😁","😂","🤣","😊","😇","🥰","😍","😘","😎","🤩","🥳",
  "😏","😔","😢","😭","😤","🤯","😱","🥺","😴","🙏","👍","👎",
  "👏","🙌","💪","✌️","🤝","❤️","🔥","⭐","💯","✅","❌","⚠️",
];

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
        .select("id, sender_id, content, created_at, media_url, media_type, media_filename")
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

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

  // Get tenant_id once
  const { data: tenantId } = useQuery({
    queryKey: ["my-tenant-id", user?.id],
    enabled: !!user?.id,
    staleTime: Infinity,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", user!.id)
        .single();
      return data?.tenant_id || null;
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (payload: { content: string; media_url?: string; media_type?: string; media_filename?: string }) => {
      const { error } = await supabase.from("internal_chat_messages").insert({
        chat_id: chatId,
        sender_id: user!.id,
        content: payload.content,
        tenant_id: tenantId!,
        media_url: payload.media_url || null,
        media_type: payload.media_type || null,
        media_filename: payload.media_filename || null,
      });
      if (error) throw error;
      await supabase.from("internal_chats").update({ updated_at: new Date().toISOString() }).eq("id", chatId);
    },
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey: ["internal-chat-messages", chatId] });
      queryClient.invalidateQueries({ queryKey: ["internal-chat-team-members"] });
    },
    onError: (err: any) => {
      toast.error("Erro ao enviar: " + (err?.message || "tente novamente"));
    },
  });

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || sendMutation.isPending) return;
    sendMutation.mutate({ content: trimmed });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Formatting helpers
  const wrapSelection = useCallback(
    (prefix: string, suffix?: string) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const selected = text.substring(start, end);
      const s = suffix || prefix;
      const newText = text.substring(0, start) + prefix + selected + s + text.substring(end);
      setText(newText);
      setTimeout(() => {
        ta.focus();
        const cursor = selected ? start + prefix.length + selected.length + s.length : start + prefix.length;
        ta.setSelectionRange(selected ? start : start + prefix.length, selected ? cursor : start + prefix.length);
      }, 0);
    },
    [text]
  );

  const insertEmoji = useCallback(
    (emoji: string) => {
      const ta = textareaRef.current;
      if (!ta) { setText((v) => v + emoji); return; }
      const start = ta.selectionStart;
      const newText = text.substring(0, start) + emoji + text.substring(start);
      setText(newText);
      setTimeout(() => {
        ta.focus();
        ta.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 0);
    },
    [text]
  );

  // File upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenantId) return;

    if (file.size > 16 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 16MB.");
      return;
    }

    setIsUploading(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${tenantId}/internal-chat/${chatId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("checklist-assets")
        .upload(path, file, { upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("checklist-assets")
        .getPublicUrl(path);

      const mediaType = file.type.startsWith("image/") ? "image" : "document";

      sendMutation.mutate({
        content: file.name,
        media_url: urlData.publicUrl,
        media_type: mediaType,
        media_filename: file.name,
      });
    } catch (err: any) {
      toast.error("Erro ao enviar arquivo: " + (err?.message || "tente novamente"));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const busy = sendMutation.isPending || isUploading;

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
                    {/* Media content */}
                    {msg.media_url && msg.media_type === "image" && (
                      <img
                        src={msg.media_url}
                        alt={msg.media_filename || "Imagem"}
                        className="rounded-lg mb-1 max-w-full max-h-48 object-cover cursor-pointer"
                        onClick={() => window.open(msg.media_url!, "_blank")}
                      />
                    )}
                    {msg.media_url && msg.media_type === "document" && (
                      <a
                        href={msg.media_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-2 mb-1 text-xs ${
                          isMe ? "text-primary-foreground/80 hover:text-primary-foreground" : "text-primary hover:text-primary/80"
                        }`}
                      >
                        <FileText className="h-4 w-4 shrink-0" />
                        <span className="truncate">{msg.media_filename || "Documento"}</span>
                        <Download className="h-3 w-3 shrink-0" />
                      </a>
                    )}
                    {msg.content && !(msg.media_url && msg.content === msg.media_filename) && (
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    )}
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

      {/* Rich Composer */}
      <div className="border-t border-border/40 shrink-0 bg-card">
        {/* Formatting toolbar */}
        <div className="flex items-center gap-0.5 px-3 pt-2 pb-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={() => wrapSelection("*")} className="p-1.5 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors" type="button">
                <Bold className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px]">Negrito</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={() => wrapSelection("_")} className="p-1.5 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors" type="button">
                <Italic className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px]">Itálico</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={() => wrapSelection("~")} className="p-1.5 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors" type="button">
                <Strikethrough className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px]">Tachado</TooltipContent>
          </Tooltip>

          <div className="w-px h-4 bg-border/40 mx-1" />

          {/* Emoji picker */}
          <Popover>
            <PopoverTrigger asChild>
              <button className="p-1.5 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors" type="button">
                <Smile className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="w-72 p-2">
              <div className="grid grid-cols-9 gap-0.5">
                {EMOJI_GRID.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => insertEmoji(emoji)}
                    className="text-lg hover:scale-125 transition-transform p-1 rounded hover:bg-muted/60"
                    type="button"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* File upload */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                type="button"
                disabled={isUploading}
              >
                {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px]">Enviar arquivo</TooltipContent>
          </Tooltip>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
            onChange={handleFileSelect}
          />
        </div>

        {/* Text input + send */}
        <div className="flex items-end gap-2 px-3 pb-3">
          <Textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite uma mensagem..."
            className="flex-1 min-h-[40px] max-h-[120px] resize-none text-sm"
            autoComplete="off"
            rows={1}
            name="internal-chat-input"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!text.trim() || busy}
            className="shrink-0 h-10 w-10"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
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
    } catch (err: any) {
      console.error("[InternalChat] Error creating chat:", err);
      toast.error("Erro ao abrir conversa: " + (err?.message || "tente novamente"));
    } finally {
      setCreating(false);
    }
  };

  // Mobile: show chat view when active
  const showChat = activeChatId && activeMember;

  return (
    <div className="flex h-full overflow-hidden">
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
