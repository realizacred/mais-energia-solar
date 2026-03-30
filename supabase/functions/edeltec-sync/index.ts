import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EDELTEC_BASE = "https://api.edeltecsolar.com.br";
const PAGES_PER_BATCH = 5;
const ITEMS_PER_PAGE = 50;

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

// ── Robust product classification ───────────────────────────
function classifyEdeltecProduct(p: any): { is_generator: boolean; product_kind: string } {
  const tipo = (p.tipoDeProduto || "").toLowerCase();
  const isGen =
    p.ehGerador === true ||
    tipo.includes("gerador") ||
    tipo.includes("kit") ||
    (p.potenciaGerador > 0 && (p.potenciaModulo > 0 || p.potenciaInversor > 0)) ||
    (Array.isArray(p.codMateriaPrima) && p.codMateriaPrima.length > 0);

  return {
    is_generator: isGen,
    product_kind: isGen ? "generator" : "component",
  };
}

// ── Map product → solar_kit_catalog row ─────────────────────
function mapToKit(produto: any, tenantId: string, fornecedorId: string | null) {
  const disponivel = produto.disponivelEmEstoque === true;
  const permiteCompra = produto.permiteCompraSemEstoque === true;
  const isAvailableNow = disponivel || permiteCompra;

  const nome = produto.titulo || `${produto.descricao ?? ""} ${produto.complemento ?? ""}`.trim();
  const kwp = produto.potenciaGerador || 0;
  const classification = classifyEdeltecProduct(produto);

  const tipo = (produto.tipoDeProduto || "").toLowerCase();
  let sistema = "on_grid";
  if (tipo.includes("hibrid") || produto.inversorHibrido) sistema = "hibrido";
  else if (tipo.includes("off")) sistema = "off_grid";

  const precoIntegrador = produto.precoDoIntegrador || 0;
  const precoPorKwp = kwp > 0 ? Math.round((precoIntegrador / kwp) * 100) / 100 : null;

  // Build image URLs from bucket/key if available
  const imgPrincipal = produto.imagemPrincipal;
  const imgThumb = produto.imagemThumbnail;

  return {
    name: nome,
    description: `${produto.fase || ""} · ${produto.estrutura || ""} · ${produto.fabricante || ""}`.trim(),
    estimated_kwp: kwp,
    pricing_mode: "fixed",
    fixed_price: precoIntegrador,
    status: isAvailableNow ? "active" : "inactive",
    tenant_id: tenantId,
    fornecedor_id: fornecedorId,
    external_id: String(produto.id),
    external_code: produto.codProd || null,
    source: "edeltec",
    last_synced_at: new Date().toISOString(),
    fabricante: produto.fabricante || null,
    marca: produto.marca || null,
    tipo: produto.tipoDeProduto || null,
    potencia_inversor: produto.potenciaInversor || null,
    potencia_modulo: produto.potenciaModulo || null,
    fase: produto.fase || null,
    tensao: produto.tensaoSaida || null,
    estrutura: produto.estrutura || null,
    preco_consumidor: produto.precoDoConsumidorFinal || null,
    valor_avulso: produto.valorAvulso || null,
    disponivel,
    permite_compra_sem_estoque: permiteCompra,
    previsao: produto.dataPrevistaParaDisponibilidade || null,
    product_kind: classification.product_kind,
    is_generator: classification.is_generator,
    is_available_now: isAvailableNow,
    preco_por_kwp: precoPorKwp,
    imagem_principal_url: imgPrincipal?.key ? `https://cdn.edeltecsolar.com.br/${imgPrincipal.bucket}/${imgPrincipal.key}` : null,
    thumbnail_url: imgThumb?.key ? `https://cdn.edeltecsolar.com.br/${imgThumb.bucket}/${imgThumb.key}` : null,
    external_data: {
      codProd: produto.codProd,
      tipoDeProduto: produto.tipoDeProduto,
      potenciaInversor: produto.potenciaInversor,
      potenciaModulo: produto.potenciaModulo,
      fabricante: produto.fabricante,
      marca: produto.marca,
      fase: produto.fase,
      tensaoSaida: produto.tensaoSaida,
      estrutura: produto.estrutura,
      disponivelEmEstoque: produto.disponivelEmEstoque,
      permiteCompraSemEstoque: produto.permiteCompraSemEstoque,
      dataPrevistaParaDisponibilidade: produto.dataPrevistaParaDisponibilidade,
      ehGerador: produto.ehGerador,
      inversorHibrido: produto.inversorHibrido,
      moduloBifacial: produto.moduloBifacial,
      maisVendido: produto.maisVendido,
      precoConsumidorFinal: produto.precoDoConsumidorFinal,
      valorAvulso: produto.valorAvulso,
      arranjo: produto.arranjo,
      componentes: produto.codMateriaPrima,
      sistema,
    },
  };
}

// ── Map kit items (módulos/inversores) ──────────────────────
function mapToKitItems(produto: any) {
  const items: any[] = [];
  const titulo = produto.titulo || "";

  if (produto.potenciaModulo && produto.potenciaModulo > 0) {
    const qty = produto.potenciaGerador
      ? Math.round((produto.potenciaGerador * 1000) / produto.potenciaModulo)
      : 0;
    const modMatch = titulo.match(/(\d+)\s+(.+?)\s*\+/);
    const modDesc = modMatch
      ? `${modMatch[2].trim()} ${produto.potenciaModulo}W`
      : `${produto.fabricante || "Módulo"} ${produto.potenciaModulo}W`;
    items.push({
      item_type: "modulo",
      description: modDesc,
      quantity: qty || 1,
      unit_price: 0,
      ref_id: null,
    });
  }

  if (produto.potenciaInversor && produto.potenciaInversor > 0) {
    const plusParts = titulo.split("+").slice(1);
    const invDescs: string[] = [];
    for (const part of plusParts) {
      const invMatch = part.trim().match(/^(\d+)\s+(.+)/);
      if (invMatch) invDescs.push(`${invMatch[2].trim()}`);
    }
    const invDesc = invDescs.length > 0
      ? invDescs.join(" + ")
      : `${produto.fabricante || "Inversor"} ${produto.potenciaInversor}kW`;

    let invQty = 1;
    const invQtyMatches = plusParts.map(p => p.trim().match(/^(\d+)\s+/));
    if (invQtyMatches.length > 0) {
      invQty = invQtyMatches.reduce((s, m) => s + (m ? parseInt(m[1], 10) : 0), 0) || 1;
    }

    items.push({
      item_type: "inversor",
      description: invDesc,
      quantity: invQty,
      unit_price: 0,
      ref_id: null,
    });
  }

  return items;
}

// ── Sync Log helper ─────────────────────────────────────────
async function syncLog(
  supabase: any, tenantId: string, level: string, message: string, payload?: any
) {
  try {
    await supabase.from("integration_sync_logs").insert({
      tenant_id: tenantId,
      provider: "edeltec",
      level,
      message,
      payload: payload || {},
    });
  } catch (e) {
    console.error("[edeltec-sync] Log write error:", e);
  }
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
      max_pages,
      only_generators = false,
      mode = "incremental", // 'incremental' | 'full_replace'
    } = body;
    const test_only = !!body.test_only;

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

    // Test-only mode
    if (test_only) {
      await syncLog(supabase, tenant_id, "info", "Teste de conexão realizado com sucesso");
      return new Response(
        JSON.stringify({ success: true, test: true, message: "Autenticação validada com sucesso" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Load or create sync state ──
    const { data: existingState } = await supabase
      .from("integration_sync_state")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("provider", "edeltec")
      .maybeSingle();

    let syncState = existingState;
    const isNewSync = !syncState || syncState.status === "completed" || syncState.status === "error" || syncState.status === "idle";

    if (isNewSync) {
      // First call of first page to discover totalPages
      const { meta } = await fetchEdeltecProducts(token, 1, ITEMS_PER_PAGE, q);
      const totalPages = max_pages ? Math.min(meta.totalPages, max_pages) : meta.totalPages;

      const stateData = {
        tenant_id,
        provider: "edeltec",
        mode,
        current_page: 0,
        total_pages: totalPages,
        batch_size: PAGES_PER_BATCH,
        processed_items: 0,
        inserted_items: 0,
        updated_items: 0,
        ignored_items: 0,
        status: "running",
        started_at: new Date().toISOString(),
        last_run_at: new Date().toISOString(),
        completed_at: null,
        last_error: null,
        metadata: { q: q || null, only_generators, fornecedor_id },
      };

      if (syncState) {
        const { data, error } = await supabase
          .from("integration_sync_state")
          .update(stateData)
          .eq("id", syncState.id)
          .select()
          .single();
        if (error) throw error;
        syncState = data;
      } else {
        const { data, error } = await supabase
          .from("integration_sync_state")
          .insert(stateData)
          .select()
          .single();
        if (error) throw error;
        syncState = data;
      }

      // FULL_REPLACE: delete existing edeltec records for this tenant at start
      if (mode === "full_replace") {
        const { error: delError } = await supabase
          .from("solar_kit_catalog")
          .delete()
          .eq("tenant_id", tenant_id)
          .eq("source", "edeltec");
        if (delError) {
          console.error("[edeltec-sync] Full replace delete error:", delError);
          await syncLog(supabase, tenant_id, "error", "Erro ao limpar catálogo para full replace", { error: delError.message });
        } else {
          await syncLog(supabase, tenant_id, "info", "Catálogo Edeltec limpo para ressincronização completa");
        }
      }

      await syncLog(supabase, tenant_id, "info", `Sincronização iniciada (modo: ${mode})`, {
        totalPages, mode, only_generators,
      });
    } else if (syncState.status === "running") {
      // Resume from checkpoint
      await supabase
        .from("integration_sync_state")
        .update({ last_run_at: new Date().toISOString() })
        .eq("id", syncState.id);
    }

    // ── Process batch of pages ──
    const startPage = (syncState.current_page || 0) + 1;
    const endPage = Math.min(startPage + PAGES_PER_BATCH - 1, syncState.total_pages || 999);
    const batchMeta = syncState.metadata || {};

    let batchProducts: any[] = [];
    let lastPageProcessed = startPage - 1;

    for (let page = startPage; page <= endPage; page++) {
      try {
        const { items } = await fetchEdeltecProducts(token, page, ITEMS_PER_PAGE, batchMeta.q);
        const filtered = batchMeta.only_generators
          ? items.filter((p: any) => classifyEdeltecProduct(p).is_generator)
          : items;
        batchProducts = [...batchProducts, ...filtered];
        lastPageProcessed = page;
        console.log(`[edeltec-sync] Page ${page}/${syncState.total_pages}: ${filtered.length}/${items.length} items`);
      } catch (e: any) {
        console.error(`[edeltec-sync] Error fetching page ${page}:`, e);
        await syncLog(supabase, tenant_id, "error", `Erro na página ${page}`, { error: e.message });
        break;
      }
    }

    // ── Batch upsert ──
    let created = 0, updated = 0, skipped = 0;

    if (batchProducts.length > 0) {
      const mappedProducts = batchProducts.map(p => mapToKit(p, tenant_id, batchMeta.fornecedor_id));

      // Fetch existing external_ids for this batch
      const extIds = mappedProducts.map(p => p.external_id);
      const { data: existingKits } = await supabase
        .from("solar_kit_catalog")
        .select("id, external_id")
        .eq("tenant_id", tenant_id)
        .eq("source", "edeltec")
        .in("external_id", extIds);

      const existingMap = new Map<string, string>();
      (existingKits || []).forEach((k: any) => existingMap.set(k.external_id, k.id));

      // Separate inserts and updates
      const toInsert: any[] = [];
      const toUpdate: { id: string; data: any }[] = [];

      for (const product of mappedProducts) {
        const existingId = existingMap.get(product.external_id);
        if (existingId) {
          toUpdate.push({ id: existingId, data: product });
          updated++;
        } else {
          toInsert.push(product);
          created++;
        }
      }

      // Batch insert
      if (toInsert.length > 0) {
        const { error: insertErr } = await supabase
          .from("solar_kit_catalog")
          .upsert(toInsert, { onConflict: "tenant_id,source,external_id", ignoreDuplicates: false });
        if (insertErr) {
          console.error("[edeltec-sync] Batch insert error:", insertErr);
          await syncLog(supabase, tenant_id, "error", "Erro no batch insert", { error: insertErr.message, count: toInsert.length });
          skipped += toInsert.length;
          created -= toInsert.length;
        } else {
          // Insert kit items for new generators
          for (let i = 0; i < batchProducts.length; i++) {
            const prod = batchProducts[i];
            const mapped = mappedProducts[i];
            if (!existingMap.has(mapped.external_id) && classifyEdeltecProduct(prod).is_generator) {
              const kitItems = mapToKitItems(prod);
              if (kitItems.length > 0) {
                // Find the inserted kit ID
                const { data: newKit } = await supabase
                  .from("solar_kit_catalog")
                  .select("id")
                  .eq("tenant_id", tenant_id)
                  .eq("external_id", mapped.external_id)
                  .eq("source", "edeltec")
                  .maybeSingle();
                if (newKit?.id) {
                  await supabase
                    .from("solar_kit_catalog_items")
                    .upsert(
                      kitItems.map(item => ({ ...item, kit_id: newKit.id, tenant_id })),
                      { onConflict: "tenant_id,kit_id,item_type,ref_id", ignoreDuplicates: true }
                    );
                }
              }
            }
          }
        }
      }

      // Batch updates (individual due to different WHERE clauses)
      for (const { id, data } of toUpdate) {
        const { error: upErr } = await supabase
          .from("solar_kit_catalog")
          .update(data)
          .eq("id", id);
        if (upErr) {
          console.error(`[edeltec-sync] Update error for ${id}:`, upErr);
          skipped++;
          updated--;
        }
      }
    }

    // ── Update sync state ──
    const isComplete = lastPageProcessed >= (syncState.total_pages || 0);
    const newState: any = {
      current_page: lastPageProcessed,
      processed_items: (syncState.processed_items || 0) + batchProducts.length,
      inserted_items: (syncState.inserted_items || 0) + created,
      updated_items: (syncState.updated_items || 0) + updated,
      ignored_items: (syncState.ignored_items || 0) + skipped,
      last_run_at: new Date().toISOString(),
      status: isComplete ? "completed" : "running",
    };
    if (isComplete) {
      newState.completed_at = new Date().toISOString();
    }

    await supabase
      .from("integration_sync_state")
      .update(newState)
      .eq("id", syncState.id);

    const msg = isComplete
      ? `Sincronização concluída: ${newState.inserted_items} criados, ${newState.updated_items} atualizados, ${newState.ignored_items} ignorados`
      : `Batch processado: páginas ${startPage}-${lastPageProcessed}, ${created} criados, ${updated} atualizados`;

    await syncLog(supabase, tenant_id, "info", msg, {
      pages: `${startPage}-${lastPageProcessed}`,
      created, updated, skipped, isComplete,
    });

    console.log(`[edeltec-sync] ${msg}`);

    return new Response(
      JSON.stringify({
        success: true,
        is_complete: isComplete,
        total_fetched: batchProducts.length,
        created,
        updated,
        skipped,
        current_page: lastPageProcessed,
        total_pages: syncState.total_pages,
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
