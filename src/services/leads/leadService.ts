import { supabase } from "@/integrations/supabase/client";
import type { Lead, LeadStatus } from "@/types/lead";

export interface FetchLeadsParams {
  page: number;
  pageSize: number;
}

export interface FetchLeadsResponse {
  leads: Lead[];
  statuses: LeadStatus[];
  totalCount: number;
}

export const leadService = {
  async fetchLeads({ page, pageSize }: FetchLeadsParams): Promise<FetchLeadsResponse> {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const [leadsRes, statusesRes] = await Promise.all([
      supabase
        .from("leads")
        .select("id, lead_code, nome, email, telefone, status_id, consultor_id, origem, media_consumo, valor_estimado, created_at, visto_admin, estado, cidade, consultores:consultor_id(id, nome), clientes!clientes_lead_id_fkey(id, potencia_kwp, valor_projeto)", { count: "exact" })
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to),
      supabase
        .from("lead_status")
        .select("id, nome, cor, ordem, probabilidade_peso, motivo_perda_obrigatorio")
        .order("ordem"),
    ]);

    if (leadsRes.error) throw leadsRes.error;

    const enrichedLeads: Lead[] = (leadsRes.data || []).map((l: any) => {
      const cliente = Array.isArray(l.clientes) ? l.clientes[0] : l.clientes;
      return {
        ...l,
        consultor_nome: l.consultores?.nome || l.consultor || null,
        cliente_potencia_kwp: cliente?.potencia_kwp ?? null,
        cliente_valor_projeto: cliente?.valor_projeto ?? null,
        cliente_id_vinculado: cliente?.id ?? null,
        consultores: undefined,
        clientes: undefined,
      } as Lead;
    });

    return {
      leads: enrichedLeads,
      statuses: (statusesRes.data || []) as LeadStatus[],
      totalCount: leadsRes.count || 0,
    };
  },

  async toggleVisto(id: string, vistoAdmin: boolean) {
    const { error } = await supabase
      .from("leads")
      .update({ visto_admin: vistoAdmin })
      .eq("id", id);
    if (error) throw error;
  },

  async delete(id: string) {
    const { error } = await supabase.rpc("delete_lead_cascade", { p_lead_id: id });
    if (error) throw error;
  },

  async restore(id: string) {
    const { data: defaultStatus, error: statusError } = await supabase
      .from("lead_status")
      .select("id")
      .neq("nome", "Arquivado")
      .order("ordem", { ascending: true })
      .limit(1)
      .single();

    if (statusError || !defaultStatus) {
      throw new Error("Não foi possível determinar o status padrão para restauração.");
    }

    const { error } = await supabase
      .from("leads")
      .update({ status_id: defaultStatus.id })
      .eq("id", id);

    if (error) throw error;
  }
};
