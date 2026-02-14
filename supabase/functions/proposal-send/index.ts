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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonError("Não autorizado", 401);
    }

    const callerClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await callerClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return jsonError("Token inválido", 401);
    }
    const userId = claimsData.claims.sub as string;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: profile } = await adminClient
      .from("profiles")
      .select("tenant_id, ativo")
      .eq("user_id", userId)
      .single();

    if (!profile?.tenant_id || !profile.ativo) {
      return jsonError("Usuário inativo", 403);
    }
    const tenantId = profile.tenant_id;

    // Parse body
    const body = await req.json();
    const { proposta_id, versao_id, canal, lead_id } = body;

    if (!proposta_id || !versao_id) {
      return jsonError("proposta_id e versao_id obrigatórios", 400);
    }

    // Verify ownership
    const { data: proposta } = await adminClient
      .from("propostas_nativas")
      .select("id, lead_id, titulo")
      .eq("id", proposta_id)
      .eq("tenant_id", tenantId)
      .single();

    if (!proposta) {
      return jsonError("Proposta não encontrada", 404);
    }

    // Create acceptance token
    const { data: aceiteToken, error: tokenErr } = await adminClient
      .from("proposta_aceite_tokens")
      .insert({
        tenant_id: tenantId,
        proposta_id,
        versao_id,
        created_by: userId,
      })
      .select("id, token")
      .single();

    if (tokenErr || !aceiteToken) {
      return jsonError(`Erro ao criar token: ${tokenErr?.message}`, 500);
    }

    // Build public URL
    const { data: tenant } = await adminClient
      .from("tenants")
      .select("dominio_customizado, slug")
      .eq("id", tenantId)
      .single();

    // Use the app's base URL
    const baseUrl = req.headers.get("origin") || `https://${tenant?.slug || "app"}.lovable.app`;
    const publicUrl = `${baseUrl}/proposta/${aceiteToken.token}`;

    // Update proposta status
    await adminClient
      .from("propostas_nativas")
      .update({
        status: "enviada",
        enviada_at: new Date().toISOString(),
        enviada_via: canal || "link",
        enviada_por: userId,
        public_token: aceiteToken.token,
      })
      .eq("id", proposta_id)
      .eq("tenant_id", tenantId);

    // If canal === "whatsapp", try to send via existing infrastructure
    let whatsappSent = false;
    if (canal === "whatsapp" && (lead_id || proposta.lead_id)) {
      try {
        const targetLeadId = lead_id || proposta.lead_id;
        const { data: lead } = await adminClient
          .from("leads")
          .select("telefone, nome")
          .eq("id", targetLeadId)
          .eq("tenant_id", tenantId)
          .single();

        if (lead?.telefone) {
          const mensagem = `Olá ${lead.nome || ""}! 🌞\n\nSua proposta solar está pronta!\n\n📄 *${proposta.titulo}*\n\n🔗 Veja e aceite aqui:\n${publicUrl}\n\nQualquer dúvida, estamos à disposição!`;

          // Use send-whatsapp-message function
          const { error: waErr } = await adminClient.functions.invoke("send-whatsapp-message", {
            body: {
              lead_id: targetLeadId,
              message: mensagem,
              tenant_id: tenantId,
            },
          });

          whatsappSent = !waErr;
        }
      } catch (e) {
        console.warn("[proposal-send] WhatsApp send failed:", e);
      }
    }

    return jsonOk({
      success: true,
      token: aceiteToken.token,
      public_url: publicUrl,
      whatsapp_sent: whatsappSent,
    });
  } catch (err: any) {
    console.error("[proposal-send] Error:", err);
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
