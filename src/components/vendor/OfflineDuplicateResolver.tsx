import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  User,
  Phone,
  AlertTriangle,
  Check,
  Plus,
  Link2,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useOfflineLeadSync } from "@/hooks/useOfflineLeadSync";
import type { LeadSimplified } from "@/types/orcamento";

interface OfflineDuplicateResolverProps {
  vendedorNome?: string | null;
}

export function OfflineDuplicateResolver({ vendedorNome }: OfflineDuplicateResolverProps = {}) {
  const {
    duplicatesToResolve,
    resolveDuplicateAsNew,
    resolveDuplicateAsExisting,
  } = useOfflineLeadSync({ vendedorNome });

  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [selectedLeads, setSelectedLeads] = useState<Map<string, LeadSimplified>>(new Map());
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  if (duplicatesToResolve.length === 0) {
    return null;
  }

  const toggleExpanded = (localLeadId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(localLeadId)) {
      newExpanded.delete(localLeadId);
    } else {
      newExpanded.add(localLeadId);
    }
    setExpandedItems(newExpanded);
  };

  const selectLead = (localLeadId: string, lead: LeadSimplified) => {
    const newSelected = new Map(selectedLeads);
    newSelected.set(localLeadId, lead);
    setSelectedLeads(newSelected);
  };

  const handleUseExisting = async (localLeadId: string) => {
    setResolvingId(localLeadId);
    const success = resolveDuplicateAsExisting(localLeadId);
    if (success) {
      setExpandedItems((prev) => {
        const next = new Set(prev);
        next.delete(localLeadId);
        return next;
      });
    }
    setResolvingId(null);
  };

  const handleCreateNew = async (localLeadId: string) => {
    setResolvingId(localLeadId);
    const success = await resolveDuplicateAsNew(localLeadId);
    if (success) {
      setExpandedItems((prev) => {
        const next = new Set(prev);
        next.delete(localLeadId);
        return next;
      });
    }
    setResolvingId(null);
  };

  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <CardTitle className="text-lg">Clientes Duplicados</CardTitle>
          <Badge variant="destructive" className="ml-2">
            {duplicatesToResolve.length}
          </Badge>
        </div>
        <CardDescription>
          Leads salvos offline que têm telefone já cadastrado. Escolha vincular ao existente ou criar novo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {duplicatesToResolve.map((duplicate) => {
          const isExpanded = expandedItems.has(duplicate.leadId);
          const firstMatch = duplicate.matchingLeads[0];
          const selectedLead = selectedLeads.get(duplicate.leadId) || firstMatch;

          return (
            <Collapsible
              key={duplicate.leadId}
              open={isExpanded}
              onOpenChange={() => toggleExpanded(duplicate.leadId)}
            >
              <div className="border rounded-lg bg-background">
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{duplicate.leadData.nome}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {duplicate.leadData.telefone}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {duplicate.matchingLeads.length} existente{duplicate.matchingLeads.length > 1 ? "s" : ""}
                      </Badge>
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="px-4 pb-4 space-y-4 border-t pt-3">
                    {/* Lead info */}
                    <div className="text-sm text-muted-foreground">
                      <p>{duplicate.leadData.cidade}, {duplicate.leadData.estado}</p>
                    </div>

                    {/* Matching leads list */}
                    <div>
                      <p className="text-sm font-medium mb-2">Clientes existentes com este telefone:</p>
                      <ScrollArea className={duplicate.matchingLeads.length > 2 ? "max-h-40" : ""}>
                        <div className="space-y-2">
                          {duplicate.matchingLeads.map((lead) => {
                            const isSelected = selectedLead?.id === lead.id;
                            const createdDate = format(new Date(lead.created_at), "dd/MM/yyyy", { locale: ptBR });

                            return (
                              <div
                                key={lead.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => selectLead(duplicate.leadId, lead)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    selectLead(duplicate.leadId, lead);
                                  }
                                }}
                                className={`
                                  relative rounded-lg p-3 border cursor-pointer transition-all duration-150
                                  ${isSelected 
                                    ? "border-primary bg-primary/5 ring-1 ring-primary/30" 
                                    : "border-muted hover:border-muted-foreground/40 bg-muted/50"
                                  }
                                `}
                              >
                                {isSelected && (
                                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                    <Check className="w-3 h-3 text-primary-foreground" />
                                  </div>
                                )}

                                <div className="flex items-center gap-2 pr-8">
                                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                                  <span className="font-medium truncate">{lead.nome}</span>
                                  {lead.lead_code && (
                                    <Badge variant="outline" className="text-xs shrink-0">
                                      {lead.lead_code}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                  <Phone className="h-3 w-3 shrink-0" />
                                  <span className="text-xs">{lead.telefone}</span>
                                  <span className="text-xs">• Cadastrado em {createdDate}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-col sm:flex-row gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCreateNew(duplicate.leadId)}
                        disabled={resolvingId === duplicate.leadId}
                        className="gap-2 flex-1"
                      >
                        {resolvingId === duplicate.leadId ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                        Criar Novo Cliente
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleUseExisting(duplicate.leadId)}
                        disabled={resolvingId === duplicate.leadId}
                        className="gap-2 flex-1"
                      >
                        {resolvingId === duplicate.leadId ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Link2 className="w-4 h-4" />
                        )}
                        Usar Existente
                      </Button>
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </CardContent>
    </Card>
  );
}
