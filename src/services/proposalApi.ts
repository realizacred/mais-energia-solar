import { supabase } from "@/integrations/supabase/client";

export interface GenerateProposalPayload {
  lead_id: string;
  projeto_id?: string;
  cliente_id?: string;
  grupo: "A" | "B";
  template_id?: string;
  dados_tecnicos: {
    potencia_kwp: number;
    consumo_medio_kwh: number;
    tipo_fase: "monofasico" | "bifasico" | "trifasico";
    concessionaria_id?: string;
    estado: string;
  };
  itens: Array<{
    descricao: string;
    quantidade: number;
    preco_unitario: number;
    categoria: string;
  }>;
  mao_de_obra?: number;
  desconto_percentual?: number;
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
