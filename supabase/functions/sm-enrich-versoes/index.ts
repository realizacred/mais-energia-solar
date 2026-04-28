/**
 * sm-enrich-versoes
 *
 * Enriquece propostas SOLARMARKET migradas, populando campos vazios em
 * `proposta_versoes` e (re)criando `proposta_kits`/`proposta_kit_itens`,
 * `proposta_versao_ucs` e atualizando `projetos` com endereço/lat/lng.
 *
 * Fontes de dados:
 *  • payload.pricingTable[]  → kit completo (módulos, inversores, cabos, estruturas)
 *  • payload.variables[]     → consumo, tarifa, geração, payback, tir, vpl, etc.
 *  • payload.project / cliente_* → endereço, cidade, UF
 *
 * Estratégia: SOBRESCREVE TUDO (decisão do usuário). Idempotente — pode rodar várias vezes.
 *
 * Modo: { action: "enrich", payload: { batch?: number, offset?: number, dry_run?: boolean } }
 *
 * Governança:
 *   - RB-23 (sem console.log ativo)
 *   - RB-57 (sem let no escopo de módulo)
 *   - RB-58 (UPDATE crítico verifica .select() count)
 *   - RB-04 (queries em hooks no front)
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface EnrichResult {
  ok: boolean;
  processed: number;
  versoes_updated: number;
  kits_created: number;
  kit_itens_inserted: number;
  ucs_inserted: number;
  projetos_updated: number;
  errors: Array<{ projeto_id?: string; deal_id?: string; error: string }>;
  next_offset: number | null;
  duration_ms: number;
  error?: string;
}

// ─────────────────────────────────────────── Helpers ───

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).replace(/\s/g, "");
  // Lida com BR (1.234,56) e US (1,234.56) e científico
  let normalized = s;
  if (/,/.test(s) && /\./.test(s)) {
    // formato BR: 1.234,56  → remove ponto, vírgula vira ponto
    normalized = s.replace(/\./g, "").replace(",", ".");
  } else if (/,\d{1,3}$/.test(s) && !/\./.test(s)) {
    // formato BR sem milhar: 12,34
    normalized = s.replace(",", ".");
  }
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

function toInt(v: unknown): number | null {
  const n = toNumber(v);
  return n === null ? null : Math.round(n);
}

/**
 * Mapeia "tipo" do SolarMarket (BT/MT/AT) para o grupo canônico (B/A).
 * proposta_versoes.grupo aceita apenas 'A', 'B' ou NULL.
 */
function mapGrupo(raw: string | null | undefined): "A" | "B" | null {
  if (!raw) return null;
  const s = String(raw).trim().toUpperCase();
  if (s === "A" || s === "B") return s;
  if (s === "BT") return "B";
  if (s === "MT" || s === "AT") return "A";
  return null;
}

interface VarMap {
  get(key: string): string | null;
  num(key: string): number | null;
  int(key: string): number | null;
}

function buildVarMap(variables: any[]): VarMap {
  const map = new Map<string, string>();
  for (const v of variables ?? []) {
    const k = v?.key as string | undefined;
    if (!k) continue;
    const val = v?.value;
    if (val === null || val === undefined || val === "") continue;
    map.set(k, String(val));
  }
  return {
    get: (k: string) => map.get(k) ?? null,
    num: (k: string) => toNumber(map.get(k)),
    int: (k: string) => toInt(map.get(k)),
  };
}

// Categoriza item da pricingTable do SM em categoria canônica nossa.
// Categorias aceitas pelo BD: modulo, inversor, otimizador, estrutura, componente, bateria.
function categorizar(category: string, item: string): string {
  const c = (category || "").toLowerCase();
  const it = (item || "").toLowerCase();
  if (c.includes("módulo") || c.includes("modulo") || c.includes("painel")) return "modulo";
  if (c.includes("microinversor") || it.includes("microinversor")) return "inversor";
  if (c.includes("inversor")) return "inversor";
  if (c.includes("otimizador") || it.includes("otimizador") || it.includes("optimizer")) return "otimizador";
  if (c.includes("bateria")) return "bateria";
  if (c.includes("estrutura") || it.includes("estrutura") || it.includes("trilho") || it.includes("telha"))
    return "estrutura";
  // Cabos, conectores, string box, disjuntores e quaisquer outros itens BoS → componente.
  return "componente";
}

// Extrai fabricante + modelo do "item" do SM. Geralmente vem "FABRICANTE MODELO".
function splitFabricanteModelo(item: string): { fabricante: string | null; modelo: string } {
  const trimmed = (item || "").trim();
  if (!trimmed) return { fabricante: null, modelo: "" };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { fabricante: null, modelo: parts[0] };
  return {
    fabricante: parts[0],
    modelo: parts.slice(1).join(" "),
  };
}

// ─────────────────────────────────────────── Handler ───

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startedAt = Date.now();

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const action = body?.action ?? "enrich";
    const payload = body?.payload ?? {};
    const batch = Math.min(Math.max(Number(payload.batch ?? 25), 1), 100);
    const offset = Math.max(Number(payload.offset ?? 0), 0);
    const dryRun = payload.dry_run === true;
    const tenantIdFilter = typeof payload.tenant_id === "string" && payload.tenant_id.trim()
      ? payload.tenant_id.trim()
      : null;
    const projectExternalIdsFilter = Array.isArray(payload.project_external_ids)
      ? payload.project_external_ids.map((id: unknown) => String(id).trim()).filter(Boolean).slice(0, 25)
      : [];

    if (action !== "enrich") {
      return new Response(
        JSON.stringify({ ok: false, error: `Unknown action: ${action}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 1. Buscar lote de propostas_nativas SM.
    //    Neste tenant a proposta nativa usa external_id = sm_project_id.
    let propostasQuery = supabase
      .from("propostas_nativas")
      .select("id, projeto_id, tenant_id, external_id, deal_id")
      .eq("external_source", "solarmarket")
      .order("id", { ascending: true });
    if (tenantIdFilter) propostasQuery = propostasQuery.eq("tenant_id", tenantIdFilter);
    if (projectExternalIdsFilter.length > 0) propostasQuery = propostasQuery.in("external_id", projectExternalIdsFilter);
    const { data: propostas, error: propErr } = await propostasQuery
      .range(offset, offset + batch - 1);

    if (propErr) throw propErr;
    if (!propostas || propostas.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          processed: 0,
          versoes_updated: 0,
          kits_created: 0,
          kit_itens_inserted: 0,
          ucs_inserted: 0,
          projetos_updated: 0,
          errors: [],
          next_offset: null,
          duration_ms: Date.now() - startedAt,
        } satisfies EnrichResult),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const projectExternalIds = propostas
      .map((p) => p.external_id)
      .filter((x): x is string => !!x);

    // PostgREST: `.in()` não funciona em operador JSON `->>` (silenciosamente retorna 0 linhas).
    // Usamos `.filter("col", "in", "(a,b,c)")` com a sintaxe nativa do PostgREST.
    // Valores são quoted para suportar IDs com caracteres especiais.
    const inList = projectExternalIds
      .map((id) => `"${String(id).replace(/"/g, '\\"')}"`)
      .join(",");
    const { data: stagingRows, error: stErr } = projectExternalIds.length === 0
      ? { data: [] as any[], error: null }
      : await supabase
          .from("sm_propostas_raw")
          .select("payload")
          .filter("payload->>_sm_project_id", "in", `(${inList})`);

    if (stErr) throw stErr;

    const stagingByProjectExt = new Map<string, any>();
    for (const row of stagingRows ?? []) {
      const p = (row as any).payload;
      const ext = String(p?._sm_project_id ?? p?.project?.id ?? "");
      if (!ext) continue;
      stagingByProjectExt.set(ext, p);
    }

    // 3. Carregar versão atual de cada proposta (uma por proposta — versao_atual).
    const propIds = propostas.map((p) => p.id);
    const { data: versoes, error: vErr } = await supabase
      .from("proposta_versoes")
      .select("id, proposta_id, tenant_id")
      .in("proposta_id", propIds);
    if (vErr) throw vErr;

    const versaoByProp = new Map<string, { id: string; tenant_id: string }>();
    for (const v of versoes ?? []) {
      versaoByProp.set(v.proposta_id as string, {
        id: v.id as string,
        tenant_id: v.tenant_id as string,
      });
    }

    const counters = {
      processed: 0,
      versoes_updated: 0,
      kits_created: 0,
      kit_itens_inserted: 0,
      ucs_inserted: 0,
      projetos_updated: 0,
    };
    const errors: EnrichResult["errors"] = [];

    for (const prop of propostas) {
      counters.processed++;
      const propId = prop.id as string;
      const projetoId = prop.projeto_id as string;
      const dealId = prop.deal_id as string | null;
      const tenantId = prop.tenant_id as string;
      const sm = stagingByProjectExt.get(String(prop.external_id ?? ""));
      const versao = versaoByProp.get(propId);

      if (!sm || !versao) continue;

      try {
        const variables: any[] = Array.isArray(sm?.variables) ? sm.variables : [];
        const pricing: any[] = Array.isArray(sm?.pricingTable) ? sm.pricingTable : [];
        const v = buildVarMap(variables);

        // ─── 3a. Calcular agregados financeiros do pricingTable ───
        let valorTotal = 0;
        let custoTotal = 0;
        let lucroTotal = 0;
        for (const row of pricing) {
          valorTotal += toNumber(row?.salesValue) ?? 0;
          custoTotal += toNumber(row?.totalCost) ?? 0;
          lucroTotal += toNumber(row?.profit) ?? 0;
        }
        // Fallbacks do SM: preço total costuma vir em `preco`.
        if (custoTotal === 0) custoTotal = v.num("kits_custo_total") ?? 0;
        if (valorTotal === 0) valorTotal = v.num("preco") ?? v.num("preco_total") ?? v.num("preco_kits") ?? 0;

        // ─── 3b. Calcular potência e geração ───
        // Soma potencias dos módulos: qnt * potencia_w
        let potenciaWp = 0;
        let qtdModulosTotal = 0;
        for (const row of pricing) {
          const cat = categorizar(String(row?.category ?? ""), String(row?.item ?? ""));
          if (cat === "modulo") {
            const qnt = toNumber(row?.qnt) ?? 0;
            qtdModulosTotal += qnt;
            // Tenta extrair "555" do nome "SUNOVA SS-555-72MDH" como fallback
            const matchPot = String(row?.item ?? "").match(/[-\s](\d{3,4})[-\sW]/);
            const potUn = matchPot ? toNumber(matchPot[1]) ?? 0 : 0;
            potenciaWp += qnt * potUn;
          }
        }
        // Fallback: variáveis do SM; potência total costuma vir pronta em `potencia_sistema`.
        if (potenciaWp === 0) {
          const potSistema = v.num("potencia_sistema");
          if (potSistema && potSistema > 0) {
            potenciaWp = potSistema >= 100 ? potSistema : potSistema * 1000;
          } else {
            const potMod = v.num("modulo_potencia") ?? 0;
            const qtdMod = v.num("modulo_quantidade") ?? v.num("modulo_qtd") ?? 0;
            potenciaWp = potMod * qtdMod;
            if (qtdModulosTotal === 0) qtdModulosTotal = qtdMod;
          }
        }
        const potenciaKwp = potenciaWp > 0 ? potenciaWp / 1000 : null;

        // Geração mensal: pega a média do array s_geracao_mensal se existir, senão geracao_mensal
        let geracaoMensal: number | null = v.num("geracao_mensal");
        const sGeracaoStr = v.get("s_geracao_mensal");
        if (sGeracaoStr) {
          try {
            const arr = JSON.parse(sGeracaoStr);
            if (Array.isArray(arr) && arr.length > 0) {
              const soma = arr.reduce((a, b) => a + (Number(b) || 0), 0);
              geracaoMensal = soma / arr.length;
            }
          } catch {
            /* ignore */
          }
        }
        const geracaoAnual = geracaoMensal ? geracaoMensal * 12 : v.num("geracao_anual_0");

        // Payback: vem como "X meses" ou número (anos) → guardar em meses
        const paybackRaw = v.get("payback") ?? "";
        let paybackMeses: number | null = null;
        const matchMes = paybackRaw.match(/(\d+(?:[.,]\d+)?)\s*mes/i);
        const matchAno = paybackRaw.match(/(\d+(?:[.,]\d+)?)\s*ano/i);
        if (matchMes) paybackMeses = toInt(matchMes[1]);
        else if (matchAno) {
          const anos = toNumber(matchAno[1]) ?? 0;
          paybackMeses = Math.round(anos * 12);
        } else {
          const n = toNumber(paybackRaw);
          paybackMeses = n !== null ? Math.round(n * 12) : null; // assume anos
        }

        // ─── 3c. UPDATE proposta_versoes ───
        const versaoUpdate: Record<string, any> = {
          valor_total: valorTotal > 0 ? valorTotal : null,
          potencia_kwp: potenciaKwp,
          geracao_mensal: geracaoMensal,
          geracao_anual: geracaoAnual,
          payback_meses: paybackMeses,
          tir: v.num("tir"),
          vpl: v.num("vpl"),
          economia_mensal: v.num("economia_mensal") ?? v.num("s_economia_mensal"),
          consumo_mensal: v.num("consumo_mensal"),
          tarifa_distribuidora: v.num("tarifa_distribuidora"),
          distribuidora_nome: v.get("dis_energia"),
          grupo: mapGrupo(v.get("tipo")), // BT→B, MT/AT→A
        };

        if (!dryRun) {
          const { error: upVErr, data: upVData } = await supabase
            .from("proposta_versoes")
            .update(versaoUpdate)
            .eq("id", versao.id)
            .select("id");
          if (upVErr) throw upVErr;
          if (upVData && upVData.length > 0) counters.versoes_updated++;

          // ─── 3d. (RE)CRIAR Kit ───
          // Apaga kit anterior dessa versão (e itens em cascata) — garante idempotência.
          const { data: oldKits } = await supabase
            .from("proposta_kits")
            .select("id")
            .eq("versao_id", versao.id);
          if (oldKits && oldKits.length > 0) {
            const oldKitIds = oldKits.map((k) => k.id as string);
            await supabase.from("proposta_kit_itens").delete().in("kit_id", oldKitIds);
            await supabase.from("proposta_kits").delete().in("id", oldKitIds);
          }

          if (pricing.length > 0) {
            // Inserir 1 kit
            const { data: kitIns, error: kitErr } = await supabase
              .from("proposta_kits")
              .insert({
                versao_id: versao.id,
                tenant_id: tenantId,
                tipo_kit: "customizado",
                tipo_sistema: "on_grid",
              })
              .select("id")
              .single();
            if (kitErr) throw kitErr;
            counters.kits_created++;

            const itens = pricing.map((row, idx) => {
              const item = String(row?.item ?? "");
              const cat = categorizar(String(row?.category ?? ""), item);
              const { fabricante, modelo } = splitFabricanteModelo(item);
              const qnt = toInt(row?.qnt) ?? 1;
              const unit = toNumber(row?.salesValue) ?? toNumber(row?.unitCost) ?? 0;
              const totalCost = toNumber(row?.totalCost) ?? 0;
              const totalSale = toNumber(row?.salesValue) ?? 0;
              const precoUn = qnt > 0 ? totalSale / qnt : unit;

              // Tenta inferir potencia_w do nome (ex: "SUNOVA SS-555-72MDH")
              let potW: number | null = null;
              if (cat === "modulo") {
                const m = item.match(/[-\s](\d{3,4})[-\sW]/);
                potW = m ? toNumber(m[1]) : null;
              } else if (cat === "inversor") {
                const m = item.match(/(\d{1,3})K/i);
                potW = m ? (toNumber(m[1]) ?? 0) * 1000 : null;
              }

              return {
                kit_id: kitIns!.id,
                tenant_id: tenantId,
                categoria: cat,
                produto_ref: null,
                descricao: item,
                fabricante,
                modelo,
                potencia_w: potW,
                quantidade: qnt,
                preco_unitario: precoUn,
                avulso: false,
                ordem: idx,
              };
            });

            // Insere em lotes de 100
            for (let i = 0; i < itens.length; i += 100) {
              const slice = itens.slice(i, i + 100);
              const { error: itErr, data: itData } = await supabase
                .from("proposta_kit_itens")
                .insert(slice)
                .select("id");
              if (itErr) throw itErr;
              counters.kit_itens_inserted += itData?.length ?? 0;
            }
          }

          // ─── 3e. (RE)CRIAR proposta_versao_ucs (1 UC mínima) ───
          await supabase.from("proposta_versao_ucs").delete().eq("versao_id", versao.id);
          const consumoUc1 = v.num("consumo_mensal_uc1") ?? v.num("consumo_mensal");
          const tarifaUc1 = v.num("tarifa_distribuidora_uc1") ?? v.num("tarifa_distribuidora");
          if (consumoUc1 || tarifaUc1) {
            const { error: ucErr } = await supabase.from("proposta_versao_ucs").insert({
              versao_id: versao.id,
              tenant_id: tenantId,
              ordem: 1,
              nome: "UC 1",
              numero_uc: v.get("numero_uc_uc1") ?? v.get("numero_uc"),
              titular: v.get("titular_uc1") ?? v.get("cliente_nome"),
              tipo_ligacao: v.get("tipo_uc1") ?? v.get("tipo"),
              grupo: mapGrupo(v.get("subgrupo_uc1") ?? v.get("tipo")),
              consumo_mensal_kwh: consumoUc1,
              consumo_ponta_kwh: v.num("consumo_mensal_p_uc1"),
              consumo_fora_ponta_kwh: v.num("consumo_mensal_fp_uc1"),
              tarifa_energia: tarifaUc1,
              tarifa_ponta: v.num("tarifa_te_p_uc1") ?? v.num("tarifa_distribuidora_p"),
              tarifa_fora_ponta: v.num("tarifa_te_fp_uc1") ?? v.num("tarifa_distribuidora_fp"),
              percentual_atendimento: 100,
            });
            if (ucErr) {
              errors.push({
                projeto_id: projetoId,
                deal_id: dealId ?? undefined,
                error: `UC: ${ucErr.message}`,
              });
            } else {
              counters.ucs_inserted++;
            }
          }

          // ─── 3f. Marcar proposta como principal (RB-59) ───
          await supabase
            .from("propostas_nativas")
            .update({ is_principal: true })
            .eq("id", propId);

          // ─── 3g. UPDATE projetos (endereço/cidade/UF + potência/módulos + proposta_id) ───
          const projUpdate: Record<string, any> = {
            cidade_instalacao: v.get("cliente_cidade") ?? v.get("cidade"),
            uf_instalacao: v.get("cliente_estado"),
            cep_instalacao: v.get("cliente_cep"),
            rua_instalacao: v.get("cliente_endereco"),
            numero_instalacao: v.get("cliente_numero"),
            bairro_instalacao: v.get("cliente_bairro"),
            complemento_instalacao: v.get("cliente_complemento"),
            potencia_kwp: potenciaKwp,
            numero_modulos: qtdModulosTotal > 0 ? qtdModulosTotal : null,
            modelo_modulos: v.get("modulo_fabricante") && v.get("modulo_modelo")
              ? `${v.get("modulo_fabricante")} ${v.get("modulo_modelo")}`
              : null,
            modelo_inversor: v.get("inversor_fabricante") && v.get("inversor_modelo")
              ? `${v.get("inversor_fabricante")} ${v.get("inversor_modelo")}`
              : null,
            valor_total: valorTotal > 0 ? valorTotal : null,
            geracao_mensal_media_kwh: geracaoMensal,
            proposta_id: propId, // RB-60: vincula projeto à proposta principal
          };
          // Remove chaves null/undefined para não sobrescrever com NULL.
          for (const k of Object.keys(projUpdate)) {
            if (projUpdate[k] === null || projUpdate[k] === undefined) delete projUpdate[k];
          }
          if (Object.keys(projUpdate).length > 0) {
            const { error: pErr, data: pData } = await supabase
              .from("projetos")
              .update(projUpdate)
              .eq("id", projetoId)
              .select("id");
            if (pErr) {
              errors.push({
                projeto_id: projetoId,
                deal_id: dealId ?? undefined,
                error: `Projeto: ${pErr.message}`,
              });
            } else if (pData && pData.length > 0) {
              counters.projetos_updated++;
            }
          }
        }
      } catch (e: any) {
        const msg = e instanceof Error
          ? e.message
          : (e?.message || e?.error_description || JSON.stringify(e));
        errors.push({
          projeto_id: projetoId,
          deal_id: dealId ?? undefined,
          error: msg,
        });
      }
    }

    const nextOffset = projectExternalIdsFilter.length > 0 || propostas.length < batch ? null : offset + batch;

    return new Response(
      JSON.stringify({
        ok: true,
        ...counters,
        errors,
        next_offset: nextOffset,
        duration_ms: Date.now() - startedAt,
      } satisfies EnrichResult),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[sm-enrich-versoes] Error:", msg);
    return new Response(
      JSON.stringify({
        ok: false,
        processed: 0,
        versoes_updated: 0,
        kits_created: 0,
        kit_itens_inserted: 0,
        ucs_inserted: 0,
        projetos_updated: 0,
        errors: [],
        next_offset: null,
        duration_ms: Date.now() - startedAt,
        error: msg,
      } satisfies EnrichResult),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
