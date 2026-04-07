/**
 * Edge Function: signature-send
 * Sends a generated document for electronic signature via adapter pattern.
 * Supports ZapSign and Clicksign — provider chosen per tenant.
 * 
 * DA-27: Adapter pattern for signature providers
 * RB-23: No console.log — only console.error with prefix
 * RB-14: External API called only from Edge Function
 * 
 * Auto-signers: Contratante (client) + Contratada (representative from brand_settings)
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getSignatureAdapter } from "../_shared/signatureAdapters.ts";

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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Parse body
    const body = await req.json();
    const { documento_id, tenant_id, signers: requestSigners } = body;

    if (!documento_id || !tenant_id) {
      return new Response(JSON.stringify({ error: "documento_id e tenant_id são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Fetch document
    const { data: doc, error: docErr } = await supabase
      .from("generated_documents")
      .select("id, title, pdf_path, status, signature_status, template_id, tenant_id, cliente_id, lead_id, projeto_id, deal_id")
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
      return new Response(JSON.stringify({ error: "Token de assinatura não configurado. Configure em Documentos → Assinatura." }), {
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

    // 7. Build signers list — auto-resolve Contratante + Contratada
    let signersList: Array<{ name: string; email: string; cpf?: string; phone?: string; auth_method?: string }> = [];

    // 7a. Try auto-resolve: Contratante (client) + Contratada (representative)
    const clienteId = doc.cliente_id;
    let autoResolved = false;

    if (clienteId) {
      // Fetch client data
      const { data: cliente } = await supabase
        .from("clientes")
        .select("nome, email, cpf_cnpj, telefone")
        .eq("id", clienteId)
        .single();

      // Fetch brand_settings for representative
      const { data: brand } = await supabase
        .from("brand_settings")
        .select("representante_legal, representante_email, representante_cpf, representante_cargo")
        .eq("tenant_id", tenant_id)
        .maybeSingle();

      const hasRepresentante = brand?.representante_legal && brand?.representante_email;
      const hasCliente = cliente?.nome && cliente?.email;

      if (hasCliente && hasRepresentante) {
        // Contratante (client)
        signersList.push({
          name: cliente.nome,
          email: cliente.email!,
          cpf: cliente.cpf_cnpj?.replace(/\D/g, "")?.length <= 11 ? cliente.cpf_cnpj : undefined,
          phone: cliente.telefone || undefined,
        });

        // Contratada (representative)
        signersList.push({
          name: brand.representante_legal!,
          email: brand.representante_email!,
          cpf: brand.representante_cpf || undefined,
        });

        autoResolved = true;
      } else if (hasCliente && !hasRepresentante) {
        // Client available but no representative configured — warn
        console.error("[signature-send] Representante legal não configurado para tenant", tenant_id);
      }
    }

    // 7b. Fallback: use template default_signers or all signers
    if (!autoResolved) {
      const defaultSignerIds = template?.default_signers as string[] | null;
      if (defaultSignerIds && defaultSignerIds.length > 0) {
        const { data: signers } = await supabase
          .from("signers")
          .select("full_name, email, phone, auth_method, cpf")
          .in("id", defaultSignerIds)
          .eq("tenant_id", tenant_id);

        if (signers && signers.length > 0) {
          signersList = signers.map((s: any) => ({
            name: s.full_name,
            email: s.email,
            cpf: s.cpf || undefined,
            phone: s.phone || undefined,
            auth_method: s.auth_method || undefined,
          }));
        }
      }

      if (signersList.length === 0) {
        const { data: allSigners } = await supabase
          .from("signers")
          .select("full_name, email, phone, auth_method, cpf")
          .eq("tenant_id", tenant_id)
          .limit(5);

        if (!allSigners || allSigners.length === 0) {
          // No auto-resolve and no signers — give specific error
          if (clienteId) {
            const { data: cliente } = await supabase
              .from("clientes")
              .select("email")
              .eq("id", clienteId)
              .single();

            if (!cliente?.email) {
              return new Response(JSON.stringify({ 
                error: "O cliente não possui e-mail cadastrado. Cadastre o e-mail do cliente ou configure o representante legal em Configurações → Representante Legal." 
              }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
          }

          return new Response(JSON.stringify({ 
            error: "Nenhum signatário encontrado. Configure o representante legal em Configurações → Representante Legal, ou cadastre signatários em Documentos → Assinatura." 
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        signersList = allSigners.map((s: any) => ({
          name: s.full_name,
          email: s.email,
          cpf: s.cpf || undefined,
          phone: s.phone || undefined,
          auth_method: s.auth_method || undefined,
        }));
      }
    }

    const missingEmail = signersList.find(s => !s.email);
    if (missingEmail) {
      return new Response(JSON.stringify({ error: `Signatário "${missingEmail.name}" não possui e-mail cadastrado.` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 8. Use adapter pattern — DA-27
    const provider = sigSettings.provider || "zapsign";
    const adapter = getSignatureAdapter(provider);

    let result;
    try {
      result = await adapter.createEnvelope({
        pdfUrl: signedUrl.signedUrl,
        docName: doc.title,
        signers: signersList,
        sandbox: sigSettings.sandbox_mode ?? false,
        apiToken,
      });
    } catch (adapterErr: any) {
      console.error(`[signature-send] ${provider} adapter error:`, adapterErr.message);
      return new Response(JSON.stringify({ error: adapterErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 9. Update document with provider data
    const { error: updateErr } = await supabase
      .from("generated_documents")
      .update({
        signature_provider: provider,
        envelope_id: result.envelopeId,
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
      provider,
      envelope_id: result.envelopeId,
      sign_url: result.signUrl,
      signers_count: signersList.length,
      auto_resolved: autoResolved,
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
