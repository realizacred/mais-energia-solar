import { supabase } from "@/integrations/supabase/client";
import { ClienteRow } from "@/hooks/useClientes";

export const customerService = {
  async fetchAll(): Promise<ClienteRow[]> {
    const PAGE = 1000;
    const cols =
      "id, nome, telefone, email, empresa, cpf_cnpj, data_nascimento, cep, estado, cidade, bairro, rua, numero, complemento, potencia_kwp, valor_projeto, data_instalacao, numero_placas, modelo_inversor, observacoes, lead_id, localizacao, ativo, created_at, identidade_urls, comprovante_endereco_urls, comprovante_beneficiaria_urls, disjuntor_id, transformador_id, telefone_normalized, cliente_code";
    
    const all: ClienteRow[] = [];
    let from = 0;
    
    while (true) {
      const to = from + PAGE - 1;
      const { data, error } = await supabase
        .from("clientes")
        .select(cols)
        .order("created_at", { ascending: false })
        .range(from, to);
        
      if (error) throw error;
      const chunk = (data || []) as ClienteRow[];
      all.push(...chunk);
      if (chunk.length < PAGE) break;
      from += PAGE;
    }
    return all;
  },

  async save(id: string | undefined, payload: Record<string, any>) {
    if (id) {
      const { data, error } = await supabase
        .from("clientes")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase
        .from("clientes")
        .insert(payload as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  },

  async delete(id: string) {
    const { data, error } = await supabase.rpc("delete_cliente_cascade", { p_cliente_id: id });
    if (error) throw error;
    return data;
  },

  async fetchProjectsAndDealsCount(ids: string[]) {
    const [projRes, dealRes] = await Promise.all([
      supabase.from("projetos").select("cliente_id").in("cliente_id", ids),
      supabase.from("deals").select("customer_id").in("customer_id", ids),
    ]);
    
    if (projRes.error) throw projRes.error;
    if (dealRes.error) throw dealRes.error;

    return {
      projects: projRes.data || [],
      deals: dealRes.data || []
    };
  }
};
