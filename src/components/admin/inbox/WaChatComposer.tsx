import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { useWritingAssistant } from "@/hooks/useWritingAssistant";
import { WritingAssistantButton } from "./WritingAssistantButton";
import { WritingAssistantPreview } from "./WritingAssistantPreview";
import {
  Send,
  StickyNote,
  
  X,
  Bold,
  Italic,
  Strikethrough,
  Smile,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Zap,
  ChevronDown,
  Video,
  Music,
  Search,
  SpellCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

// ── Common Emojis ──
const EMOJI_CATEGORIES: Record<string, string[]> = {
  "😀 Rostos": ["😀","😁","😂","🤣","😊","😇","🥰","😍","😘","😗","😋","😛","🤪","😎","🤩","🥳","😏","😒","😔","😢","😭","😤","🤬","🤯","😱","🥺","😴","🤮","🤧","😷","🤒"],
  "👋 Gestos": ["👋","🤝","👍","👎","👏","🙌","🤲","🤞","✌️","🤙","👊","✊","💪","🙏","☝️","👆","👇","👈","👉","🖐️"],
  "❤️ Símbolos": ["❤️","🧡","💛","💚","💙","💜","🤎","🖤","🤍","💔","❣️","💕","💞","💓","💗","💖","💝","💘","✨","🔥","⭐","🌟","💯","✅","❌","⚠️","📌"],
  "☀️ Natureza": ["☀️","🌤️","⛅","🌧️","🌩️","❄️","🌊","🌺","🌸","🌼","🌻","🌹","🍃","🌿","☘️","🌵","🌴","🌳"],
  "📦 Objetos": ["📱","💻","📧","📞","📊","📈","💰","💵","🏠","🔧","⚡","🔋","☎️","📋","📎","🗂️","📅","🕐","⏰","🚀"],
};

interface QuickReplyDb {
  id: string;
  titulo: string;
  conteudo: string;
  emoji: string | null;
  categoria: string | null;
  media_url: string | null;
  media_type: string | null;
  media_filename: string | null;
  ativo: boolean;
}

const MEDIA_ICONS: Record<string, typeof ImageIcon> = {
  image: ImageIcon,
  video: Video,
  audio: Music,
  document: FileText,
};

interface ReplyingTo {
  id: string;
  content: string | null;
  direction: "in" | "out";
  sent_by_name?: string | null;
}

interface WaChatComposerProps {
  onSendMessage: (content: string, isNote?: boolean, quotedMessageId?: string) => void;
  onSendMedia: (file: File, caption?: string) => void;
  isSending: boolean;
  isNoteMode: boolean;
  onNoteModeChange: (v: boolean) => void;
  replyingTo?: ReplyingTo | null;
  onCancelReply?: () => void;
  prefillMessage?: string | null;
}

export function WaChatComposer({
  onSendMessage,
  onSendMedia,
  isSending,
  isNoteMode,
  onNoteModeChange,
  replyingTo,
  onCancelReply,
  prefillMessage,
}: WaChatComposerProps) {
  const [inputValue, setInputValue] = useState("");
  const [slashActive, setSlashActive] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [slashIndex, setSlashIndex] = useState(0);
  const prefillAppliedRef = useRef(false);

  // ── Writing Assistant ──
  const writingAssistant = useWritingAssistant();

  // Apply prefill message once
  useEffect(() => {
    if (prefillMessage && !prefillAppliedRef.current) {
      setInputValue(prefillMessage);
      prefillAppliedRef.current = true;
      // Focus the textarea
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [prefillMessage]);

  // Listen for AI suggestion events
  useEffect(() => {
    const handler = (e: Event) => {
      const text = (e as CustomEvent).detail;
      if (text) {
        setInputValue(text);
        setTimeout(() => textareaRef.current?.focus(), 100);
      }
    };
    window.addEventListener("wa-ai-suggestion", handler);
    return () => window.removeEventListener("wa-ai-suggestion", handler);
  }, []);

  const [showEmoji, setShowEmoji] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [spellCheckEnabled, setSpellCheckEnabled] = useState(() => {
    const saved = localStorage.getItem("wa-spellcheck");
    return saved !== null ? saved === "true" : true;
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Fetch quick replies from DB
  const { data: quickReplies = [] } = useQuery({
    queryKey: ["wa-quick-replies-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wa_quick_replies")
        .select("*")
        .eq("ativo", true)
        .order("ordem", { ascending: true })
        .order("titulo", { ascending: true });
      if (error) throw error;
      return data as QuickReplyDb[];
    },
    staleTime: 60 * 1000,
  });

  // Fetch categories from DB
  const { data: dbCategories = [] } = useQuery({
    queryKey: ["wa-qr-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wa_quick_reply_categories")
        .select("*")
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data as Array<{ id: string; nome: string; slug: string; cor: string; emoji: string | null }>;
    },
    staleTime: 60 * 1000,
  });

  // Build category meta from DB
  const CATEGORY_META = useMemo(() => {
    const map: Record<string, { label: string; color: string }> = {};
    dbCategories.forEach(c => {
      map[c.slug] = { label: c.nome, color: c.cor };
    });
    return map;
  }, [dbCategories]);

  const [quickReplySearch, setQuickReplySearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Group by category
  const categories = useMemo(() => {
    const grouped = quickReplies.reduce<Record<string, QuickReplyDb[]>>((acc, qr) => {
      const cat = qr.categoria || "geral";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(qr);
      return acc;
    }, {});
    return Object.entries(grouped);
  }, [quickReplies]);

  // Filter replies
  const filteredReplies = useMemo(() => {
    let result = quickReplies;
    if (selectedCategory) {
      result = result.filter(qr => (qr.categoria || "geral") === selectedCategory);
    }
    if (quickReplySearch.trim()) {
      const q = quickReplySearch.toLowerCase();
      result = result.filter(
        qr => qr.titulo.toLowerCase().includes(q) || qr.conteudo.toLowerCase().includes(q)
      );
    }
    return result;
  }, [quickReplies, selectedCategory, quickReplySearch]);

  // Slash command filtered replies
  const slashFilteredReplies = useMemo(() => {
    if (!slashActive) return [];
    if (!slashQuery.trim()) return quickReplies;
    const q = slashQuery.toLowerCase();
    return quickReplies.filter(
      qr => qr.titulo.toLowerCase().includes(q) || qr.conteudo.toLowerCase().includes(q)
    );
  }, [slashActive, slashQuery, quickReplies]);

  // Reset slash index when results change
  useEffect(() => {
    setSlashIndex(0);
  }, [slashFilteredReplies.length]);

  const applySlashReply = useCallback((qr: QuickReplyDb) => {
    setInputValue(qr.conteudo);
    setSlashActive(false);
    setSlashQuery("");
    setSlashIndex(0);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, []);

  const handleInputChange = useCallback((val: string) => {
    setInputValue(val);
    if (val.startsWith("/")) {
      setSlashActive(true);
      setSlashQuery(val.slice(1));
    } else {
      setSlashActive(false);
      setSlashQuery("");
    }
  }, []);

  const handleSend = () => {
    if (!inputValue.trim()) return;
    onSendMessage(inputValue.trim(), isNoteMode, replyingTo?.id);
    setInputValue("");
    setSlashActive(false);
    setSlashQuery("");
    onNoteModeChange(false);
    onCancelReply?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Slash command keyboard navigation
    if (slashActive && slashFilteredReplies.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashIndex(i => (i + 1) % slashFilteredReplies.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashIndex(i => (i - 1 + slashFilteredReplies.length) % slashFilteredReplies.length);
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        applySlashReply(slashFilteredReplies[slashIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSlashActive(false);
        setSlashQuery("");
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        applySlashReply(slashFilteredReplies[slashIndex]);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Formatting ──
  const wrapSelection = useCallback(
    (prefix: string, suffix?: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = inputValue;
      const selected = text.substring(start, end);
      const s = suffix || prefix;
      const newText = text.substring(0, start) + prefix + selected + s + text.substring(end);
      setInputValue(newText);
      // Restore cursor
      setTimeout(() => {
        textarea.focus();
        const newCursor = selected ? start + prefix.length + selected.length + s.length : start + prefix.length;
        textarea.setSelectionRange(
          selected ? start : start + prefix.length,
          selected ? newCursor : start + prefix.length
        );
      }, 0);
    },
    [inputValue]
  );

  // ── Emoji ──
  const insertEmoji = useCallback(
    (emoji: string) => {
      const textarea = textareaRef.current;
      if (!textarea) {
        setInputValue((v) => v + emoji);
        return;
      }
      const start = textarea.selectionStart;
      const text = inputValue;
      const newText = text.substring(0, start) + emoji + text.substring(start);
      setInputValue(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 0);
    },
    [inputValue]
  );

  // ── Paste image from clipboard ──
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (!file) return;
        if (file.size > 16 * 1024 * 1024) {
          toast({ title: "Imagem muito grande", description: "Máximo 16MB", variant: "destructive" });
          return;
        }
        onSendMedia(file, inputValue.trim() || undefined);
        setInputValue("");
        return;
      }
    }
  }, [onSendMedia, inputValue, toast]);

  // ── File Upload ──
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 16 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo 16MB", variant: "destructive" });
      return;
    }

    onSendMedia(file, inputValue.trim() || undefined);
    setInputValue("");
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const busy = isSending || isUploading;

  return (
    <div
      className="p-3 border-t border-border/30 bg-card shadow-[0_-1px_3px_0_rgb(0_0_0/0.03)]"
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const file = e.dataTransfer.files?.[0];
        if (file && file.size <= 16 * 1024 * 1024) {
          onSendMedia(file, inputValue.trim() || undefined);
          setInputValue("");
        }
      }}
    >
      {/* Reply bar */}
      {replyingTo && (
        <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-lg bg-primary/5 border-l-2 border-primary">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-primary">
              {replyingTo.direction === "out" ? (replyingTo.sent_by_name || "Você") : "Cliente"}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {replyingTo.content || "Mídia"}
            </p>
          </div>
          <Button size="icon" variant="ghost" className="h-5 w-5 shrink-0" onClick={onCancelReply}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {isNoteMode && (
        <div className="flex items-center gap-2 mb-2 px-1">
          <StickyNote className="h-3.5 w-3.5 text-warning" />
          <span className="text-xs text-warning font-medium">Modo nota interna — não será enviada ao cliente</span>
          <Button size="icon" variant="ghost" className="h-5 w-5 ml-auto" onClick={() => onNoteModeChange(false)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Quick Replies */}
      {!isNoteMode && quickReplies.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 mb-1.5 text-primary hover:text-primary hover:bg-primary/5">
              <Zap className="h-3 w-3" />
              Respostas rápidas
              <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-0.5">{quickReplies.length}</Badge>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent side="top" align="start" className="w-96 p-0">
            {/* Search */}
            <div className="p-2 border-b border-border/40">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar resposta..."
                  value={quickReplySearch}
                  onChange={(e) => setQuickReplySearch(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 text-xs rounded-md border border-border/50 bg-muted/30 focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
              </div>
            </div>

            {/* Category Pills */}
            <div className="px-2 pt-2 pb-1 flex flex-wrap gap-1">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                  selectedCategory === null
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                Todas
              </button>
              {categories.map(([cat]) => {
                const meta = CATEGORY_META[cat] || { label: cat, color: "bg-muted text-muted-foreground" };
                const count = quickReplies.filter(qr => (qr.categoria || "geral") === cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                      selectedCategory === cat
                        ? "bg-primary text-primary-foreground"
                        : `${meta.color} hover:opacity-80`
                    }`}
                  >
                    {meta.label} ({count})
                  </button>
                );
              })}
            </div>

            {/* Replies List */}
            <div className="max-h-64 overflow-y-auto p-1.5 space-y-0.5">
              {filteredReplies.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhuma resposta encontrada</p>
              ) : (
                filteredReplies.map((qr) => {
                  const MediaIcon = qr.media_type ? MEDIA_ICONS[qr.media_type] : null;
                  const catMeta = CATEGORY_META[qr.categoria || "geral"] || { label: qr.categoria, color: "bg-muted text-muted-foreground" };
                  return (
                    <button
                      key={qr.id}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors group border border-transparent hover:border-border/30"
                      onClick={() => {
                        setInputValue(qr.conteudo);
                        setQuickReplySearch("");
                        setSelectedCategory(null);
                        textareaRef.current?.focus();
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base shrink-0">{qr.emoji || "💬"}</span>
                        <span className="text-xs font-semibold text-foreground truncate flex-1">{qr.titulo}</span>
                        {MediaIcon && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 gap-0.5 shrink-0">
                            <MediaIcon className="w-2.5 h-2.5" />
                            {qr.media_type}
                          </Badge>
                        )}
                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 shrink-0 border-0 ${catMeta.color}`}>
                          {catMeta.label}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 pl-7">{qr.conteudo}</p>
                    </button>
                  );
                })
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Formatting Toolbar */}
      <div className="flex items-center gap-0.5 mb-1.5 px-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => wrapSelection("*")}>
              <Bold className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">Negrito *texto*</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => wrapSelection("_")}>
              <Italic className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">Itálico _texto_</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => wrapSelection("~")}>
              <Strikethrough className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">Tachado ~texto~</TooltipContent>
        </Tooltip>

        <div className="w-px h-4 bg-border/50 mx-1" />

        {/* Emoji picker */}
        <Popover open={showEmoji} onOpenChange={setShowEmoji}>
          <PopoverTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7">
              <Smile className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent side="top" align="start" className="w-80 p-2">
            <div className="max-h-56 overflow-y-auto space-y-2">
              {Object.entries(EMOJI_CATEGORIES).map(([cat, emojis]) => (
                <div key={cat}>
                  <p className="text-[10px] text-muted-foreground font-medium mb-1 px-1">{cat}</p>
                  <div className="flex flex-wrap gap-0.5">
                    {emojis.map((e) => (
                      <button
                        key={e}
                        className="w-7 h-7 flex items-center justify-center text-base hover:bg-muted rounded transition-colors"
                        onClick={() => {
                          insertEmoji(e);
                          setShowEmoji(false);
                        }}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Attachment */}
        {!isNoteMode && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
              >
                <Paperclip className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Anexar arquivo</TooltipContent>
          </Tooltip>
        )}

        <div className="w-px h-4 bg-border/50 mx-1" />

        {/* Spell check toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className={`h-7 w-7 ${spellCheckEnabled ? "text-primary bg-primary/10" : "text-muted-foreground"}`}
              onClick={() => {
                const next = !spellCheckEnabled;
                setSpellCheckEnabled(next);
                localStorage.setItem("wa-spellcheck", String(next));
                if (next) {
                  // Only show warning if browser doesn't have Portuguese configured
                  const langs = navigator.languages || [navigator.language];
                  const hasPt = langs.some(l => l.toLowerCase().startsWith("pt"));
                  if (!hasPt) {
                    toast({
                      title: "Corretor ativado",
                      description: "Para sugestões em Português, ative o idioma nas configurações do navegador (chrome://settings/languages).",
                    });
                  }
                }
              }}
            >
              <SpellCheck className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {spellCheckEnabled ? "Desativar corretor" : "Ativar corretor"}
          </TooltipContent>
        </Tooltip>

        {/* Writing Assistant */}
        {!isNoteMode && (
          <>
            <div className="w-px h-4 bg-border/50 mx-1" />
            <WritingAssistantButton
              onAction={(action) => writingAssistant.requestSuggestion(inputValue, action)}
              isLoading={writingAssistant.isLoading}
              disabled={!inputValue.trim() || inputValue.trim().length < 3 || busy}
            />
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
          onChange={handleFileSelect}
        />
      </div>

      {/* Slash Command Floating Menu */}
      {slashActive && !isNoteMode && slashFilteredReplies.length > 0 && (
        <div className="relative mb-1.5">
          <div className="absolute bottom-0 left-0 right-0 z-50 bg-card border border-border/50 rounded-xl shadow-lg max-h-56 overflow-y-auto">
            <div className="px-3 py-1.5 border-b border-border/30">
              <p className="text-[10px] text-muted-foreground font-medium">
                <Zap className="h-3 w-3 inline mr-1" />
                Respostas rápidas — <kbd className="px-1 py-0.5 rounded bg-muted text-[9px]">↑↓</kbd> navegar · <kbd className="px-1 py-0.5 rounded bg-muted text-[9px]">Enter</kbd> selecionar · <kbd className="px-1 py-0.5 rounded bg-muted text-[9px]">Esc</kbd> fechar
              </p>
            </div>
            {slashFilteredReplies.map((qr, idx) => {
              const catMeta = CATEGORY_META[qr.categoria || "geral"] || { label: qr.categoria, color: "bg-muted text-muted-foreground" };
              return (
                <button
                  key={qr.id}
                  className={`w-full text-left px-3 py-2 transition-colors flex items-start gap-2 ${
                    idx === slashIndex
                      ? "bg-primary/10 border-l-2 border-primary"
                      : "hover:bg-muted/40 border-l-2 border-transparent"
                  }`}
                  onMouseEnter={() => setSlashIndex(idx)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applySlashReply(qr);
                  }}
                >
                  <span className="text-base shrink-0 mt-0.5">{qr.emoji || "💬"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-foreground truncate">{qr.titulo}</span>
                      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 shrink-0 border-0 ${catMeta.color}`}>
                        {catMeta.label}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{qr.conteudo}</p>
                  </div>
                </button>
              );
            })}
            {slashFilteredReplies.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">Nenhuma resposta encontrada</p>
            )}
          </div>
        </div>
      )}

      {/* Writing Assistant Preview */}
      {writingAssistant.suggestion && writingAssistant.originalText && (
        <WritingAssistantPreview
          originalText={writingAssistant.originalText}
          suggestion={writingAssistant.suggestion}
          model={writingAssistant.model}
          onAccept={(text) => {
            setInputValue(text);
            writingAssistant.dismiss();
          }}
          onEdit={(text) => {
            setInputValue(text);
            writingAssistant.dismiss();
            setTimeout(() => textareaRef.current?.focus(), 100);
          }}
          onDismiss={writingAssistant.dismiss}
        />
      )}

      {/* Input Area */}
      <div className="flex items-end gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant={isNoteMode ? "default" : "ghost"}
              className={`h-9 w-9 shrink-0 ${isNoteMode ? "bg-warning hover:bg-warning/90 text-warning-foreground" : ""}`}
              onClick={() => onNoteModeChange(!isNoteMode)}
            >
              <StickyNote className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Nota interna</TooltipContent>
        </Tooltip>

        <Textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          spellCheck={spellCheckEnabled}
          autoCorrect={spellCheckEnabled ? "on" : "off"}
          autoCapitalize={spellCheckEnabled ? "sentences" : "off"}
          lang="pt-BR"
          placeholder={isNoteMode ? "Escreva uma nota interna..." : "Digite / para respostas rápidas..."}
          className={`flex-1 min-h-[40px] max-h-[120px] resize-none text-sm leading-snug py-2.5 rounded-xl ${isNoteMode ? "border-warning/30 bg-warning/5" : "bg-muted/30 border-border/30 focus:bg-background"}`}
          rows={1}
          disabled={busy}
        />

        <Button
          size="icon"
          className={`h-10 w-10 shrink-0 rounded-xl ${isNoteMode ? "bg-warning hover:bg-warning/90" : ""}`}
          onClick={handleSend}
          disabled={!inputValue.trim() || busy}
        >
          {busy ? (
            <Spinner size="sm" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
