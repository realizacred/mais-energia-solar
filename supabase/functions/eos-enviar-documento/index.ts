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

    const payload = await req.json()
    const { 
      tipo_documento, 
      file_url, 
      file_content, 
      file_name, 
      tenant_id, 
      analise_id 
    } = payload

    let { protocolo } = payload

    // Se não veio protocolo mas veio analise_id, buscar na base
    if (!protocolo && analise_id) {
      const { data: analise } = await supabaseClient
        .from('analise_credito')
        .select('eos_proposta_protocolo, tenant_id')
        .eq('id', analise_id)
        .single()
      
      protocolo = analise?.eos_proposta_protocolo
      if (!tenant_id) {
        // use tenant_id from analise if not provided
        payload.tenant_id = analise?.tenant_id
      }
    }

    if (!protocolo || !tipo_documento || (!file_url && !file_content)) {
      throw new Error('protocolo, tipo_documento, and (file_url or file_content) are required')
    }

    const tId = tenant_id || payload.tenant_id
    if (!tId) throw new Error('tenant_id is required')

    // 1. Obter credenciais EOS
    const { data: config, error: configError } = await supabaseClient
      .from('financeiras_config')
      .select('eos_api_key, ambiente')
      .eq('tenant_id', tId)
      .eq('financeira', 'eos')
      .single()

    if (configError || !config) throw new Error('Integração EOS não configurada')

    const baseUrl = config.ambiente === 'producao' 
      ? 'https://api.eosfin.com.br' 
      : 'https://api.test.eosfin.com.br'

    // 2. Obter o arquivo como Blob
    let fileBlob: Blob
    let finalFileName = file_name || 'documento.pdf'

    if (file_content) {
      // Decode base64
      const binaryString = atob(file_content)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      fileBlob = new Blob([bytes], { type: 'application/pdf' })
    } else {
      const fileResponse = await fetch(file_url)
      if (!fileResponse.ok) throw new Error('Erro ao baixar arquivo do storage')
      fileBlob = await fileResponse.blob()
    }

    // 3. Montar FormData
    const formData = new FormData()
    formData.append('arquivo', fileBlob, finalFileName)

    // 4. Enviar para EOS
    const eosResponse = await fetch(`${baseUrl}/proposta/partner/api/envia-documentos/${protocolo}/${tipo_documento}`, {
      method: 'POST',
      headers: {
        'x-api-key': config.eos_api_key,
      },
      body: formData,
    })

    if (!eosResponse.ok) {
      const eosData = await eosResponse.text()
      throw new Error(`Erro API EOS: ${eosData}`)
    }

    // 5. Gravar evento
    if (analise_id) {
      await supabaseClient
        .from('credit_analysis_events')
        .insert({
          analise_id,
          tipo: 'documento_enviado_eos',
          metadata: { tipo_documento, protocolo, file_name: finalFileName }
        })
    }

    return new Response(JSON.stringify({ success: true }), {
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
