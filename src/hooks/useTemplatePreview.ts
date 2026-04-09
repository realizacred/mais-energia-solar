/**
 * Hook para dados do TemplatePreviewDialog.
 * §16: Queries só em hooks — NUNCA em componentes
 * §23: staleTime obrigatório
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { VARIABLES_CATALOG } from "@/lib/variablesCatalog";
import { formatDate } from "@/lib/dateUtils";

const STALE_TIME = 1000 * 60 * 5;

interface PropostaOption {
  id: string;
  titulo: string;
  codigo: string | null;
  status: string;
  lead_id: string | null;
  cliente_id: string | null;
  consultor_id: string | null;
  projeto_id: string | null;
}

// ─── Propostas list query ──────────────────────────
export function usePropostasParaPreview(enabled: boolean) {
  return useQuery({
    queryKey: ["propostas-preview-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("propostas_nativas")
        .select("id, titulo, codigo, status, lead_id, cliente_id, consultor_id, projeto_id")
        .order("created_at", { ascending: false })
        .limit(100);
      return (data as PropostaOption[]) || [];
    },
    staleTime: STALE_TIME,
    enabled,
  });
}

// ─── Build proposal context (data fetching) ────────
export async function buildPropostaContext(proposta: PropostaOption): Promise<Record<string, any>> {
  const ctx: Record<string, any> = {};
  const set = (canonical: string, legacy: string, value: any) => {
    if (value !== undefined && value !== null && value !== "") {
      ctx[canonical] = String(value);
      ctx[legacy] = String(value);
    }
  };

  const fmtCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
  const now = new Date();

  // Fetch all related data in parallel
  const [leadRes, clienteRes, projetoRes, consultorRes, versaoRes, brandRes, tenantRes] = await Promise.all([
    proposta.lead_id
      ? supabase.from("leads").select("nome, telefone, cidade, estado, media_consumo, valor_estimado, tipo_telhado, rede_atendimento, area").eq("id", proposta.lead_id).maybeSingle()
      : Promise.resolve({ data: null }),
    proposta.cliente_id
      ? supabase.from("clientes").select("nome, telefone, email, cpf_cnpj, cidade, estado, bairro, rua, numero, cep, complemento, empresa, potencia_kwp, valor_projeto, numero_placas, modelo_inversor, data_nascimento").eq("id", proposta.cliente_id).maybeSingle()
      : Promise.resolve({ data: null }),
    proposta.projeto_id
      ? supabase.from("projetos").select("codigo, status, potencia_kwp, valor_total, numero_modulos, modelo_inversor, modelo_modulos, data_instalacao, geracao_mensal_media_kwh, tipo_instalacao, forma_pagamento").eq("id", proposta.projeto_id).maybeSingle()
      : Promise.resolve({ data: null }),
    proposta.consultor_id
      ? supabase.from("consultores").select("nome, telefone, email, codigo").eq("id", proposta.consultor_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("proposta_versoes")
      .select("snapshot, valor_total, potencia_kwp, economia_mensal, payback_meses, validade_dias, versao_numero")
      .eq("proposta_id", proposta.id)
      .order("versao_numero", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("brand_settings")
      .select("logo_url, logo_small_url, logo_white_url, representante_legal, representante_email, representante_cpf, representante_cargo")
      .limit(1)
      .maybeSingle(),
    supabase.from("tenants")
      .select("nome, nome_fantasia, cnpj, telefone, email, endereco, cidade, estado, bairro, cep, inscricao_estadual")
      .limit(1)
      .maybeSingle(),
  ]);

  const lead = leadRes.data as any;
  const cliente = clienteRes.data as any;
  const projeto = projetoRes.data as any;
  const consultor = consultorRes.data as any;
  const versao = versaoRes.data as any;
  const brand = brandRes.data as any;
  const tenant = tenantRes.data as any;

  // Se tiver snapshot, ele é a fonte primária (contém todos os cálculos)
  const snapshot = versao?.snapshot as Record<string, any> | null;
  if (snapshot && typeof snapshot === "object") {
    for (const [key, value] of Object.entries(snapshot)) {
      if (value !== null && value !== undefined && value !== "") {
        ctx[key] = String(value);
      }
    }
  }

  // ── Cliente ──
  set("cliente.nome", "cliente_nome", cliente?.nome || lead?.nome);
  set("cliente.celular", "cliente_celular", cliente?.telefone || lead?.telefone);
  set("cliente.email", "cliente_email", cliente?.email);
  set("cliente.cnpj_cpf", "cliente_cnpj_cpf", cliente?.cpf_cnpj);
  set("cliente.empresa", "cliente_empresa", cliente?.empresa);
  set("cliente.cep", "cliente_cep", cliente?.cep);
  set("cliente.endereco", "cliente_endereco", cliente?.rua);
  set("cliente.numero", "cliente_numero", cliente?.numero);
  set("cliente.complemento", "cliente_complemento", cliente?.complemento);
  set("cliente.bairro", "cliente_bairro", cliente?.bairro);
  set("cliente.cidade", "cliente_cidade", cliente?.cidade || lead?.cidade);
  set("cliente.estado", "cliente_estado", cliente?.estado || lead?.estado);

  // ── Entrada ──
  set("entrada.consumo_mensal", "consumo_mensal", lead?.media_consumo);
  set("entrada.cidade", "cidade", cliente?.cidade || lead?.cidade);
  set("entrada.estado", "estado", cliente?.estado || lead?.estado);
  set("entrada.tipo_telhado", "tipo_telhado", lead?.tipo_telhado);
  set("entrada.fase", "fase", lead?.rede_atendimento);

  // ── Sistema Solar ──
  const potencia = versao?.potencia_kwp || projeto?.potencia_kwp || cliente?.potencia_kwp;
  set("sistema_solar.potencia_sistema", "potencia_sistema", potencia);
  set("sistema_solar.modulo_quantidade", "modulo_quantidade", projeto?.numero_modulos || cliente?.numero_placas);
  set("sistema_solar.inversor_modelo", "inversor_modelo", projeto?.modelo_inversor || cliente?.modelo_inversor);
  set("sistema_solar.modulo_modelo", "modulo_modelo", projeto?.modelo_modulos);
  set("sistema_solar.geracao_mensal", "geracao_mensal", projeto?.geracao_mensal_media_kwh);

  // ── Financeiro ──
  const valorTotal = versao?.valor_total || projeto?.valor_total || lead?.valor_estimado || cliente?.valor_projeto;
  if (valorTotal) {
    set("financeiro.valor_total", "valor_total", fmtCurrency(valorTotal));
    set("financeiro.preco_final", "preco_final", fmtCurrency(valorTotal));
    set("financeiro.preco_total", "preco_total", fmtCurrency(valorTotal));
  }
  if (versao?.economia_mensal) {
    set("financeiro.economia_mensal", "economia_mensal", fmtCurrency(versao.economia_mensal));
  }
  if (versao?.payback_meses) {
    set("financeiro.payback_meses", "payback_meses", String(versao.payback_meses));
  }

  // ── Comercial ──
  set("comercial.proposta_data", "proposta_data", formatDate(now));
  set("comercial.proposta_codigo", "proposta_codigo", proposta.codigo);
  const validadeDias = versao?.validade_dias || 15;
  set("comercial.proposta_validade", "proposta_validade",
    formatDate(new Date(now.getTime() + validadeDias * 86400000)));
  if (consultor) {
    set("comercial.consultor_nome", "consultor_nome", consultor.nome);
    set("comercial.consultor_telefone", "consultor_telefone", consultor.telefone);
    set("comercial.consultor_email", "consultor_email", consultor.email);
  }

  // ── Empresa (brand_settings + tenants) ──
  const logoUrl = brand?.logo_url || brand?.logo_small_url || "";
  set("comercial.empresa_logo_url", "empresa_logo_url", logoUrl);
  set("comercial.empresa_logo_white_url", "empresa_logo_white_url", brand?.logo_white_url || logoUrl);
  set("comercial.empresa_nome", "empresa_nome", tenant?.nome_fantasia || tenant?.nome);
  set("comercial.empresa_cnpj_cpf", "empresa_cnpj_cpf", tenant?.cnpj);
  set("comercial.empresa_telefone", "empresa_telefone", tenant?.telefone);
  set("comercial.empresa_email", "empresa_email", tenant?.email);
  set("comercial.empresa_endereco", "empresa_endereco", tenant?.endereco);
  set("comercial.empresa_cidade", "empresa_cidade", tenant?.cidade);
  set("comercial.empresa_estado", "empresa_estado", tenant?.estado);
  set("comercial.empresa_bairro", "empresa_bairro", tenant?.bairro);
  set("comercial.empresa_cep", "empresa_cep", tenant?.cep);
  set("comercial.empresa_inscricao_estadual", "empresa_inscricao_estadual", tenant?.inscricao_estadual);
  set("comercial.representante_legal", "representante_legal", brand?.representante_legal);
  set("comercial.representante_email", "representante_email", brand?.representante_email);
  set("comercial.representante_cpf", "representante_cpf", brand?.representante_cpf);
  set("comercial.representante_cargo", "representante_cargo", brand?.representante_cargo);

  for (const v of VARIABLES_CATALOG) {
    if (v.isSeries || v.notImplemented) continue;
    const canonicalBare = v.canonicalKey.replace(/^\{\{|\}\}$/g, "");
    const legacyBare = v.legacyKey.replace(/^\[|\]$/g, "");
    if (!(canonicalBare in ctx)) ctx[canonicalBare] = v.example;
    if (!(legacyBare in ctx)) ctx[legacyBare] = v.example;
  }

  return ctx;
}
