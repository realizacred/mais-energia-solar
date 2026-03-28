import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EDELTEC_BASE = "https://api.edeltecsolar.com.br";

// ── Auth ────────────────────────────────────────────────────
async function getEdeltecToken(apiKey: string, secret: string): Promise<string> {
  const res = await fetch(`${EDELTEC_BASE}/api-access/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey, secret }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Edeltec auth failed: ${res.status} ${body}`);
  }
  const token = await res.text();
  return token.replace(/"/g, "").trim();
}

// ── Fetch products (paginated) ──────────────────────────────
async function fetchEdeltecProducts(
  token: string, page = 1, limit = 50, q?: string
): Promise<{ items: any[]; meta: any }> {
  const params = new URLSearchParams({
    limit: String(limit),
    page: String(page),
    ...(q ? { q } : {}),
  });
  const res = await fetch(`${EDELTEC_BASE}/produtos/integration?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Edeltec products failed: ${res.status}`);
  return res.json();
}

// ── Map product → solar_kit_catalog row ─────────────────────
function mapToKit(produto: any, tenantId: string, fornecedorId: string | null) {
  const disponivel =
    produto.disponivelEmEstoque ||
    produto.permiteCompraSemEstoque ||
    !!produto.dataPrevistaParaDisponibilidade;

  const nome = produto.titulo || `${produto.descricao ?? ""} ${produto.complemento ?? ""}`.trim();
  const kwp = produto.potenciaGerador || 0;

  const tipo = (produto.tipoDeProduto || "").toLowerCase();
  let sistema = "on_grid";
  if (tipo.includes("hibrid")) sistema = "hibrido";
  else if (tipo.includes("off")) sistema = "off_grid";

  return {
    name: nome,
    description: `${produto.fase || ""} · ${produto.estrutura || ""} · ${produto.fabricante || ""}`,
    estimated_kwp: kwp,
    pricing_mode: "fixed",
    fixed_price: produto.precoDoIntegrador || 0,
    status: disponivel ? "active" : "inactive",
    tenant_id: tenantId,
    fornecedor_id: fornecedorId,
    external_id: String(produto.id),
    source: "edeltec",
    last_synced_at: new Date().toISOString(),
    external_data: {
      codProd: produto.codProd,
      tipoDeProduto: produto.tipoDeProduto,
      potenciaInversor: produto.potenciaInversor,
      potenciaModulo: produto.potenciaModulo,
      fabricante: produto.fabricante,
      fase: produto.fase,
      estrutura: produto.estrutura,
      disponivelEmEstoque: produto.disponivelEmEstoque,
      permiteCompraSemEstoque: produto.permiteCompraSemEstoque,
      dataPrevistaParaDisponibilidade: produto.dataPrevistaParaDisponibilidade,
      calcularFrete: produto.calcularFrete,
      precoConsumidorFinal: produto.precoDoConsumidorFinal,
      maisVendido: produto.maisVendido,
      ehGerador: produto.ehGerador,
      inversorHibrido: produto.inversorHibrido,
      moduloBifacial: produto.moduloBifacial,
      sistema,
    },
  };
}

// ── Map kit items (módulos/inversores) ──────────────────────
function mapToKitItems(produto: any) {
  const items: any[] = [];

  if (produto.potenciaModulo && produto.potenciaModulo > 0) {
    const qty = produto.potenciaGerador
      ? Math.round((produto.potenciaGerador * 1000) / produto.potenciaModulo)
      : 0;
    items.push({
      item_type: "modulo",
      description: `${produto.fabricante || "Módulo"} ${produto.potenciaModulo}W`,
      quantity: qty,
      unit_price: 0,
      ref_id: null,
    });
  }

  if (produto.potenciaInversor && produto.potenciaInversor > 0) {
    items.push({
      item_type: "inversor",
      description: `${produto.fabricante || "Inversor"} ${produto.potenciaInversor}kW`,
      quantity: 1,
      unit_price: 0,
      ref_id: null,
    });
  }

  return items;
}

// ── Handler ─────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const {
      tenant_id,
      api_config_id,
      fornecedor_id = null,
      q,
      max_pages = 5,
      only_generators = true,
    } = body;

    if (!tenant_id || !api_config_id) {
      return new Response(
        JSON.stringify({ error: "tenant_id e api_config_id obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch credentials
    const { data: config, error: configErr } = await supabase
      .from("integrations_api_configs")
      .select("credentials, is_active")
      .eq("id", api_config_id)
      .eq("tenant_id", tenant_id)
      .single();

    if (configErr || !config) {
      return new Response(
        JSON.stringify({ error: "Configuração não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!config.is_active) {
      return new Response(
        JSON.stringify({ error: "Integração desativada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { apiKey, secret } = (config.credentials || {}) as any;
    if (!apiKey || !secret) {
      return new Response(
        JSON.stringify({ error: "Credenciais incompletas (apiKey/secret)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authenticate
    console.log("[edeltec-sync] Authenticating...");
    const token = await getEdeltecToken(apiKey, secret);
    console.log("[edeltec-sync] Auth OK");

    // Fetch products paginated
    let allProducts: any[] = [];
    for (let page = 1; page <= max_pages; page++) {
      const { items, meta } = await fetchEdeltecProducts(token, page, 50, q);
      const filtered = only_generators
        ? items.filter((p: any) => p.ehGerador === true)
        : items;
      allProducts = [...allProducts, ...filtered];
      console.log(`[edeltec-sync] Page ${page}/${meta.totalPages}: ${filtered.length} items`);
      if (page >= meta.totalPages) break;
    }

    // Upsert
    let created = 0, updated = 0, skipped = 0;

    for (const produto of allProducts) {
      try {
        const kitData = mapToKit(produto, tenant_id, fornecedor_id);

        const { data: existing } = await supabase
          .from("solar_kit_catalog")
          .select("id")
          .eq("external_id", String(produto.id))
          .eq("tenant_id", tenant_id)
          .maybeSingle();

        if (existing?.id) {
          const { error } = await supabase
            .from("solar_kit_catalog")
            .update(kitData)
            .eq("id", existing.id);
          if (error) throw error;
          updated++;
        } else {
          const { data: newKit, error } = await supabase
            .from("solar_kit_catalog")
            .insert(kitData)
            .select("id")
            .single();
          if (error) throw error;

          const items = mapToKitItems(produto);
          if (items.length > 0 && newKit?.id) {
            await supabase
              .from("solar_kit_catalog_items")
              .insert(items.map((item) => ({ ...item, kit_id: newKit.id, tenant_id })));
          }
          created++;
        }
      } catch (e) {
        console.error(`[edeltec-sync] Error on product ${produto.id}:`, e);
        skipped++;
      }
    }

    console.log(`[edeltec-sync] Done: ${created} created, ${updated} updated, ${skipped} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        total_fetched: allProducts.length,
        created,
        updated,
        skipped,
        synced_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[edeltec-sync] Error:", e);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
