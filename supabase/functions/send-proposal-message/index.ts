/**
 * send-proposal-message
 * 
 * Orquestra envio real de mensagem da proposta via WhatsApp ou Email.
 * - Persiste log em proposal_message_logs
 * - Registra evento em project_events
 * - WhatsApp: delega para send-whatsapp-message
 * - Email: usa SMTP do tenant (mesma infra de proposal-email)
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResp({ error: "Não autorizado" }, 401);
    }

    const callerClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await callerClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return jsonResp({ error: "Token inválido" }, 401);
    }
    const userId = claimsData.claims.sub as string;

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: profile } = await admin
      .from("profiles")
      .select("tenant_id, ativo")
      .eq("user_id", userId)
      .single();

    if (!profile?.tenant_id || !profile.ativo) {
      return jsonResp({ error: "Usuário inativo" }, 403);
    }
    const tenantId = profile.tenant_id;

    // Parse body
    const body = await req.json();
    const {
      canal,
      conteudo,
      destinatario_valor,
      destinatario_tipo,
      tipo_mensagem,
      estilo,
      proposta_id,
      versao_id,
      projeto_id,
      cliente_id,
      cliente_nome,
    } = body;

    if (!canal || !conteudo || !proposta_id || !versao_id || !projeto_id) {
      return jsonResp({ error: "Campos obrigatórios faltando" }, 400);
    }

    if (!["whatsapp", "email"].includes(canal)) {
      return jsonResp({ error: "Canal inválido" }, 400);
    }

    if (!destinatario_valor?.trim()) {
      return jsonResp({ error: "Destinatário não informado" }, 400);
    }

    // Create log entry (pending)
    const { data: logEntry, error: logErr } = await admin
      .from("proposal_message_logs")
      .insert({
        tenant_id: tenantId,
        proposta_id,
        versao_id,
        projeto_id,
        cliente_id: cliente_id || null,
        user_id: userId,
        tipo_mensagem: tipo_mensagem || "cliente",
        estilo: estilo || "completa",
        canal,
        destinatario_tipo: destinatario_tipo || "cliente",
        destinatario_valor: destinatario_valor.trim(),
        conteudo,
        status: "pending",
      })
      .select("id")
      .single();

    if (logErr) {
      console.error("[send-proposal-message] Log insert error:", logErr);
      return jsonResp({ error: "Erro ao registrar envio" }, 500);
    }

    const logId = logEntry.id;
    let sendError: string | null = null;

    // ─── Send via channel ───
    try {
      if (canal === "whatsapp") {
        // RB-26: Use enqueue_wa_outbox_item RPC instead of legacy direct fetch
        const { data: waInstance } = await admin
          .from("wa_instances")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("status", "connected")
          .limit(1)
          .maybeSingle();

        if (!waInstance) {
          sendError = "Nenhuma instância WhatsApp conectada para este tenant";
        } else {
          const phone = destinatario_valor.trim().replace(/\D/g, "");
          const remoteJid = `${phone}@s.whatsapp.net`;
          const idempKey = `proposal-msg-${logId}`;

          const { error: enqueueErr } = await admin.rpc("enqueue_wa_outbox_item", {
            p_tenant_id: tenantId,
            p_instance_id: waInstance.id,
            p_remote_jid: remoteJid,
            p_message_type: "text",
            p_content: conteudo,
            p_idempotency_key: idempKey,
          });

          if (enqueueErr) {
            sendError = `WhatsApp enqueue error: ${enqueueErr.message}`;
          }
        }
      } else if (canal === "email") {
        // Use SMTP config from tenant
        const { data: smtp } = await admin
          .from("tenant_smtp_config")
          .select("host, port, username, password_encrypted, from_email, from_name, use_tls, ativo")
          .eq("tenant_id", tenantId)
          .eq("ativo", true)
          .single();

        if (!smtp) {
          sendError = "SMTP não configurado para este tenant";
        } else {
          // Simple SMTP send via Deno
          const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");
          const client = new SMTPClient({
            connection: {
              hostname: smtp.host,
              port: smtp.port || 587,
              tls: smtp.use_tls !== false,
              auth: {
                username: smtp.username,
                password: smtp.password_encrypted, // Note: ideally decrypt
              },
            },
          });

          const subject = `Proposta de Energia Solar — ${cliente_nome || "Cliente"}`;

          await client.send({
            from: smtp.from_email || smtp.username,
            to: destinatario_valor.trim(),
            subject,
            content: conteudo,
          });

          await client.close();
        }
      }
    } catch (err) {
      sendError = err instanceof Error ? err.message : String(err);
      console.error(`[send-proposal-message] Send error (${canal}):`, sendError);
    }

    // Update log status
    const finalStatus = sendError ? "failed" : "sent";
    await admin
      .from("proposal_message_logs")
      .update({
        status: finalStatus,
        erro: sendError,
        sent_at: sendError ? null : new Date().toISOString(),
      })
      .eq("id", logId);

    // Register project event (fire-and-forget)
    try {
      const canalLabel = canal === "whatsapp" ? "WhatsApp" : "E-mail";
      const tipoLabel = (tipo_mensagem || "cliente") === "cliente" ? "cliente" : "consultor";
      await admin.from("project_events").insert({
        tenant_id: tenantId,
        deal_id: projeto_id,
        event_type: "proposal_message_sent",
        to_value: `${canalLabel} → ${tipoLabel}`,
        actor_user_id: userId,
        metadata: {
          canal,
          destinatario_tipo: destinatario_tipo || "cliente",
          destinatario_valor: destinatario_valor.trim(),
          status: finalStatus,
          log_id: logId,
        },
      });
    } catch (evtErr) {
      console.warn("[send-proposal-message] Event insert failed:", evtErr);
    }

    if (sendError) {
      return jsonResp({ success: false, error: sendError, log_id: logId }, 500);
    }

    return jsonResp({ success: true, log_id: logId });
  } catch (err) {
    console.error("[send-proposal-message] Unhandled:", err);
    return jsonResp({ error: String(err) }, 500);
  }
});
