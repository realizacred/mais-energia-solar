export interface PropostaFilters {
  status?: string;
  consultorId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export interface Proposta {
  id: string;
  nome: string;
  status: string;
  cliente_nome: string | null;
  cliente_celular: string | null;
  cliente_cidade: string | null;
  cliente_estado: string | null;
  cliente_email: string | null;
  potencia_kwp: number | null;
  numero_modulos: number | null;
  modelo_modulo: string | null;
  modelo_inversor: string | null;
  preco_total: number | null;
  economia_mensal: number | null;
  geracao_mensal_kwh: number | null;
  payback_anos: number | null;
  distribuidora: string | null;
  link_pdf: string | null;
  expiration_date: string | null;
  generated_at: string | null;
  created_at: string;
  vendedor_id: string | null;
  vendedor?: { nome: string } | null;
}

export interface PropostaFormData {
  nome: string;
  cliente_nome: string;
  cliente_celular: string;
  cliente_cidade: string;
  cliente_estado: string;
  cliente_email: string;
  potencia_kwp: number;
  numero_modulos: number;
  modelo_modulo: string;
  modelo_inversor: string;
  preco_total: number;
  economia_mensal: number;
  geracao_mensal_kwh: number;
  payback_anos: number;
  distribuidora: string;
  vendedor_id: string;
}

export interface PropostaListResult {
  propostas: Proposta[];
  total: number;
}
