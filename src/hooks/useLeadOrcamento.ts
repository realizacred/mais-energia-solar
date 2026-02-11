import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { LeadSimplified, DuplicateLeadsResult } from "@/types/orcamento";
import { useAuth } from "@/hooks/useAuth";
import { mapToUserMessage } from "@/lib/errorHandler";

interface LeadData {
  nome: string;
  telefone: string;
  vendedor_id?: string;
}

interface OrcamentoData {
  cep?: string | null;
  estado: string;
  cidade: string;
  bairro?: string | null;
  rua?: string | null;
  numero?: string | null;
  complemento?: string | null;
  area: string;
  tipo_telhado: string;
  rede_atendimento: string;
  media_consumo: number;
  consumo_previsto: number;
  observacoes?: string | null;
  arquivos_urls?: string[];
  vendedor?: string | null;
  vendedor_id?: string;
}

interface SubmitResult {
  success: boolean;
  leadId?: string;
  orcamentoId?: string;
  isNewLead: boolean;
  error?: string;
}

/**
 * Hook para gerenciar a criação de leads e orçamentos com detecção de duplicatas
 */
export function useLeadOrcamento() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Support multiple leads with same phone
  const [matchingLeads, setMatchingLeads] = useState<LeadSimplified[]>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  // Track which lead the user selected (if any)
  const [selectedLead, setSelectedLead] = useState<LeadSimplified | null>(null);

  const { user } = useAuth();

  /**
   * Normaliza o telefone removendo caracteres não numéricos
   */
  const normalizePhone = (phone: string): string => {
    return phone.replace(/\D/g, "");
  };

  /**
   * Verifica se já existem leads com o mesmo telefone
   * Para usuários anônimos: usa função RPC segura (check_phone_duplicate)
   * Para usuários autenticados: retorna leads completos para seleção
   */
  const checkExistingLeads = useCallback(async (telefone: string): Promise<DuplicateLeadsResult | null> => {
    const normalized = normalizePhone(telefone);
    if (normalized.length < 10) return null;

    try {
      // For anonymous users: use boolean-only RPC (no lead details exposed)
      if (!user) {
        const { data: hasDuplicate, error } = await supabase
          .rpc("check_phone_duplicate", { _telefone: telefone });

        if (error) {
          console.error("[checkExistingLeads] RPC error:", error.message);
          return null;
        }

        if (hasDuplicate) {
          return {
            leads: [],
            hasDuplicate: true,
          };
        }

        return null;
      }

      // For authenticated users: use SECURITY DEFINER RPC that bypasses RLS
      // This ensures vendor B can see leads from vendor A for duplicate detection
      const { data: leads, error } = await supabase
        .rpc("find_leads_by_phone", { _telefone: telefone });

      if (error) {
        console.error("[checkExistingLeads] RPC error:", error.message);
        return null;
      }

      if (leads && leads.length > 0) {
        // Deduplicate by normalized name - keep only the most recent lead for each unique name
        const normalizedNameMap = new Map<string, typeof leads[0]>();

        for (const lead of leads) {
          const normalizedName = lead.nome.toLowerCase().trim().replace(/\s+/g, " ");
          if (!normalizedNameMap.has(normalizedName)) {
            normalizedNameMap.set(normalizedName, lead);
          }
        }

        const uniqueLeads = Array.from(normalizedNameMap.values());

        return {
          leads: uniqueLeads as LeadSimplified[],
          hasDuplicate: true,
        };
      }

      return null;
    } catch (error) {
      console.error("[checkExistingLeads] Exception:", error);
      return null;
    }
  }, [user]);

  /**
   * Cria um novo lead
   */
  const createLead = async (data: LeadData): Promise<{ success: boolean; leadId?: string; error?: string }> => {
    try {
      const leadId = crypto.randomUUID();

      // Note: We still insert with the original required fields
      // The database may require certain fields even though we're moving them to orcamentos
      // We'll insert minimal data that satisfies NOT NULL constraints
      const { error } = await supabase
        .from("leads")
        .insert({
          id: leadId,
          nome: data.nome,
          telefone: data.telefone,
          vendedor_id: data.vendedor_id,
          // Minimal required fields with defaults
          estado: "N/A",
          cidade: "N/A",
          area: "N/A",
          tipo_telhado: "N/A",
          rede_atendimento: "N/A",
          media_consumo: 0,
          consumo_previsto: 0,
        });

      if (error) {
        console.error("[createLead] Error:", error);
        return { success: false, error: mapToUserMessage(error.message, error.code) };
      }

      return { success: true, leadId };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      return { success: false, error: mapToUserMessage(msg) };
    }
  };

  /**
   * Cria um novo orçamento vinculado a um lead
   */
  const createOrcamento = async (leadId: string, data: OrcamentoData): Promise<{ success: boolean; orcamentoId?: string; error?: string }> => {
    try {
      const orcamentoId = crypto.randomUUID();
      const { error } = await supabase
        .from("orcamentos")
        .insert({
          id: orcamentoId,
          lead_id: leadId,
          cep: data.cep || null,
          estado: data.estado,
          cidade: data.cidade,
          bairro: data.bairro || null,
          rua: data.rua || null,
          numero: data.numero || null,
          complemento: data.complemento || null,
          area: data.area,
          tipo_telhado: data.tipo_telhado,
          rede_atendimento: data.rede_atendimento,
          media_consumo: data.media_consumo,
          consumo_previsto: data.consumo_previsto,
          observacoes: data.observacoes || null,
          arquivos_urls: data.arquivos_urls || [],
          vendedor: data.vendedor || null,
          vendedor_id: data.vendedor_id || null,
        });

      if (error) {
        console.error("[createOrcamento] Error:", error);
        return { success: false, error: mapToUserMessage(error.message, error.code) };
      }

      return { success: true, orcamentoId };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      return { success: false, error: mapToUserMessage(msg) };
    }
  };

  /**
   * Submete um novo orçamento, verificando duplicatas
   * Se encontrar lead existente, mostra aviso. Senão, cria novo lead + orçamento.
   */
  const submitOrcamento = async (
    leadData: LeadData,
    orcamentoData: OrcamentoData,
    options?: { forceNew?: boolean; useExistingLeadId?: string }
  ): Promise<SubmitResult> => {
    setIsSubmitting(true);

    try {
      let leadId: string;
      let isNewLead = true;

      // Check for existing leads if not forcing new
      if (!options?.forceNew && !options?.useExistingLeadId) {
        const existing = await checkExistingLeads(leadData.telefone);
        
        if (existing && existing.hasDuplicate) {
          // Found existing leads - show warning dialog with list
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

      // Use existing lead or create new one
      if (options?.useExistingLeadId) {
        leadId = options.useExistingLeadId;
        isNewLead = false;
      } else {
        console.log("[submitOrcamento] Creating new lead...");
        const leadResult = await createLead(leadData);
        if (!leadResult.success || !leadResult.leadId) {
          console.error("[submitOrcamento] Failed to create lead:", leadResult.error);
          setIsSubmitting(false);
          return { success: false, isNewLead: true, error: leadResult.error };
        }
        leadId = leadResult.leadId;
        console.log("[submitOrcamento] Lead created with id:", leadId);
      }

      // Create the orcamento
      console.log("[submitOrcamento] Creating orcamento for lead:", leadId);
      const orcamentoResult = await createOrcamento(leadId, orcamentoData);
      if (!orcamentoResult.success) {
        console.error("[submitOrcamento] Failed to create orcamento:", orcamentoResult.error);
        setIsSubmitting(false);
        return { success: false, leadId, isNewLead, error: orcamentoResult.error };
      }

      console.log("[submitOrcamento] Success! Lead:", leadId, "Orcamento:", orcamentoResult.orcamentoId);
      setIsSubmitting(false);
      return {
        success: true,
        leadId,
        orcamentoId: orcamentoResult.orcamentoId,
        isNewLead,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      console.error("[submitOrcamento] Exception:", msg);
      setIsSubmitting(false);
      return { success: false, isNewLead: true, error: mapToUserMessage(msg) };
    }
  };

  /**
   * Seleciona um lead específico da lista de duplicados
   */
  const selectLeadFromList = (lead: LeadSimplified) => {
    setSelectedLead(lead);
  };

  /**
   * Confirma o uso do lead selecionado, reatribui vendedor e cria novo orçamento.
   * Registra transferência em lead_distribution_log se vendedor mudou.
   */
  const confirmUseExistingLead = async (orcamentoData: OrcamentoData, leadOverride?: LeadSimplified): Promise<SubmitResult> => {
    const leadToUse = leadOverride || selectedLead;
    if (!leadToUse) {
      return { success: false, isNewLead: false, error: "Nenhum lead existente selecionado" };
    }

    setShowDuplicateWarning(false);
    setMatchingLeads([]);
    setSelectedLead(null);

    // Reatribuir vendedor_id se o orçamento tem um vendedor diferente
    const newVendedorId = orcamentoData.vendedor_id;
    if (newVendedorId) {
      try {
        // Fetch current vendedor_id from lead for distribution log
        const { data: currentLead } = await supabase
          .from("leads")
          .select("vendedor_id")
          .eq("id", leadToUse.id)
          .single();

        const oldVendedorId = currentLead?.vendedor_id;

        // Update lead ownership
        await supabase
          .from("leads")
          .update({
            vendedor_id: newVendedorId,
            vendedor: orcamentoData.vendedor || null,
          })
          .eq("id", leadToUse.id);

        // Register transfer in lead_distribution_log if vendedor changed
        if (oldVendedorId && oldVendedorId !== newVendedorId) {
          await supabase
            .from("lead_distribution_log")
            .insert({
              lead_id: leadToUse.id,
              vendedor_id: newVendedorId,
              vendedor_anterior_id: oldVendedorId,
              motivo: "Reatribuição por novo orçamento",
              distribuido_em: new Date().toISOString(),
              distribuido_por: user?.id || null,
            });
        }
      } catch (err) {
        console.warn("[confirmUseExistingLead] Failed to update vendedor:", err);
        // Continue anyway — the orçamento creation is more important
      }
    }
    
    return submitOrcamento(
      { nome: leadToUse.nome, telefone: leadToUse.telefone, vendedor_id: newVendedorId },
      orcamentoData,
      { useExistingLeadId: leadToUse.id }
    );
  };

  /**
   * Força a criação de um novo lead mesmo com duplicata
   */
  const forceCreateNewLead = async (
    leadData: LeadData,
    orcamentoData: OrcamentoData
  ): Promise<SubmitResult> => {
    setShowDuplicateWarning(false);
    setMatchingLeads([]);
    setSelectedLead(null);
    
    return submitOrcamento(leadData, orcamentoData, { forceNew: true });
  };

  /**
   * Cancela o aviso de duplicata
   */
  const cancelDuplicateWarning = () => {
    setShowDuplicateWarning(false);
    setMatchingLeads([]);
    setSelectedLead(null);
  };

  /**
   * Abre o aviso de duplicata manualmente (usado na checagem antecipada do step 1)
   */
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
    selectLeadFromList,
    submitOrcamento,
    confirmUseExistingLead,
    forceCreateNewLead,
    cancelDuplicateWarning,
    triggerDuplicateWarning,
  };
}
