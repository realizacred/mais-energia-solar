import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Bell, 
  BellOff, 
  Clock, 
  MessageCircle,
  Zap,
  TrendingDown,
  Calendar,
  CheckCircle2,
  History,
  FileText
} from "lucide-react";
import { differenceInDays, differenceInHours, parseISO, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScheduleWhatsAppDialog, type OrcamentoContext } from "@/components/vendor/ScheduleWhatsAppDialog";
import type { Lead } from "@/types/lead";
import type { OrcamentoVendedor } from "@/hooks/useOrcamentosVendedor";
import { toast } from "@/hooks/use-toast";

interface SmartRemindersProps {
  leads: Lead[];
  orcamentos?: OrcamentoVendedor[];
  vendedorNome: string;
  onContactLead?: (lead: Lead) => void;
}

interface ClientGroup {
  lead: Lead;
  orcamentos: OrcamentoVendedor[];
  firstOrcamento: OrcamentoVendedor | null;
  latestOrcamento: OrcamentoVendedor | null;
  count: number;
}

interface Reminder {
  id: string;
  type: "urgent" | "scheduled" | "opportunity" | "stale";
  clientGroup: ClientGroup;
  message: string;
  priority: number;
  icon: typeof Bell;
}

export function SmartReminders({ leads, orcamentos = [], vendedorNome, onContactLead }: SmartRemindersProps) {
  const STORAGE_KEY = `smart_reminders_settings_${vendedorNome.toLowerCase().replace(/\s/g, "_")}`;
  
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {
      enabled: true,
      urgentDays: 5,
      staleDays: 7,
      showOpportunities: true,
    };
  });

  const [dismissedReminders, setDismissedReminders] = useState<Set<string>>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_dismissed`);
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedOrcamentoContext, setSelectedOrcamentoContext] = useState<OrcamentoContext | null>(null);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings, STORAGE_KEY]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_dismissed`, JSON.stringify([...dismissedReminders]));
  }, [dismissedReminders, STORAGE_KEY]);

  // Group orcamentos by lead_id
  const clientGroups = useMemo(() => {
    const groupMap = new Map<string, ClientGroup>();
    
    leads.forEach((lead) => {
      const leadOrcamentos = orcamentos
        .filter((orc) => orc.lead_id === lead.id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      groupMap.set(lead.id, {
        lead,
        orcamentos: leadOrcamentos,
        firstOrcamento: leadOrcamentos[leadOrcamentos.length - 1] || null,
        latestOrcamento: leadOrcamentos[0] || null,
        count: leadOrcamentos.length,
      });
    });
    
    return groupMap;
  }, [leads, orcamentos]);

  const reminders = useMemo(() => {
    if (!settings.enabled) return [];
    
    const now = new Date();
    const result: Reminder[] = [];

    clientGroups.forEach((clientGroup) => {
      const { lead } = clientGroup;
      const lastContact = lead.ultimo_contato 
        ? parseISO(lead.ultimo_contato) 
        : parseISO(lead.created_at);
      const daysSinceContact = differenceInDays(now, lastContact);
      
      // Urgent: hasn't been contacted in a while
      if (daysSinceContact >= settings.urgentDays * 2) {
        result.push({
          id: `urgent-${lead.id}`,
          type: "urgent",
          clientGroup,
          message: `${daysSinceContact} dias sem contato! Cliente pode estar perdendo interesse.`,
          priority: 1,
          icon: Zap,
        });
      }
      
      // Scheduled: has a follow-up date today or overdue
      if (lead.data_proxima_acao) {
        const scheduledDate = parseISO(lead.data_proxima_acao);
        const daysUntil = differenceInDays(scheduledDate, now);
        
        if (daysUntil <= 0) {
          result.push({
            id: `scheduled-${lead.id}`,
            type: "scheduled",
            clientGroup,
            message: daysUntil === 0 
              ? `Ação agendada para hoje: ${lead.proxima_acao || "Follow-up"}`
              : `Ação atrasada (${Math.abs(daysUntil)} dias): ${lead.proxima_acao || "Follow-up"}`,
            priority: daysUntil < 0 ? 0 : 2,
            icon: Calendar,
          });
        }
      }
      
      // Opportunity: new lead not yet contacted
      if (settings.showOpportunities && !lead.visto && !lead.ultimo_contato) {
        const hoursOld = differenceInHours(now, parseISO(lead.created_at));
        if (hoursOld >= 2 && hoursOld <= 48) {
          result.push({
            id: `opportunity-${lead.id}`,
            type: "opportunity",
            clientGroup,
            message: `Lead novo há ${hoursOld}h! Contate rápido para aumentar conversão.`,
            priority: 3,
            icon: TrendingDown,
          });
        }
      }
      
      // Stale: no activity for too long
      if (daysSinceContact >= settings.staleDays && daysSinceContact < settings.urgentDays * 2) {
        result.push({
          id: `stale-${lead.id}`,
          type: "stale",
          clientGroup,
          message: `${daysSinceContact} dias sem atualização. Considere fazer um follow-up.`,
          priority: 4,
          icon: Clock,
        });
      }
    });

    // Filter dismissed and sort by priority
    return result
      .filter((r) => !dismissedReminders.has(r.id))
      .sort((a, b) => a.priority - b.priority);
  }, [clientGroups, settings, dismissedReminders]);

  const dismissReminder = (id: string) => {
    setDismissedReminders((prev) => new Set([...prev, id]));
    toast({ title: "Lembrete dispensado" });
  };

  const clearDismissed = () => {
    setDismissedReminders(new Set());
    toast({ title: "Lembretes restaurados" });
  };

  const openWhatsApp = (lead: Lead, orcamento?: OrcamentoVendedor) => {
    setSelectedLead(lead);
    if (orcamento) {
      setSelectedOrcamentoContext({
        orc_code: orcamento.orc_code,
        cidade: orcamento.cidade,
        estado: orcamento.estado,
        media_consumo: orcamento.media_consumo,
        created_at: orcamento.created_at,
      });
    } else {
      setSelectedOrcamentoContext(null);
    }
    setWhatsappOpen(true);
  };

  const toggleExpanded = (leadId: string) => {
    setExpandedClients((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) {
        next.delete(leadId);
      } else {
        next.add(leadId);
      }
      return next;
    });
  };

  const getTypeStyles = (type: Reminder["type"]) => {
    switch (type) {
      case "urgent":
        return "bg-destructive/10 border-destructive/30 text-destructive";
      case "scheduled":
        return "bg-primary/10 border-primary/30 text-primary";
      case "stale":
        return "bg-amber-100 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400";
    }
  };

  const getTypeBadge = (type: Reminder["type"]) => {
    switch (type) {
      case "urgent": return "Urgente";
      case "scheduled": return "Agendado";
      case "opportunity": return "Oportunidade";
      case "stale": return "Inativo";
    }
  };

  return (
    <Card className="flex flex-col h-full w-full min-h-0 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Lembretes Inteligentes</CardTitle>
            {reminders.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {reminders.length}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={settings.enabled}
              onCheckedChange={(enabled) => setSettings({ ...settings, enabled })}
            />
          </div>
        </div>
        <CardDescription>
          Alertas por cliente com histórico de orçamentos
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden min-h-0">
        {!settings.enabled ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <BellOff className="h-12 w-12 opacity-20 mb-2" />
            <p className="text-sm">Lembretes desativados</p>
            <Button 
              size="sm" 
              variant="link"
              onClick={() => setSettings({ ...settings, enabled: true })}
            >
              Ativar lembretes
            </Button>
          </div>
        ) : reminders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 text-success opacity-50 mb-2" />
            <p className="text-sm font-medium text-success">Tudo em dia! 🎉</p>
            <p className="text-xs mt-1">Nenhum lembrete pendente no momento</p>
            {dismissedReminders.size > 0 && (
              <Button 
                size="sm" 
                variant="link"
                onClick={clearDismissed}
                className="mt-2"
              >
                Restaurar {dismissedReminders.size} dispensados
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3 h-full overflow-y-auto pr-1 min-h-0">
            {reminders.map((reminder) => {
              const Icon = reminder.icon;
              const { clientGroup } = reminder;
              const isExpanded = expandedClients.has(clientGroup.lead.id);
              
              return (
                <div
                  key={reminder.id}
                  className={`p-3 rounded-lg border ${getTypeStyles(reminder.type)}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 mt-0.5">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          {getTypeBadge(reminder.type)}
                        </Badge>
                        <span className="text-sm font-medium truncate">
                          {clientGroup.lead.nome}
                        </span>
                        {clientGroup.count > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1.5 gap-1 text-xs"
                            onClick={() => toggleExpanded(clientGroup.lead.id)}
                          >
                            <FileText className="h-3 w-3" />
                            {clientGroup.count} orç.
                          </Button>
                        )}
                      </div>
                      <p className="text-xs opacity-80">{reminder.message}</p>
                      <p className="text-xs opacity-60 mt-1">
                        {clientGroup.lead.cidade}, {clientGroup.lead.estado}
                      </p>
                      
                      {/* Expanded: Show orcamentos history */}
                      {isExpanded && clientGroup.orcamentos.length > 0 && (
                        <div className="mt-3 space-y-2 p-2 rounded-md bg-background/50">
                          <p className="text-xs font-medium flex items-center gap-1">
                            <History className="h-3 w-3" />
                            Histórico de Orçamentos (clique para enviar)
                          </p>
                          {clientGroup.orcamentos.map((orc, idx) => {
                            const isLatest = idx === 0;
                            const isFirst = idx === clientGroup.orcamentos.length - 1;
                            
                            return (
                              <div
                                key={orc.id}
                                className={`text-xs p-2 rounded border cursor-pointer transition-colors hover:bg-accent/50 ${
                                  isLatest
                                    ? "border-success bg-success/10 ring-1 ring-success/20"
                                    : isFirst
                                    ? "border-primary/30 bg-primary/5"
                                    : "border-muted"
                                }`}
                                onClick={() => openWhatsApp(clientGroup.lead, orc)}
                              >
                                <div className="flex items-center gap-2 justify-between">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <Badge 
                                      variant={isLatest ? "default" : isFirst ? "default" : "outline"} 
                                      className={`text-[10px] h-4 ${
                                        isLatest 
                                          ? "bg-success text-success-foreground" 
                                          : isFirst 
                                          ? "bg-primary/80 text-primary-foreground" 
                                          : ""
                                      }`}
                                    >
                                      {orc.orc_code || "-"}
                                    </Badge>
                                    {isLatest && (
                                      <Badge variant="secondary" className="text-[10px] h-4 bg-success/20 text-success">
                                        Mais Recente
                                      </Badge>
                                    )}
                                    {isFirst && clientGroup.count > 1 && (
                                      <Badge variant="secondary" className="text-[10px] h-4 bg-primary/20 text-primary">
                                        Primeiro
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="opacity-60">
                                      {format(new Date(orc.created_at), "dd/MM/yy", { locale: ptBR })}
                                    </span>
                                    <MessageCircle className="h-3 w-3 text-success" />
                                  </div>
                                </div>
                                <p className="mt-1 opacity-70">
                                  {orc.cidade}, {orc.estado} • {orc.media_consumo} kWh
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs"
                      onClick={() => dismissReminder(reminder.id)}
                    >
                      Dispensar
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 gap-1 text-xs bg-success hover:bg-success/90 text-success-foreground"
                      onClick={() => openWhatsApp(clientGroup.lead, clientGroup.latestOrcamento || undefined)}
                    >
                      <MessageCircle className="h-3 w-3" />
                      WhatsApp
                    </Button>
                  </div>
                </div>
              );
            })}
            
            {dismissedReminders.size > 0 && (
              <Button 
                size="sm" 
                variant="link"
                onClick={clearDismissed}
                className="w-full"
              >
                Restaurar {dismissedReminders.size} lembretes dispensados
              </Button>
            )}
          </div>
        )}
      </CardContent>

      {/* WhatsApp Dialog - uses API */}
      <ScheduleWhatsAppDialog
        lead={selectedLead ? {
          id: selectedLead.id,
          nome: selectedLead.nome,
          telefone: selectedLead.telefone,
        } : null}
        open={whatsappOpen}
        onOpenChange={setWhatsappOpen}
        vendedorNome={vendedorNome}
        orcamentoContext={selectedOrcamentoContext}
      />
    </Card>
  );
}
