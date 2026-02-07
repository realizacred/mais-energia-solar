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
  arquivos_urls: string[] | null;
  status_id: string | null;
  visto: boolean;
  visto_admin: boolean;
  ultimo_contato: string | null;
  proxima_acao: string | null;
  data_proxima_acao: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadStatus {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
}
