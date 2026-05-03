/**
 * proposal-public-action
 * 
 * Public endpoint for accepting/rejecting proposals via token.
 * Does NOT require JWT — authenticates via proposta_aceite_tokens.
 * Delegates to the same business logic as proposal-transition.
 * 
 * RB-47: Public accept/reject MUST go through this function, never direct UPDATE.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Mirror of proposal-transition state machine
const VALID_TRANSITIONS: Record<string, string[]> = {
  rascunho: ["gerada"],
  gerada: ["enviada", "aceita", "recusada", "cancelada"],
  enviada: ["vista", "aceita", "recusada", "cancelada"],
  vista: ["aceita", "recusada", "cancelada"],
  aceita: ["cancelada"],
  recusada: ["gerada", "enviada"],
  expirada: ["gerada"],
  cancelada: [],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { token, action, motivo, user_agent } = body;

    // Resolve real IP from request headers (RB: never trust client-sent IP)
    const xff = req.headers.get("x-forwarded-for");
    const realIp = xff ? xff.split(",")[0].trim() : (req.headers.get("x-real-ip") || "unknown");
    const ip_address = realIp;

    if (!token || !action) {
      return new Response(
        JSON.stringify({ error: "token e action são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["aceitar", "recusar"].includes(action)) {
      return new Response(
        JSON.stringify({ error: "action deve ser 'aceitar' ou 'recusar'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // 1. Validate token
    const { data: tokenData, error: tokenErr } = await admin
      .from("proposta_aceite_tokens")
      .select("id, proposta_id, versao_id, tenant_id, tipo, expires_at, invalidado_em, used_at")
      .eq("token", token)
      .maybeSingle();

    if (tokenErr || !tokenData) {
      return new Response(
        JSON.stringify({ error: "Token inválido ou não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (tokenData.invalidado_em) {
      return new Response(
        JSON.stringify({ error: "Token já foi invalidado" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Token expirado" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const propostaId = tokenData.proposta_id;
    const tenantId = tokenData.tenant_id;
    const newStatus = action === "aceitar" ? "aceita" : "recusada";

    // 2. Load current proposal
    const { data: proposta, error: pErr } = await admin
      .from("propostas_nativas")
      .select("id, status, lead_id, cliente_id, projeto_id, tenant_id")
      .eq("id", propostaId)
      .eq("tenant_id", tenantId)
      .single();

    if (pErr || !proposta) {
      return new Response(
        JSON.stringify({ error: "Proposta não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Validate transition
    const currentStatus = proposta.status || "rascunho";
    const allowed = VALID_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      return new Response(
        JSON.stringify({
          error: `Transição inválida: ${currentStatus} → ${newStatus}`,
          allowed,
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3b. Idempotency check
    const { data: existingEvent } = await admin
      .from("proposal_events")
      .select("id")
      .eq("proposta_id", propostaId)
      .eq("tipo", newStatus === "aceita" ? "proposta_aceita" : "proposta_recusada")
      .maybeSingle();

    if (existingEvent) {
      return new Response(
        JSON.stringify({
          success: true,
          idempotent: true,
          message: `Ação '${action}' já registrada anteriormente`,
          previous_status: currentStatus,
          new_status: newStatus,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Build update payload
    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = { status: newStatus };

    if (newStatus === "aceita") {
      updateData.aceita_at = now;
      updateData.is_principal = true;
    }
    if (newStatus === "recusada") {
      updateData.recusada_at = now;
      updateData.recusa_motivo = motivo || null;
    }
    // Clear opposite timestamps
    if (newStatus !== "aceita") {
      updateData.aceita_at = null;
      updateData.aceite_motivo = null;
    }
    if (newStatus !== "recusada") {
      updateData.recusada_at = null;
      updateData.recusa_motivo = null;
    }

    // 5. Execute update
    const { error: updateErr } = await admin
      .from("propostas_nativas")
      .update(updateData)
      .eq("id", propostaId);

    if (updateErr) throw updateErr;

    // 5a. Sync proposta_versoes.status
    try {
      const statusMap: Record<string, string> = {
        aceita: "accepted",
        recusada: "rejected",
      };
      const { data: latestVersao } = await admin
        .from("proposta_versoes")
        .select("id")
        .eq("proposta_id", propostaId)
        .order("versao_numero", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestVersao?.id) {
        await admin
          .from("proposta_versoes")
          .update({ status: statusMap[newStatus] || newStatus })
          .eq("id", latestVersao.id);
      }
    } catch (syncErr) {
      console.error("[proposal-public-action] Erro ao sincronizar versão:", syncErr);
    }

    // 5b. On accept: reject siblings + cancel generated documents
    if (newStatus === "aceita" && proposta.projeto_id) {
      // Clear is_principal on siblings
      await admin
        .from("propostas_nativas")
        .update({ is_principal: false })
        .eq("projeto_id", proposta.projeto_id)
        .neq("id", propostaId);

      // Reject actionable siblings
      const { data: siblings } = await admin
        .from("propostas_nativas")
        .select("id")
        .eq("projeto_id", proposta.projeto_id)
        .neq("id", propostaId)
        .in("status", ["gerada", "enviada", "vista", "rascunho"]);

      if (siblings && siblings.length > 0) {
        await admin
          .from("propostas_nativas")
          .update({
            status: "recusada",
            recusada_at: now,
            recusa_motivo: "Outra proposta do projeto foi aceita (aceite público)",
          })
          .in("id", siblings.map((s: any) => s.id));
      }

      // Cancel generated documents (RB-44: never cancel signed)
      try {
        await admin
          .from("generated_documents")
          .update({
            status: "cancelled",
            observacao: "Nova proposta aceita (aceite público)",
            updated_at: now,
          })
          .eq("deal_id", proposta.projeto_id)
          .eq("status", "generated")
          .neq("signature_status", "signed");
      } catch (docErr) {
        console.error("[proposal-public-action] Erro ao cancelar documentos:", docErr);
      }

      // Generate commission (same logic as proposal-transition)
      try {
        const { data: existingComm } = await admin
          .from("comissoes")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("projeto_id", proposta.projeto_id)
          .neq("status", "cancelada")
          .maybeSingle();

        if (!existingComm && proposta.lead_id) {
          const { data: versao } = await admin
            .from("proposta_versoes")
            .select("potencia_kwp, valor_total")
            .eq("proposta_id", propostaId)
            .order("versao_numero", { ascending: false })
            .limit(1)
            .maybeSingle();

          const valorTotal = versao?.valor_total || 0;
          const potenciaKwp = versao?.potencia_kwp || 0;

          if (valorTotal > 0) {
            const { data: lead } = await admin
              .from("leads")
              .select("consultor_id")
              .eq("id", proposta.lead_id)
              .maybeSingle();

            if (lead?.consultor_id) {
              const { data: plan } = await admin
                .from("commission_plans")
                .select("parameters")
                .eq("tenant_id", tenantId)
                .eq("is_active", true)
                .limit(1)
                .maybeSingle();

              const percentual = (plan?.parameters as any)?.percentual ?? 5;

              let clienteNome = "Cliente";
              if (proposta.cliente_id) {
                const { data: cl } = await admin
                  .from("clientes")
                  .select("nome")
                  .eq("id", proposta.cliente_id)
                  .maybeSingle();
                clienteNome = cl?.nome || clienteNome;
              }

              await admin.from("comissoes").insert({
                tenant_id: tenantId,
                consultor_id: lead.consultor_id,
                cliente_id: proposta.cliente_id,
                projeto_id: proposta.projeto_id,
                descricao: `Proposta aceita (público) - ${clienteNome} (${potenciaKwp}kWp)`,
                valor_base: valorTotal,
                percentual_comissao: percentual,
                valor_comissao: (valorTotal * percentual) / 100,
                mes_referencia: new Date().getMonth() + 1,
                ano_referencia: new Date().getFullYear(),
                status: "pendente",
              });
            }
          }
        }
      } catch (commErr) {
        console.error("[proposal-public-action] Erro ao gerar comissão:", commErr);
      }
    }

    // 6. Cancel commissions on reject
    if (newStatus === "recusada" && proposta.projeto_id) {
      await admin
        .from("comissoes")
        .update({ status: "cancelada", observacoes: `Proposta recusada (público)` })
        .eq("projeto_id", proposta.projeto_id)
        .eq("status", "pendente");
    }

    // 7. Mark token as used + persist real IP / UA
    await admin
      .from("proposta_aceite_tokens")
      .update({
        used_at: now,
        aceite_ip: ip_address || null,
        aceite_user_agent: user_agent || null,
      })
      .eq("id", tokenData.id);

    // 8. Log event
    const eventType = newStatus === "aceita" ? "proposta_aceita" : "proposta_recusada";
    try {
      await admin.from("proposal_events").insert({
        proposta_id: propostaId,
        tipo: eventType,
        payload: {
          previous_status: currentStatus,
          new_status: newStatus,
          motivo: motivo || null,
          source: "public_token",
          ip_address: ip_address || null,
          user_agent: user_agent || null,
        },
        tenant_id: tenantId,
      });
    } catch (evtErr) {
      console.error("[proposal-public-action] Erro ao registrar evento:", evtErr);
    }

    // 9. Trigger notification (fire-and-forget)
    try {
      await admin.functions.invoke("proposal-decision-notify", {
        body: {
          proposta_id: propostaId,
          action: newStatus,
          motivo: motivo || null,
        },
      });
    } catch {
      // Non-blocking
    }

    return new Response(
      JSON.stringify({
        success: true,
        previous_status: currentStatus,
        new_status: newStatus,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[proposal-public-action] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
