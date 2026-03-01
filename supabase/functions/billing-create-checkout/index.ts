/**
 * billing-create-checkout — Creates a subscription checkout for a plant.
 * Input: { plant_id, plan_id, provider: "asaas"|"mercadopago"|"stripe" }
 * Returns: { checkout_url } or creates subscription directly.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonRes(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return jsonRes({ error: "Unauthorized" }, 401);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const sbUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  try {
    const { data: userData } = await sbUser.auth.getUser();
    if (!userData?.user) return jsonRes({ error: "Unauthorized" }, 401);

    const { data: profile } = await sb.from("profiles").select("tenant_id").eq("user_id", userData.user.id).single();
    if (!profile?.tenant_id) return jsonRes({ error: "Tenant not found" }, 403);
    const tenantId = profile.tenant_id;

    const body = await req.json();
    const { plant_id, plan_id, provider } = body;

    if (!plant_id || !plan_id) return jsonRes({ error: "plant_id and plan_id required" }, 400);

    // Load plan
    const { data: plan } = await sb.from("monitor_plans").select("*").eq("id", plan_id).single();
    if (!plan) return jsonRes({ error: "Plan not found" }, 404);

    // Check if subscription already exists for this plant
    const { data: existing } = await sb
      .from("monitor_subscriptions")
      .select("id, status")
      .eq("tenant_id", tenantId)
      .eq("plant_id", plant_id)
      .in("status", ["active", "trialing"])
      .maybeSingle();

    if (existing) return jsonRes({ error: "Plant already has an active subscription", subscription_id: existing.id }, 409);

    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // For now: create subscription directly as "active" (manual billing)
    // When provider webhooks are integrated, this will create a checkout and wait for webhook confirmation
    const { data: sub, error: subErr } = await sb
      .from("monitor_subscriptions")
      .insert({
        tenant_id: tenantId,
        plant_id: plant_id,
        plant_ids: [plant_id],
        plan_id: plan_id,
        plan_name: (plan as any).name,
        price_brl: (plan as any).price_cents / 100,
        billing_cycle: (plan as any).interval || "monthly",
        status: "active",
        provider: provider || "manual",
        started_at: now.toISOString(),
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        max_plants: 1,
      } as any)
      .select("id")
      .single();

    if (subErr) {
      console.error("[billing-checkout] Error:", subErr);
      return jsonRes({ error: subErr.message }, 500);
    }

    // Create first billing record
    await sb.from("monitor_billing_records").insert({
      tenant_id: tenantId,
      subscription_id: (sub as any).id,
      reference_month: now.getMonth() + 1,
      reference_year: now.getFullYear(),
      amount_brl: (plan as any).price_cents / 100,
      amount_cents: (plan as any).price_cents,
      currency: (plan as any).currency || "BRL",
      status: "pending",
      provider: provider || "manual",
      due_date: periodEnd.toISOString().split("T")[0],
    });

    // Audit
    await sb.from("audit_logs").insert({
      tenant_id: tenantId,
      user_id: userData.user.id,
      acao: "monitor.subscription.created",
      tabela: "monitor_subscriptions",
      registro_id: (sub as any).id,
      dados_novos: { plant_id, plan_id, provider, plan_name: (plan as any).name },
    });

    return jsonRes({
      success: true,
      subscription_id: (sub as any).id,
      status: "active",
      message: `Assinatura ${(plan as any).name} ativada para a usina.`,
    });
  } catch (err) {
    console.error("[billing-checkout] Fatal:", err);
    return jsonRes({ error: (err as Error).message }, 500);
  }
});
