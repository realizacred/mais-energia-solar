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

    const { analise_id, valor, prazo_meses, cpf_cnpj, tipo_pessoa, tenant_id } = await req.json()

    if (!tenant_id || !cpf_cnpj || !valor) {
      throw new Error('Missing required fields: tenant_id, cpf_cnpj, valor')
    }

    // 1. Buscar credenciais
    const { data: config, error: configError } = await supabaseClient
      .from('financeiras_config')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('financeira', 'eos')
      .eq('ativo', true)
      .single()

    if (configError || !config) {
      throw new Error('Integração EOS não configurada ou inativa para este tenant')
    }

    // 2. Obter Token (chamando a função interna para segurança)
    const tokenResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/eos-get-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify({
        client_id: config.client_id,
        client_secret: config.client_secret,
        ambiente: config.ambiente
      })
    })

    const tokenData = await tokenResponse.json()
    if (!tokenResponse.ok) throw new Error(tokenData.error || 'Erro ao obter token EOS')

    const accessToken = tokenData.access_token
    const baseUrl = config.ambiente === 'producao' 
      ? 'https://api.eosfin.com.br' 
      : 'https://api.test.eosfin.com.br'

    // 3. Chamada de Simulação EOS
    const eosResponse = await fetch(`${baseUrl}/simulacoes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valor: Number(valor),
        prazo: Number(prazo_meses),
        documento: cpf_cnpj.replace(/\D/g, ''),
        tipo_pessoa: tipo_pessoa?.toUpperCase() === 'PJ' ? 'PJ' : 'PF'
      }),
    })

    const eosData = await eosResponse.json()
    if (!eosResponse.ok) {
      console.error('EOS Simulation Error:', eosData)
      throw new Error(eosData.message || 'Erro na simulação EOS')
    }

    // 4. Salvar resultado se houver analise_id
    if (analise_id) {
      await supabaseClient
        .from('analise_credito')
        .update({
          simulacao_resultado: eosData,
          simulacao_at: new Date().toISOString()
        } as any)
        .eq('id', analise_id)
    }

    return new Response(JSON.stringify(eosData), {
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
