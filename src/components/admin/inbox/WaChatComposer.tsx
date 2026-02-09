import { useState, useRef, useCallback } from "react";
import {
  Send,
  StickyNote,
  Loader2,
  X,
  Bold,
  Italic,
  Strikethrough,
  Smile,
  Paperclip,
  Image as ImageIcon,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// ── Common Emojis ──
const EMOJI_CATEGORIES: Record<string, string[]> = {
  "😀 Rostos": ["😀","😁","😂","🤣","😊","😇","🥰","😍","😘","😗","😋","😛","🤪","😎","🤩","🥳","😏","😒","😔","😢","😭","😤","🤬","🤯","😱","🥺","😴","🤮","🤧","😷","🤒"],
  "👋 Gestos": ["👋","🤝","👍","👎","👏","🙌","🤲","🤞","✌️","🤙","👊","✊","💪","🙏","☝️","👆","👇","👈","👉","🖐️"],
  "❤️ Símbolos": ["❤️","🧡","💛","💚","💙","💜","🤎","🖤","🤍","💔","❣️","💕","💞","💓","💗","💖","💝","💘","✨","🔥","⭐","🌟","💯","✅","❌","⚠️","📌"],
  "☀️ Natureza": ["☀️","🌤️","⛅","🌧️","🌩️","❄️","🌊","🌺","🌸","🌼","🌻","🌹","🍃","🌿","☘️","🌵","🌴","🌳"],
  "📦 Objetos": ["📱","💻","📧","📞","📊","📈","💰","💵","🏠","🔧","⚡","🔋","☎️","📋","📎","🗂️","📅","🕐","⏰","🚀"],
};

interface WaChatComposerProps {
  onSendMessage: (content: string, isNote?: boolean) => void;
  onSendMedia: (file: File, caption?: string) => void;
  isSending: boolean;
  isNoteMode: boolean;
  onNoteModeChange: (v: boolean) => void;
}

export function WaChatComposer({
  onSendMessage,
  onSendMedia,
  isSending,
  isNoteMode,
  onNoteModeChange,
}: WaChatComposerProps) {
  const [inputValue, setInputValue] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleSend = () => {
    if (!inputValue.trim()) return;
    onSendMessage(inputValue.trim(), isNoteMode);
    setInputValue("");
    onNoteModeChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
    <div className="p-3 border-t border-border/40 bg-card/50">
      {isNoteMode && (
        <div className="flex items-center gap-2 mb-2 px-1">
          <StickyNote className="h-3.5 w-3.5 text-warning" />
          <span className="text-xs text-warning font-medium">Modo nota interna — não será enviada ao cliente</span>
          <Button size="icon" variant="ghost" className="h-5 w-5 ml-auto" onClick={() => onNoteModeChange(false)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
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
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
          onChange={handleFileSelect}
        />
      </div>

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
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isNoteMode ? "Escreva uma nota interna..." : "Digite uma mensagem..."}
          className={`flex-1 min-h-[36px] max-h-[120px] resize-none text-sm leading-snug py-2 ${isNoteMode ? "border-warning/30 bg-warning/5" : ""}`}
          rows={1}
          disabled={busy}
        />

        <Button
          size="icon"
          className={`h-9 w-9 shrink-0 ${isNoteMode ? "bg-warning hover:bg-warning/90" : ""}`}
          onClick={handleSend}
          disabled={!inputValue.trim() || busy}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
