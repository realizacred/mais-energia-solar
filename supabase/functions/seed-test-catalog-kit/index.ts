import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  // Get tenant from auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "No auth" }), { status: 401, headers: corsHeaders });

  const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await anonClient.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: corsHeaders });

  // Get tenant_id
  const { data: profile } = await sb.from("profiles").select("tenant_id").eq("user_id", user.id).single();
  if (!profile) return new Response(JSON.stringify({ error: "No profile" }), { status: 400, headers: corsHeaders });
  const tenantId = profile.tenant_id;

  // Modulo ref
  const { data: modulo } = await sb.from("modulos_solares").select("id").eq("tenant_id", tenantId).limit(1).single();
  // Inversor ref
  const { data: inversor } = await sb.from("inversores_catalogo").select("id").eq("tenant_id", tenantId).limit(1).single();

  if (!modulo || !inversor) {
    return new Response(JSON.stringify({ error: "Need at least 1 modulo and 1 inversor in catalog", modulo, inversor }), { status: 400, headers: corsHeaders });
  }

  // Create kit
  const { data: kit, error: kitErr } = await sb.from("solar_kit_catalog").insert({
    tenant_id: tenantId,
    name: "Kit Teste Integração v1",
    description: "Kit para teste de aceite Catálogo → Wizard",
    estimated_kwp: 6.0,
    status: "active",
    pricing_mode: "calculated",
  }).select("id").single();

  if (kitErr) return new Response(JSON.stringify({ error: kitErr.message }), { status: 500, headers: corsHeaders });

  // Insert 3 items: modulo, inversor, generico
  const items = [
    { kit_id: kit.id, tenant_id: tenantId, item_type: "modulo", ref_id: modulo.id, description: "Módulo Solar", quantity: 10, unit: "un" },
    { kit_id: kit.id, tenant_id: tenantId, item_type: "inversor", ref_id: inversor.id, description: "Inversor", quantity: 1, unit: "un" },
    { kit_id: kit.id, tenant_id: tenantId, item_type: "generico", ref_id: null, description: "Cabo Solar 6mm 50m", quantity: 2, unit: "un" },
  ];

  const { data: inserted, error: itemErr } = await sb.from("solar_kit_catalog_items").insert(items).select("id, item_type, ref_id");

  if (itemErr) return new Response(JSON.stringify({ error: itemErr.message }), { status: 500, headers: corsHeaders });

  return new Response(JSON.stringify({ kit_id: kit.id, items: inserted, tenant_id: tenantId }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
