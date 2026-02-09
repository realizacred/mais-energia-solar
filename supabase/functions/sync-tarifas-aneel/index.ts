import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ANEEL Dados Abertos - Tarifas Homologadas Distribuidoras
// Resource ID do dataset de tarifas homologadas
const ANEEL_API_URL = "https://dadosabertos.aneel.gov.br/api/3/action/datastore_search";
const ANEEL_RESOURCE_ID = "fcf2906c-7c32-4b9b-a637-054e7a5234f4";

interface TarifaAneel {
  SigAgente: string;
  NomAgente: string;
  DscREH: string;
  DscBaseTarifaria: string;
  DscSubGrupo: string;
  DscModalidadeTarifaria: string;
  NomPostoTarifario: string;
  DscDetalhe: string;
  VlrTUSD: string;
  VlrTE: string;
  DatInicioVigencia: string;
  DatFimVigencia: string;
  NumCNPJDistribuidora: string;
}

interface ConcessionariaDb {
  id: string;
  nome: string;
  sigla: string | null;
  estado: string | null;
  tarifa_energia: number | null;
  tarifa_fio_b: number | null;
}

// Verificar autenticação admin
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
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();

  let userId: string | null = null;

  if (userError || !userData?.user) {
    try {
      const token = authHeader.replace('Bearer ', '');
      const payload = JSON.parse(atob(token.split('.')[1]));
      userId = payload.sub;
    } catch {
      return {
        authorized: false,
        error: new Response(
          JSON.stringify({ success: false, error: 'Não autorizado' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      };
    }
  } else {
    userId = userData.user.id;
  }

  if (!userId) {
    return {
      authorized: false,
      error: new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    };
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: roles } = await adminClient
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);

  const isAdmin = roles?.some(r => ['admin', 'gerente', 'financeiro'].includes(r.role));
  if (!isAdmin) {
    return {
      authorized: false,
      error: new Response(
        JSON.stringify({ success: false, error: 'Apenas administradores podem sincronizar tarifas' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    };
  }

  console.log("[sync-tarifas-aneel] Auth OK for user:", userId);
  return { authorized: true };
}

// Normalize string for matching
function normalizeStr(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9\s]/g, "")
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authCheck = await verifyAdminRole(req);
    if (!authCheck.authorized) {
      return authCheck.error!;
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Optional: sync only a specific concessionária
    let concessionariaId: string | null = null;
    try {
      const body = await req.json();
      concessionariaId = body?.concessionaria_id || null;
    } catch {
      // No body
    }

    console.log("[sync-tarifas-aneel] Iniciando sincronização com API da ANEEL...");

    // Fetch concessionárias from DB
    const { data: concessionarias, error: concError } = await supabase
      .from('concessionarias')
      .select('id, nome, sigla, estado, tarifa_energia, tarifa_fio_b');

    if (concError) throw concError;

    let concParaSincronizar = concessionarias || [];
    if (concessionariaId) {
      concParaSincronizar = concParaSincronizar.filter(c => c.id === concessionariaId);
    }

    if (concParaSincronizar.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Nenhuma concessionária para sincronizar", resultados: [], erros: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch tariffs from ANEEL
    // We filter for B1 (residential), conventional modality, most recent
    // The API uses CKAN datastore_search
    const filters = JSON.stringify({
      DscSubGrupo: "B1",
      DscModalidadeTarifaria: "Convencional",
      DscDetalhe: "Não se aplica",
      DscBaseTarifaria: "Tarifa de Aplicação",
    });

    const aneelUrl = `${ANEEL_API_URL}?resource_id=${ANEEL_RESOURCE_ID}&filters=${encodeURIComponent(filters)}&limit=500&sort=DatInicioVigencia desc`;

    console.log("[sync-tarifas-aneel] Consultando API ANEEL...");
    const response = await fetch(aneelUrl);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[sync-tarifas-aneel] Erro na API ANEEL:", response.status, errorText);
      throw new Error(`Erro na API da ANEEL: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !data.result?.records) {
      console.error("[sync-tarifas-aneel] Resposta inesperada da API:", JSON.stringify(data).substring(0, 500));
      throw new Error("Resposta inesperada da API da ANEEL");
    }

    const tarifas: TarifaAneel[] = data.result.records;
    console.log(`[sync-tarifas-aneel] Recebidas ${tarifas.length} tarifas da ANEEL`);

    // Build a map: sigla/nome → latest tariff
    // Group by SigAgente, keep only the most recent (highest DatInicioVigencia)
    const tarifasPorAgente: Record<string, TarifaAneel> = {};
    for (const t of tarifas) {
      if (!t.SigAgente) continue;
      const key = normalizeStr(t.SigAgente);
      if (!key) continue;
      const existing = tarifasPorAgente[key];
      if (!existing || t.DatInicioVigencia > existing.DatInicioVigencia) {
        tarifasPorAgente[key] = t;
      }
    }

    // Also index by full name
    const tarifasPorNome: Record<string, TarifaAneel> = {};
    for (const t of tarifas) {
      if (!t.NomAgente) continue;
      const key = normalizeStr(t.NomAgente);
      if (!key) continue;
      const existing = tarifasPorNome[key];
      if (!existing || t.DatInicioVigencia > existing.DatInicioVigencia) {
        tarifasPorNome[key] = t;
      }
    }

    console.log(`[sync-tarifas-aneel] ${Object.keys(tarifasPorAgente).length} distribuidoras únicas encontradas`);

    // Match and update
    const resultados: { concessionaria: string; tarifa_anterior: number | null; tarifa_nova: number; tusd: number; te: number; vigencia: string; sincronizado: boolean }[] = [];
    const erros: { concessionaria: string; erro: string }[] = [];

    for (const conc of concParaSincronizar) {
      let tarifa: TarifaAneel | undefined;

      // Try match by sigla first
      if (conc.sigla) {
        const siglaNorm = normalizeStr(conc.sigla);
        tarifa = tarifasPorAgente[siglaNorm];
      }

      // Try match by name
      if (!tarifa) {
        const nomeNorm = normalizeStr(conc.nome);
        tarifa = tarifasPorNome[nomeNorm];

        // Partial match: check if conc nome contains any agent sigla
        if (!tarifa) {
          for (const [agentKey, agentTarifa] of Object.entries(tarifasPorAgente)) {
            if (nomeNorm.includes(agentKey) || agentKey.includes(nomeNorm)) {
              tarifa = agentTarifa;
              break;
            }
          }
        }
      }

      if (tarifa) {
        const tusd = parseFloat(tarifa.VlrTUSD) || 0;
        const te = parseFloat(tarifa.VlrTE) || 0;
        const tarifaTotal = Math.round((tusd + te) * 10000) / 10000; // R$/kWh

        const { error: updateError } = await supabase
          .from('concessionarias')
          .update({
            tarifa_energia: tarifaTotal,
            ultima_sync_tarifas: new Date().toISOString(),
          })
          .eq('id', conc.id);

        if (updateError) {
          console.error(`[sync-tarifas-aneel] Erro ao atualizar ${conc.nome}:`, updateError);
          erros.push({ concessionaria: conc.nome, erro: updateError.message });
        } else {
          console.log(`[sync-tarifas-aneel] ✅ ${conc.nome} (${tarifa.SigAgente}): ${conc.tarifa_energia || '?'} → ${tarifaTotal} R$/kWh (TUSD: ${tusd} + TE: ${te}, vigência: ${tarifa.DatInicioVigencia})`);
          resultados.push({
            concessionaria: conc.nome,
            tarifa_anterior: conc.tarifa_energia,
            tarifa_nova: tarifaTotal,
            tusd,
            te,
            vigencia: tarifa.DatInicioVigencia,
            sincronizado: true,
          });
        }
      } else {
        console.log(`[sync-tarifas-aneel] ⚠️ ${conc.nome} (${conc.sigla || 'sem sigla'}): Não encontrado na API ANEEL`);
        erros.push({
          concessionaria: conc.nome,
          erro: `Não encontrada na ANEEL. Verifique se a sigla "${conc.sigla || ''}" corresponde ao código do agente na ANEEL.`,
        });
      }
    }

    console.log(`[sync-tarifas-aneel] Sincronização concluída. ${resultados.length} atualizadas, ${erros.length} erros.`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Tarifas atualizadas para ${resultados.length} concessionária(s)`,
        resultados,
        erros,
        fonte: "ANEEL - Dados Abertos (Tarifas Homologadas)",
        total_aneel: tarifas.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error("[sync-tarifas-aneel] Erro:", error);
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
