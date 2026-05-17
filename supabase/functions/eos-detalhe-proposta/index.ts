import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { protocolo, tenant_id } = await req.json()
    if (!protocolo || !tenant_id) throw new Error('protocolo and tenant_id are required')

    const { data: config, error: configError } = await supabaseClient
      .from('financeiras_config')
      .select('eos_api_key, ambiente')
      .eq('tenant_id', tenant_id)
      .eq('financeira', 'eos')
      .single()

    if (configError || !config) throw new Error('Integração EOS não configurada')

    const baseUrl = config.ambiente === 'producao' 
      ? 'https://api.eosfin.com.br' 
      : 'https://api.test.eosfin.com.br'

    const response = await fetch(`${baseUrl}/proposta/partner/api/${protocolo}`, {
      headers: { 'x-api-key': config.eos_api_key }
    })

    if (!response.ok) throw new Error(`Erro API EOS: ${response.statusText}`)
    const details = await response.json()

    // EOS returns fichas as an array, we'll take the first one or the most relevant
    const ficha = details.fichas?.[0] || {}

    return new Response(JSON.stringify({
      status: details.status,
      ficha: {
        financiador: ficha.financiador?.name || 'N/A',
        parcela: ficha.parcela || 0,
        cet: ficha.cet || 0,
        taxa: ficha.taxa || 0,
        tempoFinanciado: ficha.tempoFinanciado || 0
      },
      documentos: details.documentos || []
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
