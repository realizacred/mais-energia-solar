export interface Lead {
  id: string;
  lead_code: string | null;
  nome: string;
  telefone: string;
  telefone_normalized: string | null;
  cep: string | null;
  estado: string;
  cidade: string;
  rua: string | null;
  numero: string | null;
  bairro: string | null;
  complemento: string | null;
  area: string;
  tipo_telhado: string;
  rede_atendimento: string;
  media_consumo: number;
  consumo_previsto: number;
  observacoes: string | null;
  consultor: string | null;
  consultor_id: string | null;
  arquivos_urls: string[] | null;
  status_id: string | null;
  visto: boolean;
  visto_admin: boolean;
  ultimo_contato: string | null;
  proxima_acao: string | null;
  data_proxima_acao: string | null;
  valor_estimado: number | null;
  motivo_perda_id: string | null;
  motivo_perda_obs: string | null;
  distribuido_em: string | null;
  created_at: string;
  updated_at: string;
  /** Joined from consultores table via consultor_id */
  consultor_nome?: string;
  /** Joined from clientes table via lead_id (reverse FK) */
  cliente_potencia_kwp?: number | null;
  cliente_valor_projeto?: number | null;
  cliente_id_vinculado?: string | null;
  /** @deprecated Use consultor_id + consultor_nome instead */
  _consultor_text_fallback?: string;
  /** WhatsApp welcome message delivery status */
  wa_welcome_status?: string;
  wa_welcome_error?: string | null;
  /** Soft delete */
  deleted_at?: string | null;
  deleted_by?: string | null;
}

export interface LeadStatus {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
  probabilidade_peso?: number;
  motivo_perda_obrigatorio?: boolean;
}

export interface MotivoPerda {
  id: string;
  nome: string;
  ativo: boolean;
  ordem: number;
}
