import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth check ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { pdf_base64, fabricante, modelo } = await req.json();

    if (!pdf_base64) {
      return new Response(
        JSON.stringify({ success: false, error: 'PDF base64 é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'GEMINI_API_KEY não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `Você é um extrator de dados técnicos de datasheets de módulos fotovoltaicos.
Extraia TODOS os dados técnicos disponíveis do PDF e retorne como JSON estruturado.
Se um campo não for encontrado, retorne null.
Não invente valores — extraia APENAS o que está no documento.`;

    const userPrompt = `Extraia os dados técnicos deste datasheet de módulo fotovoltaico${fabricante ? ` (${fabricante} ${modelo || ''})` : ''}. Retorne APENAS o JSON solicitado.`;

    const responseSchema = {
      type: 'object',
      properties: {
        fabricante: { type: 'string' },
        modelo: { type: 'string' },
        potencia_wp: { type: 'number' },
        tipo_celula: { type: 'string' },
        num_celulas: { type: 'number' },
        tensao_sistema: { type: 'string' },
        eficiencia_percent: { type: 'number' },
        comprimento_mm: { type: 'number' },
        largura_mm: { type: 'number' },
        profundidade_mm: { type: 'number' },
        peso_kg: { type: 'number' },
        bifacial: { type: 'boolean' },
        vmp_v: { type: 'number' },
        imp_a: { type: 'number' },
        voc_v: { type: 'number' },
        isc_a: { type: 'number' },
        temp_coeff_pmax: { type: 'number' },
        temp_coeff_voc: { type: 'number' },
        temp_coeff_isc: { type: 'number' },
        garantia_produto_anos: { type: 'number' },
        garantia_performance_anos: { type: 'number' },
      },
      required: ['fabricante', 'modelo', 'potencia_wp'],
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [
            {
              role: 'user',
              parts: [
                { text: userPrompt },
                { inlineData: { mimeType: 'application/pdf', data: pdf_base64 } },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
            responseSchema,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini error:', response.status, errorText.slice(0, 300));
      return new Response(
        JSON.stringify({ success: false, error: `Erro na extração: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não foi possível extrair dados do PDF.' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let specs: Record<string, unknown>;
    try {
      specs = JSON.parse(content);
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Resposta da IA inválida.' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: specs }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error extracting PDF:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
