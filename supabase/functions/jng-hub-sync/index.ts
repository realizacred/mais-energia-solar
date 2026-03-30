import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const JNG_BASE = "https://api-d1542.cloud.solaryum.com.br";
const PAGES_PER_BATCH = 5;
const ITEMS_PER_PAGE = 100;

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

// ── JNG Types ───────────────────────────────────────────────
interface JngProduto {
  idProduto: number;
  descricao: string | null;
  situacao: string | null;
  potencia: number;
  tipo: string | null;
  marca: { idMarca: number; descricao: string | null } | null;
  categoria: { id: number; descricao: string | null } | null;
  agrupamento: { idAgrupamento: number; descricao: string | null } | null;
  precoVenda: number;
  precoAvulso: number;
  precoCusto: number;
  composicao: any[] | null;
  dtDisponibilidade: string | null;
  codErp: string | null;
  referencia: string | null;
}

// ── Fetch helpers ───────────────────────────────────────────
async function fetchJngProducts(
  token: string,
  page: number,
  limit: number,
  dtAlteracao?: string | null
): Promise<any[]> {
  const params = new URLSearchParams({
    token,
    paginaAtual: String(page),
    qtdPorPagina: String(limit),
  });
  if (dtAlteracao) params.set("dtAlteracao", dtAlteracao);

  const res = await fetch(`${JNG_BASE}/integracao/Produtos?${params}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`JNG products failed: ${res.status} ${body}`);
  }
  return res.json();
}

async function fetchJngEstoque(token: string): Promise<any[]> {
  const res = await fetch(
    `${JNG_BASE}/integracao/Estoque?token=${encodeURIComponent(token)}&situacao=A`
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`JNG estoque failed: ${res.status} ${body}`);
  }
  return res.json();
}

async function fetchJngValores(token: string): Promise<any[]> {
  const res = await fetch(
    `${JNG_BASE}/integracao/Valores?token=${encodeURIComponent(token)}`
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`JNG valores failed: ${res.status} ${body}`);
  }
  return res.json();
}

// ── Classification ──────────────────────────────────────────
function classifyJngProduct(p: JngProduto): { is_generator: boolean; product_kind: string } {
  const isKit =
    (Array.isArray(p.composicao) && p.composicao.length > 0) ||
    (p.tipo || "").toLowerCase().includes("kit");
  return {
    is_generator: isKit,
    product_kind: isKit ? "generator" : "component",
  };
}

// ── Map product → solar_kit_catalog row ─────────────────────
function mapToKit(
  produto: JngProduto,
  estoqueMap: Map<number, any>,
  valoresMap: Map<number, any>,
  tenantId: string,
  fornecedorId: string | null
): CanonicalKit {
  const estoque = estoqueMap.get(produto.idProduto);
  const valores = valoresMap.get(produto.idProduto);
  const classification = classifyJngProduct(produto);

  const kwp = produto.potencia || 0;
  const precoVenda = valores?.precoVenda ?? produto.precoVenda ?? 0;
  const precoPorKwp = kwp > 0 ? Math.round((precoVenda / kwp) * 100) / 100 : null;

  const qtEstoque = estoque?.qtEstoque ?? 0;
  const situacaoEstoque = estoque?.situacao ?? produto.situacao;
  const isAvailableNow = qtEstoque > 0 || situacaoEstoque === "A";

  return {
    name: produto.descricao || `Produto ${produto.idProduto}`,
    description: [produto.tipo, produto.categoria?.descricao, produto.marca?.descricao]
      .filter(Boolean)
      .join(" · "),
    estimated_kwp: kwp,
    pricing_mode: "fixed",
    fixed_price: precoVenda,
    status: produto.situacao === "A" ? "active" : "inactive",
    tenant_id: tenantId,
    fornecedor_id: fornecedorId,
    external_id: String(produto.idProduto),
    external_code: produto.codErp || produto.referencia || null,
    source: "jng",
    last_synced_at: new Date().toISOString(),
    fabricante: produto.marca?.descricao || null,
    marca: produto.marca?.descricao || null,
    tipo: produto.tipo || null,
    potencia_inversor: null,
    potencia_modulo: null,
    fase: null,
    tensao: null,
    estrutura: null,
    preco_consumidor: produto.precoAvulso || null,
    valor_avulso: produto.precoAvulso || null,
    disponivel: qtEstoque > 0,
    permite_compra_sem_estoque: false,
    previsao: produto.dtDisponibilidade || null,
    product_kind: classification.product_kind,
    is_generator: classification.is_generator,
    is_available_now: isAvailableNow,
    preco_por_kwp: precoPorKwp,
    imagem_principal_url: null,
    thumbnail_url: null,
    external_data: {
      idProduto: produto.idProduto,
      tipo: produto.tipo,
      categoria: produto.categoria,
      agrupamento: produto.agrupamento,
      marca: produto.marca,
      situacao: produto.situacao,
      potencia: produto.potencia,
      precoCusto: produto.precoCusto,
      precoVenda: precoVenda,
      precoAvulso: produto.precoAvulso,
      qtEstoque: qtEstoque,
      situacaoEstoque: situacaoEstoque,
      composicaoLength: produto.composicao?.length ?? 0,
    },
  };
}

// ── Map kit items ───────────────────────────────────────────
function buildKitItems(produto: JngProduto): KitItem[] {
  if (!Array.isArray(produto.composicao) || produto.composicao.length === 0) return [];

  return produto.composicao.map((item: any) => {
    const tipoItem = (item.produto?.tipo || "").toLowerCase();
    let itemType = "outro";
    if (tipoItem.includes("módulo") || tipoItem.includes("modulo") || tipoItem.includes("painel")) {
      itemType = "modulo";
    } else if (tipoItem.includes("inversor")) {
      itemType = "inversor";
    }

    return {
      item_type: itemType,
      description: item.produto?.descricao || `Item ${item.idProduto}`,
      quantity: item.quantidade || 1,
      unit_price: item.produto?.precoVenda || 0,
      ref_id: String(item.idProduto),
    };
  });
}

// ── Provider Adapter Factory (closure local — sem estado global) ──
function createJngAdapter(
  estoqueMap: Map<number, any>,
  valoresMap: Map<number, any>
): ProviderAdapter {
  return {
    normalize: (raw, tenantId, fornecedorId) =>
      mapToKit(raw as JngProduto, estoqueMap, valoresMap, tenantId, fornecedorId),
    classify: (raw) => classifyJngProduct(raw as JngProduto),
    buildKitItems: (raw) => buildKitItems(raw as JngProduto),
  };
}

// ── Sync Log helper ─────────────────────────────────────────
async function syncLog(
  supabase: any,
  tenantId: string,
  level: string,
  message: string,
  payload?: any
) {
  try {
    await supabase.from("integration_sync_logs").insert({
      tenant_id: tenantId,
      provider: "jng",
      level,
      message,
      payload: payload || {},
    });
  } catch (e) {
    console.error("[jng-hub-sync] Log write error:", e);
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
      fornecedor_id,
      mode = "incremental",
      max_pages,
    } = body;
    const test_only = !!body.test_only;

    // ── Validations (§EF-S1) ──
    if (!tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: "tenant_id obrigatório", code: "MISSING_TENANT" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!api_config_id) {
      return new Response(
        JSON.stringify({ success: false, error: "api_config_id obrigatório", code: "MISSING_CONFIG" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!fornecedor_id) {
      return new Response(
        JSON.stringify({ success: false, error: "fornecedor_id obrigatório", code: "MISSING_FORNECEDOR_ID" }),
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
        JSON.stringify({ success: false, error: "Configuração não encontrada", code: "CONFIG_NOT_FOUND" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!config.is_active) {
      return new Response(
        JSON.stringify({ success: false, error: "Integração desativada", code: "INTEGRATION_DISABLED" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { token } = (config.credentials || {}) as any;
    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: "Token não encontrado nas credenciais", code: "MISSING_TOKEN" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Test-only mode ──
    if (test_only) {
      try {
        const testItems = await fetchJngProducts(token, 1, 1);
        await syncLog(supabase, tenant_id, "info", "Teste de conexão JNG realizado com sucesso", {
          sample_count: testItems.length,
        });
        return new Response(
          JSON.stringify({ success: true, test: true, message: "Conexão JNG validada com sucesso" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (e: any) {
        return new Response(
          JSON.stringify({ success: false, error: `Falha na conexão JNG: ${e.message}`, code: "AUTH_FAILED" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── Load estoque + valores (ONCE before pagination loop) ──
    console.log("[jng-hub-sync] Loading estoque + valores...");
    let estoqueMap = new Map<number, any>();
    let valoresMap = new Map<number, any>();
    try {
      const [estoqueData, valoresData] = await Promise.all([
        fetchJngEstoque(token),
        fetchJngValores(token),
      ]);
      estoqueMap = new Map(
        (estoqueData || []).map((e: any) => [e.idProduto, e])
      );
      valoresMap = new Map(
        (valoresData || []).map((v: any) => [v.idProduto, v])
      );
      console.log(`[jng-hub-sync] Estoque: ${estoqueMap.size} items, Valores: ${valoresMap.size} items`);
    } catch (e: any) {
      console.error("[jng-hub-sync] Failed to load estoque/valores:", e);
      await syncLog(supabase, tenant_id, "warn", "Falha ao carregar estoque/valores — usando dados do produto", {
        error: e.message,
      });
    }

    // Criar adapter com closure local — isolamento por request
    const jngAdapter = createJngAdapter(estoqueMap, valoresMap);

    // ── Load or create sync state ──
    const { data: existingState } = await supabase
      .from("integration_sync_state")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("provider", "jng")
      .maybeSingle();

    let syncState = existingState;
    const isNewSync =
      !syncState ||
      syncState.status === "completed" ||
      syncState.status === "error" ||
      syncState.status === "idle";

    // For incremental, use last_completed_at as dtAlteracao
    let dtAlteracao: string | null = null;
    if (mode === "incremental" && syncState?.completed_at) {
      dtAlteracao = syncState.completed_at;
    }

    if (isNewSync) {
      const stateData = {
        tenant_id,
        provider: "jng",
        mode,
        current_page: 0,
        total_pages: null, // JNG doesn't report totalPages
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
        metadata: {
          fornecedor_id,
          token_partial: token.slice(0, 8) + "...",
          estoque_count: estoqueMap.size,
          valores_count: valoresMap.size,
          dtAlteracao: dtAlteracao || null,
        },
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

      // FULL_REPLACE: delete existing records
      if (mode === "full_replace") {
        const { error: delError } = await supabase
          .from("solar_kit_catalog")
          .delete()
          .eq("tenant_id", tenant_id)
          .eq("fornecedor_id", fornecedor_id);

        if (delError) {
          console.error("[jng-hub-sync] Full replace delete error:", delError);
          await syncLog(supabase, tenant_id, "error", "Erro ao limpar catálogo JNG para full replace", {
            error: delError.message,
          });
        } else {
          await syncLog(supabase, tenant_id, "info", "Catálogo JNG limpo para ressincronização completa");
        }
      }

      await syncLog(supabase, tenant_id, "info", `Sincronização JNG iniciada (modo: ${mode})`, {
        mode,
        dtAlteracao,
        estoque_count: _estoqueMap.size,
        valores_count: _valoresMap.size,
      });
    } else if (syncState.status === "running") {
      // Resume from checkpoint
      await supabase
        .from("integration_sync_state")
        .update({ last_run_at: new Date().toISOString() })
        .eq("id", syncState.id);

      // Restore dtAlteracao from metadata if resuming
      if (mode === "incremental" && syncState.metadata?.dtAlteracao) {
        dtAlteracao = syncState.metadata.dtAlteracao;
      }
    }

    // ── Process batch of pages ──
    const startPage = (syncState.current_page || 0) + 1;
    const maxPage = max_pages ? startPage + max_pages - 1 : startPage + PAGES_PER_BATCH - 1;
    const endPage = maxPage;

    let batchProducts: any[] = [];
    let lastPageProcessed = startPage - 1;
    let isLastPage = false;

    for (let page = startPage; page <= endPage; page++) {
      if (isLastPage) break;

      try {
        const items = await fetchJngProducts(token, page, ITEMS_PER_PAGE, dtAlteracao);

        if (items.length === 0 || items.length < ITEMS_PER_PAGE) {
          isLastPage = true;
        }

        batchProducts = [...batchProducts, ...items];
        lastPageProcessed = page;

        // Per-page logging with manufacturer breakdown
        const fabricantes = new Map<string, number>();
        for (const p of items) {
          const fab = p.marca?.descricao || "(sem marca)";
          fabricantes.set(fab, (fabricantes.get(fab) || 0) + 1);
        }
        const fabSummary = Array.from(fabricantes.entries())
          .map(([f, c]) => `${f}:${c}`)
          .join(", ");

        console.log(
          `[jng-hub-sync] Page ${page}: ${items.length} items → marcas: ${fabSummary}`
        );

        await syncLog(supabase, tenant_id, "info", `Página ${page}: ${items.length} produtos`, {
          page,
          items_count: items.length,
          fabricantes: Object.fromEntries(fabricantes),
          is_last_page: isLastPage,
        });
      } catch (e: any) {
        console.error(`[jng-hub-sync] Error fetching page ${page}:`, e);
        await syncLog(supabase, tenant_id, "error", `Erro na página ${page}`, {
          error: e.message,
        });
        // Don't break — try next page
        continue;
      }
    }

    // ── Batch upsert ──
    let created = 0,
      updated = 0,
      skipped = 0;

    if (batchProducts.length > 0) {
      const mappedProducts = batchProducts.map((p) =>
        jngAdapter.normalize(p, tenant_id, fornecedor_id)
      );

      // Fetch existing external_ids to count created vs updated
      const extIds = mappedProducts.map((p) => p.external_id);
      const { data: existingKits } = await supabase
        .from("solar_kit_catalog")
        .select("id, external_id")
        .eq("tenant_id", tenant_id)
        .eq("fornecedor_id", fornecedor_id)
        .in("external_id", extIds);

      const existingMap = new Map<string, string>();
      (existingKits || []).forEach((k: any) =>
        existingMap.set(k.external_id, k.id)
      );

      for (const product of mappedProducts) {
        if (existingMap.has(product.external_id)) {
          updated++;
        } else {
          created++;
        }
      }

      // SINGLE upsert for all products (AP-20)
      const { error: upsertErr } = await supabase
        .from("solar_kit_catalog")
        .upsert(mappedProducts, {
          onConflict: "tenant_id,fornecedor_id,external_id",
          ignoreDuplicates: false,
        });

      if (upsertErr) {
        console.error("[jng-hub-sync] Batch upsert error:", upsertErr);
        await syncLog(supabase, tenant_id, "error", "Erro no batch upsert", {
          error: upsertErr.message,
          count: mappedProducts.length,
        });
        skipped += mappedProducts.length;
        created = 0;
        updated = 0;
      } else {
        // ── Batch kit items (eliminate N+1) ──
        const newExtIds = mappedProducts
          .filter((p) => !existingMap.has(p.external_id))
          .map((p) => p.external_id);

        if (newExtIds.length > 0) {
          const { data: insertedKits } = await supabase
            .from("solar_kit_catalog")
            .select("id, external_id")
            .eq("tenant_id", tenant_id)
            .eq("fornecedor_id", fornecedor_id)
            .in("external_id", newExtIds);

          const insertedMap = new Map<string, string>(
            (insertedKits || []).map((k: any) => [k.external_id, k.id])
          );

          const allKitItems: any[] = [];
          for (let i = 0; i < batchProducts.length; i++) {
            const prod = batchProducts[i];
            const mapped = mappedProducts[i];
            const kitId = insertedMap.get(mapped.external_id);
            if (!kitId) continue;
            if (!jngAdapter.classify(prod).is_generator) continue;
            const items = jngAdapter.buildKitItems(prod);
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
              console.error("[jng-hub-sync] Kit items upsert error:", kitItemsErr);
              await syncLog(supabase, tenant_id, "warn", "Erro ao salvar itens de kit JNG", {
                error: kitItemsErr.message,
                count: allKitItems.length,
              });
            }
          }
        }
      }
    }

    // ── Update sync state ──
    const isComplete = isLastPage || batchProducts.length === 0;
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

      // Final validation: log manufacturer summary
      const { data: fabData } = await supabase
        .from("solar_kit_catalog")
        .select("fabricante")
        .eq("tenant_id", tenant_id)
        .eq("fornecedor_id", fornecedor_id);

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

        console.log(`[jng-hub-sync] FINAL: ${fabData.length} products, marcas: ${summary}`);
        await syncLog(supabase, tenant_id, "info", `Catálogo JNG final: ${fabData.length} produtos`, {
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
      ? `Sincronização JNG concluída: ${newState.inserted_items} criados, ${newState.updated_items} atualizados, ${newState.ignored_items} ignorados`
      : `Batch JNG processado: páginas ${startPage}-${lastPageProcessed}, ${created} criados, ${updated} atualizados`;

    await syncLog(supabase, tenant_id, "info", msg, {
      pages: `${startPage}-${lastPageProcessed}`,
      created,
      updated,
      skipped,
      isComplete,
    });

    console.log(`[jng-hub-sync] ${msg}`);

    return new Response(
      JSON.stringify({
        success: true,
        is_complete: isComplete,
        total_fetched: batchProducts.length,
        created,
        updated,
        skipped,
        current_page: lastPageProcessed,
        synced_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[jng-hub-sync] Error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e.message, code: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
