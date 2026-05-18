import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { AudioRecorderButton } from "./AudioRecorderButton";
import type { RecordedAudio } from "@/services/audioRecorder";
import { Spinner } from "@/components/ui-kit/Spinner";
import { useWritingAssistant } from "@/hooks/useWritingAssistant";
import { WritingAssistantButton } from "./WritingAssistantButton";
import { WritingAssistantPreview } from "./WritingAssistantPreview";
import {
  Send,
  StickyNote,
  Lock,
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
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useWaComposerData, type QuickReplyDb } from "@/hooks/useWaComposerData";
import { useToast } from "@/hooks/use-toast";

const EMOJI_CATEGORIES: Record<string, string[]> = {
  "😀 Rostos": ["😀","😁","😂","🤣","😊","😇","🥰","😍","😘","😗","😋","😛","🤪","😎","🤩","🥳","😏","😒","😔","😢","😭","😤","🤬","🤯","😱","🥺","😴","🤮","🤧","😷","🤒"],
  "👋 Gestos": ["👋","🤝","👍","👎","👏","🙌","🤲","🤞","✌️","🤙","👊","✊","💪","🙏","☝️","👆","👇","👈","👉","🖐️"],
  "❤️ Símbolos": ["❤️","🧡","💛","💚","💙","💜","🤎","🖤","🤍","💔","❣️","💕","💞","💓","💗","💖","💝","💘","✨","🔥","⭐","🌟","💯","✅","❌","⚠️","📌"],
  "☀️ Natureza": ["☀️","🌤️","⛅","🌧️","🌩️","❄️","🌊","🌺","🌸","🌼","🌻","🌹","🍃","🌿","☘️","🌵","🌴","🌳"],
  "📦 Objetos": ["📱","💻","📧","📞","📊","📈","💰","💵","🏠","🔧","⚡","🔋","☎️","📋","📎","🗂️","📅","🕐","⏰","🚀"],
};

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
  onSendAudio?: (file: File) => void;
  isSending: boolean;
  isNoteMode: boolean;
  onNoteModeChange: (v: boolean) => void;
  replyingTo?: ReplyingTo | null;
  onCancelReply?: () => void;
  prefillMessage?: string | null;
  readOnly?: boolean;
  readOnlyReason?: string;
  instanceId?: string;
  remoteJid?: string;
}

export function WaChatComposer({
  onSendMessage, onSendMedia, onSendAudio, isSending, isNoteMode, onNoteModeChange,
  replyingTo, onCancelReply, prefillMessage, readOnly, readOnlyReason, instanceId, remoteJid,
}: WaChatComposerProps) {
  const [inputValue, setInputValue] = useState("");
  const [slashActive, setSlashActive] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [slashIndex, setSlashIndex] = useState(0);
  const prefillAppliedRef = useRef(false);

  const { writingAssistantEnabled, quickReplies, dbCategories } = useWaComposerData();
  const writingAssistant = useWritingAssistant();
  const [activeWritingAction, setActiveWritingAction] = useState<any>(null);

  useEffect(() => {
    if (prefillMessage && !prefillAppliedRef.current) {
      setInputValue(prefillMessage);
      prefillAppliedRef.current = true;
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [prefillMessage]);

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
  const [spellCheckEnabled, setSpellCheckEnabled] = useState(() => {
    const saved = localStorage.getItem("wa-spellcheck");
    return saved !== null ? saved === "true" : true;
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pauseTimerRef = useRef<any>(null);
  const lastPresenceSentRef = useRef<number>(0);
  const { toast } = useToast();

  const sendPresence = useCallback(async (presence: "composing" | "paused") => {
    if (!instanceId || !remoteJid || isNoteMode) return;
    try {
      await supabase.functions.invoke("send-wa-presence", {
        body: { instance_id: instanceId, number: remoteJid, presence },
      });
    } catch (e) {}
  }, [instanceId, remoteJid, isNoteMode]);

  const CATEGORY_META = useMemo(() => {
    const map: Record<string, { label: string; color: string }> = {};
    dbCategories.forEach(c => { map[c.slug] = { label: c.nome, color: c.cor }; });
    return map;
  }, [dbCategories]);

  const [quickReplySearch, setQuickReplySearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = useMemo(() => {
    const grouped = quickReplies.reduce<Record<string, QuickReplyDb[]>>((acc, qr) => {
      const cat = qr.categoria || "geral";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(qr);
      return acc;
    }, {});
    return Object.entries(grouped);
  }, [quickReplies]);

  const slashFilteredReplies = useMemo(() => {
    if (!slashActive) return [];
    if (!slashQuery.trim()) return quickReplies;
    const q = slashQuery.toLowerCase();
    return quickReplies.filter(qr => qr.titulo.toLowerCase().includes(q) || qr.conteudo.toLowerCase().includes(q));
  }, [slashActive, slashQuery, quickReplies]);

  useEffect(() => { setSlashIndex(0); }, [slashFilteredReplies.length]);

  const applySlashReply = useCallback((qr: QuickReplyDb) => {
    setInputValue(qr.conteudo.replace(/\\n/g, "\n"));
    setSlashActive(false);
    setSlashQuery("");
    setSlashIndex(0);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, []);

  const handleInputChange = useCallback((val: string) => {
    setInputValue(val);
    if (val.startsWith("/")) { setSlashActive(true); setSlashQuery(val.slice(1)); }
    else { setSlashActive(false); setSlashQuery(""); }

    if (val.trim() && instanceId && remoteJid && !isNoteMode) {
      const now = Date.now();
      if (now - lastPresenceSentRef.current > 2000) {
        lastPresenceSentRef.current = now;
        sendPresence("composing");
      }
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = setTimeout(() => sendPresence("paused"), 3000);
    }
  }, [instanceId, remoteJid, isNoteMode, sendPresence]);

  const handleSend = () => {
    if (!inputValue.trim()) return;
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    sendPresence("paused");
    onSendMessage(inputValue.trim(), isNoteMode, replyingTo?.id);
    setInputValue("");
    setSlashActive(false);
    setSlashQuery("");
    onNoteModeChange(false);
    onCancelReply?.();
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (slashActive && slashFilteredReplies.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSlashIndex(i => (i + 1) % slashFilteredReplies.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setSlashIndex(i => (i - 1 + slashFilteredReplies.length) % slashFilteredReplies.length); return; }
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); applySlashReply(slashFilteredReplies[slashIndex]); return; }
      if (e.key === "Escape") { e.preventDefault(); setSlashActive(false); setSlashQuery(""); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const wrapSelection = useCallback((prefix: string, suffix?: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = inputValue;
    const selected = text.substring(start, end);
    const s = suffix || prefix;
    const newText = text.substring(0, start) + prefix + selected + s + text.substring(end);
    setInputValue(newText);
    setTimeout(() => {
      textarea.focus();
      const newCursor = selected ? start + prefix.length + selected.length + s.length : start + prefix.length;
      textarea.setSelectionRange(selected ? start : start + prefix.length, selected ? newCursor : start + prefix.length);
    }, 0);
  }, [inputValue]);

  const insertEmoji = useCallback((emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) { setInputValue((v) => v + emoji); return; }
    const start = textarea.selectionStart;
    const text = inputValue;
    const newText = text.substring(0, start) + emoji + text.substring(start);
    setInputValue(newText);
    setTimeout(() => { textarea.focus(); textarea.setSelectionRange(start + emoji.length, start + emoji.length); }, 0);
  }, [inputValue]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (!file) return;
        if (file.size > 16 * 1024 * 1024) { toast({ title: "Imagem muito grande (máx 16MB)", variant: "destructive" }); return; }
        onSendMedia(file, inputValue.trim() || undefined);
        setInputValue("");
        return;
      }
    }
  }, [onSendMedia, inputValue, toast]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 16 * 1024 * 1024) { toast({ title: "Arquivo muito grande (máx 16MB)", variant: "destructive" }); return; }
    onSendMedia(file, inputValue.trim() || undefined);
    setInputValue("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const busy = isSending;

  if (readOnly) {
    return (
      <div className="p-3 border-t border-border/30 bg-muted/50 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
        <Lock className="h-3.5 w-3.5" />
        <span>{readOnlyReason || "Não é possível enviar mensagens"}</span>
      </div>
    );
  }

  return (
    <div className="p-2 border-t border-border/30 bg-card">
      <TooltipProvider delayDuration={400}>
        {replyingTo && (
          <div className="flex items-center gap-2 mb-1.5 px-2 py-1 rounded-lg bg-primary/5 border-l-2 border-primary">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-primary">{replyingTo.direction === "out" ? (replyingTo.sent_by_name || "Você") : "Cliente"}</p>
              <p className="text-[10px] text-muted-foreground truncate">{replyingTo.content || "Mídia"}</p>
            </div>
            <Button size="icon" variant="ghost" className="h-5 w-5" onClick={onCancelReply}><X className="h-3 w-3" /></Button>
          </div>
        )}

        {isNoteMode && (
          <div className="flex items-center gap-2 mb-1.5 px-2 py-1 rounded-lg bg-warning/10 border-l-2 border-warning">
            <StickyNote className="h-3 w-3 text-warning" />
            <span className="text-[10px] text-warning font-bold">Nota interna</span>
            <Button size="icon" variant="ghost" className="h-5 w-5 ml-auto" onClick={() => onNoteModeChange(false)}><X className="h-3 w-3" /></Button>
          </div>
        )}

        {slashActive && !isNoteMode && slashFilteredReplies.length > 0 && (
          <div className="relative mb-1">
            <div className="absolute bottom-0 left-0 right-0 z-50 bg-card border border-border/50 rounded-xl shadow-xl max-h-56 overflow-y-auto">
              {slashFilteredReplies.map((qr, idx) => (
                <button key={qr.id} className={`w-full text-left px-3 py-1.5 transition-colors flex items-center gap-2 ${idx === slashIndex ? "bg-primary/10" : "hover:bg-muted/40"}`} onMouseEnter={() => setSlashIndex(idx)} onMouseDown={(e) => { e.preventDefault(); applySlashReply(qr); }}>
                  <span className="text-sm shrink-0">{qr.emoji || "💬"}</span>
                  <span className="text-[11px] font-medium text-foreground truncate flex-1">{qr.titulo}</span>
                  <Badge variant="outline" className="text-[9px] px-1 py-0 border-0 bg-muted/50">{CATEGORY_META[qr.categoria || ""]?.label || "Geral"}</Badge>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-end gap-1.5">
          <div className="flex flex-col gap-1 shrink-0">
            <Popover open={showEmoji} onOpenChange={setShowEmoji}>
              <PopoverTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground"><Smile className="h-4 w-4" /></Button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="w-72 p-2">
                <div className="max-h-56 overflow-y-auto space-y-2">
                  {Object.entries(EMOJI_CATEGORIES).map(([cat, emojis]) => (
                    <div key={cat}>
                      <p className="text-[9px] text-muted-foreground font-bold uppercase mb-1">{cat}</p>
                      <div className="flex flex-wrap gap-0.5">{emojis.map((e) => <button key={e} className="w-7 h-7 flex items-center justify-center text-base hover:bg-muted rounded" onClick={() => { insertEmoji(e); setShowEmoji(false); }}>{e}</button>)}</div>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => fileInputRef.current?.click()} disabled={busy}><Paperclip className="h-4 w-4" /></Button>
          </div>

          <div className="flex-1 flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground" onClick={() => wrapSelection("*")}><Bold className="h-3 w-3" /></Button>
                </TooltipTrigger>
                <TooltipContent className="text-[9px]">Negrito</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground" onClick={() => wrapSelection("_")}><Italic className="h-3 w-3" /></Button>
                </TooltipTrigger>
                <TooltipContent className="text-[9px]">Itálico</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground" onClick={() => wrapSelection("~")}><Strikethrough className="h-3 w-3" /></Button>
                </TooltipTrigger>
                <TooltipContent className="text-[9px]">Tachado</TooltipContent>
              </Tooltip>
              <div className="w-px h-3 bg-border/40 mx-0.5" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground"><MoreHorizontal className="h-3 w-3" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-40">
                  <DropdownMenuItem onClick={() => { setSpellCheckEnabled(!spellCheckEnabled); localStorage.setItem("wa-spellcheck", String(!spellCheckEnabled)); }} className="text-xs">
                    <SpellCheck className="h-3.5 w-3.5 mr-2" /> {spellCheckEnabled ? "Desativar corretor" : "Ativar corretor"}
                  </DropdownMenuItem>
                  {quickReplies.length > 0 && (
                     <DropdownMenuItem className="text-xs" onClick={() => setSlashActive(true)}>
                       <Zap className="h-3.5 w-3.5 mr-2" /> Respostas rápidas
                     </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {writingAssistantEnabled && (
                <div className="ml-auto">
                   <WritingAssistantButton
                    onAction={(action) => writingAssistant.requestSuggestion(inputValue, action)}
                    isLoading={writingAssistant.isLoading} disabled={busy} activeAction={null} onDeactivate={() => writingAssistant.dismiss()}
                  />
                </div>
              )}
            </div>

            <Textarea
              ref={textareaRef} value={inputValue} onChange={(e) => handleInputChange(e.target.value)} onKeyDown={handleKeyDown} onPaste={handlePaste}
              spellCheck={spellCheckEnabled} autoCorrect={spellCheckEnabled ? "on" : "off"} autoCapitalize={spellCheckEnabled ? "sentences" : "off"}
              placeholder={isNoteMode ? "Nota interna..." : "Mensagem ou /respostas"}
              className={`min-h-[44px] max-h-[120px] resize-none text-[13px] leading-tight py-2.5 rounded-xl ${isNoteMode ? "border-warning/30 bg-warning/5" : "bg-muted/30 border-border/20 focus:bg-background"}`}
              rows={1} disabled={busy}
            />
          </div>

          <div className="flex flex-col gap-1 shrink-0">
             <Button size="icon" variant={isNoteMode ? "default" : "ghost"} className={`h-8 w-8 ${isNoteMode ? "bg-warning hover:bg-warning/90 text-warning-foreground" : "text-muted-foreground"}`} onClick={() => onNoteModeChange(!isNoteMode)}><StickyNote className="h-4 w-4" /></Button>
             {inputValue.trim() ? (
              <Button size="icon" className={`h-9 w-9 rounded-xl ${isNoteMode ? "bg-warning hover:bg-warning/90" : ""}`} onClick={handleSend} disabled={busy}>{busy ? <Spinner size="sm" /> : <Send className="h-4 w-4" />}</Button>
            ) : !isNoteMode && onSendAudio ? (
              <AudioRecorderButton disabled={busy} onSend={(audio) => { const ext = audio.mimeType.includes("mp4") ? "m4a" : audio.mimeType.includes("ogg") ? "ogg" : "webm"; onSendAudio(new File([audio.blob], `audio-${Date.now()}.${ext}`, { type: audio.mimeType })); }} />
            ) : (
              <Button size="icon" className="h-9 w-9 rounded-xl" disabled={true}><Send className="h-4 w-4" /></Button>
            )}
          </div>
        </div>

        {writingAssistant.suggestion && writingAssistant.originalText && (
          <div className="mt-2">
            <WritingAssistantPreview
              originalText={writingAssistant.originalText} suggestion={writingAssistant.suggestion} model={writingAssistant.model}
              onAccept={(text) => { setInputValue(text); writingAssistant.dismiss(); }}
              onEdit={(text) => { setInputValue(text); writingAssistant.dismiss(); setTimeout(() => textareaRef.current?.focus(), 100); }}
              onDismiss={() => writingAssistant.dismiss()}
            />
          </div>
        )}
      </TooltipProvider>

      <input ref={fileInputRef} type="file" className="hidden" accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={handleFileSelect} />
    </div>
  );
}