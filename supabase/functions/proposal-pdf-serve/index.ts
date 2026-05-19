import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-client-timeout, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("token") || url.pathname.split("/").pop();

  if (!token) {
    return new Response(JSON.stringify({ error: "Token é obrigatório" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  try {
    // 1. Resolve token
    const { data: tokenData, error: tokenErr } = await adminClient
      .from("proposta_aceite_tokens")
      .select("id, versao_id, token, invalidado_em, used_at, expires_at, tipo")
      .eq("token", token)
      .maybeSingle();

    if (tokenErr || !tokenData) {
      console.error("[proposal-pdf-serve] Token not found:", token);
      return new Response(JSON.stringify({ error: "Proposta não encontrada ou link inválido" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (tokenData.invalidado_em) {
      return new Response(JSON.stringify({ error: "Este link foi invalidado por uma nova versão" }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Este link expirou" }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch PDF path
    const { data: versao, error: versaoErr } = await adminClient
      .from("proposta_versoes")
      .select("output_pdf_path, link_pdf")
      .eq("id", tokenData.versao_id)
      .maybeSingle();

    if (versaoErr || !versao) {
      console.error("[proposal-pdf-serve] Versao not found:", tokenData.versao_id);
      return new Response(JSON.stringify({ error: "Documento não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Tracking (Best-effort)
    try {
      const sw = null;
      const deviceType = "Proxy";
      await adminClient.rpc("registrar_view_proposta", {
        p_token: tokenData.token,
        p_user_agent: req.headers.get("user-agent") || "PDF-Proxy",
        p_referrer: req.headers.get("referer") || null,
        p_ip: null,
        p_device_type: deviceType,
        p_screen_width: sw,
      });
    } catch { /* skip */ }

    // 3. Serve the PDF
    if (versao.output_pdf_path) {
      const { data: signed, error: signErr } = await adminClient.storage
        .from("proposta-documentos")
        .createSignedUrl(versao.output_pdf_path, 60);

      if (signErr || !signed?.signedUrl) {
        throw new Error("Erro ao gerar acesso ao documento");
      }

      // True Masking: Stream the response
      const pdfResp = await fetch(signed.signedUrl);
      if (!pdfResp.ok) throw new Error("Erro ao carregar arquivo do storage");

      const headers = new Headers(corsHeaders);
      headers.set("Content-Type", "application/pdf");
      headers.set("Content-Disposition", `inline; filename="proposta.pdf"`);
      
      return new Response(pdfResp.body, {
        headers,
      });
    } 
    
    // Fallback if it's an external link (like SolarMarket imports)
    if (versao.link_pdf) {
      return Response.redirect(versao.link_pdf, 302);
    }

    return new Response(JSON.stringify({ error: "PDF ainda não gerado" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[proposal-pdf-serve] Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Erro interno ao processar documento" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
