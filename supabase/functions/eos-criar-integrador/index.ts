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

    // 1. Buscar Tenant
    const { data: tenant, error: tenantError } = await supabaseClient
      .from('tenants')
      .select('*')
      .eq('id', tenant_id)
      .single()

    if (tenantError || !tenant) throw new Error('Tenant não encontrado')

    // 2. Buscar Admin Profile (usando o owner_user_id do tenant)
    // Note: owner_user_id in tenants refers to auth.users.id
    const { data: adminProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('user_id', tenant.owner_user_id)
      .single()

    if (profileError || !adminProfile) throw new Error('Perfil do administrador não encontrado')

    // 3. Buscar Email do Admin
    const { data: userData, error: userError } = await supabaseClient.auth.admin.getUserById(tenant.owner_user_id)
    if (userError || !userData.user) throw new Error('Dados de autenticação do administrador não encontrados')

    // 4. Buscar credenciais EOS
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

    // 5. Montar Payload
    const payload = {
      cnpj: tenant.documento?.replace(/\D/g, ''),
      nomeFantasia: tenant.nome,
      telefone: adminProfile.telefone || "",
      nome: adminProfile.nome?.split(' ')[0] || "Admin",
      sobrenome: adminProfile.nome?.split(' ').slice(1).join(' ') || "Tenant",
      email: userData.user.email
    }

    // 6. Chamada API EOS
    const eosResponse = await fetch(`${base_url}/integrador/partner/api/create`, {
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
      throw new Error(eosData.message || 'Erro ao criar integrador na EOS')
    }

    const integradorId = eosData.data

    // 7. Atualizar financeiras_config
    await supabaseClient
      .from('financeiras_config')
      .update({
        eos_integrador_id: integradorId,
        eos_onboarding_step: 2
      } as any)
      .eq('tenant_id', tenant_id)
      .eq('financeira', 'eos')

    return new Response(JSON.stringify({ integrador_id: integradorId }), {
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
