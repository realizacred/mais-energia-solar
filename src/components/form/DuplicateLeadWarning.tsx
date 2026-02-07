import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { User, Phone, Plus, Link2, Check } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { LeadSimplified } from "@/types/orcamento";

interface DuplicateLeadWarningProps {
  open: boolean;
  matchingLeads: LeadSimplified[];
  selectedLead: LeadSimplified | null;
  onSelectLead: (lead: LeadSimplified) => void;
  onUseExisting: (lead: LeadSimplified) => void;
  onCreateNew: () => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function DuplicateLeadWarning({
  open,
  matchingLeads,
  selectedLead,
  onSelectLead,
  onUseExisting,
  onCreateNew,
  onCancel,
  isSubmitting = false,
}: DuplicateLeadWarningProps) {
  if (!matchingLeads.length) return null;

  const firstLead = matchingLeads[0];
  const hasMultiple = matchingLeads.length > 1;

  const handleUseSelected = () => {
    const leadToUse = selectedLead || firstLead;
    onUseExisting(leadToUse);
  };

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <AlertDialogContent className="max-w-[90vw] sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-base">
            <User className="h-5 w-5 text-primary" />
            {hasMultiple ? "Clientes encontrados" : "Cliente já cadastrado"}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm">
            {hasMultiple 
              ? `Encontramos ${matchingLeads.length} clientes com este telefone. Selecione um para vincular ou crie um novo.`
              : "Encontramos um cliente com este telefone. Deseja vincular este novo orçamento ao cadastro existente ou criar um novo cliente?"
            }
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Lead list */}
        <ScrollArea className={hasMultiple ? "max-h-48 sm:max-h-60" : ""}>
          <div className="space-y-2 my-2">
            {matchingLeads.map((lead) => {
              const isSelected = selectedLead?.id === lead.id || (!selectedLead && lead.id === firstLead.id);
              const createdDate = format(new Date(lead.created_at), "dd/MM/yyyy", { locale: ptBR });

              return (
                <div
                  key={lead.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectLead(lead)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectLead(lead);
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
                  {/* Selection indicator */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </div>
                  )}

                  <div className="flex items-center gap-2 pr-8">
                    <User className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium truncate max-w-[120px] sm:max-w-none">{lead.nome}</span>
                    {lead.lead_code && (
                      <Badge variant="outline" className="text-xs shrink-0">
                        {lead.lead_code}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground mt-1">
                    <div className="flex items-center gap-1">
                      <Phone className="h-3 w-3 shrink-0" />
                      <span className="text-xs sm:text-sm">{lead.telefone}</span>
                    </div>
                    <span className="text-xs">• Cadastrado em {createdDate}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-2 mt-2">
          <AlertDialogCancel 
            disabled={isSubmitting} 
            onClick={onCancel}
            className="w-full sm:w-auto mt-0"
          >
            Cancelar
          </AlertDialogCancel>
          <Button
            type="button"
            variant="outline"
            onClick={onCreateNew}
            disabled={isSubmitting}
            className="gap-1.5 w-full sm:w-auto text-sm"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden xs:inline">Criar</span> Novo Cliente
          </Button>
          <AlertDialogAction
            onClick={handleUseSelected}
            disabled={isSubmitting}
            className="gap-1.5 w-full sm:w-auto text-sm"
          >
            <Link2 className="h-4 w-4" />
            Vincular<span className="hidden xs:inline"> ao Selecionado</span>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
