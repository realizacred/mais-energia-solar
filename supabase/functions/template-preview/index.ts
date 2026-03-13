import { createClient } from "npm:@supabase/supabase-js@2";
import JSZip from "npm:jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-client-timeout, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Robust DOCX template processor.
 * Step 1: Normalize split placeholders by merging <w:r> runs within each <w:p>.
 * Step 2: Simple [key] → value substitution on the normalized XML.
 * Step 3: Final sweep to blank out any unresolved [placeholder] tags.
 */
async function processDocxTemplate(
  templateBytes: Uint8Array,
  vars: Record<string, string>,
): Promise<{ output: Uint8Array; missingVars: string[] }> {
  const zip = await JSZip.loadAsync(templateBytes);
  const missingVars: string[] = [];

  const xmlFiles = Object.keys(zip.files).filter((fileName) =>
    /^word\/(document|header\d+|footer\d+|footnotes|endnotes|comments)\.xml$/i.test(fileName),
  );

  for (const fileName of xmlFiles) {
    const file = zip.file(fileName);
    if (!file || file.dir) continue;

    let content = await file.async("string");
    let modified = false;

    // ── STEP 1: Normalize split runs paragraph-by-paragraph ──
    content = normalizeParagraphRuns(content);

    // ── STEP 2: Direct [key] → value substitution ──
    for (const [key, value] of Object.entries(vars)) {
      const safeValue = escapeXml(value);
      const pattern = `[${key}]`;
      if (content.includes(pattern)) {
        content = content.replaceAll(pattern, safeValue);
        modified = true;
      }
    }

    // ── STEP 3: Final sweep — blank remaining *valid placeholders* only ──
    // Important: avoid matching arbitrary bracket tokens like [3212], which can exist in DOCX internals.
    const remainingPattern = /\[([a-zA-Z_][a-zA-Z0-9_.-]{0,120})\]/g;
    let remaining;
    const localMissing: string[] = [];
    while ((remaining = remainingPattern.exec(content)) !== null) {
      const varName = remaining[1];
      if (!localMissing.includes(varName)) {
        localMissing.push(varName);
      }
    }

    for (const varName of localMissing) {
      const pattern = `[${varName}]`;
      if (content.includes(pattern)) {
        content = content.replaceAll(pattern, "");
        modified = true;
      }
      if (!missingVars.includes(varName)) {
        missingVars.push(varName);
      }
    }

    if (modified) {
      if (!isValidXmlDocument(content)) {
        console.error(`[template-preview] Invalid XML detected after replacement in ${fileName}; keeping original content.`);
        continue;
      }
      zip.file(fileName, content);
    }
  }

  const output = await zip.generateAsync({ type: "uint8array" });
  return { output, missingVars };
}

/**
 * Normalize runs inside each <w:p> paragraph so that placeholders
 * split across multiple <w:r> runs are merged into single runs.
 *
 * For every paragraph that contains a bracket character:
 * 1. Extract all <w:r> runs (preserving inter-run XML like <w:pPr>).
 * 2. Concatenate the text content of all runs.
 * 3. If the concatenated text contains [...], identify which runs
 *    participate in each placeholder span (from '[' to ']').
 * 4. Merge those runs into a single <w:r>, keeping the <w:rPr>
 *    of the first run in each group. Runs outside placeholders
 *    are left untouched.
 */
function normalizeParagraphRuns(xml: string): string {
  // Match each <w:p ...>...</w:p> (non-greedy, handles nested tags via [^] not .)
  const paraPattern = /<w:p[\s>][^]*?<\/w:p>/g;

  return xml.replace(paraPattern, (paraXml) => {
    // Quick check: does this paragraph even contain a bracket?
    if (!paraXml.includes("[")) return paraXml;

    // Extract runs: each <w:r>...</w:r> or <w:r ...>...</w:r>
    const runPattern = /<w:r[\s>][^]*?<\/w:r>/g;
    const runs: Array<{ xml: string; text: string; rPr: string }> = [];
    let runMatch;
    while ((runMatch = runPattern.exec(paraXml)) !== null) {
      const runXml = runMatch[0];
      // Extract <w:rPr>...</w:rPr> if present
      const rPrMatch = runXml.match(/<w:rPr>[^]*?<\/w:rPr>/);
      const rPr = rPrMatch ? rPrMatch[0] : "";
      // Extract text from <w:t ...>text</w:t>
      const textMatch = runXml.match(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/);
      const text = textMatch ? textMatch[1] : "";
      runs.push({ xml: runXml, text, rPr });
    }

    if (runs.length === 0) return paraXml;

    // Concatenate all run texts
    const fullText = runs.map((r) => r.text).join("");
    if (!fullText.includes("[")) return paraXml;

    // Build a char→run index map
    // charRunIdx[i] = which run index owns character i
    const charRunIdx: number[] = [];
    for (let ri = 0; ri < runs.length; ri++) {
      for (let ci = 0; ci < runs[ri].text.length; ci++) {
        charRunIdx.push(ri);
      }
    }

    // Find all [placeholder] spans in the concatenated text
    const phPattern = /\[[^\]]+\]/g;
    let phMatch;
    // Track which run ranges need merging: Set<"startRunIdx-endRunIdx">
    const mergeSpans: Array<[number, number]> = [];
    while ((phMatch = phPattern.exec(fullText)) !== null) {
      const startChar = phMatch.index;
      const endChar = startChar + phMatch[0].length - 1;
      const startRun = charRunIdx[startChar];
      const endRun = charRunIdx[endChar];
      if (startRun !== endRun) {
        // This placeholder spans multiple runs — needs merging
        mergeSpans.push([startRun, endRun]);
      }
    }

    if (mergeSpans.length === 0) return paraXml;

    // Merge overlapping/adjacent spans
    mergeSpans.sort((a, b) => a[0] - b[0]);
    const merged: Array<[number, number]> = [mergeSpans[0]];
    for (let i = 1; i < mergeSpans.length; i++) {
      const prev = merged[merged.length - 1];
      if (mergeSpans[i][0] <= prev[1]) {
        prev[1] = Math.max(prev[1], mergeSpans[i][1]);
      } else {
        merged.push(mergeSpans[i]);
      }
    }

    // Build new runs array by merging identified spans
    const newRuns: Array<{ xml: string }> = [];
    let ri = 0;
    while (ri < runs.length) {
      const span = merged.find((s) => s[0] === ri);
      if (span) {
        // Merge runs[span[0]..span[1]] into one
        const groupRuns = runs.slice(span[0], span[1] + 1);
        const combinedText = groupRuns.map((r) => r.text).join("");
        const rPr = groupRuns[0].rPr; // keep first run's formatting
        const mergedRunXml = `<w:r>${rPr}<w:t xml:space="preserve">${combinedText}</w:t></w:r>`;
        newRuns.push({ xml: mergedRunXml });
        ri = span[1] + 1;
      } else {
        newRuns.push({ xml: runs[ri].xml });
        ri++;
      }
    }

    // Rebuild the paragraph: replace runs in the original XML
    // Strategy: find the first run start and last run end, replace that region
    const firstRunIdx = paraXml.indexOf(runs[0].xml);
    const lastRun = runs[runs.length - 1];
    const lastRunIdx = paraXml.lastIndexOf(lastRun.xml);
    const lastRunEnd = lastRunIdx + lastRun.xml.length;

    if (firstRunIdx < 0 || lastRunIdx < 0) return paraXml; // safety

    const before = paraXml.substring(0, firstRunIdx);
    const after = paraXml.substring(lastRunEnd);

    // Preserve any non-run XML between runs (e.g., <w:bookmarkStart>, <w:proofErr>)
    // by walking through the original paragraph region and keeping inter-run content
    const runsRegion = paraXml.substring(firstRunIdx, lastRunEnd);
    const interRunContent: string[] = [];
    let searchPos = 0;
    for (let i = 0; i < runs.length; i++) {
      const pos = runsRegion.indexOf(runs[i].xml, searchPos);
      if (pos > searchPos) {
        // There's non-run XML between previous run end and this run start
        interRunContent.push(runsRegion.substring(searchPos, pos));
      } else {
        interRunContent.push("");
      }
      searchPos = pos + runs[i].xml.length;
    }
    // Any trailing non-run content after last run
    const trailingContent = searchPos < runsRegion.length ? runsRegion.substring(searchPos) : "";

    // Rebuild: map original run indices to new runs, preserving inter-run content
    let rebuiltRegion = "";
    let origIdx = 0;
    for (const newRun of newRuns) {
      // Add inter-run content from the original run at origIdx
      if (origIdx < interRunContent.length) {
        rebuiltRegion += interRunContent[origIdx];
      }
      rebuiltRegion += newRun.xml;

      // Figure out how many original runs this new run consumed
      const span = merged.find((s) => s[0] === origIdx);
      if (span) {
        origIdx = span[1] + 1;
      } else {
        origIdx++;
      }
    }
    rebuiltRegion += trailingContent;

    return before + rebuiltRegion + after;
  });
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function isValidXmlDocument(xml: string): boolean {
  try {
    const parsed = new DOMParser().parseFromString(xml, "application/xml");
    return !parsed.querySelector("parsererror");
  } catch {
    return false;
  }
}

// ─── Main handler ─────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    // ── 1. AUTH + TENANT ──────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonError("Não autorizado", 401);
    }

    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await callerClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return jsonError("Token inválido", 401);
    const userId = claimsData.claims.sub as string;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: profile } = await adminClient
      .from("profiles")
      .select("tenant_id, ativo")
      .eq("user_id", userId)
      .single();
    if (!profile?.tenant_id || !profile.ativo) return jsonError("Usuário inativo ou sem tenant", 403);
    const tenantId = profile.tenant_id;

    // ── 2. PARSE BODY ─────────────────────────────────────
    const body = await req.json();
    const { template_id, proposta_id, lead_id: bodyLeadId } = body;

    if (!template_id) {
      return jsonError("template_id é obrigatório", 400);
    }
    if (!proposta_id && !bodyLeadId) {
      return jsonError("proposta_id ou lead_id é obrigatório", 400);
    }

    // ── 3. BUSCAR TEMPLATE ────────────────────────────────
    const { data: template, error: tmplErr } = await adminClient
      .from("proposta_templates")
      .select("id, nome, tipo, file_url, template_html")
      .eq("id", template_id)
      .eq("tenant_id", tenantId)
      .single();

    if (tmplErr || !template) return jsonError("Template não encontrado neste tenant", 404);
    if (template.tipo !== "docx" || !template.file_url) {
      return jsonError("Template não é DOCX ou não tem arquivo", 400);
    }

    // ── 4. RESOLVER PROPOSTA → LEAD/CLIENTE/PROJETO ───────
    let leadId = bodyLeadId;
    let propostaData: any = null;
    let versaoData: any = null;

    if (proposta_id) {
      const { data: proposta, error: propErr } = await adminClient
        .from("propostas_nativas")
        .select("id, titulo, codigo, status, lead_id, cliente_id, consultor_id, projeto_id")
        .eq("id", proposta_id)
        .eq("tenant_id", tenantId)
        .single();

      if (propErr || !proposta) return jsonError("Proposta não encontrada neste tenant", 404);
      propostaData = proposta;
      leadId = proposta.lead_id;

      // Buscar versão mais recente com snapshot
      const { data: versao } = await adminClient
        .from("proposta_versoes")
        .select("snapshot, valor_total, potencia_kwp, economia_mensal, payback_meses, validade_dias, versao_numero")
        .eq("proposta_id", proposta_id)
        .order("versao_numero", { ascending: false })
        .limit(1)
        .maybeSingle();

      versaoData = versao;
    }

    // ── 5. BUSCAR DADOS RELACIONADOS ──────────────────────
    const [leadRes, clienteRes, projetoRes, consultorRes] = await Promise.all([
      leadId
        ? adminClient
            .from("leads")
            .select("id, nome, telefone, cidade, estado, media_consumo, valor_estimado, cep, rua, numero, bairro, area, tipo_telhado, rede_atendimento, consumo_previsto, observacoes")
            .eq("id", leadId)
            .eq("tenant_id", tenantId)
            .single()
        : Promise.resolve({ data: null, error: null }),
      propostaData?.cliente_id
        ? adminClient
            .from("clientes")
            .select("nome, telefone, email, cpf_cnpj, cidade, estado, bairro, rua, numero, cep, potencia_kwp, valor_projeto, empresa, complemento, data_nascimento, numero_placas, modelo_inversor")
            .eq("id", propostaData.cliente_id)
            .eq("tenant_id", tenantId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      propostaData?.projeto_id
        ? adminClient
            .from("projetos")
            .select("codigo, status, potencia_kwp, valor_total, numero_modulos, modelo_inversor, modelo_modulos, data_instalacao, geracao_mensal_media_kwh, tipo_instalacao, forma_pagamento")
            .eq("id", propostaData.projeto_id)
            .eq("tenant_id", tenantId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      propostaData?.consultor_id
        ? adminClient
            .from("consultores")
            .select("nome, telefone, email, codigo")
            .eq("id", propostaData.consultor_id)
            .eq("tenant_id", tenantId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    const lead = leadRes.data;
    const cliente = clienteRes.data;
    const projeto = projetoRes.data as any;
    const consultor = consultorRes.data as any;

    // ── 6. MONTAR MAPA DE VARIÁVEIS ───────────────────────
    const now = new Date();
    const fmtCur = (v: number) =>
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

    const vars: Record<string, string> = {};

    // 6a. Se tiver snapshot, extrair campos úteis (evitar objetos complexos)
    const snapshot = versaoData?.snapshot as Record<string, any> | null;
    if (snapshot && typeof snapshot === "object") {
      for (const [key, value] of Object.entries(snapshot)) {
        if (value !== null && value !== undefined && value !== "" && typeof value !== "object") {
          vars[key] = String(value);
        }
      }
    }

    // 6b. Sobrescrever/complementar com dados estruturados
    const set = (legacy: string, value: string | number | null | undefined) => {
      if (value !== null && value !== undefined && value !== "") {
        vars[legacy] = String(value);
      }
    };

    // Cliente
    set("cliente_nome", cliente?.nome || lead?.nome);
    set("cliente_celular", cliente?.telefone || lead?.telefone);
    set("cliente_email", cliente?.email);
    set("cliente_cnpj_cpf", cliente?.cpf_cnpj);
    set("cliente_empresa", cliente?.empresa);
    set("cliente_cep", cliente?.cep || lead?.cep);
    set("cliente_endereco", cliente?.rua || lead?.rua);
    set("cliente_numero", cliente?.numero || lead?.numero);
    set("cliente_complemento", cliente?.complemento);
    set("cliente_bairro", cliente?.bairro || lead?.bairro);
    set("cliente_cidade", cliente?.cidade || lead?.cidade);
    set("cliente_estado", cliente?.estado || lead?.estado);

    // Entrada
    set("consumo_mensal", lead?.media_consumo);
    set("cidade", cliente?.cidade || lead?.cidade);
    set("estado", cliente?.estado || lead?.estado);
    set("tipo_telhado", lead?.tipo_telhado);
    set("cape_telhado", lead?.tipo_telhado);
    set("fase", lead?.rede_atendimento);

    // Sistema Solar
    const potencia = versaoData?.potencia_kwp || projeto?.potencia_kwp || cliente?.potencia_kwp;
    set("potencia_sistema", potencia ? `${potencia} kWp` : undefined);
    set("potencia_si", potencia ? `${potencia} kWp` : undefined);
    set("modulo_quantidade", projeto?.numero_modulos || cliente?.numero_placas);
    set("inversor_modelo", projeto?.modelo_inversor || cliente?.modelo_inversor);
    set("modulo_modelo", projeto?.modelo_modulos);
    set("geracao_mensal", projeto?.geracao_mensal_media_kwh);

    // Financeiro
    const valorTotal = versaoData?.valor_total || projeto?.valor_total || lead?.valor_estimado || cliente?.valor_projeto;
    if (valorTotal) {
      set("valor_total", fmtCur(valorTotal));
      set("preco_final", fmtCur(valorTotal));
      set("preco_total", fmtCur(valorTotal));
      set("vc_a_vista", fmtCur(valorTotal));
    }
    if (versaoData?.economia_mensal) {
      set("economia_mensal", fmtCur(versaoData.economia_mensal));
    }
    if (versaoData?.payback_meses != null) {
      set("payback", `${versaoData.payback_meses} meses`);
      set("payback_meses", String(versaoData.payback_meses));
    }

    // Comercial
    set("proposta_data", now.toLocaleDateString("pt-BR"));
    set("proposta_titulo", propostaData?.titulo || cliente?.nome || lead?.nome);
    set("proposta_identificador", propostaData?.codigo);
    const validadeDias = versaoData?.validade_dias || 15;
    set("proposta_validade", new Date(now.getTime() + validadeDias * 86400000).toLocaleDateString("pt-BR"));

    // Consultor / Responsável
    if (consultor) {
      set("consultor_nome", consultor.nome);
      set("responsavel_nome", consultor.nome);
      set("responsavel_nom", consultor.nome);
      set("consultor_telefone", consultor.telefone);
      set("consultor_email", consultor.email);
    }

    // Observações
    set("vc_observacao", lead?.observacoes);

    console.log(`[template-preview] Variables mapped: ${Object.keys(vars).length} keys`);

    // ── 7. BAIXAR O DOCX DO STORAGE ───────────────────────
    // The bucket is PRIVATE, so we extract the storage path from the URL
    // and use the admin client to download instead of a public fetch.
    console.log(`[template-preview] Downloading DOCX from: ${template.file_url}`);

    let templateBuffer: Uint8Array;
    try {
      // Extract bucket and path from the stored URL
      // URL format: https://<ref>.supabase.co/storage/v1/object/public/<bucket>/<path>
      const urlObj = new URL(template.file_url);
      const storagePath = urlObj.pathname.replace(/^\/storage\/v1\/object\/(?:public|sign)\//, "");
      // storagePath = "proposta-templates/<tenant>/<filename>"
      const firstSlash = storagePath.indexOf("/");
      const bucketName = storagePath.substring(0, firstSlash);
      const filePath = decodeURIComponent(storagePath.substring(firstSlash + 1));

      console.log(`[template-preview] Downloading via Storage API: bucket=${bucketName}, path=${filePath}`);

      const { data: fileData, error: dlError } = await adminClient.storage
        .from(bucketName)
        .download(filePath);

      if (dlError || !fileData) {
        console.error("[template-preview] Storage download error:", dlError?.message);
        return jsonError(`Erro ao baixar template DOCX: ${dlError?.message || "arquivo não encontrado"}`, 500);
      }

      templateBuffer = new Uint8Array(await fileData.arrayBuffer());
      console.log(`[template-preview] DOCX downloaded: ${templateBuffer.byteLength} bytes`);
    } catch (fetchErr: any) {
      console.error("[template-preview] Download error:", fetchErr?.message);
      return jsonError(`Erro ao baixar template: ${fetchErr?.message}`, 500);
    }

    // ── 8. PROCESSAR TEMPLATE ─────────────────────────────
    console.log(`[template-preview] Processing DOCX with JSZip-based replacer`);

    let report: Uint8Array;
    try {
      const result = await processDocxTemplate(templateBuffer, vars);
      report = result.output;
      if (result.missingVars.length > 0) {
        console.warn(`[template-preview] Missing variables (${result.missingVars.length}):`, result.missingVars);
      }
      console.log(`[template-preview] Processing OK, output: ${report.length} bytes`);
    } catch (processErr: any) {
      console.error("[template-preview] Processing error:", processErr?.message, processErr?.stack);
      return jsonError(`Erro ao processar template DOCX: ${processErr?.message || "unknown"}`, 500);
    }

    // ── 9. RETORNAR O ARQUIVO PROCESSADO ──────────────────
    const clienteNome = cliente?.nome || lead?.nome || "preview";
    const fileName = `preview_${template.nome.replace(/[^a-zA-Z0-9]/g, "_")}_${clienteNome.replace(/[^a-zA-Z0-9]/g, "_")}.docx`;
    console.log(`[template-preview] Returning ${report.length} bytes as ${fileName}`);

    return new Response(report, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (err: any) {
    console.error("[template-preview] Error:", err?.message, err?.stack);
    return jsonError(err?.message ?? "Erro interno", 500);
  }
});

function jsonError(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}