/**
 * approve-proposal-followup
 *
 * Aprova manualmente um item de follow-up por proposta da fila wa_followup_queue
 * e dispara o envio via pipeline canônica `send-proposal-message`.
 *
 * NÃO automatiza envio — exige clique humano.
 * NÃO cria nova fila/tabela. Reaproveita:
 *   - wa_followup_queue (status: pendente_revisao → enviado)
 *   - wa_followup_logs  (audit trail)
 *   - send-proposal-message (envio + proposal_message_logs + project_events)
 *
 * AGENTS.md v4 — RB-76 (auditar antes de criar) / DA-48.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResp(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResp({ error: "Não autorizado" }, 401);
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await callerClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return jsonResp({ error: "Token inválido" }, 401);
    const userId = claimsData.claims.sub as string;

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: profile } = await admin
      .from("profiles")
      .select("tenant_id, ativo")
      .eq("user_id", userId)
      .maybeSingle();
    if (!profile?.tenant_id || profile.ativo === false) {
      return jsonResp({ error: "Usuário inativo ou sem tenant" }, 403);
    }
    const tenantId = profile.tenant_id as string;

    let body: any = {};
    try { body = await req.json(); } catch { /* ignore */ }
    const queueId = body?.queue_id as string | undefined;
    if (!queueId) return jsonResp({ error: "queue_id obrigatório" }, 400);

    // ─── Validate queue item ─────────────────────────────
    const { data: item, error: itemErr } = await admin
      .from("wa_followup_queue")
      .select("id, tenant_id, status, conversation_id, proposta_id, versao_id, mensagem_sugerida, cenario, tentativa, assigned_to, rule_id, proposal_context, metadata")
      .eq("id", queueId)
      .maybeSingle();

    if (itemErr) return jsonResp({ error: "Erro ao buscar item" }, 500);
    if (!item) return jsonResp({ error: "Item não encontrado" }, 404);
    if (item.tenant_id !== tenantId) return jsonResp({ error: "Tenant inválido" }, 403);
    if (item.status !== "pendente_revisao") {
      return jsonResp({ error: `Status inválido (${item.status})` }, 409);
    }
    if (!item.mensagem_sugerida?.trim()) return jsonResp({ error: "Mensagem sugerida vazia" }, 400);
    if (!item.conversation_id) return jsonResp({ error: "Conversation ausente" }, 400);
    if (!item.proposta_id) return jsonResp({ error: "Proposta ausente" }, 400);

    // ─── Resolve recipient + proposta context ────────────
    const { data: proposta } = await admin
      .from("propostas_nativas")
      .select("id, projeto_id, cliente_id, versao_atual")
      .eq("id", item.proposta_id)
      .maybeSingle();
    if (!proposta?.projeto_id) return jsonResp({ error: "Projeto da proposta não encontrado" }, 400);

    const versaoId = item.versao_id || proposta.versao_atual;
    if (!versaoId) return jsonResp({ error: "Versão da proposta não encontrada" }, 400);

    const { data: conv } = await admin
      .from("wa_conversations")
      .select("cliente_telefone, telefone_normalized, cliente_nome, remote_jid, cliente_id")
      .eq("id", item.conversation_id)
      .maybeSingle();

    const phone = (conv?.telefone_normalized || conv?.cliente_telefone || "")
      .toString()
      .replace(/\D/g, "");
    if (!phone) {
      // fallback: extract from remote_jid (e.g. 5532...@s.whatsapp.net)
      const jid = conv?.remote_jid || "";
      const m = jid.match(/^(\d+)@/);
      if (!m) return jsonResp({ error: "Telefone do destinatário ausente" }, 400);
    }
    const finalPhone = phone || (conv?.remote_jid || "").split("@")[0];

    const clienteId = proposta.cliente_id || conv?.cliente_id || null;
    const clienteNome = conv?.cliente_nome || (item.proposal_context as any)?.cliente_nome || null;

    // ─── Delegate to canonical pipeline send-proposal-message ───
    const sendResp = await fetch(`${supabaseUrl}/functions/v1/send-proposal-message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
        apikey: anonKey,
      },
      body: JSON.stringify({
        canal: "whatsapp",
        conteudo: item.mensagem_sugerida,
        destinatario_valor: finalPhone,
        destinatario_tipo: "cliente",
        tipo_mensagem: "cliente",
        estilo: "completa",
        proposta_id: item.proposta_id,
        versao_id: versaoId,
        projeto_id: proposta.projeto_id,
        cliente_id: clienteId,
        cliente_nome: clienteNome,
      }),
    });

    const sendJson: any = await sendResp.json().catch(() => ({}));
    if (!sendResp.ok || !sendJson?.success) {
      const errMsg = sendJson?.error || `Falha no envio (HTTP ${sendResp.status})`;
      // log failure
      await admin.from("wa_followup_logs").insert({
        tenant_id: tenantId,
        conversation_id: item.conversation_id,
        rule_id: item.rule_id,
        queue_id: item.id,
        action: "proposal_followup_send_failed",
        cenario: item.cenario,
        tentativa: item.tentativa,
        assigned_to: item.assigned_to,
        proposta_id: item.proposta_id,
        versao_id: versaoId,
        proposal_context: item.proposal_context as any,
        mensagem_original: item.mensagem_sugerida,
        metadata: { error: errMsg, approved_by: userId },
      });
      return jsonResp({ error: errMsg }, 502);
    }

    // ─── Update queue item ───────────────────────────────
    const nowIso = new Date().toISOString();
    const newMeta = {
      ...((item.metadata as any) || {}),
      approved_by: userId,
      approved_at: nowIso,
      proposal_message_log_id: sendJson?.log_id || null,
    };
    await admin
      .from("wa_followup_queue")
      .update({
        status: "enviado",
        sent_at: nowIso,
        mensagem_enviada: item.mensagem_sugerida,
        metadata: newMeta,
      })
      .eq("id", item.id)
      .eq("tenant_id", tenantId);

    // ─── Audit log ───────────────────────────────────────
    await admin.from("wa_followup_logs").insert({
      tenant_id: tenantId,
      conversation_id: item.conversation_id,
      rule_id: item.rule_id,
      queue_id: item.id,
      action: "proposal_followup_sent",
      cenario: item.cenario,
      tentativa: item.tentativa,
      assigned_to: item.assigned_to,
      proposta_id: item.proposta_id,
      versao_id: versaoId,
      proposal_context: item.proposal_context as any,
      mensagem_original: item.mensagem_sugerida,
      metadata: {
        approved_by: userId,
        approved_at: nowIso,
        proposal_message_log_id: sendJson?.log_id || null,
      },
    });

    return jsonResp({ success: true, log_id: sendJson?.log_id || null });
  } catch (err) {
    console.error("[approve-proposal-followup] Unhandled:", err);
    return jsonResp({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
