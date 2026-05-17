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

    const { tenant_id } = await req.json()
    if (!tenant_id) throw new Error('tenant_id is required')

    const { data: config, error: configError } = await supabaseClient
      .from('financeiras_config')
      .select('id, eos_api_key, ambiente')
      .eq('tenant_id', tenant_id)
      .eq('financeira', 'eos')
      .single()

    if (configError || !config) throw new Error('Integração EOS não configurada')

    const baseUrl = config.ambiente === 'producao' 
      ? 'https://api.eosfin.com.br' 
      : 'https://api.test.eosfin.com.br'

    const webhookToken = `${crypto.randomUUID()}-${crypto.randomUUID()}`
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const webhookUrl = `${supabaseUrl}/functions/v1/eos-webhook-receiver`

    const response = await fetch(`${baseUrl}/proposta/webhook/cadastro`, {
      method: 'POST',
      headers: { 
        'x-api-key': config.eos_api_key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        webhookUrl,
        webhookToken
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Erro ao cadastrar webhook na EOS: ${errorText}`)
    }

    // Salvar token e atualizar step
    const { error: updateError } = await supabaseClient
      .from('financeiras_config')
      .update({
        eos_webhook_secret: webhookToken,
        eos_onboarding_step: 3
      })
      .eq('id', config.id)

    if (updateError) throw updateError

    return new Response(JSON.stringify({ success: true, webhookUrl }), {
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
