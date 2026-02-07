export interface Orcamento {
  id: string;
  orc_code: string | null;
  lead_id: string;
  
  // Address data (can vary per proposal)
  cep: string | null;
  estado: string;
  cidade: string;
  bairro: string | null;
  rua: string | null;
  numero: string | null;
  complemento: string | null;
  
  // Technical data
  area: string;
  tipo_telhado: string;
  rede_atendimento: string;
  media_consumo: number;
  consumo_previsto: number;
  
  // Files and notes
  arquivos_urls: string[] | null;
  observacoes: string | null;
  
  // Tracking
  vendedor: string | null;
  status_id: string | null;
  visto: boolean;
  visto_admin: boolean;
  ultimo_contato: string | null;
  proxima_acao: string | null;
  data_proxima_acao: string | null;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface OrcamentoWithLead extends Orcamento {
  lead: {
    id: string;
    lead_code: string | null;
    nome: string;
    telefone: string;
    telefone_normalized: string | null;
  };
}

// Combined view for display (flattened)
export interface OrcamentoDisplayItem {
  id: string;
  orc_code: string | null;
  lead_id: string;
  lead_code: string | null;
  nome: string;
  telefone: string;
  cep: string | null;
  estado: string;
  cidade: string;
  bairro: string | null;
  rua: string | null;
  numero: string | null;
  area: string;
  tipo_telhado: string;
  rede_atendimento: string;
  media_consumo: number;
  consumo_previsto: number;
  arquivos_urls: string[] | null;
  observacoes: string | null;
  vendedor: string | null;
  status_id: string | null;
  visto: boolean;
  visto_admin: boolean;
  ultimo_contato: string | null;
  proxima_acao: string | null;
  data_proxima_acao: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadSimplified {
  id: string;
  lead_code: string | null;
  nome: string;
  telefone: string;
  telefone_normalized: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExistingLeadMatch {
  lead: LeadSimplified;
  orcamentos_count: number;
}

// List of matching leads for duplicate selection
export interface DuplicateLeadsResult {
  leads: LeadSimplified[];
}
