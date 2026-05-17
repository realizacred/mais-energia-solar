import { supabase } from "@/integrations/supabase/client";
import type { Proposta, PropostaFilters, PropostaListResult, PropostaFormData } from "./types";

export const proposalService = {
  async fetchPropostas(filters: PropostaFilters = {}, pageSize: number): Promise<PropostaListResult> {
    const params: Record<string, any> = {
      p_limit: filters.limit || pageSize,
      p_offset: filters.offset || 0,
    };
    if (filters.status) params.p_status = filters.status;
    if (filters.consultorId) params.p_consultor_id = filters.consultorId;
    if (filters.search) params.p_search = filters.search;
    if (filters.dateFrom) params.p_date_from = filters.dateFrom;
    if (filters.dateTo) params.p_date_to = filters.dateTo;

    const { data, error } = await supabase.rpc("proposal_list" as any, params);
    if (error) throw error;

    const result = data as any;
    const rows = result?.data || [];
    const total = result?.total || 0;

    return {
      total,
      propostas: rows.map((r: any): Proposta => ({
        id: r.id,
        nome: r.nome || "Proposta",
        status: r.status,
        cliente_nome: r.cliente_nome || null,
        cliente_celular: r.cliente_celular || null,
        cliente_cidade: r.cliente_cidade || null,
        cliente_estado: r.cliente_estado || null,
        cliente_email: r.cliente_email || null,
        potencia_kwp: r.potencia_kwp != null ? Number(r.potencia_kwp) : null,
        numero_modulos: null,
        modelo_modulo: null,
        modelo_inversor: null,
        preco_total: r.preco_total != null ? Number(r.preco_total) : null,
        economia_mensal: r.economia_mensal != null ? Number(r.economia_mensal) : null,
        geracao_mensal_kwh: r.geracao_mensal_kwh != null ? Number(r.geracao_mensal_kwh) : null,
        payback_anos: r.payback_anos != null ? Number(r.payback_anos) : null,
        distribuidora: null,
        link_pdf: r.link_pdf || null,
        expiration_date: null,
        generated_at: r.generated_at || null,
        created_at: r.created_at,
        vendedor_id: r.vendedor_id || null,
        vendedor: r.consultor_nome ? { nome: r.consultor_nome } : null,
      })),
    };
  },

  async create(data: PropostaFormData) {
    const snapshot = {
      clienteNome: data.cliente_nome,
      clienteCelular: data.cliente_celular,
      clienteEmail: data.cliente_email,
      locCidade: data.cliente_cidade,
      locEstado: data.cliente_estado,
      moduloModelo: data.modelo_modulo,
      inversorModelo: data.modelo_inversor,
      moduloQtd: data.numero_modulos,
      distribuidora: data.distribuidora,
    };

    const { data: result, error } = await supabase.rpc("proposal_create" as any, {
      p_titulo: data.nome || null,
      p_consultor_id: data.vendedor_id || null,
      p_snapshot: snapshot,
      p_potencia_kwp: data.potencia_kwp || null,
      p_valor_total: data.preco_total || null,
      p_economia_mensal: data.economia_mensal || null,
      p_geracao_mensal: data.geracao_mensal_kwh || null,
      p_payback_meses: data.payback_anos ? Math.round(data.payback_anos * 12) : null,
      p_intent: "wizard_save",
    });

    if (error) throw error;
    if ((result as any)?.error) throw new Error((result as any).error);

    return { id: (result as any).proposta_id };
  },

  async delete(id: string) {
    const { data, error } = await supabase.rpc("proposal_delete", {
      p_proposta_id: id,
    });
    
    if (error) throw error;
    if ((data as any)?.error) throw new Error((data as any).error);
    
    return data;
  },

  async updateStatus(id: string, status: string, motivo?: string) {
    const { data, error } = await supabase.rpc("proposal_update_status" as any, {
      p_proposta_id: id,
      p_new_status: status,
      p_motivo: motivo || null,
    });
    if (error) throw error;
    if ((data as any)?.error) throw new Error((data as any).error);
    return data;
  }
};
