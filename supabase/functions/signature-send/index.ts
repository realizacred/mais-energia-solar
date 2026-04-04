/**
 * Edge Function: signature-send
 * Sends a generated document to ZapSign for electronic signature.
 * 
 * RB-23: No console.log — only console.error with prefix
 * RB-14: External API called only from Edge Function
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const ZAPSIGN_API_URL = "https://api.zapsign.com.br/api/v1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth client to get user
    const authClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service client for data ops
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Parse body
    const body = await req.json();
    const { documento_id, tenant_id } = body;

    if (!documento_id || !tenant_id) {
      return new Response(JSON.stringify({ error: "documento_id e tenant_id são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Fetch document
    const { data: doc, error: docErr } = await supabase
      .from("generated_documents")
      .select("id, title, pdf_path, status, signature_status, template_id, tenant_id")
      .eq("id", documento_id)
      .eq("tenant_id", tenant_id)
      .single();

    if (docErr || !doc) {
      return new Response(JSON.stringify({ error: "Documento não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!doc.pdf_path) {
      return new Response(JSON.stringify({ error: "PDF não gerado ainda. Gere o documento antes de enviar para assinatura." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (doc.signature_status === "signed") {
      return new Response(JSON.stringify({ error: "Documento já assinado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Fetch template for default_signers
    const { data: template } = await supabase
      .from("document_templates")
      .select("default_signers, requires_signature_default")
      .eq("id", doc.template_id)
      .single();

    // 5. Fetch signature settings
    const { data: sigSettings, error: sigErr } = await supabase
      .from("signature_settings")
      .select("api_token_encrypted, sandbox_mode, enabled, provider, webhook_secret_encrypted")
      .eq("tenant_id", tenant_id)
      .single();

    if (sigErr || !sigSettings) {
      return new Response(JSON.stringify({ error: "Configurações de assinatura não encontradas. Configure em Documentos → Assinatura." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!sigSettings.enabled) {
      return new Response(JSON.stringify({ error: "Assinatura eletrônica desativada nas configurações." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiToken = sigSettings.api_token_encrypted;
    if (!apiToken) {
      return new Response(JSON.stringify({ error: "Token ZapSign não configurado. Configure em Documentos → Assinatura." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6. Get PDF signed URL (valid for 1 hour)
    const { data: signedUrl, error: urlErr } = await supabase.storage
      .from("document-files")
      .createSignedUrl(doc.pdf_path, 3600);

    if (urlErr || !signedUrl?.signedUrl) {
      console.error("[signature-send] Failed to create signed URL:", urlErr);
      return new Response(JSON.stringify({ error: "Erro ao acessar o PDF no storage" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 7. Build signers list
    let signersList: Array<{ name: string; email: string; phone_country?: string; phone_number?: string; auth_mode: string; send_automatic_email: boolean }> = [];

    // Try default_signers from template first
    const defaultSignerIds = template?.default_signers as string[] | null;
    if (defaultSignerIds && defaultSignerIds.length > 0) {
      const { data: signers } = await supabase
        .from("signers")
        .select("full_name, email, phone, auth_method")
        .in("id", defaultSignerIds)
        .eq("tenant_id", tenant_id);

      if (signers && signers.length > 0) {
        signersList = signers.map((s: any) => ({
          name: s.full_name,
          email: s.email,
          phone_country: "55",
          phone_number: s.phone?.replace(/\D/g, "") || undefined,
          auth_mode: s.auth_method || "assinaturaTela",
          send_automatic_email: true,
        }));
      }
    }

    // Fallback: get all tenant signers if no default signers
    if (signersList.length === 0) {
      const { data: allSigners } = await supabase
        .from("signers")
        .select("full_name, email, phone, auth_method")
        .eq("tenant_id", tenant_id)
        .limit(5);

      if (!allSigners || allSigners.length === 0) {
        return new Response(JSON.stringify({ error: "Nenhum signatário cadastrado. Cadastre signatários em Documentos → Assinatura." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      signersList = allSigners.map((s: any) => ({
        name: s.full_name,
        email: s.email,
        phone_country: "55",
        phone_number: s.phone?.replace(/\D/g, "") || undefined,
        auth_mode: s.auth_method || "assinaturaTela",
        send_automatic_email: true,
      }));
    }

    // Validate all signers have email
    const missingEmail = signersList.find(s => !s.email);
    if (missingEmail) {
      return new Response(JSON.stringify({ error: `Signatário "${missingEmail.name}" não possui e-mail cadastrado.` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 8. Call ZapSign API
    const zapSignBody = {
      sandbox: sigSettings.sandbox_mode ?? false,
      name: doc.title,
      url_pdf: signedUrl.signedUrl,
      signers: signersList.map(s => ({
        name: s.name,
        email: s.email,
        phone_country: s.phone_country,
        phone_number: s.phone_number,
        auth_mode: s.auth_mode,
        send_automatic_email: s.send_automatic_email,
      })),
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    let zapResponse: Response;
    try {
      zapResponse = await fetch(`${ZAPSIGN_API_URL}/docs/`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(zapSignBody),
        signal: controller.signal,
      });
    } catch (fetchErr: any) {
      console.error("[signature-send] ZapSign API fetch error:", fetchErr.message);
      return new Response(JSON.stringify({ error: "Falha na comunicação com ZapSign. Tente novamente." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } finally {
      clearTimeout(timeout);
    }

    const zapData = await zapResponse.json();

    if (!zapResponse.ok) {
      console.error("[signature-send] ZapSign API error:", zapResponse.status, JSON.stringify(zapData));

      const errorMsg = zapResponse.status === 401 || zapResponse.status === 403
        ? "Token ZapSign inválido ou expirado. Verifique nas configurações."
        : `Erro ZapSign (${zapResponse.status}): ${zapData?.detail || zapData?.message || JSON.stringify(zapData)}`;

      return new Response(JSON.stringify({ error: errorMsg }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 9. Update document with ZapSign data
    const envelopeId = zapData.token || zapData.open_id;
    const signUrl = zapData.signers?.[0]?.sign_url || null;

    const { error: updateErr } = await supabase
      .from("generated_documents")
      .update({
        signature_provider: "zapsign",
        envelope_id: envelopeId,
        signature_status: "sent",
        status: "sent_for_signature",
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq("id", documento_id)
      .eq("tenant_id", tenant_id);

    if (updateErr) {
      console.error("[signature-send] DB update error:", updateErr);
    }

    return new Response(JSON.stringify({
      success: true,
      envelope_id: envelopeId,
      sign_url: signUrl,
      signers_count: signersList.length,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[signature-send] Unexpected error:", err.message);
    return new Response(JSON.stringify({ error: err.message || "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
