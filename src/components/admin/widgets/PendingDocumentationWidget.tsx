import { useState, useEffect } from "react";
import { differenceInDays } from "date-fns";
import { 
  FileWarning, 
  Clock, 
  AlertCircle, 
  ChevronRight,
  User,
  MapPin,
  Phone,
  FileX
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

interface PendingLead {
  id: string;
  nome: string;
  telefone: string;
  cidade: string;
  estado: string;
  observacoes: string | null;
  updated_at: string;
  created_at: string;
  status_id: string | null;
  consultor: string | null;
  arquivos_urls: string[] | null;
}
interface PendingDocumentationWidgetProps {
  onLeadClick?: (lead: PendingLead) => void;
  onConvertClick?: (lead: PendingLead) => void;
  maxItems?: number;
  refreshKey?: number;
}

// Helper to parse missing docs from observacoes
function parseMissingDocs(observacoes: string | null): string[] {
  if (!observacoes) return [];
  const match = observacoes.match(/\[Documentação Pendente: ([^\]]+)\]/);
  if (!match) return [];
  return match[1].split(",").map(s => s.trim()).filter(Boolean);
}

export function PendingDocumentationWidget({ 
  onLeadClick,
  onConvertClick,
  maxItems = 10,
  refreshKey = 0,
}: PendingDocumentationWidgetProps) {
  const [leads, setLeads] = useState<PendingLead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPendingLeads();
  }, [refreshKey]);

  // ⚠️ HARDENING: Realtime subscription — auto-refresh when leads change
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const channel = supabase
      .channel('pending-docs-widget')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        () => {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => loadPendingLeads(), 600);
        }
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, []);

  const loadPendingLeads = async () => {
    try {
      // Get "Aguardando Documentação" status
      const { data: statusData } = await supabase
        .from("lead_status")
        .select("id")
        .eq("nome", "Aguardando Documentação")
        .single();

      if (!statusData) {
        setLoading(false);
        return;
      }

      // Get leads with this status - use explicit columns, exclude soft-deleted
      const { data: leadsData, error } = await supabase
        .from("leads")
        .select("id, nome, telefone, cidade, estado, observacoes, updated_at, created_at, status_id, consultor, arquivos_urls")
        .eq("status_id", statusData.id)
        .is("deleted_at", null)
        .order("updated_at", { ascending: true })
        .limit(maxItems);

      if (error) throw error;
      setLeads(leadsData || []);
    } catch (error) {
      console.error("Error loading pending documentation leads:", error);
    } finally {
      setLoading(false);
    }
  };

  const getDaysWaiting = (updatedAt: string) => {
    return differenceInDays(new Date(), new Date(updatedAt));
  };

  const getUrgencyBadge = (days: number) => {
    if (days >= 7) {
      return <Badge variant="destructive" className="text-xs font-medium">Crítico ({days}d)</Badge>;
    }
    if (days >= 3) {
      return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-xs">{days}d</Badge>;
    }
    return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">{days}d</Badge>;
  };

  const handleClick = (lead: PendingLead) => {
    if (onConvertClick) {
      onConvertClick(lead);
    } else if (onLeadClick) {
      onLeadClick(lead);
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
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (leads.length === 0) {
    return (
      <Card className="border-dashed flex flex-col h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileWarning className="h-5 w-5 text-muted-foreground" />
            Documentação Pendente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhum lead aguardando documentação</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-l-[3px] border-l-warning bg-card flex flex-col h-full">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-warning/10 flex items-center justify-center">
              <FileWarning className="h-3.5 w-3.5 text-warning" />
            </div>
            <CardTitle className="text-sm font-semibold">Aguardando Documentação</CardTitle>
            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-[10px] h-5">
              {leads.length}
            </Badge>
          </div>
        </div>
        <CardDescription className="text-xs">
          Clique em um lead para completar a documentação e converter
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 flex flex-col px-4 pt-0 pb-3">
        <ScrollArea className="flex-1 min-h-0 max-h-[200px]">
          <div className="space-y-2">
            {leads.map((lead) => {
              const daysWaiting = getDaysWaiting(lead.updated_at);
              const missingDocs = parseMissingDocs(lead.observacoes);
              
              return (
                <div
                  key={lead.id}
                  className="flex flex-col py-2 px-3 border rounded-md bg-background hover:bg-muted/50 transition-colors cursor-pointer group"
                  onClick={() => handleClick(lead)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="bg-warning/10 rounded-full p-1.5">
                        <User className="h-3.5 w-3.5 text-warning" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{lead.nome}</p>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-2.5 w-2.5" />
                            {lead.cidade}/{lead.estado}
                          </span>
                          <span className="flex items-center gap-1">
                            <Phone className="h-2.5 w-2.5" />
                            {lead.telefone}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5">
                      {getUrgencyBadge(daysWaiting)}
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-warning transition-colors" />
                    </div>
                  </div>
                  
                  {/* Missing docs summary */}
                  {missingDocs.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-dashed flex items-start gap-2">
                      <FileX className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
                      <div className="flex flex-wrap gap-1">
                        {missingDocs.map((doc, idx) => (
                          <Badge 
                            key={idx} 
                            variant="outline" 
                            className="text-[11px] bg-warning/10 text-warning border border-warning/30 rounded-full px-2.5 py-0.5 font-medium"
                          >
                            {doc}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
        
        {leads.length > 0 && (
        <div className="flex items-center gap-1.5 pt-2 mt-2 border-t border-border text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span>Tempo médio de espera: <strong className="text-foreground">{Math.round(leads.reduce((acc, lead) => acc + getDaysWaiting(lead.updated_at), 0) / leads.length)} dias</strong></span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
