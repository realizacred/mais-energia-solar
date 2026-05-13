import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAi } from "../_shared/aiCallNoLovable.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { description, available_variables } = await req.json();
    if (!description) {
      return new Response(JSON.stringify({ error: "Descrição é obrigatória" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const varsListStr = (available_variables || []).slice(0, 80).join(", ");

    const systemPrompt = `Você é um especialista em criar fórmulas matemáticas para propostas de energia solar fotovoltaica.

O sistema usa expressões matemáticas simples com variáveis entre colchetes.
Exemplos de expressões válidas:
- [geracao_mensal] * 12
- 100 * ([geracao_mensal] / [consumo_mensal] - 1)
- [valor_total] / ([potencia_kwp] * 1000)
- ([economia_mensal] * 12 * 25)

Regras:
- Use APENAS variáveis entre colchetes: [nome_variavel]
- Use operadores: +, -, *, /, (, ), ^
- Use números decimais com ponto: 0.074
- Retorne APENAS a expressão matemática, sem explicação, sem markdown
- Se não conseguir criar a fórmula com as variáveis disponíveis, retorne "IMPOSSIVEL: motivo"

Variáveis disponíveis: ${varsListStr}`;

    let formula = "";
    try {
      // Tenta provider próprio (Gemini/OpenAI) e cai para Lovable AI Gateway
      const hasOwnKey = !!Deno.env.get("GEMINI_API_KEY") || !!Deno.env.get("OPENAI_API_KEY");
      if (hasOwnKey) {
        const aiData = await callAi({
          tier: "flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Crie uma fórmula que: ${description}` },
          ],
        });
        formula = aiData?.choices?.[0]?.message?.content?.trim() || "";
      } else {
        const lovableKey = Deno.env.get("LOVABLE_API_KEY");
        if (!lovableKey) throw new Error("Nenhuma API key de IA configurada");
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `Crie uma fórmula que: ${description}` },
            ],
          }),
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`Lovable AI Gateway ${res.status}: ${txt.slice(0, 200)}`);
        }
        const data = await res.json();
        formula = data?.choices?.[0]?.message?.content?.trim() || "";
      }
    } catch (aiErr) {
      console.error("[suggest-formula] AI error:", aiErr);
      return new Response(JSON.stringify({ error: `Erro no serviço de IA: ${(aiErr as Error).message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ formula }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("suggest-formula error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
