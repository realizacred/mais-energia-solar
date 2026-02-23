import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'LOVABLE_API_KEY não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `Você é um extrator de dados técnicos de datasheets de módulos fotovoltaicos.
Extraia TODOS os dados técnicos disponíveis do PDF e retorne como JSON estruturado.
Se um campo não for encontrado, retorne null.
Não invente valores — extraia APENAS o que está no documento.`;

    const userPrompt = `Extraia os dados técnicos deste datasheet de módulo fotovoltaico${fabricante ? ` (${fabricante} ${modelo || ''})` : ''}.

Retorne APENAS o JSON no formato abaixo, sem explicações:`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: userPrompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${pdf_base64}`,
                },
              },
            ],
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_module_specs',
              description: 'Extrai especificações técnicas de um módulo fotovoltaico a partir de um datasheet PDF',
              parameters: {
                type: 'object',
                properties: {
                  fabricante: { type: 'string', description: 'Nome do fabricante' },
                  modelo: { type: 'string', description: 'Modelo do módulo' },
                  potencia_wp: { type: 'number', description: 'Potência máxima em Wp (STC)' },
                  tipo_celula: {
                    type: 'string',
                    enum: ['Mono PERC', 'N-Type TOPCon', 'N-Type HJT', 'N-Type HPBC', 'Policristalino'],
                    description: 'Tipo de célula fotovoltaica',
                  },
                  num_celulas: { type: 'number', description: 'Número de células' },
                  tensao_sistema: {
                    type: 'string', enum: ['1000V', '1500V'],
                    description: 'Tensão máxima do sistema',
                  },
                  eficiencia_percent: { type: 'number', description: 'Eficiência do módulo em %' },
                  comprimento_mm: { type: 'number', description: 'Comprimento em mm' },
                  largura_mm: { type: 'number', description: 'Largura em mm' },
                  profundidade_mm: { type: 'number', description: 'Profundidade/espessura em mm' },
                  peso_kg: { type: 'number', description: 'Peso em kg' },
                  bifacial: { type: 'boolean', description: 'Se o módulo é bifacial' },
                  vmp_v: { type: 'number', description: 'Tensão de máxima potência Vmp (V)' },
                  imp_a: { type: 'number', description: 'Corrente de máxima potência Imp (A)' },
                  voc_v: { type: 'number', description: 'Tensão de circuito aberto Voc (V)' },
                  isc_a: { type: 'number', description: 'Corrente de curto-circuito Isc (A)' },
                  temp_coeff_pmax: { type: 'number', description: 'Coeficiente de temperatura Pmax (%/°C)' },
                  temp_coeff_voc: { type: 'number', description: 'Coeficiente de temperatura Voc (%/°C)' },
                  temp_coeff_isc: { type: 'number', description: 'Coeficiente de temperatura Isc (%/°C)' },
                  garantia_produto_anos: { type: 'number', description: 'Garantia do produto em anos' },
                  garantia_performance_anos: { type: 'number', description: 'Garantia de performance em anos' },
                },
                required: ['fabricante', 'modelo', 'potencia_wp'],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'extract_module_specs' } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit excedido. Tente novamente em alguns segundos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'Créditos insuficientes. Adicione créditos ao workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: `Erro na extração: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall || toolCall.function?.name !== 'extract_module_specs') {
      console.error('Unexpected AI response:', JSON.stringify(data));
      return new Response(
        JSON.stringify({ success: false, error: 'Não foi possível extrair dados do PDF.' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let specs: Record<string, unknown>;
    try {
      specs = JSON.parse(toolCall.function.arguments);
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Resposta da IA inválida.' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Extracted specs:', JSON.stringify(specs));

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
