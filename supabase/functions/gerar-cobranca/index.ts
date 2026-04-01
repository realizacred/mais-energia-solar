import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Gateway helpers ────────────────────────────────

interface ChargeResult {
  cobranca_id: string;
  boleto_url: string | null;
  boleto_linha_digitavel: string | null;
  boleto_codigo_barras: string | null;
  pix_qr_code: string | null;
  pix_copia_cola: string | null;
}

function onlyDigits(v: string | null | undefined): string {
  return (v ?? "").replace(/\D/g, "");
}

function futureDueDate(original: string): string {
  const d = new Date(original);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (d >= today) return original;
  const future = new Date(today);
  future.setDate(future.getDate() + 3);
  return future.toISOString().slice(0, 10);
}

// ─── PagSeguro ──────────────────────────────────────

async function chargePagSeguro(
  token: string,
  sandbox: boolean,
  parcelaId: string,
  valorCentavos: number,
  dueDate: string,
  descricao: string,
  cliente: Record<string, unknown> | null,
  multaPct: number,
  jurosPct: number,
): Promise<ChargeResult> {
  const baseUrl = sandbox
    ? "https://sandbox.api.pagseguro.com"
    : "https://api.pagseguro.com";

  const cpf = onlyDigits(cliente?.cpf_cnpj as string) || "00000000000";
  const nome = (cliente?.nome as string) || "Cliente";
  const email = (cliente?.email as string) || "cliente@email.com";
  const cep = onlyDigits(cliente?.cep as string) || "01001000";

  const boletoBody = {
    reference_id: `parcela_${parcelaId}`,
    description: descricao || "Parcela solar",
    amount: { value: valorCentavos, currency: "BRL" },
    payment_method: {
      type: "BOLETO",
      boleto: {
        due_date: futureDueDate(dueDate),
        instruction_lines: {
          line_1: `Multa de ${multaPct}% após vencimento`,
          line_2: `Juros de ${jurosPct}% ao mês`,
        },
        holder: {
          name: nome,
          tax_id: cpf,
          email,
          address: {
            street: (cliente?.rua as string) || "Rua Exemplo",
            number: (cliente?.numero as string) || "1",
            locality: (cliente?.bairro as string) || "Centro",
            city: (cliente?.cidade as string) || "São Paulo",
            region_code: (cliente?.estado as string) || "SP",
            country: "BRA",
            postal_code: cep,
          },
        },
      },
    },
  };

  const boletoRes = await fetch(`${baseUrl}/charges`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(boletoBody),
  });

  if (!boletoRes.ok) {
    const errText = await boletoRes.text();
    throw new Error(`PagSeguro boleto error ${boletoRes.status}: ${errText}`);
  }

  const boleto = await boletoRes.json();
  const boletoLink =
    boleto.links?.find((l: Record<string, string>) => l.rel === "BOLETO.PDF")
      ?.href ?? null;

  // PIX charge
  const pixBody = {
    reference_id: `parcela_pix_${parcelaId}`,
    description: descricao || "Parcela solar",
    amount: { value: valorCentavos, currency: "BRL" },
    payment_method: { type: "PIX" },
  };

  let pixCopaCola: string | null = null;
  let pixQrCode: string | null = null;

  try {
    const pixRes = await fetch(`${baseUrl}/charges`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pixBody),
    });
    if (pixRes.ok) {
      const pix = await pixRes.json();
      pixCopaCola = pix.qr_codes?.[0]?.text ?? null;
      pixQrCode = pix.qr_codes?.[0]?.links?.[0]?.href ?? null;
    }
  } catch {
    // PIX is optional; proceed with boleto only
  }

  return {
    cobranca_id: boleto.id,
    boleto_url: boletoLink,
    boleto_linha_digitavel:
      boleto.payment_method?.boleto?.formatted_barcode ?? null,
    boleto_codigo_barras: boleto.payment_method?.boleto?.barcode ?? null,
    pix_qr_code: pixQrCode,
    pix_copia_cola: pixCopaCola,
  };
}

// ─── Asaas ──────────────────────────────────────────

async function chargeAsaas(
  token: string,
  sandbox: boolean,
  parcelaId: string,
  valor: number,
  dueDate: string,
  descricao: string,
  _cliente: Record<string, unknown> | null,
  multaPct: number,
  jurosPct: number,
): Promise<ChargeResult> {
  const baseUrl = sandbox
    ? "https://sandbox.asaas.com/api/v3"
    : "https://api.asaas.com/v3";

  const headers: Record<string, string> = {
    access_token: token,
    "Content-Type": "application/json",
  };

  // For Asaas, customer must exist; use a placeholder if missing
  const customerName = (_cliente?.nome as string) || "Cliente Avulso";
  const cpf = onlyDigits(_cliente?.cpf_cnpj as string) || "00000000000";

  // Create or find customer
  const custRes = await fetch(`${baseUrl}/customers`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: customerName,
      cpfCnpj: cpf,
      externalReference: `cli_${cpf}`,
    }),
  });

  let customerId: string;
  if (custRes.ok) {
    const cust = await custRes.json();
    customerId = cust.id;
  } else {
    // Try to find existing
    const findRes = await fetch(
      `${baseUrl}/customers?cpfCnpj=${cpf}`,
      { headers },
    );
    const findData = await findRes.json();
    if (findData.data?.[0]?.id) {
      customerId = findData.data[0].id;
    } else {
      throw new Error("Asaas: não foi possível criar/encontrar customer");
    }
  }

  const effectiveDue = futureDueDate(dueDate);

  // Boleto
  const boletoRes = await fetch(`${baseUrl}/payments`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      customer: customerId,
      billingType: "BOLETO",
      value: valor,
      dueDate: effectiveDue,
      description: descricao || "Parcela solar",
      externalReference: `parcela_${parcelaId}`,
      fine: { value: multaPct },
      interest: { value: jurosPct },
    }),
  });

  if (!boletoRes.ok) {
    const errText = await boletoRes.text();
    throw new Error(`Asaas boleto error ${boletoRes.status}: ${errText}`);
  }

  const boleto = await boletoRes.json();

  // PIX
  let pixCopaCola: string | null = null;
  let pixQrCode: string | null = null;

  try {
    const pixRes = await fetch(`${baseUrl}/payments`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        customer: customerId,
        billingType: "PIX",
        value: valor,
        dueDate: effectiveDue,
        description: descricao || "Parcela solar (PIX)",
        externalReference: `parcela_pix_${parcelaId}`,
      }),
    });
    if (pixRes.ok) {
      const pix = await pixRes.json();
      // Asaas returns PIX info via separate endpoint
      const pixInfoRes = await fetch(
        `${baseUrl}/payments/${pix.id}/pixQrCode`,
        { headers },
      );
      if (pixInfoRes.ok) {
        const pixInfo = await pixInfoRes.json();
        pixCopaCola = pixInfo.payload ?? null;
        pixQrCode = pixInfo.encodedImage
          ? `data:image/png;base64,${pixInfo.encodedImage}`
          : null;
      }
    }
  } catch {
    // PIX optional
  }

  return {
    cobranca_id: boleto.id,
    boleto_url: boleto.bankSlipUrl ?? null,
    boleto_linha_digitavel: boleto.nossoNumero ?? null,
    boleto_codigo_barras: boleto.barCode ?? null,
    pix_qr_code: pixQrCode,
    pix_copia_cola: pixCopaCola,
  };
}

// ─── Main handler ───────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } =
      await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const userId = claimsData.claims.sub as string;

    // 2. Parse body
    const body = await req.json();
    const { parcela_id, gateway: requestedGateway } = body;
    if (!parcela_id) {
      return jsonResponse({ error: "parcela_id é obrigatório" }, 400);
    }

    // 3. Tenant
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", userId)
      .single();

    if (!profile?.tenant_id) {
      return jsonResponse({ error: "Tenant não encontrado" }, 403);
    }
    const tenantId = profile.tenant_id;

    // 4. Parcela + recebimento
    const { data: parcela, error: parcelaErr } = await supabase
      .from("parcelas")
      .select(
        "id, valor, data_vencimento, status, recebimento_id, numero_parcela",
      )
      .eq("id", parcela_id)
      .eq("tenant_id", tenantId)
      .single();

    if (parcelaErr || !parcela) {
      return jsonResponse({ error: "Parcela não encontrada" }, 404);
    }

    const { data: recebimento } = await supabase
      .from("recebimentos")
      .select(
        "id, cliente_id, valor_total, descricao, forma_pagamento_acordada, proposta_id",
      )
      .eq("id", parcela.recebimento_id)
      .eq("tenant_id", tenantId)
      .single();

    // 5. Cliente (optional)
    let cliente: Record<string, unknown> | null = null;
    if (recebimento?.cliente_id) {
      const { data: cli } = await supabase
        .from("clientes")
        .select("nome, cpf_cnpj, email, telefone, cep, rua, numero, bairro, cidade, estado")
        .eq("id", recebimento.cliente_id)
        .single();
      cliente = cli as Record<string, unknown> | null;
    }

    // 6. Premissas
    const { data: premissas } = await supabase
      .from("tenant_premises")
      .select(
        "gateway_preferido, pagseguro_token, pagseguro_sandbox, asaas_token, asaas_sandbox, inter_client_id, inter_client_secret, inter_sandbox, sicoob_client_id, sicoob_sandbox, cobranca_multa_percentual, cobranca_juros_percentual, cobranca_dias_vencimento",
      )
      .eq("tenant_id", tenantId)
      .single();

    const gateway =
      requestedGateway || premissas?.gateway_preferido || "pagseguro";
    const multaPct = Number(premissas?.cobranca_multa_percentual ?? 2);
    const jurosPct = Number(premissas?.cobranca_juros_percentual ?? 1);

    // 7. Calculate value with penalties
    const valorOriginal = Number(parcela.valor);
    const dueDate = parcela.data_vencimento as string;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const diasAtraso = Math.max(
      0,
      Math.floor((today.getTime() - due.getTime()) / 86400000),
    );

    let multa = 0;
    let juros = 0;
    let valorCobrado = valorOriginal;

    if (diasAtraso > 0) {
      multa = valorOriginal * (multaPct / 100);
      juros = valorOriginal * (jurosPct / 100) * (diasAtraso / 30);
      valorCobrado = valorOriginal + multa + juros;
    }

    // Round to 2 decimals
    multa = Math.round(multa * 100) / 100;
    juros = Math.round(juros * 100) / 100;
    valorCobrado = Math.round(valorCobrado * 100) / 100;

    const descricao =
      recebimento?.descricao ||
      `Parcela ${parcela.numero_parcela} - Energia Solar`;

    // 8. Call gateway
    let result: ChargeResult;

    if (gateway === "pagseguro") {
      const tk = premissas?.pagseguro_token;
      if (!tk) {
        return jsonResponse(
          { error: "Token PagSeguro não configurado nas premissas" },
          400,
        );
      }
      const valorCentavos = Math.round(valorCobrado * 100);
      result = await chargePagSeguro(
        tk,
        premissas?.pagseguro_sandbox ?? true,
        parcela_id,
        valorCentavos,
        dueDate,
        descricao,
        cliente,
        multaPct,
        jurosPct,
      );
    } else if (gateway === "asaas") {
      const tk = premissas?.asaas_token;
      if (!tk) {
        return jsonResponse(
          { error: "Token Asaas não configurado nas premissas" },
          400,
        );
      }
      result = await chargeAsaas(
        tk,
        premissas?.asaas_sandbox ?? true,
        parcela_id,
        valorCobrado,
        dueDate,
        descricao,
        cliente,
        multaPct,
        jurosPct,
      );
    } else if (gateway === "inter" || gateway === "sicoob") {
      return jsonResponse(
        {
          error: `Gateway ${gateway} ainda não implementado. Use PagSeguro ou Asaas.`,
        },
        501,
      );
    } else {
      return jsonResponse({ error: `Gateway desconhecido: ${gateway}` }, 400);
    }

    // 9. Update parcela
    const serviceRole = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    await serviceRole
      .from("parcelas")
      .update({
        cobranca_id: result.cobranca_id,
        cobranca_gateway: gateway,
        cobranca_status: "gerada",
        boleto_url: result.boleto_url,
        boleto_linha_digitavel: result.boleto_linha_digitavel,
        boleto_codigo_barras: result.boleto_codigo_barras,
        pix_qr_code: result.pix_qr_code,
        pix_copia_cola: result.pix_copia_cola,
        cobranca_valor_original: valorOriginal,
        cobranca_valor_cobrado: valorCobrado,
        cobranca_multa_aplicada: multa,
        cobranca_juros_aplicado: juros,
        cobranca_gerada_em: new Date().toISOString(),
      })
      .eq("id", parcela_id);

    return jsonResponse({
      success: true,
      cobranca_id: result.cobranca_id,
      boleto_url: result.boleto_url,
      boleto_linha_digitavel: result.boleto_linha_digitavel,
      pix_qr_code: result.pix_qr_code,
      pix_copia_cola: result.pix_copia_cola,
      valor_cobrado: valorCobrado,
      multa_aplicada: multa,
      juros_aplicado: juros,
    });
  } catch (err) {
    console.error("[gerar-cobranca] Error:", err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Internal server error" },
      502,
    );
  }
});
