import { supabase } from "@/integrations/supabase/client";
import { normalizeBrazilianPhone } from "@/utils/phone/normalizeBrazilianPhone";

export type ResolutionStatus =
  | "resolved"
  | "ambiguous"
  | "not_found"
  | "already_resolved"
  | "error";

export interface ResolveResult {
  status: ResolutionStatus;
  conversation_id: string;
  matched_entity_type?: "cliente" | "lead";
  matched_entity_id?: string;
  reason?: string;
}

interface ConversationRow {
  id: string;
  tenant_id: string;
  remote_jid: string;
  lead_id: string | null;
  cliente_id: string | null;
  cliente_telefone: string | null;
}

/**
 * Resolve a conversa WhatsApp vinculando-a a um cliente OU lead existente.
 * NÃO cria registros, NÃO envia mensagens, NÃO altera telefones.
 * Resolve somente quando match único.
 */
export async function resolveWaConversation(conversationId: string): Promise<ResolveResult> {
  try {
    // 1. Buscar conversa (RLS garante tenant)
    const { data: conv, error: convErr } = await supabase
      .from("wa_conversations")
      .select("id, tenant_id, remote_jid, lead_id, cliente_id, cliente_telefone")
      .eq("id", conversationId)
      .maybeSingle<ConversationRow>();

    if (convErr) throw convErr;
    if (!conv) {
      return { status: "error", conversation_id: conversationId, reason: "Conversa não encontrada" };
    }

    // Helper: registrar log de auditoria (best-effort, não bloqueia)
    const log = async (
      status: ResolutionStatus,
      reason: string,
      phoneRaw: string | null,
      variants: string[],
      matched?: { type: "cliente" | "lead"; id: string }
    ) => {
      const { data: userData } = await supabase.auth.getUser();
      await supabase.from("wa_conversation_resolution_logs").insert({
        tenant_id: conv.tenant_id,
        conversation_id: conv.id,
        status,
        matched_entity_type: matched?.type ?? null,
        matched_entity_id: matched?.id ?? null,
        phone_raw: phoneRaw,
        phone_variants: variants,
        reason,
        resolved_by: userData.user?.id ?? null,
      });
    };

    // 2. Já vinculada?
    if (conv.cliente_id || conv.lead_id) {
      const result: ResolveResult = {
        status: "already_resolved",
        conversation_id: conv.id,
        matched_entity_type: conv.cliente_id ? "cliente" : "lead",
        matched_entity_id: (conv.cliente_id || conv.lead_id) as string,
      };
      await log(
        "already_resolved",
        "Conversa já vinculada",
        conv.cliente_telefone,
        [],
        { type: result.matched_entity_type!, id: result.matched_entity_id! }
      );
      return result;
    }

    // 3-4. Extrair + normalizar telefone
    const phoneInput = conv.cliente_telefone || conv.remote_jid;
    const normalized = normalizeBrazilianPhone(phoneInput);

    if (!normalized || !normalized.variants.length) {
      await log("error", "Telefone inválido ou ausente", phoneInput, []);
      return { status: "error", conversation_id: conv.id, reason: "Telefone inválido" };
    }

    // 5. Buscar clientes por variantes (tenant filtrado por RLS, reforçado em query)
    const { data: clientes, error: cliErr } = await supabase
      .from("clientes")
      .select("id")
      .eq("tenant_id", conv.tenant_id)
      .in("telefone_normalized", normalized.variants)
      .limit(5);

    if (cliErr) throw cliErr;

    if (clientes && clientes.length > 1) {
      await log("ambiguous", `${clientes.length} clientes possíveis`, phoneInput, normalized.variants);
      return { status: "ambiguous", conversation_id: conv.id, reason: `${clientes.length} clientes` };
    }

    if (clientes && clientes.length === 1) {
      const clienteId = clientes[0].id;
      const { error: updErr } = await supabase
        .from("wa_conversations")
        .update({ cliente_id: clienteId })
        .eq("id", conv.id)
        .eq("tenant_id", conv.tenant_id);
      if (updErr) throw updErr;

      await log("resolved", "Match único em clientes", phoneInput, normalized.variants, {
        type: "cliente",
        id: clienteId,
      });
      return {
        status: "resolved",
        conversation_id: conv.id,
        matched_entity_type: "cliente",
        matched_entity_id: clienteId,
      };
    }

    // 6. Buscar leads (apenas se não houve cliente)
    const { data: leads, error: leadErr } = await supabase
      .from("leads")
      .select("id")
      .eq("tenant_id", conv.tenant_id)
      .in("telefone_normalized", normalized.variants)
      .limit(5);

    if (leadErr) throw leadErr;

    if (leads && leads.length > 1) {
      await log("ambiguous", `${leads.length} leads possíveis`, phoneInput, normalized.variants);
      return { status: "ambiguous", conversation_id: conv.id, reason: `${leads.length} leads` };
    }

    if (leads && leads.length === 1) {
      const leadId = leads[0].id;
      const { error: updErr } = await supabase
        .from("wa_conversations")
        .update({ lead_id: leadId })
        .eq("id", conv.id)
        .eq("tenant_id", conv.tenant_id);
      if (updErr) throw updErr;

      await log("resolved", "Match único em leads", phoneInput, normalized.variants, {
        type: "lead",
        id: leadId,
      });
      return {
        status: "resolved",
        conversation_id: conv.id,
        matched_entity_type: "lead",
        matched_entity_id: leadId,
      };
    }

    await log("not_found", "Nenhum cliente/lead com este telefone", phoneInput, normalized.variants);
    return { status: "not_found", conversation_id: conv.id, reason: "Sem match" };
  } catch (e: any) {
    return { status: "error", conversation_id: conversationId, reason: e?.message ?? String(e) };
  }
}

export interface BatchSummary {
  resolved: number;
  ambiguous: number;
  not_found: number;
  already_resolved: number;
  errors: number;
  total: number;
}

/**
 * Resolução em lote sequencial (máximo limit conversas).
 */
export async function resolveWaConversationsBatch(
  conversationIds: string[],
  limit = 20
): Promise<BatchSummary> {
  const ids = conversationIds.slice(0, limit);
  const summary: BatchSummary = {
    resolved: 0,
    ambiguous: 0,
    not_found: 0,
    already_resolved: 0,
    errors: 0,
    total: ids.length,
  };

  for (const id of ids) {
    const r = await resolveWaConversation(id);
    if (r.status === "resolved") summary.resolved++;
    else if (r.status === "ambiguous") summary.ambiguous++;
    else if (r.status === "not_found") summary.not_found++;
    else if (r.status === "already_resolved") summary.already_resolved++;
    else summary.errors++;
  }

  return summary;
}
