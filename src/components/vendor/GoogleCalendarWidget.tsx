import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar,
  Clock,
  MapPin,
  ExternalLink,
  CalendarPlus,
} from "lucide-react";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CalendarEvent {
  id: string;
  summary: string;
  description: string;
  location: string;
  start: string;
  end: string;
  htmlLink: string;
  status: string;
}

/**
 * Widget that displays upcoming Google Calendar events.
 * Shows a connect prompt if the user hasn't linked their calendar.
 */
export function GoogleCalendarWidget() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["google_calendar_events", user?.id],
    enabled: !!user?.id,
    refetchInterval: 5 * 60 * 1000, // 5 min
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("google-calendar-read", {
        body: null,
        method: "GET",
      });
      if (error) throw error;
      return data as { connected: boolean; events: CalendarEvent[]; google_email?: string };
    },
  });

  const connected = data?.connected;
  const events = data?.events || [];

  const handleConnect = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar-auth");
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch {
      // Silent fail
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
          {data?.google_email && (
            <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
              {data.google_email}
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
            const startDate = event.start ? parseISO(event.start) : null;
            const dayLabel = startDate
              ? isToday(startDate)
                ? "Hoje"
                : isTomorrow(startDate)
                ? "Amanhã"
                : format(startDate, "EEE, dd/MM", { locale: ptBR })
              : "";
            const timeLabel = startDate && event.start.includes("T")
              ? format(startDate, "HH:mm")
              : "Dia todo";

            return (
              <div
                key={event.id}
                className="flex items-start gap-3 p-2.5 rounded-lg border border-border/40 hover:bg-muted/30 transition-colors group"
              >
                {/* Time block */}
                <div className="shrink-0 w-14 text-center">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase">
                    {dayLabel}
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {timeLabel}
                  </p>
                </div>

                {/* Event details */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{event.summary}</p>
                  {event.location && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {event.location}
                    </p>
                  )}
                </div>

                {/* External link */}
                {event.htmlLink && (
                  <a
                    href={event.htmlLink}
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
