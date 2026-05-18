import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export interface TriggerData {
  projeto_id: string;
  tenant_id: string;
  etapa_anterior_id?: string;
  etapa_nova_id?: string;
  funil_id?: string;
  evento: string;
  status?: string;
}

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("pt-BR");
}

export async function buildAutomationContext(
  supabase: SupabaseClient,
  projetoId: string,
  tenantId: string,
  triggerData: TriggerData
) {
  // Fetch projeto
  const { data: projeto } = await supabase
    .from("projetos")
    .select("*")
    .eq("id", projetoId)
    .single();

  if (!projeto) throw new Error("Projeto não encontrado");

  // Fetch related data in parallel
  const [clienteResult, propostaResult, responsavelResult, etapasResult] = await Promise.all([
    supabase
      .from("clientes")
      .select("*")
      .eq("id", projeto.cliente_id)
      .maybeSingle(),
    supabase
      .from("proposta_versoes")
      .select("*, propostas_nativas!inner(*)")
      .eq("propostas_nativas.projeto_id", projetoId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("consultores")
      .select("nome, email, telefone")
      .eq("id", projeto.consultor_id)
      .maybeSingle(),
    supabase
      .from("projeto_etapas")
      .select("id, nome")
      .in("id", [triggerData.etapa_anterior_id, triggerData.etapa_nova_id].filter(Boolean) as string[])
  ]);

  const cliente = clienteResult.data;
  const proposta = propostaResult.data;
  const responsavel = responsavelResult.data;
  const etapas = etapasResult.data || [];

  return {
    tenant_id: tenantId,
    projeto_id: projetoId,
    cliente: {
      nome: cliente?.nome || "Cliente",
      telefone: cliente?.telefone || "",
      email: cliente?.email || "",
      cidade: cliente?.cidade || "",
      cpf_cnpj: cliente?.cpf_cnpj || "",
    },
    projeto: {
      codigo: projeto.codigo,
      nome: projeto.nome || "Sem nome",
      valor_total: formatCurrency(projeto.valor_total),
      potencia_kwp: projeto.potencia_kwp || 0,
      data_venda: formatDate(projeto.data_venda),
      geracao_mensal_media_kwh: projeto.geracao_mensal_media_kwh || 0,
    },
    proposta: {
      link_pdf: proposta?.output_pdf_path || proposta?.link_pdf || "",
      payback_meses: proposta?.payback_meses || 0,
      economia_mensal: formatCurrency(proposta?.economia_mensal),
      valor_total: formatCurrency(proposta?.valor_total),
    },
    responsavel: {
      nome: responsavel?.nome || "Responsável",
      telefone: responsavel?.telefone || "",
      email: responsavel?.email || "",
    },
    sistema: {
      data_hoje: formatDate(new Date()),
      hora_atual: new Date().toLocaleTimeString("pt-BR"),
      nome_empresa: "Mais Energia Solar",
    },
    gatilho: {
      etapa_anterior: etapas.find((e) => e.id === triggerData.etapa_anterior_id)?.nome || "-",
      etapa_nova: etapas.find((e) => e.id === triggerData.etapa_nova_id)?.nome || "-",
    }
  };
}

export function renderTemplate(template: string | undefined, context: any): string {
  if (!template) return "";
  
  // Flatten context for simple {{key}} lookup if needed, 
  // but requested structure is {{group.field}}
  return template.replace(/\{\{([\w.]+)\}\}/g, (match, path) => {
    const parts = path.split(".");
    let val: any = context;
    for (const part of parts) {
      val = val?.[part];
    }
    return val !== undefined && val !== null ? String(val) : match;
  });
}

export function resolveVariable(path: string | undefined, context: any): string {
  if (!path) return "";
  const cleanPath = path.replace(/\{\{|\}\}/g, "");
  const parts = cleanPath.split(".");
  let val: any = context;
  for (const part of parts) {
    val = val?.[part];
  }
  return val !== undefined && val !== null ? String(val) : "";
}
