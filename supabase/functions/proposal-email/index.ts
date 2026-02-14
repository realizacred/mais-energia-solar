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

    const body = await req.json();
    const { proposta_id, versao_id, to_email, to_name, public_url } = body;

    if (!proposta_id || !to_email) {
      return jsonError("proposta_id e to_email obrigatórios", 400);
    }

    // Get SMTP config
    const { data: smtp } = await adminClient
      .from("tenant_smtp_config")
      .select("host, port, username, password_encrypted, from_email, from_name, use_tls, ativo")
      .eq("tenant_id", tenantId)
      .eq("ativo", true)
      .single();

    if (!smtp) {
      return jsonError("SMTP não configurado. Configure em Propostas → Templates.", 400);
    }

    // Get proposal info
    const { data: proposta } = await adminClient
      .from("propostas_nativas")
      .select("titulo, codigo")
      .eq("id", proposta_id)
      .eq("tenant_id", tenantId)
      .single();

    if (!proposta) {
      return jsonError("Proposta não encontrada", 404);
    }

    // Get tenant info for branding
    const { data: tenant } = await adminClient
      .from("tenants")
      .select("nome")
      .eq("id", tenantId)
      .single();

    // Build email
    const subject = `Proposta Solar - ${proposta.titulo || proposta.codigo}`;
    const htmlBody = buildEmailHtml({
      tenantName: tenant?.nome || "Empresa Solar",
      proposalTitle: proposta.titulo || proposta.codigo,
      recipientName: to_name || "",
      publicUrl: public_url || "",
    });

    // Send via SMTP using Deno's built-in fetch to a simple SMTP relay
    // Since Deno Edge Functions don't have native SMTP, we use the SMTPClient approach
    const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");

    const client = new SMTPClient({
      connection: {
        hostname: smtp.host,
        port: smtp.port,
        tls: smtp.use_tls,
        auth: {
          username: smtp.username,
          password: smtp.password_encrypted,
        },
      },
    });

    await client.send({
      from: smtp.from_name ? `${smtp.from_name} <${smtp.from_email}>` : smtp.from_email,
      to: to_email,
      subject,
      content: "Veja sua proposta solar no link abaixo.",
      html: htmlBody,
    });

    await client.close();

    return jsonOk({ success: true, sent_to: to_email });
  } catch (err: any) {
    console.error("[proposal-email] Error:", err);
    return jsonError(err.message ?? "Erro interno", 500);
  }
});

function buildEmailHtml(params: {
  tenantName: string;
  proposalTitle: string;
  recipientName: string;
  publicUrl: string;
}) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
  <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <h2 style="color: #1a1a2e; margin: 0 0 8px;">${params.tenantName}</h2>
    <hr style="border: none; border-top: 2px solid #f0f0f0; margin: 16px 0;">
    
    <p style="color: #333; font-size: 16px;">
      ${params.recipientName ? `Olá ${params.recipientName},` : "Olá,"}
    </p>
    
    <p style="color: #555; font-size: 14px; line-height: 1.6;">
      Sua proposta solar <strong>"${params.proposalTitle}"</strong> está pronta para visualização.
    </p>
    
    ${params.publicUrl ? `
    <div style="text-align: center; margin: 24px 0;">
      <a href="${params.publicUrl}" 
         style="display: inline-block; background: #1a1a2e; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
        📄 Ver Proposta
      </a>
    </div>
    ` : ""}
    
    <p style="color: #888; font-size: 12px; margin-top: 24px;">
      Qualquer dúvida, estamos à disposição.<br>
      Equipe ${params.tenantName}
    </p>
  </div>
</body>
</html>`;
}

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
