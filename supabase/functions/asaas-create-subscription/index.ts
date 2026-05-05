/**
 * asaas-create-subscription — Creates a recurring Asaas subscription for a tenant plan.
 * Reuses billing_customers / get-asaas-key. Updates public.subscriptions.external_id.
 * AGENTS RB-76: reusa infra existente, sem duplicar tabelas.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getAsaasKey } from "../_shared/get-asaas-key.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (b: Record<string, unknown>, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supaUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const supaAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: { user } } = await supaUser.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { data: profile } = await supaUser
      .from("profiles").select("tenant_id").eq("user_id", user.id).single();
    if (!profile?.tenant_id) return json({ error: "Tenant não encontrado" }, 403);
    const tenantId = profile.tenant_id;

    const { plan_id, billing_type = "UNDEFINED", cycle = "MONTHLY" } = await req.json();
    if (!plan_id) return json({ error: "plan_id obrigatório" }, 400);

    const { data: plan } = await supaAdmin
      .from("plans")
      .select("id, code, name, price_monthly, price_yearly, is_active")
      .eq("id", plan_id).single();
    if (!plan?.is_active) return json({ error: "Plano inválido" }, 400);

    const value = cycle === "YEARLY" ? plan.price_yearly : plan.price_monthly;
    if (!value || value <= 0) return json({ error: "Plano sem valor" }, 400);

    const asaasKey = await getAsaasKey(supaAdmin, tenantId);
    if (!asaasKey) return json({ error: "asaas_not_configured" }, 400);

    const baseUrl = asaasKey.environment === "production"
      ? "https://api.asaas.com/v3"
      : "https://sandbox.asaas.com/api/v3";
    const apiHeaders = {
      accept: "application/json",
      "content-type": "application/json",
      access_token: asaasKey.apiKey,
    };

    // Tenant + customer
    const { data: tenant } = await supaAdmin
      .from("tenants").select("nome, documento").eq("id", tenantId).single();
    if (!tenant) return json({ error: "Tenant não encontrado" }, 404);

    const { data: existingCustomer } = await supaAdmin
      .from("billing_customers")
      .select("id, asaas_customer_id")
      .eq("tenant_id", tenantId).maybeSingle();

    let asaasCustomerId = existingCustomer?.asaas_customer_id;
    if (!asaasCustomerId) {
      const cpf = tenant.documento?.replace(/\D/g, "");
      if (!cpf) return json({ error: "CPF/CNPJ do tenant ausente" }, 400);
      const createCust = await fetch(`${baseUrl}/customers`, {
        method: "POST", headers: apiHeaders,
        body: JSON.stringify({ name: tenant.nome, cpfCnpj: cpf }),
        signal: AbortSignal.timeout(30000),
      });
      const cd = await createCust.json();
      if (!createCust.ok) return json({ error: cd.errors?.[0]?.description || "Erro Asaas customer" }, 400);
      asaasCustomerId = cd.id;
      await supaAdmin.from("billing_customers").insert({
        tenant_id: tenantId, asaas_customer_id: asaasCustomerId,
        nome: tenant.nome, cpf_cnpj: tenant.documento,
      });
    }

    // Check existing active subscription with external_id
    const { data: currentSub } = await supaAdmin
      .from("subscriptions")
      .select("id, external_id, status")
      .eq("tenant_id", tenantId).maybeSingle();

    if (currentSub?.external_id) {
      return json({
        success: true, already_exists: true,
        subscription_id: currentSub.id,
        asaas_subscription_id: currentSub.external_id,
      });
    }

    // Create Asaas subscription
    const nextDue = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
      .toISOString().split("T")[0];
    const subPayload = {
      customer: asaasCustomerId,
      billingType: billing_type,
      value,
      nextDueDate: nextDue,
      cycle,
      description: `Assinatura ${plan.name}`,
      externalReference: `sub_${tenantId}_${plan.id}`,
    };
    const subRes = await fetch(`${baseUrl}/subscriptions`, {
      method: "POST", headers: apiHeaders,
      body: JSON.stringify(subPayload),
      signal: AbortSignal.timeout(60000),
    });
    const subData = await subRes.json();
    if (!subRes.ok) {
      console.error("[asaas-create-subscription] Failed:", subData);
      return json({ error: subData.errors?.[0]?.description || "Erro Asaas subscription" }, 400);
    }

    const periodStart = new Date();
    const periodEnd = new Date(periodStart);
    if (cycle === "YEARLY") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    else periodEnd.setMonth(periodEnd.getMonth() + 1);

    const updates = {
      plan_id,
      external_id: subData.id,
      status: "active" as const,
      trial_ends_at: null,
      current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (currentSub?.id) {
      await supaAdmin.from("subscriptions").update(updates).eq("id", currentSub.id);
    } else {
      await supaAdmin.from("subscriptions").insert({ tenant_id: tenantId, ...updates });
    }

    return json({
      success: true,
      asaas_subscription_id: subData.id,
      next_due_date: nextDue,
    });
  } catch (e) {
    console.error("[asaas-create-subscription]", e);
    return json({ error: e instanceof Error ? e.message : "Erro interno" }, 500);
  }
});
