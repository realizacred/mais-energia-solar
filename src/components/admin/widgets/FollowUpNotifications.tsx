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
}

interface LeadWithDays extends Lead {
  daysWithoutContact: number;
}

export function FollowUpNotifications({ 
  onLeadClick, 
  diasAlerta = 3,
  maxItems = 10 
}: FollowUpNotificationsProps) {
  const [leads, setLeads] = useState<LeadWithDays[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLeadsNeedingFollowUp();
  }, [diasAlerta]);

  const loadLeadsNeedingFollowUp = async () => {
    try {
      // Get leads that haven't been contacted recently
      // Exclude "Convertido" and "Cancelado" statuses
      const { data: excludeStatuses } = await supabase
        .from("lead_status")
        .select("id")
        .in("nome", ["Convertido", "Cancelado", "Perdido"]);

      const excludeIds = excludeStatuses?.map(s => s.id) || [];

      const { data: leadsData, error } = await supabase
        .from("leads")
        .select("*")
        .order("ultimo_contato", { ascending: true, nullsFirst: true })
        .limit(100);

      if (error) throw error;

      // Filter and calculate days without contact
      const now = new Date();
      const leadsNeedingFollowUp: LeadWithDays[] = (leadsData || [])
        .filter(lead => !excludeIds.includes(lead.status_id || ""))
        .map(lead => {
          const lastContact = lead.ultimo_contato 
            ? new Date(lead.ultimo_contato) 
            : new Date(lead.created_at);
          const daysWithoutContact = differenceInDays(now, lastContact);
          return { ...lead, daysWithoutContact };
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
        return <Badge variant="destructive" className="text-xs">Crítico ({days}d)</Badge>;
      case "high":
        return <Badge variant="destructive" className="text-xs opacity-80">{days} dias</Badge>;
      case "medium":
        return <Badge variant="default" className="bg-warning text-warning-foreground text-xs">{days} dias</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">{days} dias</Badge>;
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
      <Card className="border-dashed border-primary/20">
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
    <Card className={criticalCount > 0 ? "border-destructive/30 bg-destructive/5" : "border-warning/30 bg-warning/5"}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {criticalCount > 0 ? (
              <AlertTriangle className="h-5 w-5 text-destructive" />
            ) : (
              <Bell className="h-5 w-5 text-warning" />
            )}
            <CardTitle className="text-base">Follow-up Pendente</CardTitle>
            <Badge 
              variant={criticalCount > 0 ? "destructive" : "secondary"} 
              className={criticalCount > 0 ? "" : "bg-warning/20 text-warning-foreground"}
            >
              {leads.length}
            </Badge>
          </div>
        </div>
        <CardDescription>
          Leads sem contato há mais de {diasAlerta} dias
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[300px]">
          <div className="space-y-2">
            {leads.map((lead) => (
              <div
                key={lead.id}
                className={`flex items-center justify-between p-3 border rounded-lg bg-background hover:bg-muted/50 transition-colors cursor-pointer ${
                  lead.daysWithoutContact >= 7 ? "border-l-4 border-l-destructive" : ""
                }`}
                onClick={() => onLeadClick?.(lead)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`rounded-full p-2 ${
                    lead.daysWithoutContact >= 7 
                      ? "bg-destructive/10" 
                      : "bg-warning/10"
                  }`}>
                    <User className={`h-4 w-4 ${
                      lead.daysWithoutContact >= 7 
                        ? "text-destructive" 
                        : "text-warning"
                    }`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{lead.nome}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {lead.telefone}
                      </span>
                      {lead.vendedor && (
                        <span className="truncate">• {lead.vendedor}</span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {getPriorityBadge(lead.daysWithoutContact)}
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
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
