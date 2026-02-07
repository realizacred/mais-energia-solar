import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Banco Central do Brasil - API de Taxas de Juros
// Documentação: https://olinda.bcb.gov.br/olinda/servico/taxaJuros/versao/v2/swagger-ui3#/
const BCB_API_URL = "https://olinda.bcb.gov.br/olinda/servico/taxaJuros/versao/v2/odata/TaxasJurosDiariaPorInicioPeriodo";

// Mapeamento de códigos BCB para bancos
const BANCOS_MAPEAMENTO: Record<string, { nomes: string[], codigo_bcb: string }> = {
  "Santander": {
    nomes: ["BANCO SANTANDER (BRASIL) S.A.", "SANTANDER"],
    codigo_bcb: "033"
  },
  "BV": {
    nomes: ["BANCO BV S.A.", "BANCO VOTORANTIM S.A.", "BV FINANCEIRA"],
    codigo_bcb: "655"
  },
  "Banco do Brasil": {
    nomes: ["BANCO DO BRASIL S.A."],
    codigo_bcb: "001"
  },
  "Caixa": {
    nomes: ["CAIXA ECONOMICA FEDERAL", "CAIXA ECONÔMICA FEDERAL"],
    codigo_bcb: "104"
  },
};

interface TaxaBCB {
  InstituicaoFinanceira: string;
  Modalidade: string;
  TaxaJurosAoMes: number;
  TaxaJurosAoAno: number;
  InicioPeriodo: string;
}

interface BancoDb {
  id: string;
  nome: string;
  codigo_bcb: string | null;
}

// Função auxiliar para verificar se usuário é admin
async function verifyAdminRole(req: Request): Promise<{ authorized: boolean; error?: Response }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return {
      authorized: false,
      error: new Response(
        JSON.stringify({ success: false, error: 'Token de autenticação ausente' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) {
    return {
      authorized: false,
      error: new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    };
  }

  // Check admin role
  const { data: roles } = await userClient
    .from('user_roles')
    .select('role')
    .eq('user_id', userData.user.id);

  const isAdmin = roles?.some(r => r.role === 'admin');
  if (!isAdmin) {
    return {
      authorized: false,
      error: new Response(
        JSON.stringify({ success: false, error: 'Apenas administradores podem sincronizar taxas' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    };
  }

  return { authorized: true };
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verificar autenticação e role de admin
    const authCheck = await verifyAdminRole(req);
    if (!authCheck.authorized) {
      return authCheck.error!;
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if syncing specific bank
    let bankId: string | null = null;
    try {
      const body = await req.json();
      bankId = body?.bank_id || null;
    } catch {
      // No body or invalid JSON, sync all
    }

    console.log("[sync-taxas-bcb] Iniciando sincronização com API do Banco Central...");
    if (bankId) {
      console.log(`[sync-taxas-bcb] Sincronizando apenas banco ID: ${bankId}`);
    }

    // Buscar bancos cadastrados que têm código BCB ou que podem ser mapeados
    const { data: bancosDb, error: bancosError } = await supabase
      .from('financiamento_bancos')
      .select('id, nome, codigo_bcb');
    
    if (bancosError) throw bancosError;

    // Filter if specific bank requested
    let bancosParaSincronizar = bancosDb || [];
    if (bankId) {
      bancosParaSincronizar = bancosParaSincronizar.filter(b => b.id === bankId);
    }

    // Buscar todas as instituições que podemos mapear
    const todasInstituicoes: string[] = [];
    for (const config of Object.values(BANCOS_MAPEAMENTO)) {
      todasInstituicoes.push(...config.nomes);
    }

    const filterInstituicoes = todasInstituicoes.map(b => `InstituicaoFinanceira eq '${b}'`).join(' or ');
    
    const url = `${BCB_API_URL}?$format=json&$top=100&$filter=(${filterInstituicoes})`;
    console.log("[sync-taxas-bcb] Consultando API BCB...");

    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[sync-taxas-bcb] Erro na API BCB:", response.status, errorText);
      throw new Error(`Erro na API do Banco Central: ${response.status}`);
    }

    const data = await response.json();
    const taxas: TaxaBCB[] = data.value || [];
    
    console.log(`[sync-taxas-bcb] Recebidas ${taxas.length} taxas da API`);

    // Processar taxas por instituição BCB
    const taxasPorInstituicao: Record<string, number[]> = {};
    for (const taxa of taxas) {
      const inst = taxa.InstituicaoFinanceira.toUpperCase();
      if (!taxasPorInstituicao[inst]) {
        taxasPorInstituicao[inst] = [];
      }
      taxasPorInstituicao[inst].push(taxa.TaxaJurosAoMes);
    }

    // Resultados da sincronização
    const resultados: { banco: string, taxa_anterior: number | null, taxa_nova: number, sincronizado: boolean }[] = [];
    const erros: { banco: string, erro: string }[] = [];

    // Atualizar cada banco cadastrado
    for (const banco of bancosParaSincronizar) {
      let taxaEncontrada: number | null = null;
      let instituicaoEncontrada: string | null = null;

      // Primeiro, tentar pelo código BCB se existe
      if (banco.codigo_bcb) {
        for (const [, config] of Object.entries(BANCOS_MAPEAMENTO)) {
          if (config.codigo_bcb === banco.codigo_bcb) {
            for (const nomeInst of config.nomes) {
              const key = nomeInst.toUpperCase();
              if (taxasPorInstituicao[key] && taxasPorInstituicao[key].length > 0) {
                const taxas = taxasPorInstituicao[key];
                taxaEncontrada = taxas.reduce((a, b) => a + b, 0) / taxas.length;
                instituicaoEncontrada = nomeInst;
                break;
              }
            }
            if (taxaEncontrada) break;
          }
        }
      }

      // Se não encontrou pelo código, tentar pelo nome
      if (!taxaEncontrada) {
        for (const [nomePadrao, config] of Object.entries(BANCOS_MAPEAMENTO)) {
          // Verificar se o nome do banco contém alguma das palavras-chave
          if (banco.nome.toUpperCase().includes(nomePadrao.toUpperCase())) {
            for (const nomeInst of config.nomes) {
              const key = nomeInst.toUpperCase();
              if (taxasPorInstituicao[key] && taxasPorInstituicao[key].length > 0) {
                const taxas = taxasPorInstituicao[key];
                taxaEncontrada = taxas.reduce((a, b) => a + b, 0) / taxas.length;
                instituicaoEncontrada = nomeInst;
                break;
              }
            }
            if (taxaEncontrada) break;
          }
        }
      }

      if (taxaEncontrada !== null) {
        const taxaArredondada = Math.round(taxaEncontrada * 100) / 100;
        
        // Buscar taxa anterior para log
        const { data: bancoAtual } = await supabase
          .from('financiamento_bancos')
          .select('taxa_mensal')
          .eq('id', banco.id)
          .single();

        // Atualizar banco com nova taxa e marcar fonte como BCB
        const { error: updateError } = await supabase
          .from('financiamento_bancos')
          .update({ 
            taxa_mensal: taxaArredondada,
            fonte_sync: 'bcb',
            ultima_sync: new Date().toISOString(),
          })
          .eq('id', banco.id);

        if (updateError) {
          console.error(`[sync-taxas-bcb] Erro ao atualizar ${banco.nome}:`, updateError);
          erros.push({ banco: banco.nome, erro: updateError.message });
        } else {
          console.log(`[sync-taxas-bcb] ✅ ${banco.nome}: ${bancoAtual?.taxa_mensal || '?'}% → ${taxaArredondada}% (fonte: ${instituicaoEncontrada})`);
          resultados.push({ 
            banco: banco.nome, 
            taxa_anterior: bancoAtual?.taxa_mensal || null,
            taxa_nova: taxaArredondada,
            sincronizado: true 
          });
        }
      } else {
        console.log(`[sync-taxas-bcb] ⚠️ ${banco.nome}: Não encontrado na API do BCB`);
        erros.push({ banco: banco.nome, erro: "Não encontrado na API do Banco Central. Configure o código BCB ou sincronize manualmente." });
      }
    }

    // Atualizar timestamp global de sincronização
    await supabase
      .from('financiamento_api_config')
      .update({ ultima_sincronizacao: new Date().toISOString() })
      .eq('nome', 'Configuração de API');

    console.log(`[sync-taxas-bcb] Sincronização concluída. ${resultados.length} bancos atualizados, ${erros.length} erros.`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Taxas atualizadas para ${resultados.length} banco(s)`,
        resultados,
        erros,
        fonte: "Banco Central do Brasil - API de Taxas de Juros",
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error("[sync-taxas-bcb] Erro:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
