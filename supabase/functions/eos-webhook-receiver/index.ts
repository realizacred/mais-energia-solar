import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

const notifyStatuses = ['Pré-aprovada', 'Formalização', 'Paga', 'Recusada']

serve(async (req) => {
  // Rota pública, mas com validação de token
  try {
    const authHeader = req.headers.get('Authorization') || req.headers.get('x-webhook-token')
    if (!authHeader) {
      return new Response('Unauthorized', { status: 401 })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Buscar o secret configurado para a EOS
    const { data: config, error: configError } = await supabaseClient
      .from('financeiras_config')
      .select('eos_webhook_secret, tenant_id')
      .eq('financeira', 'eos')
      .single()

    if (configError || !config || config.eos_webhook_secret !== authHeader) {
      console.error('Invalid webhook token')
      return new Response('Unauthorized', { status: 401 })
    }

    const payload = await req.json()
    const { proposta } = payload

    if (!proposta || !proposta.protocolo) {
      return new Response('Invalid payload', { status: 400 })
    }

    // Processar em background
    const processWebhook = async () => {
      const { data: analise, error: analiseError } = await supabaseClient
        .from('analise_credito')
        .select('id, eos_status, responsavel_id, criado_por')
        .eq('eos_proposta_protocolo', proposta.protocolo)
        .single()

      if (analise) {
        const mappedStatus = statusMapping[proposta.status] || proposta.status
        
        // Update analise
        await supabaseClient
          .from('analise_credito')
          .update({ eos_status: mappedStatus })
          .eq('id', analise.id)

        // Log event
        const ficha = proposta.fichas?.[0] || {}
        await supabaseClient
          .from('credit_analysis_events')
          .insert({
            analise_id: analise.id,
            tipo: 'webhook_eos',
            metadata: { 
              protocolo: proposta.protocolo, 
              status: proposta.status,
              ficha 
            }
          })

        // Notificar se relevante
        if (notifyStatuses.includes(proposta.status)) {
          // Usar RPC de notificação se existir, ou inserir na tabela de notificações
          // Assumindo que existe uma lógica de notificação centralizada
          const notificationMsg = `Proposta EOS ${proposta.protocolo}: ${proposta.status}`
          
          const notifyUser = async (userId: string) => {
            if (!userId) return
            await supabaseClient.from('notifications').insert({
              user_id: userId,
              title: 'Atualização EOS',
              message: notificationMsg,
              type: 'credit_update',
              metadata: { analise_id: analise.id, protocolo: proposta.protocolo }
            })
          }

          await notifyUser(analise.responsavel_id)
          await notifyUser(analise.criado_por)
        }
      }
    }

    // EdgeRuntime.waitUntil(processWebhook()) // Not standard Deno, but usually available in Edge environments or just call it without await if it handles its own errors
    processWebhook().catch(err => console.error('Error processing webhook:', err))

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
