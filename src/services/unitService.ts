/**
 * UnitService — Canonical service for Unidades Consumidoras (UCs).
 * SRP: All UC CRUD + related queries.
 */
import { supabase } from "@/integrations/supabase/client";

export interface UCRecord {
  id: string;
  tenant_id: string;
  codigo_uc: string;
  nome: string;
  tipo_uc: "consumo" | "gd_geradora" | "beneficiaria" | "mista";
  concessionaria_id: string | null;
  concessionaria_nome: string | null;
  classificacao_grupo: string | null;
  classificacao_subgrupo: string | null;
  modalidade_tarifaria: string | null;
  endereco: Record<string, any>;
  observacoes: string | null;
  status: string;
  is_archived: boolean;
  papel_gd: "none" | "geradora" | "beneficiaria";
  categoria_gd: "gd1" | "gd2" | "gd3" | null;
  email_fatura: string | null;
  leitura_automatica_email: boolean;
  cliente_id: string | null;
  plano_servico_id: string | null;
  valor_mensalidade: number | null;
  dia_vencimento: number | null;
  servico_cobranca_ativo: boolean;
  unit_identifier: string | null;
  unit_identifier_type: string | null;
  proxima_leitura_data: string | null;
  created_at: string;
  updated_at: string;
}

const UC_SELECT_COLS = `id, tenant_id, codigo_uc, nome, tipo_uc, concessionaria_id, concessionaria_nome, classificacao_grupo, classificacao_subgrupo, modalidade_tarifaria, endereco, observacoes, status, is_archived, papel_gd, categoria_gd, email_fatura, leitura_automatica_email, cliente_id, plano_servico_id, valor_mensalidade, dia_vencimento, servico_cobranca_ativo, unit_identifier, unit_identifier_type, proxima_leitura_data, created_at, updated_at`;

export const unitService = {
  async list(filters?: { tipo_uc?: string; is_archived?: boolean; search?: string }) {
    let q = supabase.from("units_consumidoras").select(UC_SELECT_COLS).order("nome");
    if (filters?.tipo_uc && filters.tipo_uc !== "all") q = q.eq("tipo_uc", filters.tipo_uc as any);
    if (filters?.is_archived !== undefined) q = q.eq("is_archived", filters.is_archived);
    if (filters?.search) q = q.or(`nome.ilike.%${filters.search}%,codigo_uc.ilike.%${filters.search}%`);
    const { data, error } = await q;
    if (error) throw error;
    return data as UCRecord[];
  },

  async getById(id: string) {
    const { data, error } = await supabase.from("units_consumidoras").select(UC_SELECT_COLS).eq("id", id).single();
    if (error) throw error;
    return data as UCRecord;
  },

  async create(input: Partial<UCRecord>) {
    const { data, error } = await supabase.from("units_consumidoras").insert(input as any).select(UC_SELECT_COLS).single();
    if (error) throw error;
    return data as UCRecord;
  },

  async update(id: string, input: Partial<UCRecord>) {
    const { data, error } = await supabase.from("units_consumidoras").update(input as any).eq("id", id).select(UC_SELECT_COLS).single();
    if (error) throw error;
    return data as UCRecord;
  },

  async archive(id: string) {
    return this.update(id, { is_archived: true, status: "archived" } as any);
  },
};
