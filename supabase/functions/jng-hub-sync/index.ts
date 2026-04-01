import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const JNG_BASE = "https://api-d1542.cloud.solaryum.com.br";

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

// ── JNG HubB2B Types ────────────────────────────────────────
interface ProdutoComposicaoHubB2B {
  idProduto: number;
  descricao: string | null;
  qtd: number | null;
  agrupamento: string | null;
  marca: string | null;
  potencia: number | null;
  fotoUrl: string | null;
  idCategoria: number;
  categoria: string | null;
}

interface JngProduto {
  idProduto: number;
  codErp: string | null;
  descricao: string | null;
  precoVenda: number;
  marca: string | null;
  marcaPainel: string | null;
  marcaInversor: string | null;
  modelo: string | null;
  idAgrupamento: number | null;
  agrupamento: string | null;
  idCategoria: number | null;
  categoria: string | null;
  potencia: number;
  estoque: number;
  dataAlteracao: string | null;
  estrutura: string | null;
  dtDisponibilidade: string | null;
  tensao: number | null;
  fase: number | null;
  tipoInv: number | null;
  fotoUrl: string | null;
  composicao: ProdutoComposicaoHubB2B[] | null;
}

// ── Fetch helper (HubB2B — /hubB2B/Produtos) ───────────────
async function fetchJngKits(token: string, ibge?: string): Promise<any[]> {
  const params = new URLSearchParams({ token });
  if (ibge) {
    params.set("ibge", ibge);
  }
  const url = `${JNG_BASE}/hubB2B/Produtos?${params.toString()}`;
  // console.log("[jng] fetchKits URL:", url);
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`JNG kits failed: ${res.status} ${body}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

// ── Classification ──────────────────────────────────────────
function classifyJngProduct(p: JngProduto): { is_generator: boolean; product_kind: string } {
  const isKit =
    (Array.isArray(p.composicao) && p.composicao.length > 0) ||
    (p.agrupamento || "").toLowerCase().includes("kit") ||
    (p.categoria || "").toLowerCase().includes("kit") ||
    (p.categoria || "").toLowerCase().includes("gerador");
  return {
    is_generator: isKit,
    product_kind: isKit ? "generator" : "component",
  };
}

// ── Map product → solar_kit_catalog row ─────────────────────
function mapToKit(
  produto: JngProduto,
  tenantId: string,
  fornecedorId: string | null
): CanonicalKit {
  const classification = classifyJngProduct(produto);
  const kwp = produto.potencia || 0;
  const precoVenda = produto.precoVenda || 0;
  const precoPorKwp = kwp > 0 ? Math.round((precoVenda / kwp) * 100) / 100 : null;
  const isAvailableNow = (produto.estoque || 0) > 0;

  return {
    name: produto.descricao || `Produto ${produto.idProduto}`,
    description: [produto.agrupamento, produto.categoria, produto.marca]
      .filter(Boolean)
      .join(" · "),
    estimated_kwp: kwp,
    pricing_mode: "fixed",
    fixed_price: precoVenda,
    status: isAvailableNow ? "active" : "inactive",
    tenant_id: tenantId,
    fornecedor_id: fornecedorId,
    external_id: String(produto.idProduto),
    external_code: produto.codErp || null,
    source: "jng",
    last_synced_at: new Date().toISOString(),
    fabricante: produto.marcaPainel || produto.marca || null,
    marca: produto.marca || null,
    tipo: produto.agrupamento || produto.categoria || null,
    potencia_inversor: null,
    potencia_modulo: null,
    fase: produto.fase ? String(produto.fase) : null,
    tensao: produto.tensao ? String(produto.tensao) : null,
    estrutura: produto.estrutura || null,
    preco_consumidor: null,
    valor_avulso: null,
    disponivel: (produto.estoque || 0) > 0,
    permite_compra_sem_estoque: false,
    previsao: produto.dtDisponibilidade || null,
    product_kind: classification.product_kind,
    is_generator: classification.is_generator,
    is_available_now: isAvailableNow,
    preco_por_kwp: precoPorKwp,
    imagem_principal_url: produto.fotoUrl || null,
    thumbnail_url: produto.fotoUrl || null,
    external_data: {
      idProduto: produto.idProduto,
      agrupamento: produto.agrupamento,
      categoria: produto.categoria,
      marca: produto.marca,
      marcaPainel: produto.marcaPainel,
      marcaInversor: produto.marcaInversor,
      potencia: produto.potencia,
      estoque: produto.estoque,
      precoVenda: precoVenda,
      tensao: produto.tensao,
      fase: produto.fase,
      estrutura: produto.estrutura,
      composicaoLength: produto.composicao?.length ?? 0,
    },
  };
}

// ── Map kit items ───────────────────────────────────────────
function buildKitItems(produto: JngProduto): KitItem[] {
  if (!Array.isArray(produto.composicao) || produto.composicao.length === 0) return [];

  return produto.composicao.map((item: ProdutoComposicaoHubB2B) => {
    const agrup = (item.agrupamento || "").toLowerCase();
    const cat = (item.categoria || "").toLowerCase();
    const desc = (item.descricao || "").toLowerCase();
    let itemType = "outro";
    if (agrup.includes("módulo") || agrup.includes("modulo") ||
        agrup.includes("painel") || cat.includes("módulo") || cat.includes("painel")) {
      itemType = "modulo";
    } else if (agrup.includes("inversor") || cat.includes("inversor")) {
      itemType = "inversor";
    } else if (agrup.includes("estrutura") || cat.includes("estrutura") ||
               desc.includes("estrutura") || desc.includes("fixação") || desc.includes("fixacao")) {
      itemType = "estrutura";
    }
    return {
      item_type: itemType,
      description: item.descricao || `Item ${item.idProduto}`,
      quantity: item.qtd || 1,
      unit_price: 0,
      ref_id: String(item.idProduto),
    };
  });
}

// ── Provider Adapter Factory ────────────────────────────────
function createJngAdapter(): ProviderAdapter {
  return {
    normalize: (raw, tenantId, fornecedorId) =>
      mapToKit(raw as JngProduto, tenantId, fornecedorId),
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
      mode = "full_replace",
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
    // fornecedor_id is optional for JNG HubB2B — products are imported with source='jng'

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
    // IBGE comes from request body context (municipality of delivery), NOT from credentials
    const ibge = body.ibge || null;
    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: "Token não encontrado nas credenciais", code: "MISSING_TOKEN" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Test-only mode — usa /hubB2B/Categoria (não precisa de ibge) ──
    if (test_only) {
      try {
        const testUrl = `${JNG_BASE}/hubB2B/Categoria?token=${encodeURIComponent(token)}`;
        // console.log("[jng] test URL:", testUrl);
        const testRes = await fetch(testUrl);
        if (!testRes.ok) {
          const body = await testRes.text();
          throw new Error(`${testRes.status} ${body}`);
        }
        const testData = await testRes.json();
        const categorias = Array.isArray(testData) ? testData.length : 0;
        await syncLog(supabase, tenant_id, "info",
          "Teste de conexão JNG realizado com sucesso", {
          categorias,
        });
        return new Response(
          JSON.stringify({
            success: true,
            test: true,
            message: `Conexão JNG validada. ${categorias} categorias disponíveis.`
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (e: any) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Falha na conexão JNG: ${e.message}`,
            code: "AUTH_FAILED"
          }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Adapter
    const jngAdapter = createJngAdapter();

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

    if (isNewSync) {
      const stateData = {
        tenant_id,
        provider: "jng",
        mode,
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

      await syncLog(supabase, tenant_id, "info", `Sincronização JNG iniciada (modo: ${mode})`, { mode });
    } else if (syncState.status === "running") {
      await supabase
        .from("integration_sync_state")
        .update({ last_run_at: new Date().toISOString() })
        .eq("id", syncState.id);
    }

    // ── Fetch único — Plataforma-V1 não tem paginação ──
    let batchProducts: any[] = [];
    try {
      batchProducts = await fetchJngKits(token, ibge);
      // console.log(`[jng-hub-sync] Fetched ${batchProducts.length} kits`);
      await syncLog(supabase, tenant_id, "info",
        `${batchProducts.length} kits retornados pela API`, {
        count: batchProducts.length,
      });
    } catch (e: any) {
      console.error("[jng-hub-sync] Error fetching kits:", e);
      await syncLog(supabase, tenant_id, "error", "Erro ao buscar kits JNG", {
        error: e.message,
      });
      await supabase.from("integration_sync_state")
        .update({ status: "error", last_error: e.message, last_run_at: new Date().toISOString() })
        .eq("id", syncState.id);
      return new Response(
        JSON.stringify({ success: false, error: e.message, code: "FETCH_ERROR" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
    const newState: any = {
      processed_items: (syncState.processed_items || 0) + batchProducts.length,
      inserted_items: (syncState.inserted_items || 0) + created,
      updated_items: (syncState.updated_items || 0) + updated,
      ignored_items: (syncState.ignored_items || 0) + skipped,
      last_run_at: new Date().toISOString(),
      status: "completed",
      completed_at: new Date().toISOString(),
    };

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

    await supabase
      .from("integration_sync_state")
      .update(newState)
      .eq("id", syncState.id);

    const msg = `Sincronização JNG concluída: ${newState.inserted_items} criados, ${newState.updated_items} atualizados, ${newState.ignored_items} ignorados`;

    await syncLog(supabase, tenant_id, "info", msg, {
      created,
      updated,
      skipped,
    });

    console.log(`[jng-hub-sync] ${msg}`);

    return new Response(
      JSON.stringify({
        success: true,
        is_complete: true,
        total_fetched: batchProducts.length,
        created,
        updated,
        skipped,
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
