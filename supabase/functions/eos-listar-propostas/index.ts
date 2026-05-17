import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const statusMapping: Record<string, string> = {
  'Simulação': 'simulacao',
  'Em andamento': 'em_andamento',
  'Em análise': 'em_analise',
  'Pré-aprovada': 'pre_aprovada',
  'Formalização': 'formalizacao',
  'Paga': 'paga',
  'Cancelada': 'cancelada',
  'Recusada': 'recusada'
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

    const { tenant_id } = await req.json()
    if (!tenant_id) throw new Error('tenant_id is required')

    const { data: config, error: configError } = await supabaseClient
      .from('financeiras_config')
      .select('eos_api_key, ambiente')
      .eq('tenant_id', tenant_id)
      .eq('financeira', 'eos')
      .eq('ativo', true)
      .single()

    if (configError || !config) throw new Error('Integração EOS não configurada')

    const baseUrl = config.ambiente === 'producao' 
      ? 'https://api.eosfin.com.br' 
      : 'https://api.test.eosfin.com.br'

    // 1. Buscar todas as propostas da EOS
    const response = await fetch(`${baseUrl}/proposta/partner/api`, {
      headers: { 'x-api-key': config.eos_api_key }
    })

    if (!response.ok) throw new Error(`Erro API EOS: ${response.statusText}`)
    const eosPropostas = await response.json()

    let syncCount = 0

    // 2. Processar cada proposta
    for (const proposta of eosPropostas) {
      const { data: analise, error: analiseError } = await supabaseClient
        .from('analise_credito')
        .select('id, eos_status')
        .eq('eos_proposta_protocolo', proposta.protocolo)
        .eq('tenant_id', tenant_id)
        .single()

      if (analise && proposta.status) {
        const mappedStatus = statusMapping[proposta.status] || proposta.status
        
        // 3. Se status mudou, atualizar
        if (analise.eos_status !== mappedStatus) {
          await supabaseClient
            .from('analise_credito')
            .update({ eos_status: mappedStatus })
            .eq('id', analise.id)

          // 4. Gravar evento
          await supabaseClient
            .from('credit_analysis_events')
            .insert({
              analise_id: analise.id,
              tipo: 'sync_eos',
              metadata: { 
                protocolo: proposta.protocolo, 
                de: analise.eos_status, 
                para: mappedStatus 
              }
            })
          
          syncCount++
        }
      }
    }

    return new Response(JSON.stringify({ success: true, syncCount }), {
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
