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
  vendedor: string | null;
  vendedor_id: string | null;
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
  /** Joined from vendedores table via vendedor_id */
  vendedor_nome?: string;
  /** @deprecated Use vendedor_id + vendedor_nome instead */
  _vendedor_text_fallback?: string;
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
