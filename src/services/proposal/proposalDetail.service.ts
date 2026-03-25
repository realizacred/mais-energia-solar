/**
 * proposalDetail.service.ts
 * 
 * Service layer for ProposalDetail — all Supabase queries extracted.
 * §16: Queries NEVER in components — always in hooks/services.
 * §17: Business logic in src/services/.
 */

import { supabase } from "@/integrations/supabase/client";

// ─── Fetch versão + proposta + cliente + render + OS ──────

export interface ProposalDetailData {
  versao: Record<string, any> | null;
  proposta: Record<string, any> | null;
  clienteNome: string | null;
  html: string | null;
  publicUrl: string | null;
  existingOs: Record<string, any> | null;
}

export async function fetchProposalDetail(versaoId: string): Promise<ProposalDetailData> {
  // 1. Versão
  const { data: v, error: vErr } = await supabase
    .from("proposta_versoes")
    .select("id, proposta_id, versao_numero, status, grupo, potencia_kwp, valor_total, economia_mensal, geracao_mensal, payback_meses, valido_ate, observacoes, snapshot, final_snapshot, snapshot_locked, finalized_at, public_slug, created_at, updated_at, gerado_em")
    .eq("id", versaoId)
    .single();

  if (vErr || !v) return { versao: null, proposta: null, clienteNome: null, html: null, publicUrl: null, existingOs: null };

  let proposta: Record<string, any> | null = null;
  let clienteNome: string | null = null;

  // 2. Proposta root
  if (v.proposta_id) {
    const { data: p } = await supabase
      .from("propostas_nativas")
      .select("id, titulo, codigo, status, origem, lead_id, cliente_id, projeto_id, deal_id, updated_at, status_visualizacao, primeiro_acesso_em, ultimo_acesso_em, total_aberturas")
      .eq("id", v.proposta_id)
      .single();
    proposta = p;

    // 3. Cliente nome
    if (p?.cliente_id) {
      const { data: c } = await supabase
        .from("clientes")
        .select("nome")
        .eq("id", p.cliente_id)
        .single();
      clienteNome = c?.nome || null;
    }
  }

  // 4. Render HTML
  const { data: render } = await supabase
    .from("proposta_renders")
    .select("id, html, url")
    .eq("versao_id", versaoId)
    .eq("tipo", "html")
    .maybeSingle();

  // 5. OS existente
  const { data: os } = await supabase
    .from("os_instalacao" as any)
    .select("id, numero_os, status")
    .eq("versao_id", versaoId)
    .maybeSingle();

  return {
    versao: v,
    proposta,
    clienteNome,
    html: render?.html || null,
    publicUrl: render?.url || null,
    existingOs: os || null,
  };
}

// ─── Update proposta status ───────────────────────────────

export async function updatePropostaStatus(
  propostaId: string,
  newStatus: string,
  extra?: { motivo?: string; data?: string },
) {
  const updateData: Record<string, any> = { status: newStatus };

  if (newStatus === "enviada") updateData.enviada_at = new Date().toISOString();
  if (newStatus === "aceita") {
    updateData.aceita_at = extra?.data || new Date().toISOString();
    updateData.aceite_motivo = extra?.motivo || null;
  }
  if (newStatus === "recusada") {
    updateData.recusada_at = extra?.data || new Date().toISOString();
    updateData.recusa_motivo = extra?.motivo || null;
  }
  if (newStatus !== "aceita") {
    updateData.aceita_at = null;
    updateData.aceite_motivo = null;
  }
  if (newStatus !== "recusada") {
    updateData.recusada_at = null;
    updateData.recusa_motivo = null;
  }

  const { error } = await supabase
    .from("propostas_nativas")
    .update(updateData)
    .eq("id", propostaId);
  if (error) throw error;
}

// ─── Commission logic ─────────────────────────────────────

export async function generateCommissionOnAccept(
  propostaRaw: Record<string, any>,
  clienteNome: string,
  potenciaKwp: number,
  valorTotal: number,
) {
  let consultorId: string | null = null;
  if (propostaRaw.lead_id) {
    const { data: lead } = await supabase
      .from("leads")
      .select("consultor_id")
      .eq("id", propostaRaw.lead_id)
      .single();
    consultorId = lead?.consultor_id || null;
  }

  if (!consultorId || valorTotal <= 0) return null;

  const { data: plan } = await supabase
    .from("commission_plans")
    .select("parameters")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  const percentual = (plan?.parameters as any)?.percentual ?? 5;
  const now = new Date();

  await supabase.from("comissoes").insert({
    consultor_id: consultorId,
    cliente_id: propostaRaw.cliente_id,
    projeto_id: propostaRaw.projeto_id || null,
    descricao: `Proposta aceita - ${clienteNome} (${potenciaKwp}kWp)`,
    valor_base: valorTotal,
    percentual_comissao: percentual,
    valor_comissao: (valorTotal * percentual) / 100,
    mes_referencia: now.getMonth() + 1,
    ano_referencia: now.getFullYear(),
    status: "pendente",
  });

  return percentual;
}

// ─── Cancel pending commissions ───────────────────────────

export async function cancelPendingCommissions(projetoId: string, status: string) {
  await supabase
    .from("comissoes")
    .update({ status: "cancelada", observacoes: `Proposta ${status}` })
    .eq("projeto_id", projetoId)
    .eq("status", "pendente");
}

// ─── Generate OS ──────────────────────────────────────────

export async function generateOs(params: {
  propostaId: string;
  versaoId: string;
  projetoId: string | null;
  clienteId: string | null;
  potenciaKwp: number;
  valorTotal: number;
  cidade: string | null;
  estado: string | null;
}) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id, user_id")
    .single();
  if (!profile?.tenant_id) throw new Error("Perfil não encontrado.");

  const { data: os, error } = await supabase
    .from("os_instalacao" as any)
    .insert({
      tenant_id: profile.tenant_id,
      proposta_id: params.propostaId,
      versao_id: params.versaoId,
      projeto_id: params.projetoId,
      cliente_id: params.clienteId,
      potencia_kwp: params.potenciaKwp,
      valor_total: params.valorTotal,
      endereco: null,
      bairro: null,
      cidade: params.cidade,
      estado: params.estado,
      created_by: profile.user_id,
    })
    .select("id, numero_os, status")
    .single();

  if (error) throw error;
  return os;
}

// ─── Copy link (create/get token) ─────────────────────────

export async function getOrCreateProposalToken(
  propostaId: string,
  versaoId: string,
  tipo: "tracked" | "public",
): Promise<string> {
  const { data: existing } = await supabase
    .from("proposta_aceite_tokens" as any)
    .select("token")
    .eq("proposta_id", propostaId)
    .eq("versao_id", versaoId)
    .eq("tipo", tipo)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if ((existing as any)?.token) return (existing as any).token;

  const { data: created, error } = await supabase
    .from("proposta_aceite_tokens" as any)
    .insert({ proposta_id: propostaId, versao_id: versaoId, tipo } as any)
    .select("token")
    .single();

  if (error || !created) throw new Error(error?.message || "Erro ao criar link");
  return (created as any).token;
}

// ─── Update validade ──────────────────────────────────────

export async function updateValidade(versaoId: string, date: string) {
  const { error } = await supabase
    .from("proposta_versoes")
    .update({ valido_ate: date })
    .eq("id", versaoId);
  if (error) throw error;
}
