import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { mode, proposta_id } = await req.json()
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

    // 1. Templates ativos
    const { count: templatesCount } = await supabase
      .from('proposta_templates')
      .select('*', { count: 'exact', head: true })
      .eq('ativo', true)

    // 2. Extração de variáveis via auditoria de geração
    const { data: auditRows } = await supabase
      .from('proposta_versoes')
      .select('generation_audit_json')
      .not('generation_audit_json', 'is', null)
      .order('created_at', { ascending: false })
      .limit(20)

    const varsFound = new Set<string>()
    const broken = new Set<string>()
    const nulas = new Set<string>()
    const ok = new Set<string>()

    auditRows?.forEach(row => {
      const audit = row.generation_audit_json
      if (audit?.variables_found) {
        Object.keys(audit.variables_found).forEach(v => varsFound.add(v))
      }
      audit?.broken_variables?.forEach((v: string) => broken.add(v))
      audit?.null_variables?.forEach((v: string) => nulas.add(v))
    })

    // Classifica as encontradas que não estão quebradas/nulas como OK
    varsFound.forEach(v => {
      if (!broken.has(v) && !nulas.has(v)) ok.add(v)
    })

    const result: any = {
      templates_ativos: templatesCount || 0,
      variaveis_encontradas: Array.from(varsFound),
      quebradas: Array.from(broken),
      nulas: Array.from(nulas),
      ok: Array.from(ok),
      gerado_em: new Date().toISOString()
    }

    if (mode === 'full') {
      // Busca última proposta para contexto
      let targetPropostaId = proposta_id
      if (!targetPropostaId) {
        const { data: lastProp } = await supabase
          .from('propostas_nativas')
          .select('id')
          .neq('status', 'excluida')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        targetPropostaId = lastProp?.id
      }

      // Chamada IA
      if (LOVABLE_API_KEY && broken.size > 0) {
        const prompt = `Analise estas variáveis quebradas em templates de proposta solar: ${Array.from(broken).join(', ')}. Contexto: modo full audit.`
        
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "google/gemini-2.0-flash",
            messages: [
              { role: "system", content: "Você é especialista em templates de proposta solar. Analise as variáveis com problema e gere: 1. Análise em português do que está errado. 2. Um prompt pronto para corrigir no Lovable." },
              { role: "user", content: prompt }
            ]
          })
        })

        const aiData = await aiRes.json()
        const aiText = aiData.choices?.[0]?.message?.content || ""
        
        // Split simples (pode ser melhorado com regex se a IA seguir o padrão)
        result.analise_ia = aiText.split('2.')[0]?.replace('1.', '').trim()
        result.prompt_lovable = aiText.split('2.')[1]?.trim()
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
