import { useMemo } from "react";
import { StickyNote, User, Clock, X } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { WaMessage, WaConversation } from "@/hooks/useWaInbox";

interface WaNotesPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: WaMessage[];
  conversation: WaConversation | null;
  onScrollToNote?: (messageId: string) => void;
}

export function WaNotesPanel({
  open,
  onOpenChange,
  messages,
  conversation,
  onScrollToNote,
}: WaNotesPanelProps) {
  // Filter only internal notes
  const notes = useMemo(
    () => messages.filter((m) => m.is_internal_note).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ),
    [messages]
  );

  // Group by date
  const groupedNotes = useMemo(() => {
    const groups: { date: string; label: string; notes: WaMessage[] }[] = [];
    const map = new Map<string, WaMessage[]>();

    notes.forEach((note) => {
      const dateKey = format(new Date(note.created_at), "yyyy-MM-dd");
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(note);
    });

    map.forEach((notesInDay, dateKey) => {
      const d = new Date(dateKey);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
      let label: string;
      if (diffDays === 0) label = "Hoje";
      else if (diffDays === 1) label = "Ontem";
      else label = format(d, "dd 'de' MMMM", { locale: ptBR });

      groups.push({ date: dateKey, label, notes: notesInDay });
    });

    return groups;
  }, [notes]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="px-4 py-3 border-b border-border/30 shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-base">
              <div className="h-8 w-8 rounded-lg bg-warning/10 flex items-center justify-center">
                <StickyNote className="h-4 w-4 text-warning" />
              </div>
              Notas Internas
              <Badge variant="outline" className="text-[10px] font-mono ml-1">
                {notes.length}
              </Badge>
            </SheetTitle>
          </div>
          {conversation && (
            <p className="text-xs text-muted-foreground mt-1">
              {conversation.cliente_nome || conversation.cliente_telefone}
            </p>
          )}
        </SheetHeader>

        {/* Notes list */}
        <ScrollArea className="flex-1">
          {notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                <StickyNote className="h-7 w-7 text-muted-foreground/30" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Nenhuma nota interna</p>
              <p className="text-xs text-muted-foreground/60 mt-1 max-w-[200px]">
                Notas internas são visíveis apenas para a equipe e não são enviadas ao cliente.
              </p>
            </div>
          ) : (
            <div className="p-3 space-y-4">
              {groupedNotes.map((group) => (
                <div key={group.date}>
                  {/* Date separator */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {group.label}
                    </span>
                    <div className="flex-1 h-px bg-border/40" />
                  </div>

                  {/* Notes in this day */}
                  <div className="space-y-2">
                    {group.notes.map((note) => (
                      <button
                        key={note.id}
                        onClick={() => {
                          onScrollToNote?.(note.id);
                          onOpenChange(false);
                        }}
                        className={cn(
                          "w-full text-left p-3 rounded-lg border border-warning/20 bg-warning/[0.04]",
                          "hover:bg-warning/[0.08] hover:border-warning/30 transition-all duration-150",
                          "group cursor-pointer",
                        )}
                      >
                        {/* Author + time */}
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="h-5 w-5 rounded-full bg-warning/15 flex items-center justify-center shrink-0">
                              <User className="h-3 w-3 text-warning" />
                            </div>
                            <span className="text-xs font-semibold text-foreground truncate">
                              {note.sent_by_name || "Equipe"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground tabular-nums">
                              {format(new Date(note.created_at), "HH:mm")}
                            </span>
                          </div>
                        </div>

                        {/* Content */}
                        <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap break-words">
                          {note.content}
                        </p>

                        {/* Click hint */}
                        <p className="text-[10px] text-muted-foreground/50 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          Clique para ver no chat →
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
