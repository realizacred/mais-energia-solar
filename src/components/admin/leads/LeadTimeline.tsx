import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, FileText, MessageSquare, DollarSign, CalendarCheck, UserCheck, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TimelineEvent {
  id: string;
  type: "status" | "message" | "document" | "payment" | "appointment" | "note" | "creation";
  title: string;
  description?: string;
  timestamp: string;
  icon: React.ComponentType<any>;
  color: string;
}

interface LeadTimelineProps {
  leadId: string;
  leadName?: string;
}

export function LeadTimeline({ leadId, leadName }: LeadTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTimeline = async () => {
      setLoading(true);
      const allEvents: TimelineEvent[] = [];

      // 1. Audit logs for the lead
      const { data: auditData } = await supabase
        .from("audit_logs")
        .select("id, acao, tabela, created_at, dados_novos, dados_anteriores")
        .eq("registro_id", leadId)
        .eq("tabela", "leads")
        .order("created_at", { ascending: false })
        .limit(50);

      if (auditData) {
        auditData.forEach(log => {
          const dados = log.dados_novos as any;
          let title = `Lead ${log.acao}`;
          let description = "";

          if (log.acao === "INSERT") {
            title = "Lead criado";
            allEvents.push({
              id: log.id, type: "creation", title, description,
              timestamp: log.created_at, icon: UserCheck, color: "text-primary",
            });
          } else if (log.acao === "UPDATE") {
            const prev = log.dados_anteriores as any;
            if (dados?.status_id !== prev?.status_id) {
              title = "Status alterado";
              description = dados?.status_id ? `Novo status definido` : "Status removido";
            } else if (dados?.deleted_at) {
              title = "Lead arquivado";
            } else {
              title = "Lead atualizado";
            }
            allEvents.push({
              id: log.id, type: "status", title, description,
              timestamp: log.created_at, icon: Clock, color: "text-warning",
            });
          }
        });
      }

      // 2. Appointments linked to lead
      const { data: appointments } = await supabase
        .from("appointments")
        .select("id, title, starts_at, status")
        .eq("lead_id", leadId)
        .order("starts_at", { ascending: false })
        .limit(20);

      if (appointments) {
        appointments.forEach(apt => {
          allEvents.push({
            id: apt.id,
            type: "appointment",
            title: `Agendamento: ${apt.title}`,
            description: `Status: ${apt.status}`,
            timestamp: apt.starts_at,
            icon: CalendarCheck,
            color: "text-info",
          });
        });
      }

      // 3. Checklists linked to lead
      const { data: checklists } = await supabase
        .from("checklists_cliente")
        .select("id, status, created_at")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (checklists) {
        checklists.forEach(cl => {
          allEvents.push({
            id: cl.id,
            type: "document",
            title: "Checklist do cliente",
            description: `Status: ${cl.status}`,
            timestamp: cl.created_at,
            icon: FileText,
            color: "text-success",
          });
        });
      }

      // Sort all events by timestamp descending
      allEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setEvents(allEvents);
      setLoading(false);
    };

    if (leadId) fetchTimeline();
  }, [leadId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Carregando timeline...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Timeline {leadName && `— ${leadName}`}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum evento registrado</p>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="relative pl-6 space-y-0">
              {/* Vertical line */}
              <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />

              {events.map((event, i) => {
                const Icon = event.icon;
                return (
                  <div key={event.id + i} className="relative flex items-start gap-3 pb-4">
                    {/* Dot */}
                    <div className={`absolute -left-6 mt-1 flex items-center justify-center w-[22px] h-[22px] rounded-full bg-background border-2 border-border`}>
                      <Icon className={`h-3 w-3 ${event.color}`} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{event.title}</p>
                      {event.description && (
                        <p className="text-xs text-muted-foreground">{event.description}</p>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {format(new Date(event.timestamp), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
