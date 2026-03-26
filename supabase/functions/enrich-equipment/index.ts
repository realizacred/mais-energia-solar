import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type EquipmentType = "modulo" | "inversor" | "otimizador";

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
};

// ── Prompts ──────────────────────────────────────────────────────

function buildPrompt(type: EquipmentType, fabricante: string, modelo: string): { system: string; user: string } {
  const system = "Você é um especialista em energia solar. Busque as especificações técnicas do equipamento indicado. Retorne APENAS um JSON válido com os campos solicitados. Se não encontrar um valor, use null. Não invente dados. IMPORTANTE: Para datasheet_url, forneça APENAS URLs que você tem certeza absoluta que existem e estão acessíveis publicamente. Se não tiver certeza da URL exata, retorne null. NUNCA invente ou adivinhe URLs de datasheet.";

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

// Colunas geradas (GENERATED ALWAYS) — nunca incluir no UPDATE
const GENERATED_COLUMNS: Record<EquipmentType, string[]> = {
  modulo: ["area_m2"],
  inversor: [],
  otimizador: [],
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
  potencia_wp: { min: 100, max: 3000 },
  tensao_entrada_max_v: { min: 20, max: 120 },
  corrente_entrada_max_a: { min: 5, max: 30 },
  tensao_saida_v: { min: 20, max: 120 },
  corrente_saida_max_a: { min: 5, max: 30 },
  eficiencia_percent: { min: 95, max: 99.9 },
  peso_kg: { min: 0.5, max: 10 },
  garantia_anos: { min: 10, max: 30 },
};

const RANGES_MAP: Record<EquipmentType, Record<string, Range>> = {
  modulo: MODULO_RANGES,
  inversor: INVERSOR_RANGES,
  otimizador: OTIMIZADOR_RANGES,
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
  // Try to find JSON in the response (may have markdown fences)
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
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
      throw new Error("equipment_type inválido. Use: modulo, inversor, otimizador");
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

    // 4. Call AI via Lovable Gateway (always available)
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

    console.log(`[enrich-equipment] Buscando specs para ${equipment.fabricante} ${equipment.modelo} (${equipment_type})`);

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errorText = await aiRes.text();
      throw new Error(`AI Gateway error: ${aiRes.status} - ${errorText}`);
    }

    const aiData = await aiRes.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";
    const usage = aiData.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    // 5. Parse JSON
    const parsed = extractJSON(rawContent);
    if (!parsed) {
      throw new Error("IA não retornou JSON válido");
    }

    console.log(`[enrich-equipment] RAW da IA:`, JSON.stringify(parsed));

    // 6. Validate
    const validated = validateSpecs(parsed, equipment_type);

    console.log(`[enrich-equipment] VALIDADO:`, JSON.stringify(validated));

    // 7. Count filled fields
    const fieldsFilled = Object.values(validated).filter(v => v !== null && v !== undefined).length;

    // 8. Remove null fields and generated columns
    const generatedCols = GENERATED_COLUMNS[equipment_type] || [];
    const updatePayload: Record<string, unknown> = {
      datasheet_found_at: new Date().toISOString(),
      status: "revisao",
      updated_at: new Date().toISOString(),
    };

    for (const [key, value] of Object.entries(validated)) {
      if (generatedCols.includes(key)) continue; // skip generated columns
      if (value !== null && value !== undefined) {
        updatePayload[key] = value;
      } else if (force_refresh) {
        updatePayload[key] = null;
      }
    }

    // 9. Update equipment (first pass — without datasheet storage URL)
    const { error: updateError } = await supabase
      .from(tableName)
      .update(updatePayload)
      .eq("id", equipment_id);

    if (updateError) {
      console.error(`[enrich-equipment] Update error:`, updateError);
      throw new Error(`Erro ao atualizar: ${updateError.message}`);
    }

    // 9b. Download datasheet PDF and upload to Storage
    let datasheet_uploaded = false;
    const datasheetUrl = validated.datasheet_url as string | null;

    if (datasheetUrl && typeof datasheetUrl === "string" && datasheetUrl.startsWith("http")) {
      try {
        console.log(`[enrich-equipment] Fetching datasheet: ${datasheetUrl}`);
        const pdfRes = await fetch(datasheetUrl, {
          signal: AbortSignal.timeout(15000),
          headers: { "User-Agent": "Mozilla/5.0 (compatible; EnrichBot/1.0)" },
        });

        if (pdfRes.ok) {
          const contentType = pdfRes.headers.get("content-type") || "";
          if (contentType.includes("application/pdf") || datasheetUrl.toLowerCase().endsWith(".pdf")) {
            const pdfBuffer = await pdfRes.arrayBuffer();
            if (pdfBuffer.byteLength > 0 && pdfBuffer.byteLength <= 20 * 1024 * 1024) {
              const safeName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
              const storagePath = `${equipment_type}/${safeName(equipment.fabricante)}_${safeName(equipment.modelo)}.pdf`;

              const { error: uploadError } = await supabase.storage
                .from("datasheets")
                .upload(storagePath, pdfBuffer, {
                  contentType: "application/pdf",
                  upsert: true,
                });

              if (uploadError) {
                console.warn(`[enrich-equipment] Upload error:`, uploadError.message);
              } else {
                const { data: publicUrlData } = supabase.storage
                  .from("datasheets")
                  .getPublicUrl(storagePath);

                if (publicUrlData?.publicUrl) {
                  // Update the datasheet_url with the storage URL
                  await supabase
                    .from(tableName)
                    .update({
                      datasheet_url: publicUrlData.publicUrl,
                      datasheet_source_url: datasheetUrl,
                    })
                    .eq("id", equipment_id);

                  datasheet_uploaded = true;
                  console.log(`[enrich-equipment] PDF uploaded: ${storagePath} (${pdfBuffer.byteLength} bytes)`);
                }
              }
            } else {
              console.warn(`[enrich-equipment] PDF size out of range: ${pdfBuffer.byteLength} bytes`);
            }
          } else {
            console.warn(`[enrich-equipment] Not a PDF content-type: ${contentType}`);
            // Save URL as-is (fallback)
            await supabase.from(tableName).update({ datasheet_url: datasheetUrl }).eq("id", equipment_id);
          }
        } else {
          console.warn(`[enrich-equipment] Datasheet fetch failed: ${pdfRes.status}`);
          await pdfRes.text(); // consume body
          await supabase.from(tableName).update({ datasheet_url: datasheetUrl }).eq("id", equipment_id);
        }
      } catch (pdfErr: any) {
        console.warn(`[enrich-equipment] PDF download error: ${pdfErr.message}`);
        // Fallback: save URL as-is
        await supabase.from(tableName).update({ datasheet_url: datasheetUrl }).eq("id", equipment_id);
      }
    }

    // 10. Log AI usage
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

    await supabase.from("ai_usage_logs").insert({
      tenant_id,
      user_id: userId,
      function_name: "enrich-equipment",
      provider: "lovable_gateway",
      model: "google/gemini-2.5-flash",
      prompt_tokens: usage.prompt_tokens,
      completion_tokens: usage.completion_tokens,
      total_tokens: usage.total_tokens,
      estimated_cost_usd: (usage.prompt_tokens / 1000) * 0.00015 + (usage.completion_tokens / 1000) * 0.0006,
      is_fallback: false,
    });

    console.log(`[enrich-equipment] Sucesso: ${fieldsFilled} campos preenchidos para ${equipment.fabricante} ${equipment.modelo}, datasheet_uploaded=${datasheet_uploaded}`);

    return new Response(
      JSON.stringify({
        success: true,
        fields_filled: fieldsFilled,
        equipment: `${equipment.fabricante} ${equipment.modelo}`,
        datasheet_uploaded,
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
