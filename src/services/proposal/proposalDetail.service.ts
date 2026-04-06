/**
 * proposalDetail.service.ts
 * 
 * Service layer for ProposalDetail — all Supabase queries extracted.
 * §16: Queries NEVER in components — always in hooks/services.
 * §17: Business logic in src/services/.
 * 
 * Uses RPC get_proposal_workspace for single-call loading.
 * Uses edge function proposal-transition for status changes.
 */

import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction } from "@/lib/edgeFunctionAuth";

// ─── Fetch via RPC (single call) ──────────────────────────

export interface ProposalDetailData {
  versao: Record<string, any> | null;
  proposta: Record<string, any> | null;
  clienteNome: string | null;
  html: string | null;
  publicUrl: string | null;
  existingOs: Record<string, any> | null;
}

export async function fetchProposalDetail(versaoId: string): Promise<ProposalDetailData> {
  const { data, error } = await supabase.rpc("get_proposal_workspace" as any, {
    p_versao_id: versaoId,
  });

  if (error) {
    console.error("RPC get_proposal_workspace error:", error);
    return { versao: null, proposta: null, clienteNome: null, html: null, publicUrl: null, existingOs: null };
  }

  const result = data as any;

  if (result?.error === "versao_not_found") {
    return { versao: null, proposta: null, clienteNome: null, html: null, publicUrl: null, existingOs: null };
  }

  return {
    versao: result?.versao || null,
    proposta: result?.proposta || null,
    clienteNome: result?.cliente_nome || null,
    html: result?.html || null,
    publicUrl: result?.public_url || null,
    existingOs: result?.existing_os || null,
  };
}

// ─── Transition status via edge function ──────────────────

export interface TransitionResult {
  success: boolean;
  previous_status: string;
  new_status: string;
  commission_pct: number | null;
}

export async function transitionProposalStatus(
  propostaId: string,
  newStatus: string,
  extra?: { motivo?: string; data?: string },
): Promise<TransitionResult> {
  return invokeEdgeFunction<TransitionResult>("proposal-transition", {
    body: {
      proposta_id: propostaId,
      new_status: newStatus,
      motivo: extra?.motivo,
      data: extra?.data,
    },
  });
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) throw new Error("Usuário não autenticado.");
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id, user_id")
    .eq("user_id", user.id)
    .maybeSingle();
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
    .is("invalidado_em", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if ((existing as any)?.token) return (existing as any).token;

  const { getCurrentTenantId } = await import("@/lib/getCurrentTenantId");
  const { tenantId } = await getCurrentTenantId();

  const { data: created, error } = await supabase
    .from("proposta_aceite_tokens" as any)
    .insert({ proposta_id: propostaId, versao_id: versaoId, tipo, tenant_id: tenantId } as any)
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
