export interface Servico {
  id: string;
  tipo: string;
  status: string;
  data_agendada: string;
  hora_inicio: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  descricao: string | null;
  cliente: { id: string; nome: string; telefone: string } | null;
  instalador_id: string;
  fotos_urls: string[] | null;
  audio_url: string | null;
  video_url: string | null;
  layout_modulos: unknown | null;
  validado: boolean | null;
}

export interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  endereco?: string;
  bairro?: string;
  cidade?: string;
}

export interface Instalador {
  id: string;
  nome: string;
}

export interface ServicoFilters {
  status: string;
  tipo: string;
  instaladorId: string;
  dataInicio: Date | null;
  dataFim: Date | null;
  busca: string;
}

export const tipoOptions = [
  { value: "instalacao", label: "Instalação Solar" },
  { value: "manutencao", label: "Manutenção/Limpeza" },
  { value: "visita_tecnica", label: "Visita Técnica" },
  { value: "suporte", label: "Suporte/Reparo" },
];

export const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  agendado: { label: "Agendado", variant: "default" },
  em_andamento: { label: "Em Andamento", variant: "secondary" },
  concluido: { label: "Concluído", variant: "outline" },
  cancelado: { label: "Cancelado", variant: "destructive" },
  reagendado: { label: "Reagendado", variant: "secondary" },
};

export const defaultFilters: ServicoFilters = {
  status: "todos",
  tipo: "todos",
  instaladorId: "todos",
  dataInicio: null,
  dataFim: null,
  busca: "",
};
