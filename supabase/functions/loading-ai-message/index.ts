const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { context, operation_description } = await req.json();

    // Try LOVABLE_API_KEY as fallback (this function has no auth context for tenant key)
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      // No AI available — return fallback silently
      return new Response(
        JSON.stringify({ message: null, fallback: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `Você é um assistente de UX para um CRM de energia solar.
Gere UMA mensagem curta, amigável e contextual para exibir durante o carregamento de uma operação.
A mensagem deve ter no máximo 50 caracteres.
Não use emojis. Não use pontuação excessiva. Seja profissional mas acolhedor.
Contexto da operação: ${context || "geral"}
${operation_description ? `Descrição: ${operation_description}` : ""}

Responda APENAS com a mensagem, sem aspas, sem explicação.`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Gere uma mensagem de loading para: ${context}` },
          ],
          max_tokens: 30,
          temperature: 0.7,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        if (response.status === 429 || response.status === 402) {
          return new Response(
            JSON.stringify({ message: null, fallback: true, reason: "rate_limit" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ message: null, fallback: true, reason: "ai_error" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();
      const message = data.choices?.[0]?.message?.content?.trim();

      return new Response(
        JSON.stringify({ message: message || null, fallback: !message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (fetchError) {
      clearTimeout(timeout);
      return new Response(
        JSON.stringify({ message: null, fallback: true, reason: "timeout" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (e) {
    console.error("loading-ai-message error:", e);
    return new Response(
      JSON.stringify({ message: null, fallback: true, reason: "parse_error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
