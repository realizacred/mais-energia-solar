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

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();
    if (userError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    const { data: profile } = await supabaseUser
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.tenant_id)
      return jsonResponse({ error: "Tenant não encontrado" }, 403);
    const tenantId = profile.tenant_id;

    // ── Input ──
    const { plan_id } = await req.json();
    if (!plan_id) return jsonResponse({ error: "plan_id é obrigatório" }, 400);

    // ── Fetch plan ──
    const { data: plan, error: planErr } = await supabaseAdmin
      .from("plans")
      .select("id, code, name, price_monthly, is_active")
      .eq("id", plan_id)
      .single();

    if (planErr || !plan)
      return jsonResponse({ error: "Plano não encontrado" }, 404);
    if (!plan.is_active)
      return jsonResponse({ error: "Plano não está ativo" }, 400);
    if (!plan.price_monthly || plan.price_monthly <= 0)
      return jsonResponse({ error: "Plano sem valor definido" }, 400);

    // ── Check for existing pending charge for same plan ──
    const { data: existingCharge } = await supabaseAdmin
      .from("billing_charges")
      .select("id, asaas_charge_id, invoice_url, status")
      .eq("tenant_id", tenantId)
      .eq("plan_id", plan_id)
      .eq("status", "pending")
      .maybeSingle();

    if (existingCharge?.invoice_url) {
      return jsonResponse({
        success: true,
        charge_id: existingCharge.id,
        invoice_url: existingCharge.invoice_url,
        already_exists: true,
      });
    }

    // ── Get Asaas config (per-tenant from payment_gateway_config) ──
    const { data: gwConfig } = await supabaseAdmin
      .from("payment_gateway_config")
      .select("api_key, environment, is_active")
      .eq("tenant_id", tenantId)
      .eq("provider", "asaas")
      .maybeSingle();

    // Fallback: try global ASAAS config for SaaS billing
    let apiKey = gwConfig?.api_key;
    let environment = gwConfig?.environment || "sandbox";

    if (!apiKey) {
      apiKey = Deno.env.get("ASAAS_BILLING_API_KEY");
      environment = Deno.env.get("ASAAS_BILLING_ENV") || "sandbox";
    }

    if (!apiKey) {
      return jsonResponse(
        {
          error:
            "Integração de pagamento não configurada. Configure a chave Asaas.",
        },
        400,
      );
    }

    const baseUrl =
      environment === "production"
        ? "https://api.asaas.com/v3"
        : "https://sandbox.asaas.com/api/v3";

    const apiHeaders = {
      accept: "application/json",
      "content-type": "application/json",
      access_token: apiKey,
    };

    // ── Tenant info for customer ──
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("nome, email, telefone, cpf_cnpj")
      .eq("id", tenantId)
      .single();

    if (!tenant)
      return jsonResponse({ error: "Dados do tenant não encontrados" }, 404);

    // ── Find or create billing customer ──
    const { data: existingCustomer } = await supabaseAdmin
      .from("billing_customers")
      .select("id, asaas_customer_id")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    let asaasCustomerId = existingCustomer?.asaas_customer_id;
    let billingCustomerId = existingCustomer?.id;

    if (!asaasCustomerId) {
      // Search by CPF/CNPJ in Asaas
      const cpf = tenant.cpf_cnpj?.replace(/\D/g, "");
      if (cpf) {
        const searchRes = await fetch(
          `${baseUrl}/customers?cpfCnpj=${cpf}`,
          { headers: apiHeaders, signal: AbortSignal.timeout(30000) },
        );
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          if (searchData.data?.length > 0) {
            asaasCustomerId = searchData.data[0].id;
          }
        }
      }

      // Create if not found
      if (!asaasCustomerId) {
        if (!cpf) {
          return jsonResponse(
            {
              error:
                "CPF/CNPJ do tenant é obrigatório para gerar cobrança. Atualize os dados da empresa.",
            },
            400,
          );
        }

        const createRes = await fetch(`${baseUrl}/customers`, {
          method: "POST",
          headers: apiHeaders,
          body: JSON.stringify({
            name: tenant.nome,
            cpfCnpj: cpf,
            email: tenant.email || undefined,
            phone: tenant.telefone?.replace(/\D/g, "") || undefined,
          }),
          signal: AbortSignal.timeout(30000),
        });

        if (!createRes.ok) {
          const errBody = await createRes.json().catch(() => ({}));
          console.error(
            "[billing-create-charge] Customer creation failed:",
            errBody,
          );
          return jsonResponse(
            {
              error:
                errBody.errors?.[0]?.description ||
                "Erro ao criar cliente no Asaas",
            },
            400,
          );
        }

        const customerData = await createRes.json();
        asaasCustomerId = customerData.id;
      }

      // Save billing_customer
      const { data: newCust } = await supabaseAdmin
        .from("billing_customers")
        .insert({
          tenant_id: tenantId,
          asaas_customer_id: asaasCustomerId,
          nome: tenant.nome,
          email: tenant.email,
          cpf_cnpj: tenant.cpf_cnpj,
          telefone: tenant.telefone,
        })
        .select("id")
        .single();

      billingCustomerId = newCust?.id;
    }

    // ── Create charge ──
    const today = new Date();
    const dueDate = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const chargePayload = {
      customer: asaasCustomerId,
      billingType: "UNDEFINED",
      value: plan.price_monthly,
      dueDate,
      description: `Upgrade para plano ${plan.name}`,
      externalReference: `billing_upgrade_${tenantId}_${plan_id}`,
    };

    console.log(
      "[billing-create-charge] Creating charge:",
      JSON.stringify(chargePayload),
    );

    const chargeRes = await fetch(`${baseUrl}/payments`, {
      method: "POST",
      headers: apiHeaders,
      body: JSON.stringify(chargePayload),
      signal: AbortSignal.timeout(90000),
    });

    const chargeData = await chargeRes.json();

    if (!chargeRes.ok) {
      console.error(
        "[billing-create-charge] Charge creation failed:",
        chargeData,
      );
      return jsonResponse(
        {
          error:
            chargeData.errors?.[0]?.description ||
            `Erro Asaas: ${chargeRes.status}`,
        },
        400,
      );
    }

    console.log("[billing-create-charge] Charge created:", chargeData.id);

    // ── Save to billing_charges ──
    const { data: charge, error: insertErr } = await supabaseAdmin
      .from("billing_charges")
      .insert({
        tenant_id: tenantId,
        billing_customer_id: billingCustomerId,
        asaas_charge_id: chargeData.id,
        plan_id,
        valor: plan.price_monthly,
        status: "pending",
        due_date: dueDate,
        invoice_url: chargeData.invoiceUrl || null,
        payment_link: chargeData.bankSlipUrl || null,
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("[billing-create-charge] DB insert error:", insertErr);
    }

    return jsonResponse({
      success: true,
      charge_id: charge?.id,
      asaas_charge_id: chargeData.id,
      invoice_url: chargeData.invoiceUrl || null,
      payment_link: chargeData.bankSlipUrl || null,
    });
  } catch (err: unknown) {
    console.error("[billing-create-charge] Error:", err);
    const msg = err instanceof Error ? err.message : "Erro interno";
    return jsonResponse({ error: msg }, 500);
  }
});
