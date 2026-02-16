import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.tenant_id) return jsonResponse({ error: "Tenant não encontrado" }, 403);
    const tenantId = profile.tenant_id;

    // ── Input ──
    const { parcela_id } = await req.json();
    if (!parcela_id) return jsonResponse({ error: "parcela_id é obrigatório" }, 400);

    // ── Gateway config ──
    const { data: gwConfig } = await supabase
      .from("payment_gateway_config")
      .select("api_key, environment, is_active")
      .eq("tenant_id", tenantId)
      .eq("provider", "asaas")
      .maybeSingle();

    if (!gwConfig?.is_active || !gwConfig.api_key) {
      return jsonResponse({ error: "Integração Asaas não está ativa. Configure em Configurações → Pagamentos." }, 400);
    }

    // ── Parcela + Recebimento + Cliente ──
    const { data: parcela, error: parcErr } = await supabase
      .from("parcelas")
      .select("id, numero_parcela, valor, data_vencimento, status, recebimento_id")
      .eq("id", parcela_id)
      .single();

    if (parcErr || !parcela) return jsonResponse({ error: "Parcela não encontrada" }, 404);
    if (parcela.status === "paga") return jsonResponse({ error: "Parcela já está paga" }, 400);

    // Check if charge already exists
    const { data: existingCharge } = await supabase
      .from("payment_gateway_charges")
      .select("id, gateway_charge_id, boleto_pdf_url, pix_payload, gateway_status")
      .eq("parcela_id", parcela_id)
      .in("gateway_status", ["pending", "confirmed"])
      .maybeSingle();

    if (existingCharge?.gateway_charge_id && existingCharge.gateway_status === "pending") {
      // Return existing charge data instead of creating duplicate
      return jsonResponse({
        success: true,
        charge_id: existingCharge.gateway_charge_id,
        boleto_pdf_url: existingCharge.boleto_pdf_url,
        pix_payload: existingCharge.pix_payload,
        already_exists: true,
      });
    }

    const { data: recebimento } = await supabase
      .from("recebimentos")
      .select("id, cliente_id, clientes(nome, cpf_cnpj, email, telefone)")
      .eq("id", parcela.recebimento_id)
      .single();

    if (!recebimento) return jsonResponse({ error: "Recebimento não encontrado" }, 404);

    const cliente = (recebimento as any).clientes;
    if (!cliente) return jsonResponse({ error: "Cliente não encontrado" }, 404);

    // ── Create/find Asaas customer ──
    const baseUrl = gwConfig.environment === "production"
      ? "https://api.asaas.com/v3"
      : "https://sandbox.asaas.com/api/v3";

    const apiHeaders = {
      accept: "application/json",
      "content-type": "application/json",
      access_token: gwConfig.api_key,
    };

    // Try to find existing customer by CPF/CNPJ
    let asaasCustomerId: string | null = null;

    if (cliente.cpf_cnpj) {
      const cpfClean = cliente.cpf_cnpj.replace(/\D/g, "");
      const searchRes = await fetch(
        `${baseUrl}/customers?cpfCnpj=${cpfClean}`,
        { headers: apiHeaders, signal: AbortSignal.timeout(30000) }
      );
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.data?.length > 0) {
          asaasCustomerId = searchData.data[0].id;
        }
      }
    }

    // Create customer if not found
    if (!asaasCustomerId) {
      if (!cliente.cpf_cnpj) {
        return jsonResponse({
          error: "CPF/CNPJ do cliente é obrigatório para gerar cobrança. Atualize o cadastro do cliente."
        }, 400);
      }

      const createCustomerRes = await fetch(`${baseUrl}/customers`, {
        method: "POST",
        headers: apiHeaders,
        body: JSON.stringify({
          name: cliente.nome,
          cpfCnpj: cliente.cpf_cnpj.replace(/\D/g, ""),
          email: cliente.email || undefined,
          phone: cliente.telefone?.replace(/\D/g, "") || undefined,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!createCustomerRes.ok) {
        const errBody = await createCustomerRes.json().catch(() => ({}));
        console.error("[asaas-create-charge] Customer creation failed:", errBody);
        const errMsg = errBody.errors?.[0]?.description || "Erro ao criar cliente no Asaas";
        return jsonResponse({ error: errMsg }, 400);
      }

      const customerData = await createCustomerRes.json();
      asaasCustomerId = customerData.id;
    }

    // ── Create charge ──
    const dueDate = parcela.data_vencimento;
    // Ensure due date is not in the past
    const today = new Date().toISOString().split("T")[0];
    const effectiveDueDate = dueDate < today ? today : dueDate;

    const chargePayload = {
      customer: asaasCustomerId,
      billingType: "UNDEFINED", // Allows Boleto + Pix + Card
      value: parcela.valor,
      dueDate: effectiveDueDate,
      description: `Parcela ${parcela.numero_parcela} - ${cliente.nome}`,
      externalReference: parcela_id,
    };

    console.log("[asaas-create-charge] Creating charge:", JSON.stringify(chargePayload));

    const chargeRes = await fetch(`${baseUrl}/payments`, {
      method: "POST",
      headers: apiHeaders,
      body: JSON.stringify(chargePayload),
      signal: AbortSignal.timeout(90000),
    });

    const chargeData = await chargeRes.json();

    if (!chargeRes.ok) {
      console.error("[asaas-create-charge] Charge creation failed:", chargeData);
      const errMsg = chargeData.errors?.[0]?.description || `Erro Asaas: ${chargeRes.status}`;
      return jsonResponse({ error: errMsg }, 400);
    }

    console.log("[asaas-create-charge] Charge created:", chargeData.id);

    // ── Fetch Pix QR Code ──
    let pixPayload: string | null = null;
    let pixQrCodeUrl: string | null = null;

    try {
      const pixRes = await fetch(`${baseUrl}/payments/${chargeData.id}/pixQrCode`, {
        headers: apiHeaders,
        signal: AbortSignal.timeout(15000),
      });
      if (pixRes.ok) {
        const pixData = await pixRes.json();
        pixPayload = pixData.payload || null;
        pixQrCodeUrl = pixData.encodedImage ? `data:image/png;base64,${pixData.encodedImage}` : null;
      }
    } catch (e) {
      console.warn("[asaas-create-charge] Pix QR code fetch failed (non-critical):", e);
    }

    // ── Save to bridge table ──
    const { error: insertErr } = await supabase
      .from("payment_gateway_charges")
      .insert({
        tenant_id: tenantId,
        parcela_id: parcela_id,
        recebimento_id: parcela.recebimento_id,
        provider: "asaas",
        gateway_charge_id: chargeData.id,
        gateway_status: "pending",
        value: parcela.valor,
        due_date: effectiveDueDate,
        boleto_pdf_url: chargeData.bankSlipUrl || null,
        boleto_digitable_line: chargeData.nossoNumero || null,
        pix_payload: pixPayload,
        pix_qr_code_url: pixQrCodeUrl,
        billing_type: chargeData.billingType || "UNDEFINED",
        gateway_raw_response: chargeData,
      });

    if (insertErr) {
      console.error("[asaas-create-charge] DB insert error:", insertErr);
      // Charge was created in Asaas but DB failed - log but don't fail for user
    }

    // ── Update parcela status ──
    await supabase
      .from("parcelas")
      .update({ status: "aguardando_pagamento" })
      .eq("id", parcela_id);

    return jsonResponse({
      success: true,
      charge_id: chargeData.id,
      boleto_pdf_url: chargeData.bankSlipUrl || null,
      pix_payload: pixPayload,
      pix_qr_code_url: pixQrCodeUrl,
      invoice_url: chargeData.invoiceUrl || null,
    });
  } catch (err: any) {
    console.error("[asaas-create-charge] Error:", err);
    return jsonResponse({ error: err.message || "Erro interno ao gerar cobrança" }, 500);
  }
});
