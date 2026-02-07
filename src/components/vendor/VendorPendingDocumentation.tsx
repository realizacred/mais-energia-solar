import { useMemo } from "react";
import { differenceInDays } from "date-fns";
import { 
  FileWarning, 
  Clock, 
  ChevronRight,
  User,
  MapPin,
  Phone,
  FileX,
  FileCheck,
  MapPinOff,
  Zap
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Lead, LeadStatus } from "@/types/lead";

interface VendorPendingDocumentationProps {
  leads: Lead[];
  statuses: LeadStatus[];
  onLeadClick?: (lead: Lead) => void;
  onConvertClick?: (lead: Lead) => void;
}

// Helper to parse missing docs from observacoes - format: [Documentação Pendente: item1, item2]
function parseMissingDocs(observacoes: string | null): string[] {
  if (!observacoes) return [];
  const match = observacoes.match(/\[Documentação Pendente: ([^\]]+)\]/);
  if (!match) return [];
  return match[1].split(",").map(s => s.trim()).filter(Boolean);
}

// Get missing items for a lead from localStorage (if partial conversion was saved)
function getMissingItemsFromStorage(leadId: string): string[] {
  try {
    const storageKey = `lead_conversion_${leadId}`;
    const stored = localStorage.getItem(storageKey);
    if (!stored) return [];
    
    const data = JSON.parse(stored);
    const missing: string[] = [];
    
    // Check documents
    if (!data.identidadeFiles || data.identidadeFiles.length === 0) {
      missing.push("Identidade");
    }
    if (!data.comprovanteFiles || data.comprovanteFiles.length === 0) {
      missing.push("Comprovante Endereço");
    }
    
    // Check form data
    if (!data.formData?.disjuntor_id) {
      missing.push("Disjuntor");
    }
    if (!data.formData?.transformador_id) {
      missing.push("Transformador");
    }
    if (!data.formData?.localizacao) {
      missing.push("Localização");
    }
    
    return missing;
  } catch {
    return [];
  }
}

// Get completion percentage
function getCompletionPercentage(missingItems: string[]): number {
  const totalItems = 5; // Identidade, Comprovante, Disjuntor, Transformador, Localização
  const completedItems = totalItems - missingItems.length;
  return Math.round((completedItems / totalItems) * 100);
}

// Get badge variant based on item type
function getItemIcon(item: string) {
  const lowerItem = item.toLowerCase();
  if (lowerItem.includes("identidade") || lowerItem.includes("comprovante")) {
    return FileX;
  }
  if (lowerItem.includes("localização")) {
    return MapPinOff;
  }
  if (lowerItem.includes("disjuntor") || lowerItem.includes("transformador")) {
    return Zap;
  }
  return FileX;
}

export function VendorPendingDocumentation({ 
  leads, 
  statuses,
  onLeadClick,
  onConvertClick
}: VendorPendingDocumentationProps) {
  const pendingLeads = useMemo(() => {
    // Find status "Aguardando Documentação"
    const pendingStatus = statuses.find(s => s.nome === "Aguardando Documentação");
    if (!pendingStatus) return [];
    
    return leads
      .filter(lead => lead.status_id === pendingStatus.id)
      .map(lead => {
        // First try to get missing items from localStorage (more accurate)
        let missingItems = getMissingItemsFromStorage(lead.id);
        
        // Fallback to observacoes if localStorage is empty
        if (missingItems.length === 0) {
          missingItems = parseMissingDocs(lead.observacoes);
        }
        
        // If still empty, assume default required items
        if (missingItems.length === 0) {
          missingItems = ["Identidade", "Comprovante Endereço", "Disjuntor", "Transformador", "Localização"];
        }
        
        return {
          ...lead,
          missingItems,
          completionPercentage: getCompletionPercentage(missingItems),
        };
      })
      .sort((a, b) => b.completionPercentage - a.completionPercentage); // Most complete first
  }, [leads, statuses]);

  const getDaysWaiting = (updatedAt: string) => {
    return differenceInDays(new Date(), new Date(updatedAt));
  };

  const getUrgencyBadge = (days: number) => {
    if (days >= 7) {
      return <Badge variant="destructive" className="text-xs">Crítico ({days}d)</Badge>;
    }
    if (days >= 3) {
      return <Badge variant="default" className="bg-primary text-primary-foreground text-xs">Atenção ({days}d)</Badge>;
    }
    return <Badge variant="secondary" className="text-xs">{days}d</Badge>;
  };

  const handleClick = (lead: Lead) => {
    // If onConvertClick is provided, open conversion dialog; otherwise just view
    if (onConvertClick) {
      onConvertClick(lead);
    } else if (onLeadClick) {
      onLeadClick(lead);
    }
  };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <FileWarning className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
            <CardTitle className="text-sm sm:text-base">Aguardando Documentação</CardTitle>
            <Badge variant="secondary" className="bg-primary/20 text-primary text-xs">
              {pendingLeads.length}
            </Badge>
          </div>
        </div>
        <CardDescription className="text-xs sm:text-sm">
          {pendingLeads.length > 0 
            ? "Clique em um lead para completar a documentação e converter"
            : "Nenhum lead aguardando documentação no momento"
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        {pendingLeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-4 sm:py-6 text-center">
            <div className="bg-primary/10 rounded-full p-2 sm:p-3 mb-2 sm:mb-3">
              <FileCheck className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <p className="text-xs sm:text-sm font-medium text-foreground">Tudo certo! ✅</p>
            <p className="text-xs text-muted-foreground mt-1">
              Não há leads com documentação pendente.
            </p>
          </div>
        ) : (
          <>
            <ScrollArea className="max-h-[300px] sm:max-h-[400px]">
              <div className="space-y-2 sm:space-y-3">
                {pendingLeads.map((lead) => {
                  const daysWaiting = getDaysWaiting(lead.updated_at);
                  
                  return (
                    <div
                      key={lead.id}
                      className="flex flex-col p-2.5 sm:p-3 border rounded-lg bg-background hover:bg-muted/50 transition-colors cursor-pointer group"
                      onClick={() => handleClick(lead)}
                    >
                      {/* Header with name and urgency */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                          <div className="bg-primary/10 rounded-full p-1.5 sm:p-2 shrink-0">
                            <User className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">{lead.nome}</p>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1 truncate">
                                <MapPin className="h-3 w-3 shrink-0" />
                                {lead.cidade}/{lead.estado}
                              </span>
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3 shrink-0" />
                                {lead.telefone}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                          {getUrgencyBadge(daysWaiting)}
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors hidden sm:block" />
                        </div>
                      </div>
                      
                      {/* Progress bar */}
                      <div className="mt-2 sm:mt-3">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Progresso</span>
                          <span className={`font-medium ${lead.completionPercentage >= 80 ? 'text-success' : lead.completionPercentage >= 40 ? 'text-warning' : 'text-destructive'}`}>
                            {lead.completionPercentage}%
                          </span>
                        </div>
                        <div className="h-1 sm:h-1.5 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              lead.completionPercentage >= 80 
                                ? 'bg-success' 
                                : lead.completionPercentage >= 40 
                                  ? 'bg-warning' 
                                  : 'bg-destructive'
                            }`}
                            style={{ width: `${lead.completionPercentage}%` }}
                          />
                        </div>
                      </div>
                      
                      {/* Missing items */}
                      {lead.missingItems.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-dashed">
                          <p className="text-xs text-muted-foreground mb-1 sm:mb-1.5 flex items-center gap-1">
                            <FileX className="h-3 w-3" />
                            Faltando:
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {lead.missingItems.slice(0, 3).map((item, idx) => {
                              const Icon = getItemIcon(item);
                              return (
                                <Badge 
                                  key={idx} 
                                  variant="outline" 
                                  className="text-xs bg-destructive/10 text-destructive border-destructive/30 gap-1 px-1.5 py-0"
                                >
                                  <Icon className="h-2.5 w-2.5" />
                                  {item}
                                </Badge>
                              );
                            })}
                            {lead.missingItems.length > 3 && (
                              <Badge variant="outline" className="text-xs px-1.5 py-0">
                                +{lead.missingItems.length - 3}
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
            
            <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t text-xs text-muted-foreground flex items-center gap-2">
              <Clock className="h-3 w-3 shrink-0" />
              <span>
                Tempo médio: {Math.round(pendingLeads.reduce((acc, lead) => acc + getDaysWaiting(lead.updated_at), 0) / pendingLeads.length)} dias
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
