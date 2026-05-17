import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const VALID_DOC_TYPES = [
  'IDENTIFICACAO_PF',
  'IDENTIFICACAO_PJ',
  'COMPR_RESIDENCIA',
  'CONTA_ENERGIA_PROJETO_FINALIZADO',
  'ART'
]

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { protocolo, tipo_documento, file_url, tenant_id, analise_id } = await req.json()

    if (!protocolo || !tipo_documento || !file_url || !tenant_id) {
      throw new Error('protocolo, tipo_documento, file_url and tenant_id are required')
    }

    if (!VALID_DOC_TYPES.includes(tipo_documento)) {
      return new Response(JSON.stringify({ error: `Tipo de documento inválido: ${tipo_documento}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 422,
      })
    }

    // 1. Obter credenciais EOS
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

    // 2. Baixar arquivo
    const fileResponse = await fetch(file_url)
    if (!fileResponse.ok) throw new Error('Erro ao baixar arquivo do storage')
    const fileBlob = await fileResponse.blob()

    // 3. Montar FormData para multipart/form-data
    const formData = new FormData()
    // O nome do campo pode variar conforme a API, mas geralmente é 'file' ou 'arquivo'
    // Vamos usar 'arquivo' ou 'documento' conforme padrão comum, mas a doc não especificou o nome do campo multipart
    // Supondo que a API espera o arquivo no corpo como multipart
    formData.append('arquivo', fileBlob, 'documento.pdf')

    // 4. Enviar para EOS
    const eosResponse = await fetch(`${base_url}/proposta/partner/api/envia-documentos/${protocolo}/${tipo_documento}`, {
      method: 'POST',
      headers: {
        'x-api-key': api_key,
        // Ao usar FormData, o fetch define o Content-Type automaticamente com o boundary correto
      },
      body: formData,
    })

    const eosData = await eosResponse.json()
    if (!eosResponse.ok) {
      console.error('EOS API Error:', eosData)
      throw new Error(eosData.message || 'Erro ao enviar documento para EOS')
    }

    // 5. Gravar evento se analise_id foi fornecido
    if (analise_id) {
      await supabaseClient
        .from('credit_analysis_events')
        .insert({
          analise_id,
          tipo: 'documento_enviado_eos',
          metadata: { tipo_documento, protocolo }
        })
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
