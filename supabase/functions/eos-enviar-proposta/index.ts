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

    const { analise_id, tenant_id, opcao_escolhida } = await req.json()

    if (!analise_id || !tenant_id) {
      throw new Error('analise_id and tenant_id are required')
    }

    // 1. Buscar dados da análise e relacionados
    const { data: analise, error: analiseError } = await supabaseClient
      .from('analise_credito')
      .select(`
        *,
        deal:deals(*, client:profiles(*)),
        lead:leads(*)
      `)
      .eq('id', analise_id)
      .single()

    if (analiseError || !analise) throw new Error('Análise não encontrada')

    // 2. Buscar credenciais EOS via service role call to eos-get-apikey
    const apikeyResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/eos-get-apikey`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify({ tenant_id })
    })

    const apikeyData = await apikeyResponse.json()
    if (!apikeyResponse.ok) throw new Error(apikeyData.error || 'Erro ao obter credenciais EOS')

    const { api_key, base_url } = apikeyData

    // 4. Montar Payload conforme documentação EOS
    const cliente = analise.deal?.client || analise.lead
    const payload = {
      cliente: {
        nome: cliente?.nome || cliente?.full_name,
        documento: analise.cpf_cnpj?.replace(/\D/g, ''),
        email: cliente?.email,
        telefone: cliente?.telefone || cliente?.phone,
        renda_mensal: Number(analise.renda_mensal)
      },
      projeto: {
        valor_total: Number(analise.valor_solicitado), // Simplificado para fins de MVP
        endereco: cliente?.endereco || 'Não informado'
      },
      financiamento: {
        valor: Number(opcao_escolhida?.valor || analise.valor_solicitado),
        prazo: Number(opcao_escolhida?.prazo || analise.prazo_meses),
        banco: opcao_escolhida?.banco || analise.banco
      }
    }

    // 5. Enviar para EOS
    const eosResponse = await fetch(`${baseUrl}/propostas`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const eosData = await eosResponse.json()
    if (!eosResponse.ok) throw new Error(eosData.message || 'Erro ao enviar proposta para EOS')

    // 6. Atualizar análise
    await supabaseClient
      .from('analise_credito')
      .update({
        eos_proposta_id: eosData.id || eosData.protocolo,
        eos_enviado_at: new Date().toISOString(),
        status: 'enviada_ao_banco', // Status padrão para quando sai do sistema
        status_detalhado: 'Aguardando retorno da financeira EOS'
      } as any)
      .eq('id', analise_id)

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
