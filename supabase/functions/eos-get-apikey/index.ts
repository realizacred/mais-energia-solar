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

    if (!tenant_id) {
      throw new Error('tenant_id is required')
    }

    // Buscar credenciais (agora simplificado para buscar a eos_api_key direta)
    const { data: config, error: configError } = await supabaseClient
      .from('financeiras_config')
      .select('eos_api_key, ambiente')
      .eq('tenant_id', tenant_id)
      .eq('financeira', 'eos')
      .eq('ativo', true)
      .single()

    if (configError || !config) {
      throw new Error('Integração EOS não configurada ou inativa para este tenant')
    }

    const baseUrl = config.ambiente === 'producao' 
      ? 'https://api.eosfin.com.br' 
      : 'https://api.test.eosfin.com.br'

    return new Response(JSON.stringify({ 
      api_key: config.eos_api_key,
      base_url: baseUrl
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
