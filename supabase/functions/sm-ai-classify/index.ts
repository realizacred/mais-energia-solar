/**
 * Edge Function: sm-ai-classify
 * Classifica propostas do SolarMarket usando Lovable AI Gateway.
 * Fallback: retorna mapeamento manual se a IA falhar.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AiClassification {
  sugestao_etapa_id: string;
  tags_identificadas: string[];
  resumo_executivo: string;
  source: "ai" | "fallback";
}

function getManualFallback(smStatus: string): AiClassification {
  const status = (smStatus || "").toLowerCase().trim();
  let etapa = "recebido";
  const tags: string[] = [];

  if (status === "approved" || status === "accepted") {
    etapa = "fechado";
    tags.push("aprovado_sm");
  } else if (status === "viewed" || status === "sent") {
    etapa = "acompanhamento";
    tags.push("em_negociacao");
  } else if (status === "expired" || status === "rejected") {
    etapa = "perdido";
    tags.push("perdido_sm");
  } else {
    tags.push("triagem");
  }

  return {
    sugestao_etapa_id: etapa,
    tags_identificadas: tags,
    resumo_executivo: `Classificação automática baseada no status "${smStatus}" do SolarMarket.`,
    source: "fallback",
  };
}

function extractJsonFromResponse(response: string): unknown {
  let cleaned = response
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
  const jsonStart = cleaned.search(/[{[]/);
  const startChar = jsonStart !== -1 ? cleaned[jsonStart] : "{";
  const jsonEnd = cleaned.lastIndexOf(startChar === "[" ? "]" : "}");
  if (jsonStart === -1 || jsonEnd === -1) throw new Error("No JSON found");
  cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
  try {
    return JSON.parse(cleaned);
  } catch {
    cleaned = cleaned
      .replace(/,\s*}/g, "}")
      .replace(/,\s*]/g, "]")
      .replace(/[\x00-\x1F\x7F]/g, "");
    return JSON.parse(cleaned);
  }
}

function detectTruncation(response: string): boolean {
  const text = response.trim();
  const openBraces = (text.match(/{/g) || []).length;
  const closeBraces = (text.match(/}/g) || []).length;
  if (openBraces !== closeBraces) return true;
  const patterns = [/\.\.\.$/, /\u2026$/, /\[truncated\]/i, /\[continued\]/i];
  return patterns.some((p) => p.test(text));
}

function isValidAiOutput(
  data: unknown
): data is {
  sugestao_etapa_id: string;
  tags_identificadas: string[];
  resumo_executivo: string;
} {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.sugestao_etapa_id === "string" &&
    Array.isArray(d.tags_identificadas) &&
    typeof d.resumo_executivo === "string"
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { proposal_history, sm_status, proposal_id } = await req.json();

    if (!proposal_history || !sm_status) {
      return new Response(
        JSON.stringify({ error: "proposal_history and sm_status are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("[sm-ai-classify] LOVABLE_API_KEY not configured, using fallback");
      return new Response(JSON.stringify(getManualFallback(sm_status)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load system prompt from integration_configs
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // Resolve tenant from JWT
    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userErr } = await sb.auth.getUser(jwt);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: configRow } = await sb
      .from("integration_configs")
      .select("api_key, is_active")
      .eq("service_key", "sm_ai_migration_prompt")
      .maybeSingle();

    if (!configRow?.is_active) {
      return new Response(JSON.stringify(getManualFallback(sm_status)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = configRow.api_key || "";

    // Call Lovable AI Gateway
    try {
      const aiResp = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: systemPrompt },
              {
                role: "user",
                content: `Classifique esta proposta do SolarMarket:\n\nStatus: ${sm_status}\nID: ${proposal_id || "N/A"}\n\nHistórico:\n${proposal_history}\n\nRetorne APENAS o JSON com sugestao_etapa_id, tags_identificadas e resumo_executivo.`,
              },
            ],
          }),
        }
      );

      if (!aiResp.ok) {
        if (aiResp.status === 429) {
          console.error("[sm-ai-classify] Rate limited (429), using fallback");
        } else if (aiResp.status === 402) {
          console.error("[sm-ai-classify] Payment required (402), using fallback");
        } else {
          console.error(`[sm-ai-classify] AI gateway error ${aiResp.status}, using fallback`);
        }
        return new Response(JSON.stringify(getManualFallback(sm_status)), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const aiData = await aiResp.json();
      const content = aiData.choices?.[0]?.message?.content;

      if (!content || detectTruncation(content)) {
        console.error("[sm-ai-classify] Truncated or empty AI response, using fallback");
        return new Response(JSON.stringify(getManualFallback(sm_status)), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const parsed = extractJsonFromResponse(content);

      if (!isValidAiOutput(parsed)) {
        console.error("[sm-ai-classify] Invalid AI output structure, using fallback");
        return new Response(JSON.stringify(getManualFallback(sm_status)), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result: AiClassification = {
        sugestao_etapa_id: parsed.sugestao_etapa_id,
        tags_identificadas: parsed.tags_identificadas,
        resumo_executivo: parsed.resumo_executivo,
        source: "ai",
      };

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (aiErr) {
      console.error("[sm-ai-classify] AI call failed:", aiErr);
      return new Response(JSON.stringify(getManualFallback(sm_status)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    console.error("[sm-ai-classify] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
