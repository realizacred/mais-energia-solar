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

function formatCep(cep: string) {
  const clean = cep.replace(/\D/g, '');
  if (clean.length !== 8) return cep;
  return clean.replace(/(\d{5})(\d{3})/, "$1-$2");
}

function formatPhone(phone: string) {
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 11) {
    return clean.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  } else if (clean.length === 10) {
    return clean.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  }
  return phone;
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

    const { analise_id, tenant_id } = await req.json()

    if (!analise_id || !tenant_id) {
      throw new Error('analise_id and tenant_id are required')
    }

    // 1. Buscar dados da análise
    const { data: analise, error: analiseError } = await supabaseClient
      .from('analise_credito')
      .select('*')
      .eq('id', analise_id)
      .single()

    if (analiseError || !analise) throw new Error('Análise não encontrada')

    // 2. Buscar Cliente
    const { data: cliente, error: clienteError } = await supabaseClient
      .from('clientes')
      .select('*')
      .eq('id', analise.cliente_id)
      .single()

    if (clienteError || !cliente) throw new Error('Cliente não encontrado')

    // 3. Buscar Projeto/Deal
    const { data: deal, error: dealError } = await supabaseClient
      .from('deals')
      .select('*')
      .eq('id', analise.deal_id)
      .single()

    if (dealError || !deal) throw new Error('Projeto não encontrado')

    // 4. Buscar Proposta mais recente
    const { data: proposta, error: propostaError } = await supabaseClient
      .from('proposta_versoes')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('proposta_id', analise.deal_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const snapshot = proposta?.snapshot as any;
    const valorMaoObra = snapshot?.precos?.mao_obra || 0;
    const valorEquipamentos = (snapshot?.precos?.equipamentos || snapshot?.precos?.kit) || (proposta?.valor_total - valorMaoObra);

    // 5. Buscar Config EOS
    const { data: config, error: configError } = await supabaseClient
      .from('financeiras_config')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('financeira', 'eos')
      .single()

    if (configError || !config) throw new Error('Configuração EOS não encontrada')

    // 6. Buscar credenciais (apiKey e baseUrl)
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

    // 7. Montar Payload
    const payload: any = {
      tipoProjeto: "SOLAR",
      potenciaInstaladaSugerida: Number(deal.potencia_kwp || 0),
      mediaContaEnergia: Number(deal.media_conta_energia || 0),
      kitFotovoltaico: Number(valorEquipamentos),
      valorTotal: Number(proposta?.valor_total || analise.valor_solicitado),
      maoObra: Number(valorMaoObra),
      entrada: Number(analise.entrada || 0),
      carencia: Number(analise.carencia || 1),
      tempoFinanciamento: Number(analise.prazo_meses),
      clienteTelefone: formatPhone(cliente.telefone),
      clienteNome: cliente.nome,
      clienteCpf: formatCpf(cliente.cpf_cnpj),
      clienteDataNascimento: cliente.data_nascimento ? new Date(cliente.data_nascimento).toISOString() : null,
      endereco: {
        cep: formatCep(cliente.cep || ""),
        bairro: cliente.bairro || "",
        cidade: cliente.cidade || "",
        estado: cliente.estado || "",
        logradouro: cliente.rua || "",
        numero: cliente.numero || "",
        complemento: cliente.complemento || "",
        metragemQuadradaM2: 0,
        situacaoImovel: "QUITADO"
      },
      comSeguro: false,
      autorizacaoScr: true,
      integradorId: config.eos_integrador_id
    }

    if (cliente.tipo_pessoa === 'PJ') {
      payload.clienteCnpj = formatCnpj(cliente.cpf_cnpj)
      payload.clienteNomeFantasia = cliente.nome_fantasia || cliente.nome
      payload.avalistaNome = analise.avalista_nome
      payload.avalistaCpf = formatCpf(analise.avalista_cpf || "")
      payload.avalistaEmail = analise.avalista_email
      payload.avalistaDataNascimento = analise.avalista_data_nascimento
      payload.avalistaTelefone = formatPhone(analise.avalista_telefone || "")
      payload.avalistaRendaMensal = Number(analise.avalista_renda_mensal || 0)
      payload.avalistaPatrimonio = Number(analise.avalista_patrimonio || 0)
      payload.avalistaCep = formatCep(analise.avalista_cep || "")
      payload.avalistaLogradouro = analise.avalista_rua
      payload.avalistaBairro = analise.avalista_bairro
      payload.avalistaCidade = analise.avalista_cidade
      payload.avalistaEstado = analise.avalista_estado
      payload.avalistaNumero = analise.avalista_numero
      payload.avalistaComplemento = ""
      payload.avalistaOutrasRendas = 0
      payload.avalistaCargoFuncao = ""
      payload.avalistaNaturezaOcupacao = ""
      payload.avalistaTempoEmpresa = ""
      payload.cliente = {
        outrasRendas: 0,
        credencial: { email: cliente.email },
        empresa: {
          cnpj: formatCnpj(cliente.cpf_cnpj),
          nomeFantasia: cliente.nome_fantasia || cliente.nome,
          endereco: { complemento: "" },
          contato: {
            email: cliente.email,
            telefone: formatPhone(cliente.telefone || "")
          }
        }
      }
    } else {
      payload.cliente = {
        rendaMensal: Number(analise.renda_mensal || 0),
        patrimonio: Number(analise.patrimonio || 0),
        outrasRendas: 0,
        dataNascimento: cliente.data_nascimento ? new Date(cliente.data_nascimento).toISOString() : null,
        identidadePf: {
          nomeCompleto: cliente.nome,
          cpf: formatCpf(cliente.cpf_cnpj),
          contato: {
            email: cliente.email,
            telefone: formatPhone(cliente.telefone || "")
          }
        }
      }
    }

    // 8. Enviar para EOS
    const eosResponse = await fetch(`${base_url}/proposta/partner/api`, {
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
      throw new Error(eosData.message || 'Erro ao enviar proposta para EOS')
    }

    const protocolo = eosData.protocolo

    // 9. Atualizar análise
    await supabaseClient
      .from('analise_credito')
      .update({
        eos_proposta_protocolo: protocolo,
        eos_enviado_at: new Date().toISOString(),
        status: 'enviado_financeira'
      } as any)
      .eq('id', analise_id)

    // 10. Gravar evento
    await supabaseClient
      .from('credit_analysis_events')
      .insert({
        analise_id,
        tipo: 'proposta_enviada_eos',
        metadata: { protocolo }
      })

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
