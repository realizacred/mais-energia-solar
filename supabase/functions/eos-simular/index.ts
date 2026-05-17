import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function formatCpf(cpf: string) {
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return cpf;
  return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function formatCnpj(cnpj: string) {
  const clean = cnpj.replace(/\D/g, '');
  if (clean.length !== 14) return cnpj;
  return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
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

    const { analise_id, tenant_id, test_mode } = await req.json()

    if (!tenant_id) {
      throw new Error('tenant_id is required')
    }

    // 1. Obter API Key (Chamando a função interna)
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

    if (test_mode) {
      // Mock para teste de conexão
      const testPayload = {
        tipoPessoa: 'PF',
        valorMaoObra: 1000,
        valorProduto: 9000,
        entrada: 0,
        carencia: 1,
        cpf: '000.000.000-00',
        dataNascimento: '2000-01-01T00:00:00.000Z',
        nomeCompleto: 'Teste de Conexão'
      }

      const eosResponse = await fetch(`${base_url}/proposta/partner/simulate`, {
        method: 'POST',
        headers: {
          'x-api-key': api_key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testPayload),
      })

      if (!eosResponse.ok) throw new Error('Chave inválida ou erro na API EOS')
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    if (!analise_id) {
      throw new Error('analise_id is required for real simulation')
    }

    // 1. Buscar Análise de Crédito
    const { data: analise, error: analiseError } = await supabaseClient
      .from('analise_credito')
      .select('*, deals!analise_credito_deal_id_fkey(id, title)')
      .eq('id', analise_id)
      .single()

    if (analiseError || !analise) {
      throw new Error('Análise de crédito não encontrada')
    }

    // 2. Buscar Cliente
    const { data: cliente, error: clienteError } = await supabaseClient
      .from('clientes')
      .select('nome, nome_fantasia, cpf_cnpj, data_nascimento, tipo_pessoa')
      .eq('id', analise.cliente_id)
      .single()

    if (clienteError || !cliente) {
      throw new Error('Cliente não encontrado')
    }

    // 3. Buscar Valores na Proposta (mais recente)
    const { data: proposta, error: propostaError } = await supabaseClient
      .from('proposta_versoes')
      .select('valor_total, snapshot')
      .eq('tenant_id', tenant_id)
      .eq('proposta_id', analise.deal_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const valorTotal = proposta?.valor_total || analise.valor_solicitado;
    const snapshot = proposta?.snapshot as any;
    const valorMaoObra = snapshot?.precos?.mao_obra || 0;
    const valorProduto = (snapshot?.precos?.equipamentos || snapshot?.precos?.kit) || (valorTotal - valorMaoObra);

    // 5. Construir Payload Real EOS
    let payload: any = {
      valorMaoObra: Number(valorMaoObra),
      valorProduto: Number(valorProduto),
      entrada: Number(analise.entrada || 0),
      carencia: Number(analise.carencia || 1),
    }

    if (cliente.tipo_pessoa === 'PJ') {
      payload = {
        ...payload,
        tipoPessoa: 'PJ',
        cnpj: formatCnpj(cliente.cpf_cnpj),
        razaoSocial: cliente.nome_fantasia || cliente.nome
      }
    } else {
      payload = {
        ...payload,
        tipoPessoa: 'PF',
        cpf: formatCpf(cliente.cpf_cnpj),
        dataNascimento: cliente.data_nascimento ? new Date(cliente.data_nascimento).toISOString() : null,
        nomeCompleto: cliente.nome
      }
    }

    // 6. Chamada API EOS
    const eosResponse = await fetch(`${base_url}/proposta/partner/simulate`, {
      method: 'POST',
      headers: {
        'x-api-key': api_key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const eosData = await eosResponse.json()
    if (!eosResponse.ok) {
      console.error('EOS API Error:', eosData)
      throw new Error(eosData.message || eosData.error || 'Erro na simulação EOS')
    }

    // 7. Salvar resultado
    await supabaseClient
      .from('analise_credito')
      .update({
        simulacao_resultado: eosData,
        simulacao_at: new Date().toISOString()
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
