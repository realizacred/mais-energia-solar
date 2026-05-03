/**
 * proposal-decision-notify
 * Called from the public proposal page after a client accepts or rejects.
 * Notifies admins/consultants via push notification and optionally WhatsApp.
 * 
 * No JWT required — called from anonymous public page.
 * Uses token_id to resolve tenant context securely.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { token_id, decisao } = body;

    if (!token_id || !decisao) {
      return jsonError("token_id e decisao obrigatórios", 400);
    }

    if (!["aceita", "recusada", "visualizada"].includes(decisao)) {
      return jsonError("decisao deve ser 'aceita', 'recusada' ou 'visualizada'", 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── 1. Resolve context from token (secure — no user-provided tenant_id) ──
    const { data: tokenData, error: tokenErr } = await supabase
      .from("proposta_aceite_tokens")
      .select("id, proposta_id, versao_id, aceite_nome, created_by")
      .eq("id", token_id)
      .single();

    if (tokenErr || !tokenData) {
      console.warn("[proposal-decision-notify] Token not found:", token_id);
      return jsonError("Token inválido", 404);
    }

    // Get proposta + tenant in one query
    const { data: proposta } = await supabase
      .from("propostas_nativas")
      .select("id, tenant_id, titulo, codigo, lead_id, deal_id, projeto_id")
      .eq("id", tokenData.proposta_id)
      .single();

    if (!proposta) {
      return jsonError("Proposta não encontrada", 404);
    }

    const tenantId = proposta.tenant_id;
    const clienteNome = tokenData.aceite_nome || "Cliente";
    const propostaTitulo = proposta.titulo || proposta.codigo || "Proposta Solar";

    console.log(`[proposal-decision-notify] decisao=${decisao} proposta=${proposta.id} tenant=${tenantId}`);

    // ── 2. Find notification targets ──
    // Notify: creator of the token (consultant who sent) + all admins
    const targetUserIds = new Set<string>();

    // Creator of the send token
    if (tokenData.created_by) {
      targetUserIds.add(tokenData.created_by);
    }

    // All admins/gerentes of the tenant
    const { data: adminProfiles } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("tenant_id", tenantId)
      .eq("ativo", true);

    if (adminProfiles) {
      const userIds = adminProfiles.map((p: any) => p.user_id);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("user_id", userIds)
        .in("role", ["admin", "gerente"]);

      if (roles) {
        roles.forEach((r: any) => targetUserIds.add(r.user_id));
      }
    }

    if (targetUserIds.size === 0) {
      console.warn("[proposal-decision-notify] No target users found");
      return jsonOk({ notified: 0, reason: "no_targets" });
    }

    const targets = Array.from(targetUserIds);

    // ── VISUALIZAÇÃO: caminho enxuto (apenas WA ao consultor) ──
    if (decisao === "visualizada") {
      let waSent = false;
      if (tokenData.created_by) {
        try {
          const { data: consultant } = await supabase
            .from("profiles")
            .select("telefone")
            .eq("user_id", tokenData.created_by)
            .eq("tenant_id", tenantId)
            .maybeSingle();

          if (consultant?.telefone) {
            const mensagem = `👀 ${clienteNome} abriu sua proposta agora! Acesse o sistema para acompanhar.`;
            const { error: waErr } = await supabase.functions.invoke("send-whatsapp-message", {
              body: {
                telefone: consultant.telefone,
                mensagem,
                tenant_id: tenantId,
                tipo: "automatico",
              },
            });
            waSent = !waErr;
            if (waErr) console.warn("[proposal-decision-notify] WA visualização falhou:", waErr);
          }
        } catch (e) {
          console.warn("[proposal-decision-notify] WA visualização erro:", e);
        }
      }
      console.log(`[proposal-decision-notify] visualizada wa=${waSent}`);
      return jsonOk({ notified: waSent ? 1 : 0, whatsapp_sent: waSent, decisao });
    }


    // ── 3. Send push notifications ──
    // TODO(tech-debt): integração com send-push-notification usa hack
    // (direction:"in" + _proposalNotification) porque aquela função foi
    // desenhada para mensagens de WA. Refatorar send-push-notification
    // para aceitar payloads genéricos (title/body/url) e remover esse hack.
    const isAccepted = decisao === "aceita";
    const pushTitle = isAccepted
      ? `✅ Proposta Aceita!`
      : `❌ Proposta Recusada`;
    const pushBody = isAccepted
      ? `${clienteNome} aceitou "${propostaTitulo}"`
      : `${clienteNome} recusou "${propostaTitulo}"`;

    // Get push subscriptions for target users
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth, tenant_id")
      .in("user_id", targets)
      .eq("is_active", true)
      .eq("tenant_id", tenantId);

    let pushSent = 0;

    if (subscriptions && subscriptions.length > 0) {
      // Invoke the existing send-push mechanism
      // We'll call send-push-notification with a special payload
      try {
        // Use direct push sending via the existing function's internal API
        // But since it's designed for WA messages, we'll do a simpler approach:
        // Insert a notification event that the existing system can pick up
        // For now, invoke send-push directly with adapted payload
        const { data: pushResult } = await supabase.functions.invoke("send-push-notification", {
          body: {
            conversationId: null, // Not a conversation
            tenantId,
            contactName: clienteNome,
            messagePreview: pushBody,
            messageId: `proposal-decision-${token_id}`,
            direction: "in", // Trick to pass the direction check
            // Custom fields for proposal notification
            _proposalNotification: true,
            _title: pushTitle,
          },
        });
        pushSent = pushResult?.sent || 0;
      } catch (e) {
        console.warn("[proposal-decision-notify] Push notification failed:", e);
      }
    }

    // ── 4. Send WhatsApp to consultant (best-effort) ──
    let whatsappSent = false;

    if (tokenData.created_by) {
      try {
        // Find consultant's phone
        const { data: consultant } = await supabase
          .from("profiles")
          .select("telefone, nome")
          .eq("user_id", tokenData.created_by)
          .eq("tenant_id", tenantId)
          .single();

        if (consultant?.telefone) {
          const emoji = isAccepted ? "✅" : "❌";
          const statusText = isAccepted ? "ACEITA" : "RECUSADA";
          const mensagem = `${emoji} *Proposta ${statusText}*\n\n` +
            `📄 ${propostaTitulo}\n` +
            `👤 ${clienteNome}\n` +
            `📅 ${new Date().toLocaleDateString("pt-BR")}\n\n` +
            `Acesse o sistema para mais detalhes.`;

          const { error: waErr } = await supabase.functions.invoke("send-whatsapp-message", {
            body: {
              telefone: consultant.telefone,
              mensagem,
              tenant_id: tenantId,
              tipo: "automatico",
            },
          });

          whatsappSent = !waErr;
          if (waErr) {
            console.warn("[proposal-decision-notify] WA to consultant failed:", waErr);
          }
        }
      } catch (e) {
        console.warn("[proposal-decision-notify] WA notification error:", e);
      }
    }

    // ── 5. Timeline event (project_events) ──
    const dealId = proposta.deal_id;
    // If no deal_id on proposta, try to find via projetos
    let resolvedDealId = dealId;
    if (!resolvedDealId && proposta.projeto_id) {
      const { data: proj } = await supabase
        .from("projetos").select("deal_id").eq("id", proposta.projeto_id).single();
      resolvedDealId = proj?.deal_id;
    }
    if (!resolvedDealId) {
      const { data: proj } = await supabase
        .from("projetos").select("deal_id").eq("proposta_id", proposta.id).limit(1).maybeSingle();
      resolvedDealId = proj?.deal_id;
    }

    if (resolvedDealId) {
      const eventType = decisao === "aceita" ? "proposal.accepted" : "proposal.rejected";
      await supabase.from("project_events").insert({
        tenant_id: tenantId,
        deal_id: resolvedDealId,
        event_type: eventType,
        metadata: {
          proposta_id: tokenData.proposta_id,
          versao_id: tokenData.versao_id,
          token_id,
          cliente_nome: clienteNome,
        },
      }).then(({ error }) => {
        if (error) console.warn("[proposal-decision-notify] Timeline event failed:", error.message);
      });
    }

    // ── 6. Audit log (structured log — audit_logs blocks direct INSERTs) ──
    console.info("[proposal-decision-notify] Audit:", {
      tenant_id: tenantId, decisao, token_id,
      proposta_id: tokenData.proposta_id,
      cliente_nome: clienteNome, proposta_titulo: propostaTitulo,
      notificados: targets.length, push_sent: pushSent, whatsapp_sent: whatsappSent,
    });

    console.log(`[proposal-decision-notify] Done: push=${pushSent}, wa=${whatsappSent}, targets=${targets.length}`);

    return jsonOk({
      notified: targets.length,
      push_sent: pushSent,
      whatsapp_sent: whatsappSent,
    });
  } catch (err: any) {
    console.error("[proposal-decision-notify] Error:", err);
    return jsonError(err.message ?? "Erro interno", 500);
  }
});

function jsonOk(data: any) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
