import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type EquipmentType = "modulo" | "inversor" | "otimizador" | "bateria";

interface RequestBody {
  equipment_type: EquipmentType;
  equipment_id: string;
  tenant_id: string;
  force_refresh?: boolean;
}

const TABLE_MAP: Record<EquipmentType, string> = {
  modulo: "modulos_solares",
  inversor: "inversores_catalogo",
  otimizador: "otimizadores_catalogo",
  bateria: "baterias",
};

// ── Prompts ──────────────────────────────────────────────────────

function buildPrompt(type: EquipmentType, fabricante: string, modelo: string): { system: string; user: string } {
  const system = "Você é um especialista em energia solar. Busque as especificações técnicas do equipamento indicado. Retorne APENAS um JSON válido com os campos solicitados. Se não encontrar um valor, use null. Não invente dados. REGRA CRÍTICA SOBRE datasheet_url: NÃO retorne URLs de datasheet. Sempre retorne null para datasheet_url. URLs inventadas ou desatualizadas causam erros no sistema. O sistema buscará o datasheet por conta própria.";

  const specs: Record<EquipmentType, string> = {
    modulo: `{
  "potencia_wp": number,
  "eficiencia_percent": number,
  "voc_v": number,
  "isc_a": number,
  "vmp_v": number,
  "imp_a": number,
  "num_celulas": number,
  "comprimento_mm": number,
  "largura_mm": number,
  "profundidade_mm": number,
  "peso_kg": number,
  "tipo_celula": string,
  "bifacial": boolean,
  "tensao_sistema": string,
  "garantia_produto_anos": number,
  "garantia_performance_anos": number,
  "temp_coeff_pmax": number,
  "temp_coeff_voc": number,
  "temp_coeff_isc": number,
  "datasheet_url": string
}`,
    inversor: `{
  "potencia_nominal_kw": number,
  "potencia_maxima_kw": number,
  "eficiencia_max_percent": number,
  "tensao_entrada_max_v": number,
  "tensao_mppt_min_v": number,
  "tensao_mppt_max_v": number,
  "corrente_entrada_max_a": number,
  "mppt_count": number,
  "strings_por_mppt": number,
  "fases": string,
  "tensao_saida_v": number,
  "corrente_saida_a": number,
  "fator_potencia": number,
  "ip_protection": string,
  "peso_kg": number,
  "dimensoes_mm": string,
  "wifi_integrado": boolean,
  "garantia_anos": number,
  "datasheet_url": string
}`,
    otimizador: `{
  "potencia_wp": number,
  "tensao_entrada_max_v": number,
  "corrente_entrada_max_a": number,
  "tensao_saida_v": number,
  "corrente_saida_max_a": number,
  "eficiencia_percent": number,
  "compatibilidade": string,
  "ip_protection": string,
  "dimensoes_mm": string,
  "peso_kg": number,
  "garantia_anos": number,
  "datasheet_url": string
}`,
    bateria: `{
  "tipo_bateria": string,
  "energia_kwh": number,
  "tensao_nominal_v": number,
  "tensao_carga_v": number,
  "tensao_operacao_v": string,
  "potencia_max_saida_kw": number,
  "corrente_max_descarga_a": number,
  "corrente_max_carga_a": number,
  "dimensoes_mm": string,
  "garantia_anos": number,
  "datasheet_url": string
}`,
  };

  const user = `Fabricante: ${fabricante}\nModelo: ${modelo}\n\nRetorne JSON com exatamente estas chaves (null se não encontrar):\n${specs[type]}`;

  return { system, user };
}

// ── Validation ranges ────────────────────────────────────────────

interface Range { min: number; max: number }

const MODULO_RANGES: Record<string, Range> = {
  potencia_wp: { min: 50, max: 1000 },
  eficiencia_percent: { min: 10, max: 30 },
  voc_v: { min: 20, max: 120 },
  isc_a: { min: 1, max: 30 },
  vmp_v: { min: 15, max: 100 },
  imp_a: { min: 1, max: 25 },
  num_celulas: { min: 30, max: 250 },
  comprimento_mm: { min: 1000, max: 3000 },
  largura_mm: { min: 500, max: 2000 },
  profundidade_mm: { min: 20, max: 60 },
  peso_kg: { min: 5, max: 50 },
  garantia_produto_anos: { min: 5, max: 30 },
  garantia_performance_anos: { min: 20, max: 40 },
  temp_coeff_pmax: { min: -0.6, max: -0.2 },
  temp_coeff_voc: { min: -0.5, max: -0.1 },
  temp_coeff_isc: { min: 0.01, max: 0.15 },
};

const GENERATED_COLUMNS: Record<EquipmentType, string[]> = {
  modulo: ["area_m2"],
  inversor: [],
  otimizador: [],
  bateria: [],
};

const INVERSOR_RANGES: Record<string, Range> = {
  potencia_nominal_kw: { min: 0.3, max: 10000 },
  potencia_maxima_kw: { min: 0.3, max: 12000 },
  eficiencia_max_percent: { min: 90, max: 99.9 },
  tensao_entrada_max_v: { min: 100, max: 1500 },
  tensao_mppt_min_v: { min: 50, max: 600 },
  tensao_mppt_max_v: { min: 200, max: 1500 },
  corrente_entrada_max_a: { min: 1, max: 100 },
  mppt_count: { min: 1, max: 20 },
  strings_por_mppt: { min: 1, max: 10 },
  corrente_saida_a: { min: 1, max: 200 },
  fator_potencia: { min: 0.8, max: 1.0 },
  peso_kg: { min: 2, max: 500 },
  garantia_anos: { min: 5, max: 25 },
};

const OTIMIZADOR_RANGES: Record<string, Range> = {
  potencia_wp: { min: 50, max: 500 },
  tensao_entrada_max_v: { min: 20, max: 120 },
  corrente_entrada_max_a: { min: 1, max: 30 },
  tensao_saida_v: { min: 20, max: 120 },
  corrente_saida_max_a: { min: 1, max: 30 },
  eficiencia_percent: { min: 90, max: 99.9 },
  peso_kg: { min: 0.5, max: 10 },
  garantia_anos: { min: 5, max: 30 },
};

const BATERIA_RANGES: Record<string, Range> = {
  energia_kwh: { min: 0.5, max: 500 },
  tensao_nominal_v: { min: 12, max: 1000 },
  tensao_carga_v: { min: 12, max: 1000 },
  potencia_max_saida_kw: { min: 0.3, max: 250 },
  corrente_max_descarga_a: { min: 1, max: 500 },
  corrente_max_carga_a: { min: 1, max: 500 },
  garantia_anos: { min: 1, max: 25 },
};

const RANGES_MAP: Record<EquipmentType, Record<string, Range>> = {
  modulo: MODULO_RANGES,
  inversor: INVERSOR_RANGES,
  otimizador: OTIMIZADOR_RANGES,
  bateria: BATERIA_RANGES,
};

function validateSpecs(specs: Record<string, unknown>, type: EquipmentType): Record<string, unknown> {
  const ranges = RANGES_MAP[type];
  const validated: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(specs)) {
    if (value === null || value === undefined) {
      validated[key] = null;
      continue;
    }
    const range = ranges[key];
    if (range && typeof value === "number") {
      validated[key] = value >= range.min && value <= range.max ? value : null;
    } else {
      validated[key] = value;
    }
  }

  return validated;
}

function extractJSON(raw: string): Record<string, unknown> | null {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

// ── Dual AI call ─────────────────────────────────────────────────

interface AICallResult {
  parsed: Record<string, unknown> | null;
  provider: string;
  model: string;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  error?: string;
}

function countFilledFields(obj: Record<string, unknown> | null): number {
  if (!obj) return 0;
  return Object.values(obj).filter(v => v !== null && v !== undefined).length;
}

async function callAIProvider(
  provider: "gemini" | "openai",
  model: string,
  system: string,
  user: string,
  apiKey: string,
): Promise<AICallResult> {
  const providerLabel = provider === "gemini" ? "lovable_gateway" : "lovable_gateway";
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return { parsed: null, provider: providerLabel, model, usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }, error: `${res.status} - ${errorText}` };
    }

    const data = await res.json();
    const rawContent = data.choices?.[0]?.message?.content || "";
    const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    const parsed = extractJSON(rawContent);

    return { parsed, provider: providerLabel, model, usage };
  } catch (err: any) {
    return { parsed: null, provider: providerLabel, model, usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }, error: err.message };
  }
}

function mergeResults(
  r1: Record<string, unknown> | null,
  r2: Record<string, unknown> | null,
): Record<string, unknown> {
  if (!r1 && !r2) return {};
  if (!r1) return r2!;
  if (!r2) return r1;

  const count1 = countFilledFields(r1);
  const count2 = countFilledFields(r2);
  // Primary = the one with more filled fields
  const primary = count1 >= count2 ? r1 : r2;
  const secondary = count1 >= count2 ? r2 : r1;

  const merged: Record<string, unknown> = { ...primary };
  // Fill gaps from secondary
  for (const [key, value] of Object.entries(secondary)) {
    if ((merged[key] === null || merged[key] === undefined) && value !== null && value !== undefined) {
      merged[key] = value;
    }
  }
  return merged;
}

// ── Datasheet validation & download ──────────────────────────────

async function validateDatasheetUrl(url: string): Promise<{ valid: boolean; reason?: string }> {
  try {
    // Block known dead/unreliable domains
    const blocklist = ["aesolar.com", "ae-solar.com", "longisolartechnology.com", "jinkosolarglobal.com", "solisinverters.com", "deyeinverter.com", "goodwe.com", "energiasolarphb.com.br", "huawei.com"];
    const urlHost = new URL(url).hostname.replace("www.", "");
    if (blocklist.some(d => urlHost.includes(d))) {
      return { valid: false, reason: `blocked domain: ${urlHost}` };
    }

    // Try HEAD first
    let res: Response;
    try {
      res = await fetch(url, {
        method: "HEAD",
        signal: AbortSignal.timeout(8000),
        headers: { "User-Agent": "Mozilla/5.0 (compatible; EnrichBot/1.0)" },
      });
    } catch {
      // HEAD failed (connection refused, DNS, etc) — try GET as fallback
      try {
        res = await fetch(url, {
          method: "GET",
          signal: AbortSignal.timeout(10000),
          headers: { "User-Agent": "Mozilla/5.0 (compatible; EnrichBot/1.0)", "Range": "bytes=0-1024" },
        });
      } catch (err2: any) {
        return { valid: false, reason: `connection failed: ${err2.message}` };
      }
    }

    if (res.status !== 200 && res.status !== 206) {
      return { valid: false, reason: `HTTP ${res.status}` };
    }

    const contentType = res.headers.get("content-type") || "";
    const isPdf = contentType.includes("application/pdf") ||
                  contentType.includes("application/octet-stream") ||
                  url.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      return { valid: false, reason: `not PDF: content-type=${contentType}` };
    }

    const contentLength = parseInt(res.headers.get("content-length") || "0", 10);
    if (contentLength > 0 && contentLength < 10000) {
      return { valid: false, reason: `too small: ${contentLength} bytes` };
    }

    return { valid: true };
  } catch (err: any) {
    return { valid: false, reason: `validation error: ${err.message}` };
  }
}

async function downloadAndStorePDF(
  sourceUrl: string,
  equipment_type: string,
  fabricante: string,
  modelo: string,
  supabase: any,
): Promise<{ publicUrl: string | null; storagePath: string | null }> {
  try {
    const pdfRes = await fetch(sourceUrl, {
      signal: AbortSignal.timeout(30000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; EnrichBot/1.0)" },
    });

    if (!pdfRes.ok) {
      console.warn(`[enrich-equipment] PDF GET failed: ${pdfRes.status}`);
      await pdfRes.text(); // consume body
      return { publicUrl: null, storagePath: null };
    }

    const pdfBuffer = await pdfRes.arrayBuffer();

    if (pdfBuffer.byteLength < 10000) {
      console.warn(`[enrich-equipment] PDF too small: ${pdfBuffer.byteLength} bytes`);
      return { publicUrl: null, storagePath: null };
    }
    if (pdfBuffer.byteLength > 20 * 1024 * 1024) {
      console.warn(`[enrich-equipment] PDF too large: ${pdfBuffer.byteLength} bytes`);
      return { publicUrl: null, storagePath: null };
    }

    const safeName = (s: string) =>
      s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
    const storagePath = `${equipment_type}/${safeName(fabricante)}_${safeName(modelo)}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from("datasheets")
      .upload(storagePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.warn(`[enrich-equipment] Upload error:`, uploadError.message);
      return { publicUrl: null, storagePath: null };
    }

    const { data: publicUrlData } = supabase.storage
      .from("datasheets")
      .getPublicUrl(storagePath);

    // console.log(`[enrich-equipment] PDF uploaded: ${storagePath} (${pdfBuffer.byteLength} bytes)`);
    return { publicUrl: publicUrlData?.publicUrl || null, storagePath };
  } catch (err: any) {
    console.warn(`[enrich-equipment] PDF download error: ${err.message}`);
    return { publicUrl: null, storagePath: null };
  }
}

// ── Main handler ─────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body: RequestBody = await req.json();
    const { equipment_type, equipment_id, tenant_id, force_refresh = false } = body;

    if (!equipment_type || !equipment_id || !tenant_id) {
      throw new Error("Campos obrigatórios: equipment_type, equipment_id, tenant_id");
    }

    if (!TABLE_MAP[equipment_type]) {
      throw new Error(`equipment_type '${equipment_type}' não suportado. Tipos válidos: modulo, inversor, otimizador, bateria.`);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Fetch equipment
    const tableName = TABLE_MAP[equipment_type];
    const { data: equipment, error: fetchError } = await supabase
      .from(tableName)
      .select("*")
      .eq("id", equipment_id)
      .single();

    if (fetchError || !equipment) {
      throw new Error(`Equipamento não encontrado: ${fetchError?.message || "ID inválido"}`);
    }

    // 2. Check if already enriched
    if (!force_refresh && equipment.datasheet_found_at && equipment.status !== "rascunho") {
      return new Response(
        JSON.stringify({ success: true, skipped: true, message: "Já enriquecido. Use force_refresh=true para re-buscar." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Build prompt
    const { system, user } = buildPrompt(equipment_type, equipment.fabricante, equipment.modelo);

    // 4. Call AI — Dual provider strategy
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

    // console.log(`[enrich-equipment] Buscando specs para ${equipment.fabricante} ${equipment.modelo} (${equipment_type}) — dual AI`);

    // Primary: Gemini Flash (fast, cheap)
    const primary = await callAIProvider("gemini", "google/gemini-2.5-flash", system, user, apiKey);
    const primaryFilled = countFilledFields(primary.parsed);

    // console.log(`[enrich-equipment] Primary (gemini-2.5-flash): ${primaryFilled} campos, error=${primary.error || "none"}`);

    let secondary: AICallResult | null = null;
    let usedDual = false;

    // If primary failed or returned < 3 fields, try secondary
    if (primary.error || primaryFilled < 3) {
      // console.log(`[enrich-equipment] Primary insufficient (${primaryFilled} campos), trying secondary (gpt-5-mini)...`);
      secondary = await callAIProvider("openai", "openai/gpt-5-mini", system, user, apiKey);
      const secondaryFilled = countFilledFields(secondary.parsed);
      // console.log(`[enrich-equipment] Secondary (gpt-5-mini): ${secondaryFilled} campos, error=${secondary.error || "none"}`);
      usedDual = true;
    }

    // 5. Merge results
    const rawMerged = mergeResults(primary.parsed, secondary?.parsed || null);

    if (Object.keys(rawMerged).length === 0) {
      throw new Error("Nenhum provider retornou dados válidos");
    }

    // console.log(`[enrich-equipment] Merged RAW:`, JSON.stringify(rawMerged));

    // 6. Validate
    const validated = validateSpecs(rawMerged, equipment_type);
    // console.log(`[enrich-equipment] VALIDADO:`, JSON.stringify(validated));

    // 7. Count filled fields
    const fieldsFilled = countFilledFields(validated);

    // 8. Build update payload (remove null fields and generated columns)
    const generatedCols = GENERATED_COLUMNS[equipment_type] || [];
    const updatePayload: Record<string, unknown> = {
      datasheet_found_at: new Date().toISOString(),
      status: "revisao",
      updated_at: new Date().toISOString(),
    };

    for (const [key, value] of Object.entries(validated)) {
      if (generatedCols.includes(key)) continue;
      if (key === "datasheet_url") continue; // handled separately below
      if (value !== null && value !== undefined) {
        updatePayload[key] = value;
      } else if (force_refresh) {
        updatePayload[key] = null;
      }
    }

    // 9. Update equipment (specs only, no datasheet yet)
    const { error: updateError } = await supabase
      .from(tableName)
      .update(updatePayload)
      .eq("id", equipment_id);

    if (updateError) {
      console.error(`[enrich-equipment] Update error:`, updateError);
      throw new Error(`Erro ao atualizar: ${updateError.message}`);
    }

    // 10. Datasheet: validate URL → download → upload to Storage
    let datasheet_downloaded = false;
    let datasheet_path: string | null = null;
    const datasheetUrl = validated.datasheet_url as string | null;

    if (datasheetUrl && typeof datasheetUrl === "string" && datasheetUrl.startsWith("http")) {
      // console.log(`[enrich-equipment] Validating datasheet URL: ${datasheetUrl}`);
      const headCheck = await validateDatasheetUrl(datasheetUrl);

      if (!headCheck.valid) {
        console.warn(`[enrich-equipment] Datasheet URL rejected: ${headCheck.reason}`);
        // Save source_url for reference but NOT datasheet_url
        await supabase
          .from(tableName)
          .update({ datasheet_source_url: datasheetUrl })
          .eq("id", equipment_id);
      } else {
        // console.log(`[enrich-equipment] HEAD OK, downloading PDF...`);
        const { publicUrl, storagePath } = await downloadAndStorePDF(
          datasheetUrl, equipment_type, equipment.fabricante, equipment.modelo, supabase
        );

        if (publicUrl) {
          await supabase
            .from(tableName)
            .update({
              datasheet_url: publicUrl,
              datasheet_source_url: datasheetUrl,
            })
            .eq("id", equipment_id);

          datasheet_downloaded = true;
          datasheet_path = storagePath;
        } else {
          // Download failed — save source URL only
          await supabase
            .from(tableName)
            .update({ datasheet_source_url: datasheetUrl })
            .eq("id", equipment_id);
        }
      }
    }

    // 11. Log AI usage (combined)
    const authHeader = req.headers.get("authorization");
    let userId = "system";
    if (authHeader) {
      try {
        const userClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } }
        );
        const { data: { user } } = await userClient.auth.getUser();
        if (user?.id) userId = user.id;
      } catch { /* ignore */ }
    }

    // Log primary
    await supabase.from("ai_usage_logs").insert({
      tenant_id,
      user_id: userId,
      function_name: "enrich-equipment",
      provider: "lovable_gateway",
      model: primary.model,
      prompt_tokens: primary.usage.prompt_tokens,
      completion_tokens: primary.usage.completion_tokens,
      total_tokens: primary.usage.total_tokens,
      estimated_cost_usd: (primary.usage.prompt_tokens / 1000) * 0.00015 + (primary.usage.completion_tokens / 1000) * 0.0006,
      is_fallback: false,
    });

    // Log secondary if used
    if (secondary && !secondary.error) {
      await supabase.from("ai_usage_logs").insert({
        tenant_id,
        user_id: userId,
        function_name: "enrich-equipment",
        provider: "lovable_gateway",
        model: secondary.model,
        prompt_tokens: secondary.usage.prompt_tokens,
        completion_tokens: secondary.usage.completion_tokens,
        total_tokens: secondary.usage.total_tokens,
        estimated_cost_usd: (secondary.usage.prompt_tokens / 1000) * 0.00015 + (secondary.usage.completion_tokens / 1000) * 0.0006,
        is_fallback: true,
      });
    }

    const winnerProvider = usedDual
      ? (countFilledFields(primary.parsed) >= countFilledFields(secondary?.parsed || null) ? primary.model : secondary?.model || primary.model)
      : primary.model;

    // console.log(`[enrich-equipment] Sucesso: ${fieldsFilled} campos preenchidos para ${equipment.fabricante} ${equipment.modelo}, dual=${usedDual}, winner=${winnerProvider}, datasheet_downloaded=${datasheet_downloaded}`);

    return new Response(
      JSON.stringify({
        success: true,
        fields_filled: fieldsFilled,
        equipment: `${equipment.fabricante} ${equipment.modelo}`,
        dual_ai_used: usedDual,
        winner_model: winnerProvider,
        datasheet_downloaded,
        datasheet_path,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[enrich-equipment] error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
