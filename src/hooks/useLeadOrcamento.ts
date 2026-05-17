import { useState, useCallback } from "react";
import type { LeadSimplified, DuplicateLeadsResult } from "@/types/orcamento";
import { useAuth } from "@/hooks/useAuth";
import { orcamentoCreationService, type LeadData, type OrcamentoData, type SubmitResult } from "@/services/leads/orcamentoCreationService";

export function useLeadOrcamento() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [matchingLeads, setMatchingLeads] = useState<LeadSimplified[]>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadSimplified | null>(null);

  const { user } = useAuth();

  const checkExistingLeads = useCallback(async (telefone: string): Promise<DuplicateLeadsResult | null> => {
    return orcamentoCreationService.checkExistingLeads(telefone, user?.id);
  }, [user]);

  const submitOrcamento = async (
    leadData: LeadData,
    orcamentoData: OrcamentoData,
    options?: { forceNew?: boolean; useExistingLeadId?: string }
  ): Promise<SubmitResult> => {
    setIsSubmitting(true);

    try {
      let leadId: string;
      let isNewLead = true;

      if (!options?.forceNew && !options?.useExistingLeadId) {
        const existing = await checkExistingLeads(leadData.telefone);
        
        if (existing && existing.hasDuplicate) {
          setMatchingLeads(existing.leads);
          setSelectedLead(null);
          setShowDuplicateWarning(true);
          setIsSubmitting(false);
          return {
            success: false,
            isNewLead: false,
            error: "DUPLICATE_DETECTED",
          };
        }
      }

      if (options?.useExistingLeadId) {
        leadId = options.useExistingLeadId;
        isNewLead = false;
      } else {
        const leadResult = await orcamentoCreationService.createLead(leadData);
        if (!leadResult.success || !leadResult.leadId) {
          setIsSubmitting(false);
          return { success: false, isNewLead: true, error: leadResult.error };
        }
        leadId = leadResult.leadId;
      }

      const orcamentoResult = await orcamentoCreationService.createOrcamento(leadId, orcamentoData);
      if (!orcamentoResult.success) {
        setIsSubmitting(false);
        return { success: false, leadId, isNewLead, error: orcamentoResult.error };
      }

      setIsSubmitting(false);
      return {
        success: true,
        leadId,
        orcamentoId: orcamentoResult.orcamentoId,
        isNewLead,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      setIsSubmitting(false);
      return { success: false, isNewLead: true, error: msg };
    }
  };

  const confirmUseExistingLead = async (orcamentoData: OrcamentoData, leadOverride?: LeadSimplified): Promise<SubmitResult> => {
    const leadToUse = leadOverride || selectedLead;
    if (!leadToUse) {
      return { success: false, isNewLead: false, error: "Nenhum lead existente selecionado" };
    }

    setShowDuplicateWarning(false);
    setMatchingLeads([]);
    setSelectedLead(null);

    const newVendedorId = orcamentoData.vendedor_id;
    if (newVendedorId) {
      try {
        await orcamentoCreationService.updateLeadOwnership(
          leadToUse.id, 
          newVendedorId, 
          orcamentoData.vendedor || null, 
          user?.id
        );
      } catch (err) {
        console.warn("[confirmUseExistingLead] Failed to update vendedor:", err);
      }
    }
    
    return submitOrcamento(
      { nome: leadToUse.nome, telefone: leadToUse.telefone, vendedor_id: newVendedorId },
      orcamentoData,
      { useExistingLeadId: leadToUse.id }
    );
  };

  const forceCreateNewLead = async (
    leadData: LeadData,
    orcamentoData: OrcamentoData
  ): Promise<SubmitResult> => {
    setShowDuplicateWarning(false);
    setMatchingLeads([]);
    setSelectedLead(null);
    return submitOrcamento(leadData, orcamentoData, { forceNew: true });
  };

  const cancelDuplicateWarning = () => {
    setShowDuplicateWarning(false);
    setMatchingLeads([]);
    setSelectedLead(null);
  };

  const triggerDuplicateWarning = (leads: LeadSimplified[]) => {
    setMatchingLeads(leads);
    setSelectedLead(null);
    setShowDuplicateWarning(true);
  };

  return {
    isSubmitting,
    matchingLeads,
    selectedLead,
    showDuplicateWarning,
    checkExistingLeads,
    selectLeadFromList: (lead: LeadSimplified) => setSelectedLead(lead),
    submitOrcamento,
    confirmUseExistingLead,
    forceCreateNewLead,
    cancelDuplicateWarning,
    triggerDuplicateWarning,
  };
}
