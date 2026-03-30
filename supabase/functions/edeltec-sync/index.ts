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

// ── Provider Adapter Types ──────────────────────────────────
interface CanonicalKit {
  name: string;
  external_id: string;
  external_code: string | null;
  estimated_kwp: number;
  fixed_price: number;
  status: "active" | "inactive";
  tenant_id: string;
  fornecedor_id: string | null;
  is_generator: boolean;
  product_kind: string;
  fabricante: string | null;
  marca: string | null;
  source: string;
  external_data: Record<string, unknown>;
  [key: string]: unknown;
}

interface KitItem {
  item_type: string;
  description: string;
  quantity: number;
  unit_price: number;
  ref_id: string | null;
}

interface ProviderAdapter {
  normalize(raw: unknown, tenantId: string, fornecedorId: string | null): CanonicalKit;
  classify(raw: unknown): { is_generator: boolean; product_kind: string };
  buildKitItems(raw: unknown): KitItem[];
}

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
function mapToKit(produto: any, tenantId: string, fornecedorId: string | null): CanonicalKit {
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
function mapToKitItems(produto: any): KitItem[] {
  const items: KitItem[] = [];
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

// ── Provider Adapter ────────────────────────────────────────
const edeltecAdapter: ProviderAdapter = {
  normalize: (raw, tenantId, fornecedorId) => mapToKit(raw, tenantId, fornecedorId),
  classify: (raw) => classifyEdeltecProduct(raw),
  buildKitItems: (raw) => mapToKitItems(raw),
};

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
      mode = "incremental", // 'incremental' | 'full_replace'
    } = body;
    const test_only = !!body.test_only;
    const fornecedorId = fornecedor_id;

    // NOTE: only_generators is intentionally NOT used for DB filtering anymore.
    // ALL products are saved to the catalog. Filtering is done client-side in the UI.

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

    // Cache page 1 data so we don't waste it
    let page1Items: any[] | null = null;

    if (isNewSync) {
      // First call: fetch page 1 to discover totalPages AND keep items
      const page1Result = await fetchEdeltecProducts(token, 1, ITEMS_PER_PAGE, q);
      const totalPages = max_pages ? Math.min(page1Result.meta.totalPages, max_pages) : page1Result.meta.totalPages;
      page1Items = page1Result.items;

      console.log(`[edeltec-sync] API reports totalPages=${page1Result.meta.totalPages}, totalItems=${page1Result.meta.totalItems || "?"}, using=${totalPages}`);

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
        metadata: { q: q || null, fornecedor_id: fornecedorId },
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

      // FULL_REPLACE: delete existing records for this tenant+fornecedor at start
      if (mode === "full_replace") {
        if (!fornecedorId) {
          await syncLog(supabase, tenant_id, "error", "full_replace requer fornecedor_id — operação abortada");
          return new Response(
            JSON.stringify({ success: false, error: "full_replace requer fornecedor_id", code: "MISSING_FORNECEDOR_ID" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const { error: delError } = await supabase
          .from("solar_kit_catalog")
          .delete()
          .eq("tenant_id", tenant_id)
          .eq("fornecedor_id", fornecedorId);
        if (delError) {
          console.error("[edeltec-sync] Full replace delete error:", delError);
          await syncLog(supabase, tenant_id, "error", "Erro ao limpar catálogo para full replace", { error: delError.message });
        } else {
          await syncLog(supabase, tenant_id, "info", "Catálogo Edeltec limpo para ressincronização completa");
        }
      }

      await syncLog(supabase, tenant_id, "info", `Sincronização iniciada (modo: ${mode})`, {
        totalPages, mode, totalItems: page1Result.meta.totalItems || null,
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
        let items: any[];

        // Use cached page 1 data if available (avoid double-fetch)
        if (page === 1 && page1Items !== null) {
          items = page1Items;
          page1Items = null; // clear after use
        } else {
          const result = await fetchEdeltecProducts(token, page, ITEMS_PER_PAGE, batchMeta.q);
          items = result.items;
        }

        // IMPORTANT: Save ALL products to the catalog — no filtering by is_generator.
        // Classification is stored but does NOT exclude products from persistence.
        batchProducts = [...batchProducts, ...items];
        lastPageProcessed = page;

        // Detailed per-page logging with manufacturer breakdown
        const fabricantes = new Map<string, number>();
        for (const p of items) {
          const fab = p.fabricante || "(sem fabricante)";
          fabricantes.set(fab, (fabricantes.get(fab) || 0) + 1);
        }
        const fabSummary = Array.from(fabricantes.entries())
          .map(([f, c]) => `${f}:${c}`)
          .join(", ");
        
        console.log(`[edeltec-sync] Page ${page}/${syncState.total_pages}: ${items.length} items → fabricantes: ${fabSummary}`);
        
        await syncLog(supabase, tenant_id, "info", `Página ${page}/${syncState.total_pages}: ${items.length} produtos`, {
          page,
          total_pages: syncState.total_pages,
          items_count: items.length,
          fabricantes: Object.fromEntries(fabricantes),
        });
      } catch (e: any) {
        console.error(`[edeltec-sync] Error fetching page ${page}:`, e);
        await syncLog(supabase, tenant_id, "error", `Erro na página ${page}`, { error: e.message });
        // Don't break — try next page to maximize data collection
        continue;
      }
    }

    // ── Batch upsert ──
    let created = 0, updated = 0, skipped = 0;

    if (batchProducts.length > 0) {
      const mappedProducts = batchProducts.map(p => edeltecAdapter.normalize(p, tenant_id, batchMeta.fornecedor_id));

      // Fetch existing external_ids for this batch to count created vs updated
      const extIds = mappedProducts.map(p => p.external_id);
      const { data: existingKits } = await supabase
        .from("solar_kit_catalog")
        .select("id, external_id")
        .eq("tenant_id", tenant_id)
        .eq("fornecedor_id", fornecedorId)
        .in("external_id", extIds);

      const existingMap = new Map<string, string>();
      (existingKits || []).forEach((k: any) => existingMap.set(k.external_id, k.id));

      // Count created vs updated BEFORE the upsert
      for (const product of mappedProducts) {
        if (existingMap.has(product.external_id)) {
          updated++;
        } else {
          created++;
        }
      }

      // SINGLE upsert for all products (inserts + updates unified)
      const { error: upsertErr } = await supabase
        .from("solar_kit_catalog")
        .upsert(mappedProducts, {
          onConflict: "tenant_id,fornecedor_id,external_id",
          ignoreDuplicates: false,
        });

      if (upsertErr) {
        console.error("[edeltec-sync] Batch upsert error:", upsertErr);
        await syncLog(supabase, tenant_id, "error", "Erro no batch upsert", { error: upsertErr.message, count: mappedProducts.length });
        skipped += mappedProducts.length;
        created = 0;
        updated = 0;
      } else {
        // ── Batch kit items (eliminate N+1) ──
        // Fetch all IDs for generators that were just inserted (new ones only)
        const newExtIds = mappedProducts
          .filter(p => !existingMap.has(p.external_id))
          .map(p => p.external_id);

        if (newExtIds.length > 0) {
          const { data: insertedKits } = await supabase
            .from("solar_kit_catalog")
            .select("id, external_id")
            .eq("tenant_id", tenant_id)
            .eq("fornecedor_id", fornecedorId)
            .in("external_id", newExtIds);

          const insertedMap = new Map<string, string>(
            (insertedKits || []).map((k: any) => [k.external_id, k.id])
          );

          // Build ALL kit items at once
          const allKitItems: any[] = [];
          for (let i = 0; i < batchProducts.length; i++) {
            const prod = batchProducts[i];
            const mapped = mappedProducts[i];
            const kitId = insertedMap.get(mapped.external_id);
            if (!kitId) continue;
            if (!edeltecAdapter.classify(prod).is_generator) continue;
            const items = edeltecAdapter.buildKitItems(prod);
            for (const item of items) {
              allKitItems.push({ ...item, kit_id: kitId, tenant_id });
            }
          }

          // SINGLE upsert for all kit items
          if (allKitItems.length > 0) {
            const { error: kitItemsErr } = await supabase
              .from("solar_kit_catalog_items")
              .upsert(allKitItems, {
                onConflict: "tenant_id,kit_id,item_type,ref_id",
                ignoreDuplicates: true,
              });
            if (kitItemsErr) {
              console.error("[edeltec-sync] Kit items upsert error:", kitItemsErr);
              await syncLog(supabase, tenant_id, "warn", "Erro ao salvar itens de kit", { error: kitItemsErr.message, count: allKitItems.length });
            }
          }
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

      // Final validation: log manufacturer summary using fornecedor_id
      const fabQuery = supabase
        .from("solar_kit_catalog")
        .select("fabricante")
        .eq("tenant_id", tenant_id);
      
      if (fornecedorId) {
        fabQuery.eq("fornecedor_id", fornecedorId);
      } else {
        fabQuery.eq("source", "edeltec");
      }

      const { data: fabData } = await fabQuery;
      
      if (fabData) {
        const fabCount = new Map<string, number>();
        for (const row of fabData) {
          const f = row.fabricante || "(sem fabricante)";
          fabCount.set(f, (fabCount.get(f) || 0) + 1);
        }
        const summary = Array.from(fabCount.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([f, c]) => `${f}: ${c}`)
          .join(", ");
        
        console.log(`[edeltec-sync] FINAL: ${fabData.length} products, fabricantes: ${summary}`);
        await syncLog(supabase, tenant_id, "info", `Catálogo final: ${fabData.length} produtos`, {
          fabricantes: Object.fromEntries(fabCount),
          total: fabData.length,
        });
      }
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
