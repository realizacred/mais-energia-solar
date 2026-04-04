/**
 * Edge Function: proposta-chat
 *
 * Chat de dúvidas com IA para a landing page pública da proposta.
 * Usa Lovable AI Gateway (OpenAI GPT) para gerar respostas contextualizadas.
 *
 * RB-23: sem console.log ativo.
 * Página pública — sem AuthGuard (exceção RB-02).
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface RequestBody {
  mensagem: string;
  historico: ChatMessage[];
  proposta_data: Record<string, unknown>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    const { mensagem, historico = [], proposta_data } = body;

    if (!mensagem || typeof mensagem !== "string" || mensagem.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Mensagem é obrigatória" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!proposta_data || typeof proposta_data !== "object") {
      return new Response(
        JSON.stringify({ error: "Dados da proposta são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build context string from proposal data
    const ctx = buildProposalContext(proposta_data);

    const systemPrompt = `Você é um consultor especialista da empresa de energia solar mencionada nos dados.
Você tem acesso completo aos dados desta proposta comercial:

${ctx}

REGRAS:
- Responda dúvidas do cliente de forma clara, amigável e objetiva.
- NÃO invente dados — use APENAS os dados fornecidos acima.
- Responda em português brasileiro.
- Máximo 3 parágrafos por resposta.
- Use formatação simples (sem markdown complexo).
- Se o cliente perguntar algo que não está nos dados, diga educadamente que não tem essa informação e sugira entrar em contato com o consultor.
- Seja persuasivo mas honesto sobre os benefícios da energia solar.`;

    // Build messages array (limit to last 10 messages for context window)
    const recentHistory = historico.slice(-10);
    const messages = [
      { role: "system", content: systemPrompt },
      ...recentHistory.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: mensagem },
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages,
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Muitas perguntas em sequência. Aguarde um momento e tente novamente." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Serviço temporariamente indisponível." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error("[proposta-chat] AI gateway error:", response.status, errText);
      return new Response(
        JSON.stringify({ error: "Erro ao processar sua pergunta. Tente novamente." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "Desculpe, não consegui gerar uma resposta.";

    return new Response(
      JSON.stringify({ resposta: reply }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[proposta-chat] Error:", msg);
    return new Response(
      JSON.stringify({ error: "Erro interno. Tente novamente." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildProposalContext(data: Record<string, unknown>): string {
  const lines: string[] = [];

  const add = (label: string, key: string) => {
    const val = data[key];
    if (val !== null && val !== undefined && val !== "") {
      lines.push(`- ${label}: ${val}`);
    }
  };

  lines.push("## DADOS DA PROPOSTA");
  add("Cliente", "cliente_nome");
  add("Cidade", "cidade");
  add("Estado", "estado");
  add("Potência do sistema", "potencia_kwp");
  add("Valor total", "valor_total");
  add("Economia mensal estimada", "economia_mensal");
  add("Payback (meses)", "payback_meses");
  add("Consumo mensal (kWh)", "consumo_mensal");
  add("Geração mensal estimada (kWh)", "geracao_mensal");
  add("Tipo de telhado", "tipo_telhado");
  add("Empresa", "empresa_nome");
  add("Consultor", "consultor_nome");
  add("Telefone do consultor", "consultor_telefone");
  add("Módulo - modelo", "modulo_modelo");
  add("Módulo - fabricante", "modulo_fabricante");
  add("Módulo - potência (W)", "modulo_potencia_w");
  add("Quantidade de módulos", "modulo_quantidade");
  add("Inversor - modelo", "inversor_modelo");
  add("Inversor - fabricante", "inversor_fabricante");
  add("Inversor - potência (W)", "inversor_potencia_w");
  add("Quantidade de inversores", "inversor_quantidade");
  add("Tarifa (R$/kWh)", "tarifa");

  return lines.join("\n");
}
