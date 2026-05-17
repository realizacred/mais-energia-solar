import { supabase } from "@/integrations/supabase/client";
import type { LeadSimplified, DuplicateLeadsResult } from "@/types/orcamento";
import { mapToUserMessage } from "@/lib/errorHandler";

export interface LeadData {
  nome: string;
  telefone: string;
  vendedor_id?: string;
}

export interface OrcamentoData {
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

export interface SubmitResult {
  success: boolean;
  leadId?: string;
  orcamentoId?: string;
  isNewLead: boolean;
  error?: string;
}

export const orcamentoCreationService = {
  normalizePhone(phone: string): string {
    return phone.replace(/\D/g, "");
  },

  async checkExistingLeads(telefone: string, userId?: string): Promise<DuplicateLeadsResult | null> {
    const normalized = this.normalizePhone(telefone);
    if (normalized.length < 10) return null;

    try {
      const { data: leads, error } = await supabase
        .rpc("find_leads_by_phone", { _telefone: telefone });

      if (error) {
        if (!userId) {
          const { data: hasDuplicate } = await supabase
            .rpc("check_phone_duplicate", { _telefone: telefone });
          if (hasDuplicate) {
            return { leads: [], hasDuplicate: true };
          }
        }
        return null;
      }

      if (leads && leads.length > 0) {
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
      console.error("[orcamentoCreationService] Exception:", error);
      return null;
    }
  },

  async createLead(data: LeadData): Promise<{ success: boolean; leadId?: string; error?: string }> {
    try {
      const leadId = crypto.randomUUID();
      const { error } = await supabase
        .from("leads")
        .insert({
          id: leadId,
          nome: data.nome,
          telefone: data.telefone,
          consultor_id: data.vendedor_id,
          estado: "N/A",
          cidade: "N/A",
          area: "N/A",
          tipo_telhado: "N/A",
          rede_atendimento: "N/A",
          media_consumo: 0,
          consumo_previsto: 0,
        });

      if (error) {
        return { success: false, error: mapToUserMessage(error.message, error.code) };
      }
      return { success: true, leadId };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      return { success: false, error: mapToUserMessage(msg) };
    }
  },

  async createOrcamento(leadId: string, data: OrcamentoData): Promise<{ success: boolean; orcamentoId?: string; error?: string }> {
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
          consultor: data.vendedor || null,
          consultor_id: data.vendedor_id || null,
        });

      if (error) {
        return { success: false, error: mapToUserMessage(error.message, error.code) };
      }
      return { success: true, orcamentoId };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      return { success: false, error: mapToUserMessage(msg) };
    }
  },

  async updateLeadOwnership(leadId: string, newVendedorId: string, vendedorNome: string | null, userId?: string) {
    const { data: currentLead } = await supabase
      .from("leads")
      .select("consultor_id")
      .eq("id", leadId)
      .single();

    const oldVendedorId = currentLead?.consultor_id;

    await supabase
      .from("leads")
      .update({
        consultor_id: newVendedorId,
        consultor: vendedorNome,
      })
      .eq("id", leadId);

    if (oldVendedorId && oldVendedorId !== newVendedorId) {
      await supabase
        .from("lead_distribution_log")
        .insert({
          lead_id: leadId,
          consultor_id: newVendedorId,
          consultor_anterior_id: oldVendedorId,
          motivo: "Reatribuição por novo orçamento",
          distribuido_em: new Date().toISOString(),
          distribuido_por: userId || null,
        });
    }
  }
};
