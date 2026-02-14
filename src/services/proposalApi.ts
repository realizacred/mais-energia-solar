import { supabase } from "@/integrations/supabase/client";

export interface GenerateProposalPayload {
  lead_id: string;
  projeto_id?: string;
  cliente_id?: string;
  grupo: "A" | "B";
  template_id?: string;
  potencia_kwp: number;
  ucs: Array<{
    nome: string;
    tipo_dimensionamento: "BT" | "MT";
    distribuidora: string;
    distribuidora_id: string;
    subgrupo: string;
    estado: string;
    cidade: string;
    fase: "monofasico" | "bifasico" | "trifasico";
    tensao_rede: string;
    consumo_mensal: number;
    consumo_meses: Record<string, number>;
    consumo_mensal_p: number;
    consumo_mensal_fp: number;
    tarifa_distribuidora: number;
    tarifa_te_p: number;
    tarifa_tusd_p: number;
    tarifa_te_fp: number;
    tarifa_tusd_fp: number;
    demanda_preco: number;
    demanda_contratada: number;
    demanda_adicional: number;
    custo_disponibilidade_kwh: number;
    custo_disponibilidade_valor: number;
    outros_encargos_atual: number;
    outros_encargos_novo: number;
    distancia: number;
    tipo_telhado: string;
    inclinacao: number;
    desvio_azimutal: number;
    taxa_desempenho: number;
    regra_compensacao: number;
    rateio_sugerido_creditos: number;
    rateio_creditos: number;
    imposto_energia: number;
    fator_simultaneidade: number;
  }>;
  premissas: {
    imposto: number;
    inflacao_energetica: number;
    inflacao_ipca: number;
    perda_eficiencia_anual: number;
    sobredimensionamento: number;
    troca_inversor_anos: number;
    troca_inversor_custo: number;
    vpl_taxa_desconto: number;
  };
  itens: Array<{
    descricao: string;
    fabricante: string;
    modelo: string;
    potencia_w: number;
    quantidade: number;
    preco_unitario: number;
    categoria: string;
    avulso: boolean;
  }>;
  servicos: Array<{
    descricao: string;
    categoria: string;
    valor: number;
    incluso_no_preco: boolean;
  }>;
  venda: {
    custo_comissao: number;
    custo_outros: number;
    margem_percentual: number;
    desconto_percentual: number;
    observacoes: string;
  };
  pagamento_opcoes: Array<{
    nome: string;
    tipo: "a_vista" | "financiamento" | "parcelado" | "outro";
    valor_financiado: number;
    entrada: number;
    taxa_mensal: number;
    carencia_meses: number;
    num_parcelas: number;
    valor_parcela: number;
  }>;
  observacoes?: string;
  idempotency_key: string;
}

export interface GenerateProposalResult {
  success: boolean;
  idempotent: boolean;
  proposta_id: string;
  versao_id: string;
  versao_numero: number;
  valor_total: number;
  payback_meses: number;
  economia_mensal: number;
  vpl?: number;
  tir?: number;
  payback_anos?: number;
  error?: string;
}

export interface RenderProposalResult {
  success: boolean;
  idempotent: boolean;
  render_id: string;
  html: string | null;
  url: string | null;
  error?: string;
}

export async function generateProposal(
  payload: GenerateProposalPayload
): Promise<GenerateProposalResult> {
  const { data, error } = await supabase.functions.invoke("proposal-generate", {
    body: payload,
  });

  if (error) {
    throw new Error(error.message || "Erro ao gerar proposta");
  }
  if (!data?.success) {
    throw new Error(data?.error || "Erro desconhecido ao gerar proposta");
  }
  return data as GenerateProposalResult;
}

export async function renderProposal(
  versaoId: string
): Promise<RenderProposalResult> {
  const { data, error } = await supabase.functions.invoke("proposal-render", {
    body: { versao_id: versaoId },
  });

  if (error) {
    throw new Error(error.message || "Erro ao renderizar proposta");
  }
  if (!data?.success) {
    throw new Error(data?.error || "Erro desconhecido ao renderizar");
  }
  return data as RenderProposalResult;
}

export interface SendProposalPayload {
  proposta_id: string;
  versao_id: string;
  canal: "link" | "whatsapp";
  lead_id?: string;
}

export interface SendProposalResult {
  success: boolean;
  token: string;
  public_url: string;
  whatsapp_sent: boolean;
}

export async function sendProposal(
  payload: SendProposalPayload
): Promise<SendProposalResult> {
  const { data, error } = await supabase.functions.invoke("proposal-send", {
    body: payload,
  });

  if (error) {
    throw new Error(error.message || "Erro ao enviar proposta");
  }
  if (!data?.success) {
    throw new Error(data?.error || "Erro desconhecido ao enviar");
  }
  return data as SendProposalResult;
}
