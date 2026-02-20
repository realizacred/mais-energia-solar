import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { WaInbox } from "@/components/admin/inbox/WaInbox";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { MessageCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Standalone fullscreen WhatsApp Inbox page — designed as the PWA entry point.
 * Renders the WaInbox in vendor mode for the logged-in user.
 */
export default function Inbox() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) return <LoadingSpinner />;
  if (!user) return null;

  return (
    <div className="h-[100dvh] flex flex-col bg-background w-full max-w-full overflow-x-hidden">
      {/* Floating unanswered conversations button */}
      <UnansweredSheet userId={user.id} />

      <WaInbox vendorMode vendorUserId={user.id} />
    </div>
  );
}

/* ====== Unanswered Conversations Sheet ====== */

function UnansweredSheet({ userId }: { userId: string }) {
  const { data: unanswered = [] } = useQuery({
    queryKey: ["unanswered-conversations", userId],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("wa_conversations")
          .select("id, cliente_nome, cliente_telefone, last_message_preview, last_message_at, last_message_direction, unread_count")
          .eq("last_message_direction", "in")
          .in("status", ["open", "pending"])
          .order("last_message_at", { ascending: false })
          .limit(50);
        if (error) {
          console.error("[UnansweredSheet] query error:", error);
          return [];
        }
        return data || [];
      } catch (err) {
        console.error("[UnansweredSheet] unexpected error:", err);
        return [];
      }
    },
    refetchInterval: 30_000,
  });

  const count = unanswered.length;

  return (
    <div className="absolute top-2 right-2 z-50">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full bg-background/80 backdrop-blur shadow-md relative">
            <MessageCircle className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                {count > 99 ? "99+" : count}
              </span>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-0">
          <SheetHeader className="px-4 pt-4 pb-3 border-b border-border/40">
            <SheetTitle className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-warning" />
              Conversas sem resposta
              {count > 0 && (
                <Badge variant="destructive" className="text-[10px]">{count}</Badge>
              )}
            </SheetTitle>
          </SheetHeader>
          <div className="divide-y divide-border/30">
            {count === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <MessageCircle className="h-8 w-8 text-success mb-3" />
                <p className="text-sm font-medium">Tudo respondido! 🎉</p>
                <p className="text-xs text-muted-foreground mt-1">Nenhuma conversa aguardando resposta.</p>
              </div>
            ) : (
              unanswered.map((conv) => (
                <div key={conv.id} className="flex items-center gap-3 p-3 hover:bg-accent/50 transition-colors">
                  <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                    <MessageCircle className="h-4 w-4 text-destructive" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {conv.cliente_nome || conv.cliente_telefone}
                    </p>
                    {conv.last_message_preview && (
                      <p className="text-xs text-muted-foreground truncate">{conv.last_message_preview}</p>
                    )}
                    {conv.last_message_at && (
                      <p className="text-[10px] text-warning mt-0.5">
                        {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    )}
                  </div>
                  {conv.unread_count > 0 && (
                    <Badge variant="destructive" className="text-[10px] shrink-0">{conv.unread_count}</Badge>
                  )}
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
