import { createClient } from "npm:@supabase/supabase-js@2";
import JSZip from "npm:jszip@3.10.1";
import { flattenSnapshot } from "../_shared/flattenSnapshot.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-client-timeout, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonOk(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Extract [placeholder] patterns from DOCX XML content */
function extractPlaceholders(xml: string): string[] {
  const regex = /\[([a-zA-Z_][a-zA-Z0-9_]*)\]/g;
  const found = new Set<string>();
  let match;
  while ((match = regex.exec(xml)) !== null) {
    found.add(match[1]);
  }
  return Array.from(found);
}

/** Extract placeholders from a DOCX buffer by reading document.xml */
async function extractPlaceholdersFromDocx(buffer: Uint8Array): Promise<string[]> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const allPlaceholders = new Set<string>();

    // Read main document and headers/footers
    const xmlFiles = Object.keys(zip.files).filter(
      (f) => f.endsWith(".xml") && (f.includes("document") || f.includes("header") || f.includes("footer"))
    );

    for (const xmlFile of xmlFiles) {
      const content = await zip.files[xmlFile].async("string");
      for (const ph of extractPlaceholders(content)) {
        allPlaceholders.add(ph);
      }
    }

    return Array.from(allPlaceholders);
  } catch (e) {
    console.error("[audit-variables] Error reading DOCX:", e);
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return jsonError("Não autorizado", 401);

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Get tenant
    const { data: profile } = await adminClient
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();
    if (!profile?.tenant_id) return jsonError("Tenant não encontrado", 403);
    const tenantId = profile.tenant_id;

    const body = await req.json();
    const mode = body.mode || "quick";
    const propostaId = body.proposta_id as string | undefined;

    console.log(`[audit-variables] mode=${mode}, tenant=${tenantId}`);

    // ── Step 1: Get active templates ────────────────────────
    const { data: templates, error: tmplErr } = await adminClient
      .from("proposta_templates")
      .select("id, nome, file_url, ativo")
      .eq("tenant_id", tenantId)
      .eq("ativo", true)
      .eq("tipo", "docx");

    if (tmplErr) {
      console.error("[audit-variables] Error fetching templates:", tmplErr);
      return jsonError("Erro ao buscar templates", 500);
    }

    const templatesAtivos = templates?.length ?? 0;

    // ── Step 2: Extract placeholders from each template ─────
    const allPlaceholders = new Set<string>();
    const templatePlaceholders: Record<string, string[]> = {};

    for (const tmpl of (templates ?? [])) {
      if (!tmpl.file_url) continue;

      try {
        // Extract storage path
        const fileUrlStr = tmpl.file_url as string;
        let storagePath: string;

        if (fileUrlStr.startsWith("http")) {
          const storageMarker = "/proposta-templates/";
          const markerIdx = fileUrlStr.indexOf(storageMarker);
          if (markerIdx === -1) continue;
          const rawPath = fileUrlStr.slice(markerIdx + storageMarker.length);
          storagePath = decodeURIComponent(rawPath).replace(/\+/g, " ");
        } else {
          storagePath = fileUrlStr;
        }

        const { data: fileData, error: fileErr } = await adminClient.storage
          .from("proposta-templates")
          .download(storagePath);

        if (fileErr || !fileData) {
          console.warn(`[audit-variables] Could not download template ${tmpl.nome}:`, fileErr?.message);
          continue;
        }

        const buffer = new Uint8Array(await fileData.arrayBuffer());
        const phs = await extractPlaceholdersFromDocx(buffer);
        templatePlaceholders[tmpl.nome] = phs;
        for (const ph of phs) allPlaceholders.add(ph);
      } catch (e) {
        console.warn(`[audit-variables] Error processing template ${tmpl.nome}:`, e);
      }
    }

    const variaveisEncontradas = Array.from(allPlaceholders);

    // ── Step 3: Test against a real proposal ────────────────
    // Find a proposal to test with
    let testPropostaId = propostaId;
    if (!testPropostaId) {
      const { data: recentProposta } = await adminClient
        .from("propostas_nativas")
        .select("id")
        .eq("tenant_id", tenantId)
        .neq("status", "excluida")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      testPropostaId = recentProposta?.id;
    }

    let resolvedVars: Record<string, string> = {};
    let quebradas: string[] = [];
    let nulas: string[] = [];
    let ok: string[] = [];

    if (testPropostaId) {
      // Get proposal data
      const { data: prop } = await adminClient
        .from("propostas_nativas")
        .select("id, lead_id, cliente_id, consultor_id, projeto_id")
        .eq("id", testPropostaId)
        .single();

      const { data: versao } = await adminClient
        .from("proposta_versoes")
        .select("snapshot, valor_total, potencia_kwp, economia_mensal, payback_meses, validade_dias, versao_numero")
        .eq("proposta_id", testPropostaId)
        .order("versao_numero", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (prop && versao?.snapshot) {
        // Fetch related data in parallel
        const [leadR, clienteR, projetoR, consultorR, tenantR, brandR] = await Promise.all([
          prop.lead_id
            ? adminClient.from("leads").select("*").eq("id", prop.lead_id).single()
            : Promise.resolve({ data: null, error: null }),
          prop.cliente_id
            ? adminClient.from("clientes").select("*").eq("id", prop.cliente_id).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          prop.projeto_id
            ? adminClient.from("projetos").select("*").eq("id", prop.projeto_id).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          prop.consultor_id
            ? adminClient.from("consultores").select("nome, telefone, email, codigo").eq("id", prop.consultor_id).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          adminClient.from("tenants").select("nome").eq("id", tenantId).maybeSingle(),
          adminClient.from("brand_settings").select("logo_url, representante_legal, representante_cpf, representante_cargo").eq("tenant_id", tenantId).maybeSingle(),
        ]);

        const snapshot = versao.snapshot as Record<string, unknown>;
        resolvedVars = flattenSnapshot(snapshot, {
          lead: leadR.data,
          cliente: clienteR.data,
          projeto: projetoR.data,
          consultor: consultorR.data,
          tenantNome: tenantR.data?.nome,
          versaoData: versao as Record<string, unknown>,
          propostaData: prop as Record<string, unknown>,
          brandSettings: (brandR.data ?? {}) as Record<string, unknown>,
          projetoData: (projetoR.data ?? {}) as Record<string, unknown>,
          clienteData: (clienteR.data ?? {}) as Record<string, unknown>,
        });
      }

      // Classify each placeholder
      for (const ph of variaveisEncontradas) {
        const val = resolvedVars[ph];
        if (val === undefined || val === null) {
          quebradas.push(ph);
        } else if (val === "" || val === "-" || val === "–") {
          nulas.push(ph);
        } else {
          ok.push(ph);
        }
      }
    } else {
      // No proposal to test — all are unknown
      quebradas = variaveisEncontradas;
    }

    const quickResult = {
      templates_ativos: templatesAtivos,
      template_details: Object.entries(templatePlaceholders).map(([nome, phs]) => ({
        nome,
        total_placeholders: phs.length,
      })),
      variaveis_encontradas: variaveisEncontradas,
      quebradas,
      nulas,
      ok,
      total_variaveis: variaveisEncontradas.length,
      gerado_em: new Date().toISOString(),
    };

    // ── QUICK mode: return here ─────────────────────────────
    if (mode === "quick") {
      // Save report
      await adminClient.from("variable_audit_reports").insert({
        tenant_id: tenantId,
        mode: "quick",
        templates_ativos: quickResult.templates_ativos,
        total_variaveis: quickResult.total_variaveis,
        quebradas: quebradas.length,
        nulas: nulas.length,
        ok: ok.length,
        variaveis_encontradas: variaveisEncontradas,
        variaveis_quebradas: quebradas,
        variaveis_nulas: nulas,
      });

      return jsonOk(quickResult);
    }

    // ── FULL mode: AI analysis ──────────────────────────────
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return jsonOk({
        ...quickResult,
        analise_ia: "LOVABLE_API_KEY não configurada. Análise com IA indisponível.",
        prompt_lovable: null,
      });
    }

    // Build context for AI
    const aiContext = {
      quebradas: quebradas.slice(0, 50),
      nulas: nulas.slice(0, 30),
      ok_count: ok.length,
      templates_ativos: templatesAtivos,
      template_details: Object.entries(templatePlaceholders).map(([nome, phs]) => ({
        nome,
        placeholders: phs.slice(0, 20),
      })),
    };

    const systemPrompt = `Você é um engenheiro de software especialista em sistemas de geração de propostas comerciais de energia solar.
O sistema usa templates DOCX com variáveis [placeholder] que são substituídas por valores reais ao gerar o PDF.
Analise os problemas encontrados na auditoria e forneça:
1. Um diagnóstico claro e objetivo em português
2. Priorize os problemas mais críticos
3. Gere um prompt pronto para ser colado no Lovable para corrigir os problemas

REGRAS:
- Seja direto e técnico
- Use linguagem em português
- O prompt deve ser específico e acionável
- Agrupe problemas similares`;

    const userPrompt = `Auditoria de variáveis encontrou os seguintes problemas:

VARIÁVEIS QUEBRADAS (sem resolver — aparecem como [placeholder] literal no PDF):
${quebradas.length > 0 ? quebradas.map(v => `- [${v}]`).join("\n") : "Nenhuma"}

VARIÁVEIS COM VALOR NULO (resolver existe mas retorna vazio):
${nulas.length > 0 ? nulas.map(v => `- [${v}]`).join("\n") : "Nenhuma"}

VARIÁVEIS OK: ${ok.length}
TEMPLATES ATIVOS: ${templatesAtivos}

Detalhes dos templates:
${JSON.stringify(aiContext.template_details, null, 2)}

Forneça:
1. ANÁLISE: Diagnóstico dos problemas (máximo 300 palavras)
2. PROMPT_LOVABLE: Um prompt pronto para colar no chat do Lovable que corrija os problemas encontrados`;

    let analiseIa = "";
    let promptLovable = "";

    try {
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        const fullText = aiData.choices?.[0]?.message?.content ?? "";

        // Parse sections
        const analiseMatch = fullText.match(/(?:ANÁLISE|ANALISE|1\.\s*ANÁLISE)[:\s]*([\s\S]*?)(?=(?:PROMPT_LOVABLE|2\.\s*PROMPT)|$)/i);
        const promptMatch = fullText.match(/(?:PROMPT_LOVABLE|2\.\s*PROMPT)[:\s]*([\s\S]*?)$/i);

        analiseIa = analiseMatch?.[1]?.trim() || fullText;
        promptLovable = promptMatch?.[1]?.trim() || "";

        // Clean markdown code blocks from prompt
        promptLovable = promptLovable
          .replace(/^```[a-z]*\n?/gm, "")
          .replace(/```$/gm, "")
          .trim();
      } else {
        const errText = await aiResponse.text();
        console.error("[audit-variables] AI error:", aiResponse.status, errText);

        if (aiResponse.status === 429) {
          analiseIa = "Rate limit excedido. Tente novamente em alguns minutos.";
        } else if (aiResponse.status === 402) {
          analiseIa = "Créditos de IA insuficientes. Adicione créditos em Settings → Workspace → Usage.";
        } else {
          analiseIa = "Erro ao consultar IA. Tente novamente.";
        }
      }
    } catch (aiErr) {
      console.error("[audit-variables] AI call failed:", aiErr);
      analiseIa = "Erro de conexão com o serviço de IA.";
    }

    const fullResult = {
      ...quickResult,
      analise_ia: analiseIa,
      prompt_lovable: promptLovable || null,
    };

    // Save full report
    await adminClient.from("variable_audit_reports").insert({
      tenant_id: tenantId,
      mode: "full",
      templates_ativos: quickResult.templates_ativos,
      total_variaveis: quickResult.total_variaveis,
      quebradas: quebradas.length,
      nulas: nulas.length,
      ok: ok.length,
      variaveis_encontradas: variaveisEncontradas,
      variaveis_quebradas: quebradas,
      variaveis_nulas: nulas,
      analise_ia: analiseIa,
      prompt_lovable: promptLovable || null,
    });

    return jsonOk(fullResult);
  } catch (e) {
    console.error("[audit-variables] Unexpected error:", e);
    return jsonError(e instanceof Error ? e.message : "Erro interno", 500);
  }
});
