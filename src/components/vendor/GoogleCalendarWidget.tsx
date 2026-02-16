import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar,
  MapPin,
  ExternalLink,
  CalendarPlus,
} from "lucide-react";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Widget that displays upcoming Google Calendar events from local DB mirror.
 * Shows a connect prompt if the user hasn't linked their calendar.
 */
export function GoogleCalendarWidget() {
  const { user } = useAuth();

  // Check if user has connected calendar
  const { data: calToken } = useQuery({
    queryKey: ["my_google_calendar", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("google_calendar_tokens")
        .select("id, google_email, is_active, last_synced_at")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  // Read events from local mirror table
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["google_calendar_events_local", user?.id],
    enabled: !!user?.id && !!calToken?.is_active,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const now = new Date().toISOString();
      const maxDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("google_calendar_events")
        .select("id, google_event_id, summary, description, location, start_at, end_at, status, html_link")
        .eq("user_id", user!.id)
        .gte("start_at", now)
        .lte("start_at", maxDate)
        .eq("status", "confirmed")
        .order("start_at", { ascending: true })
        .limit(20);
      return data || [];
    },
  });

  const connected = calToken?.is_active;

  const handleConnect = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar-auth");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      const msg = err?.message || "";
      const isCredentialError = msg.includes("client_id") || msg.includes("credentials") || msg.includes("401") || msg.includes("invalid");
      console.error("[GoogleCalendar] Connect error:", msg);
      // Use sonner toast for inline feedback
      const { toast } = await import("sonner");
      toast.error(
        isCredentialError
          ? "Erro de Credenciais: O Client ID ou Secret são inválidos. Verifique os dados no Google Cloud Console."
          : `Falha ao conectar Google Calendar. ${msg || "Tente novamente ou verifique as credenciais OAuth."}`
      );
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Agenda
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!connected) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Google Calendar
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-6">
          <Calendar className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground mb-3">
            Conecte seu Google Calendar para ver sua agenda aqui
          </p>
          <Button variant="outline" size="sm" onClick={handleConnect} className="gap-2">
            <CalendarPlus className="h-4 w-4" />
            Conectar Calendar
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Agenda
          </CardTitle>
          {calToken?.google_email && (
            <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
              {calToken.google_email}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto space-y-2">
        {events.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-20" />
            <p className="text-sm">Nenhum evento nos próximos 7 dias</p>
          </div>
        ) : (
          events.map((event) => {
            const startDate = event.start_at ? parseISO(event.start_at) : null;
            const dayLabel = startDate
              ? isToday(startDate)
                ? "Hoje"
                : isTomorrow(startDate)
                ? "Amanhã"
                : format(startDate, "EEE, dd/MM", { locale: ptBR })
              : "";
            const timeLabel = startDate && event.start_at.includes("T")
              ? format(startDate, "HH:mm")
              : "Dia todo";

            return (
              <div
                key={event.id}
                className="flex items-start gap-3 p-2.5 rounded-lg border border-border/40 hover:bg-muted/30 transition-colors group"
              >
                <div className="shrink-0 w-14 text-center">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase">
                    {dayLabel}
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {timeLabel}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{event.summary}</p>
                  {event.location && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {event.location}
                    </p>
                  )}
                </div>
                {event.html_link && (
                  <a
                    href={event.html_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
