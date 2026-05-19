import { supabase } from "@/integrations/supabase/client";
import type { Orcamento, OrcamentoWithLead } from "@/types/orcamento";
import type { LeadStatus } from "@/types/lead";

export interface FetchOrcamentosResponse {
  orcamentos: OrcamentoWithLead[];
  statuses: LeadStatus[];
}

export const orcamentoService = {
  async fetchOrcamentos(leadId?: string): Promise<FetchOrcamentosResponse> {
    let query = supabase
      .from("orcamentos")
      .select(`
        *,
        lead:leads!inner(
          id,
          lead_code,
          nome,
          telefone,
          telefone_normalized
        )
      `)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });


    if (leadId) {
      query = query.eq("lead_id", leadId);
    }

    const [orcamentosRes, statusesRes] = await Promise.all([
      query,
      supabase.from("lead_status").select("id, nome, cor, ordem, probabilidade_peso, motivo_perda_obrigatorio").order("ordem"),
    ]);

    if (orcamentosRes.error) throw orcamentosRes.error;

    const transformedOrcamentos: OrcamentoWithLead[] = (orcamentosRes.data || []).map((orc: any) => ({
      ...orc,
      lead: orc.lead,
    }));

    return {
      orcamentos: transformedOrcamentos,
      statuses: (statusesRes.data || []) as LeadStatus[],
    };
  },

  async toggleVisto(id: string, field: "visto" | "visto_admin", value: boolean) {
    const { error } = await supabase
      .from("orcamentos")
      .update({ [field]: value })
      .eq("id", id);
    if (error) throw error;
  },

  async updateStatus(id: string, statusId: string | null) {
    const { error } = await supabase
      .from("orcamentos")
      .update({ 
        status_id: statusId,
        ultimo_contato: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw error;
  },

  async delete(id: string, motivo?: string) {
    const { data: { user } } = await supabase.auth.getUser();
    
    // Soft delete by updating deleted_at
    const { error } = await supabase
      .from("orcamentos")
      .update({ 
        deleted_at: new Date().toISOString(),
        deleted_by: user?.id,
        motivo_arquivamento: motivo || null
      })
      .eq("id", id);
      
    if (error) throw error;
  }
};
