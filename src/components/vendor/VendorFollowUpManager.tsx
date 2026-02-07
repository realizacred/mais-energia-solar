import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, Phone, CheckCircle, Bell, MessageCircle } from "lucide-react";
import { differenceInDays, parseISO } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { ScheduleWhatsAppDialog } from "@/components/vendor/ScheduleWhatsAppDialog";
import type { Lead } from "@/types/lead";

interface VendorFollowUpManagerProps {
  leads: Lead[];
  diasAlerta?: number;
  onViewLead?: (lead: Lead) => void;
}

export function VendorFollowUpManager({ leads, diasAlerta = 3, onViewLead }: VendorFollowUpManagerProps) {
  const isMobile = useIsMobile();
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const [selectedLeadForWhatsapp, setSelectedLeadForWhatsapp] = useState<Lead | null>(null);
  
  const handleWhatsappClick = (lead: Lead) => {
    setSelectedLeadForWhatsapp(lead);
    setWhatsappDialogOpen(true);
  };
  
  const { urgentLeads, pendingLeads, upToDateLeads } = useMemo(() => {
    const now = new Date();
    
    const urgent: Lead[] = [];
    const pending: Lead[] = [];
    const upToDate: Lead[] = [];

    leads.forEach((lead) => {
      const lastContact = lead.ultimo_contato ? parseISO(lead.ultimo_contato) : parseISO(lead.created_at);
      const daysSinceContact = differenceInDays(now, lastContact);
      
      if (daysSinceContact >= diasAlerta * 2) {
        urgent.push(lead);
      } else if (daysSinceContact >= diasAlerta) {
        pending.push(lead);
      } else {
        upToDate.push(lead);
      }
    });

    return { urgentLeads: urgent, pendingLeads: pending, upToDateLeads: upToDate };
  }, [leads, diasAlerta]);

  const getStatusBadge = (lead: Lead) => {
    const lastContact = lead.ultimo_contato ? parseISO(lead.ultimo_contato) : parseISO(lead.created_at);
    const daysSinceContact = differenceInDays(new Date(), lastContact);

    if (daysSinceContact >= diasAlerta * 2) {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="w-3 h-3" />
          {daysSinceContact} dias
        </Badge>
      );
    } else if (daysSinceContact >= diasAlerta) {
      return (
        <Badge variant="outline" className="gap-1 border-warning text-warning bg-warning/10">
          <Clock className="w-3 h-3" />
          {daysSinceContact} dias
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="gap-1 border-success text-success bg-success/10">
          <CheckCircle className="w-3 h-3" />
          Em dia
        </Badge>
      );
    }
  };

  const hasIssues = urgentLeads.length > 0 || pendingLeads.length > 0;

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Stats - always show */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card className="border-l-4 border-l-destructive">
          <CardContent className="flex items-center gap-3 p-3 sm:pt-6">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-destructive" />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold text-foreground">{urgentLeads.length}</p>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">Urgentes ({diasAlerta * 2}+ dias)</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-warning">
          <CardContent className="flex items-center gap-3 p-3 sm:pt-6">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-warning/10 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-warning" />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold text-foreground">{pendingLeads.length}</p>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">Pendentes ({diasAlerta}+ dias)</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-success">
          <CardContent className="flex items-center gap-3 p-3 sm:pt-6">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-success/10 flex items-center justify-center shrink-0">
              <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-success" />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold text-foreground">{upToDateLeads.length}</p>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">Em dia</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Urgent Leads */}
      {urgentLeads.length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-destructive" />
              <CardTitle className="text-sm sm:text-base text-destructive">Leads Urgentes</CardTitle>
            </div>
            <CardDescription className="text-xs sm:text-sm">
              Há mais de {diasAlerta * 2} dias sem contato.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            {isMobile ? (
              <div className="space-y-2">
                {urgentLeads.map((lead) => (
                  <div key={lead.id} className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{lead.nome}</p>
                        <p className="text-xs text-muted-foreground">{lead.cidade}, {lead.estado}</p>
                      </div>
                      {getStatusBadge(lead)}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleWhatsappClick(lead)}
                                        className="gap-1 h-8 text-xs flex-1"
                                      >
                                        <MessageCircle className="w-3 h-3" />
                                        WhatsApp
                                      </Button>
                      {onViewLead && (
                        <Button size="sm" onClick={() => onViewLead(lead)} className="h-8 text-xs flex-1">
                          Ver Detalhes
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-medium">Lead</th>
                      <th className="text-left p-3 font-medium">Telefone</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-right p-3 font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {urgentLeads.map((lead) => (
                      <tr key={lead.id} className="bg-destructive/5 border-t">
                        <td className="p-3">
                          <div>
                            <p className="font-medium">{lead.nome}</p>
                            <p className="text-xs text-muted-foreground">{lead.cidade}, {lead.estado}</p>
                          </div>
                        </td>
                        <td className="p-3">
                          <a
                            href={`tel:${lead.telefone}`}
                            className="flex items-center gap-1 text-primary hover:underline"
                          >
                            <Phone className="w-3 h-3" />
                            {lead.telefone}
                          </a>
                        </td>
                        <td className="p-3">{getStatusBadge(lead)}</td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleWhatsappClick(lead)}
                              className="gap-1"
                            >
                              <MessageCircle className="w-3 h-3" />
                              WhatsApp
                            </Button>
                            {onViewLead && (
                              <Button size="sm" onClick={() => onViewLead(lead)}>
                                Ver Detalhes
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pending Leads */}
      {pendingLeads.length > 0 && (
        <Card className="border-warning/50">
          <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-warning" />
              <CardTitle className="text-sm sm:text-base text-warning">Leads Pendentes</CardTitle>
            </div>
            <CardDescription className="text-xs sm:text-sm">
              Entre {diasAlerta} e {diasAlerta * 2} dias sem contato.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            {isMobile ? (
              <div className="space-y-2">
                {pendingLeads.map((lead) => (
                  <div key={lead.id} className="p-3 rounded-lg bg-warning/5 border border-warning/30">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{lead.nome}</p>
                        <p className="text-xs text-muted-foreground">{lead.cidade}, {lead.estado}</p>
                      </div>
                      {getStatusBadge(lead)}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleWhatsappClick(lead)}
                                        className="gap-1 h-8 text-xs flex-1"
                                      >
                                        <MessageCircle className="w-3 h-3" />
                                        WhatsApp
                                      </Button>
                      {onViewLead && (
                        <Button size="sm" variant="outline" onClick={() => onViewLead(lead)} className="h-8 text-xs flex-1">
                          Ver Detalhes
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-medium">Lead</th>
                      <th className="text-left p-3 font-medium">Telefone</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-right p-3 font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingLeads.map((lead) => (
                      <tr key={lead.id} className="bg-warning/5 border-t">
                        <td className="p-3">
                          <div>
                            <p className="font-medium">{lead.nome}</p>
                            <p className="text-xs text-muted-foreground">{lead.cidade}, {lead.estado}</p>
                          </div>
                        </td>
                        <td className="p-3">
                          <a
                            href={`tel:${lead.telefone}`}
                            className="flex items-center gap-1 text-primary hover:underline"
                          >
                            <Phone className="w-3 h-3" />
                            {lead.telefone}
                          </a>
                        </td>
                        <td className="p-3">{getStatusBadge(lead)}</td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleWhatsappClick(lead)}
                              className="gap-1"
                            >
                              <MessageCircle className="w-3 h-3" />
                              WhatsApp
                            </Button>
                            {onViewLead && (
                              <Button size="sm" variant="outline" onClick={() => onViewLead(lead)}>
                                Ver Detalhes
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
      </Card>
      )}

      <ScheduleWhatsAppDialog
        lead={selectedLeadForWhatsapp}
        open={whatsappDialogOpen}
        onOpenChange={setWhatsappDialogOpen}
      />
    </div>
  );
}
