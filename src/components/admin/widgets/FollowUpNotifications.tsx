import { useState, useEffect } from "react";
import { differenceInDays } from "date-fns";
import { 
  Bell, 
  Clock, 
  AlertTriangle, 
  User,
  Phone,
  ChevronRight,
  CheckCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { Lead } from "@/types/lead";

interface FollowUpNotificationsProps {
  onLeadClick?: (lead: Lead) => void;
  diasAlerta?: number;
  maxItems?: number;
  refreshKey?: number;
}

interface LeadWithDays extends Lead {
  daysWithoutContact: number;
}

export function FollowUpNotifications({ 
  onLeadClick, 
  diasAlerta = 3,
  maxItems = 10,
  refreshKey = 0,
}: FollowUpNotificationsProps) {
  const [leads, setLeads] = useState<LeadWithDays[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLeadsNeedingFollowUp();
  }, [diasAlerta, refreshKey]);

  // ⚠️ HARDENING: Realtime subscription — auto-refresh when leads change
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const channel = supabase
      .channel('followup-widget')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        () => {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => loadLeadsNeedingFollowUp(), 600);
        }
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [diasAlerta]);

  const loadLeadsNeedingFollowUp = async () => {
    try {
      // Get terminal + special statuses to exclude from follow-up
      const { data: excludeStatuses } = await supabase
        .from("lead_status")
        .select("id")
        .in("nome", ["Convertido", "Perdido", "Arquivado", "Aguardando Documentação", "Aguardando Validação"]);

      const excludeIds = (excludeStatuses || []).map(s => s.id);

      // Build query with server-side status exclusion
      let query = supabase
        .from("leads")
        .select("id, nome, telefone, cidade, estado, consultor, status_id, ultimo_contato, created_at, updated_at")
        .is("deleted_at", null);

      // Exclude terminal statuses server-side
      if (excludeIds.length > 0) {
        // Filter out leads whose status_id is in the exclude list
        for (const id of excludeIds) {
          query = query.neq("status_id", id);
        }
      }

      const { data: leadsData, error } = await query
        .order("ultimo_contato", { ascending: true, nullsFirst: true })
        .limit(100);

      if (error) throw error;

      // Calculate days without contact
      const now = new Date();
      const leadsNeedingFollowUp: LeadWithDays[] = (leadsData || [])
        .map(lead => {
          const lastContact = lead.ultimo_contato 
            ? new Date(lead.ultimo_contato) 
            : new Date(lead.created_at);
          const daysWithoutContact = differenceInDays(now, lastContact);
          return { ...lead, daysWithoutContact } as LeadWithDays;
        })
        .filter(lead => lead.daysWithoutContact >= diasAlerta)
        .sort((a, b) => b.daysWithoutContact - a.daysWithoutContact)
        .slice(0, maxItems);

      setLeads(leadsNeedingFollowUp);
    } catch (error) {
      console.error("Error loading follow-up leads:", error);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityLevel = (days: number) => {
    if (days >= 14) return "critical";
    if (days >= 7) return "high";
    if (days >= 3) return "medium";
    return "low";
  };

  const getPriorityBadge = (days: number) => {
    const level = getPriorityLevel(days);
    switch (level) {
      case "critical":
        return <Badge variant="destructive" className="text-xs font-medium">Crítico ({days}d)</Badge>;
      case "high":
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-xs">{days} dias</Badge>;
      case "medium":
        return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-xs">{days} dias</Badge>;
      default:
        return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">{days} dias</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-64 mt-1" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (leads.length === 0) {
    return (
      <Card className="border-dashed border-primary/20 flex flex-col h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-5 w-5 text-muted-foreground" />
            Follow-up Pendente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <CheckCircle className="h-8 w-8 mx-auto mb-2 text-primary" />
            <p className="text-sm">Todos os leads estão em dia!</p>
            <p className="text-xs mt-1">Nenhum lead sem contato há mais de {diasAlerta} dias</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const criticalCount = leads.filter(l => l.daysWithoutContact >= 7).length;

  return (
    <Card className={`flex flex-col h-full ${criticalCount > 0 ? "border-l-[3px] border-l-destructive bg-card" : "border-l-[3px] border-l-warning bg-card"}`}>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {criticalCount > 0 ? (
              <div className="w-7 h-7 rounded-md bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
              </div>
            ) : (
              <div className="w-7 h-7 rounded-md bg-warning/10 flex items-center justify-center">
                <Bell className="h-3.5 w-3.5 text-warning" />
              </div>
            )}
            <CardTitle className="text-sm font-semibold">Follow-up Pendente</CardTitle>
            <Badge 
              variant="outline"
              className={criticalCount > 0 ? "bg-destructive/10 text-destructive border-destructive/20 text-[10px] h-5" : "bg-warning/10 text-warning border-warning/20 text-[10px] h-5"}
            >
              {leads.length}
            </Badge>
          </div>
        </div>
        <CardDescription className="text-xs">
          Leads sem contato há mais de {diasAlerta} dias
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 flex flex-col px-4 pt-0 pb-3">
        <ScrollArea className="flex-1 min-h-0 max-h-[200px]">
          <div className="divide-y divide-border">
            {leads.map((lead) => (
              <div
                key={lead.id}
                className={`flex items-center justify-between py-2 px-3 border rounded-md bg-background hover:bg-muted/50 transition-colors cursor-pointer ${
                  lead.daysWithoutContact >= 7 ? "border-l-4 border-l-destructive" : ""
                }`}
                onClick={() => onLeadClick?.(lead)}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className={`rounded-full p-1.5 ${
                    lead.daysWithoutContact >= 7 
                      ? "bg-destructive/10" 
                      : "bg-warning/10"
                  }`}>
                    <User className={`h-3.5 w-3.5 ${
                      lead.daysWithoutContact >= 7 
                        ? "text-destructive" 
                        : "text-warning"
                    }`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{lead.nome}</p>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Phone className="h-2.5 w-2.5" />
                        {lead.telefone}
                      </span>
                      {lead.consultor && (
                        <span className="truncate">• {lead.consultor}</span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-1.5">
                  {getPriorityBadge(lead.daysWithoutContact)}
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        
        <div className="mt-3 pt-3 border-t text-xs text-muted-foreground flex items-center gap-2">
          <Clock className="h-3 w-3" />
          <span>
            {criticalCount > 0 
              ? `${criticalCount} lead(s) precisam de atenção urgente`
              : "Contate os leads listados para manter o engajamento"
            }
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
