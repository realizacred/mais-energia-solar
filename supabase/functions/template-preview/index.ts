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
      const xmlValid = isValidXmlDocument(content);
      if (!xmlValid) {
        console.warn(`[template-preview] XML validation warning in ${fileName} — saving anyway (DOMParser may not fully support OOXML namespaces).`);
      }
      zip.file(fileName, content);
    }
  }

  const output = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
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
  // Match each <w:p ...>...</w:p>
  const paraPattern = /<w:p[\s>][^]*?<\/w:p>/g;

  return xml.replace(paraPattern, (paraXml) => {
    // Quick check: does this paragraph contain a bracket?
    if (!paraXml.includes("[")) return paraXml;

    // SAFETY: Skip paragraphs containing drawings, images, or complex elements
    // These have positional/structural XML that must not be touched
    if (
      paraXml.includes("<w:drawing") ||
      paraXml.includes("<mc:AlternateContent") ||
      paraXml.includes("<w:pict") ||
      paraXml.includes("<w:object") ||
      paraXml.includes("<w:fldChar") ||
      paraXml.includes("<w:instrText")
    ) {
      return paraXml;
    }

    // Extract runs
    const runPattern = /<w:r[\s>][^]*?<\/w:r>/g;
    const runs: Array<{ fullMatch: string; text: string; rPr: string; startIdx: number }> = [];
    let runMatch;
    while ((runMatch = runPattern.exec(paraXml)) !== null) {
      const runXml = runMatch[0];
      const rPrMatch = runXml.match(/<w:rPr>[^]*?<\/w:rPr>/);
      const rPr = rPrMatch ? rPrMatch[0] : "";
      const textMatch = runXml.match(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/);
      const text = textMatch ? textMatch[1] : "";
      runs.push({ fullMatch: runXml, text, rPr, startIdx: runMatch.index });
    }

    if (runs.length < 2) return paraXml;

    // Concatenate all run texts
    const fullText = runs.map((r) => r.text).join("");
    if (!fullText.includes("[")) return paraXml;

    // Find placeholder spans that cross run boundaries
    const phPattern = /\[[a-zA-Z_][a-zA-Z0-9_.\-]{0,120}\]/g;
    let phMatch;
    const charRunIdx: number[] = [];
    for (let ri = 0; ri < runs.length; ri++) {
      for (let ci = 0; ci < runs[ri].text.length; ci++) {
        charRunIdx.push(ri);
      }
    }

    const mergeSpans: Array<[number, number]> = [];
    while ((phMatch = phPattern.exec(fullText)) !== null) {
      const startChar = phMatch.index;
      const endChar = startChar + phMatch[0].length - 1;
      if (startChar >= charRunIdx.length || endChar >= charRunIdx.length) continue;
      const startRun = charRunIdx[startChar];
      const endRun = charRunIdx[endChar];
      if (startRun !== endRun) {
        mergeSpans.push([startRun, endRun]);
      }
    }

    if (mergeSpans.length === 0) return paraXml;

    // Merge overlapping spans
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

    // Instead of rebuilding the entire paragraph, do targeted replacements:
    // For each merge span, replace the sequence of runs with a single merged run.
    // Work backwards so indices don't shift.
    let result = paraXml;
    for (let si = merged.length - 1; si >= 0; si--) {
      const [startRun, endRun] = merged[si];

      const firstRun = runs[startRun];
      const lastRun = runs[endRun];

      // Find the exact positions of the first and last run in the paragraph XML
      const regionStart = firstRun.startIdx;
      const regionEnd = lastRun.startIdx + lastRun.fullMatch.length;

      // Combine text from all runs in the span
      const combinedText = runs
        .slice(startRun, endRun + 1)
        .map((r) => r.text)
        .join("");

      // Keep the formatting of the first run
      const rPr = firstRun.rPr;
      const mergedRun = `<w:r>${rPr}<w:t xml:space="preserve">${combinedText}</w:t></w:r>`;

      // Replace the region (from first run start to last run end) but preserve
      // any non-run XML between the runs (bookmarks, proofErr, etc.)
      // Strategy: remove ALL original runs in the span, keep inter-run XML, prepend merged run
      const region = result.substring(regionStart, regionEnd);

      // Remove all original runs from the region and collect inter-run content
      let cleanedRegion = region;
      for (let ri = startRun; ri <= endRun; ri++) {
        cleanedRegion = cleanedRegion.replace(runs[ri].fullMatch, "");
      }
      // cleanedRegion now has only inter-run XML (bookmarks etc.), which we discard
      // since it's usually just proofErr/spelling markers between split placeholder runs

      result = result.substring(0, regionStart) + mergedRun + result.substring(regionEnd);
    }

    return result;
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

    // Helper: set only if not already set (from snapshot)
    const setIfMissing = (key: string, value: string | number | null | undefined) => {
      if (!vars[key] && value !== null && value !== undefined && value !== "") {
        vars[key] = String(value);
      }
    };

    const fmtNum = (v: number, decimals = 2) =>
      new Intl.NumberFormat("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v);

    // ── CLIENTE ──
    const nomeCliente = cliente?.nome || lead?.nome;
    set("cliente_nome", nomeCliente);
    set("vc_nome", nomeCliente);
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

    // ── LOCALIZAÇÃO ──
    const cidadeVal = cliente?.cidade || lead?.cidade;
    const estadoVal = cliente?.estado || lead?.estado;
    set("cidade", cidadeVal);
    set("estado", estadoVal);
    if (cidadeVal && estadoVal) {
      setIfMissing("cidade_estado", `${cidadeVal}- ${estadoVal}`);
    }

    // ── TÉCNICO / ENTRADA ──
    const consumo = lead?.media_consumo;
    set("consumo_mensal", consumo);
    set("capo_m", consumo ? `${fmtNum(consumo, 0)} kWh/mês` : undefined);
    set("tipo_telhado", lead?.tipo_telhado);
    set("cape_telhado", lead?.tipo_telhado);
    set("fase", lead?.rede_atendimento);
    set("tensao_rede", lead?.rede_atendimento);
    set("area_util", lead?.area ? `${lead.area} m²` : undefined);

    // ── CONCESSIONÁRIA (from snapshot) ──
    setIfMissing("dis_energia", snapshot?.concessionaria_nome || snapshot?.dis_energia);
    setIfMissing("subgrupo_uc1", snapshot?.subgrupo || snapshot?.grupo_tarifario || snapshot?.subgrupo_uc1);

    // ── SISTEMA SOLAR ──
    const potencia = versaoData?.potencia_kwp || projeto?.potencia_kwp || cliente?.potencia_kwp;
    set("potencia_sistema", potencia ? `${fmtNum(potencia)} kWp` : undefined);
    set("potencia_si", potencia ? `${fmtNum(potencia)} kWp` : undefined);

    const numModulos = projeto?.numero_modulos || cliente?.numero_placas || snapshot?.numero_modulos;
    set("modulo_quantidade", numModulos);
    set("vc_total_modulo", numModulos);

    set("inversor_modelo", projeto?.modelo_inversor || cliente?.modelo_inversor || snapshot?.inversor_modelo);
    setIfMissing("inversor_fabricante_1", snapshot?.inversor_fabricante || snapshot?.inversor_fabricante_1);
    setIfMissing("inversor_potencia_nominal", snapshot?.inversor_potencia || snapshot?.inversor_potencia_nominal);
    setIfMissing("inversores_utilizados", snapshot?.inversores_utilizados || (projeto?.modelo_inversor ? `1x ${projeto.modelo_inversor}` : undefined));

    set("modulo_modelo", projeto?.modelo_modulos || snapshot?.modulo_modelo);
    setIfMissing("modulo_fabricante", snapshot?.modulo_fabricante);
    setIfMissing("modulo_potencia", snapshot?.modulo_potencia ? `${snapshot.modulo_potencia} Wp` : undefined);

    const geracaoMensal = projeto?.geracao_mensal_media_kwh || snapshot?.geracao_mensal;
    set("geracao_mensal", geracaoMensal ? `${fmtNum(Number(geracaoMensal), 0)} kWh/mês` : undefined);

    // Aumento de produção
    if (consumo && geracaoMensal) {
      const aumento = ((Number(geracaoMensal) - consumo) / consumo) * 100;
      if (aumento > 0) {
        setIfMissing("vc_aumento", `${fmtNum(aumento)}%`);
      }
    }

    // ── FINANCEIRO ──
    const valorTotal = versaoData?.valor_total || projeto?.valor_total || lead?.valor_estimado || cliente?.valor_projeto;
    if (valorTotal) {
      set("valor_total", fmtCur(valorTotal));
      set("preco_final", fmtCur(valorTotal));
      set("preco_total", fmtCur(valorTotal));
      set("vc_a_vista", fmtCur(valorTotal));
      set("capo_i", fmtCur(valorTotal));
      set("kit_fechado_preco_total", fmtCur(valorTotal));
    }
    if (versaoData?.economia_mensal) {
      set("economia_mensal", fmtCur(versaoData.economia_mensal));
    }
    if (versaoData?.payback_meses != null) {
      const paybackMeses = versaoData.payback_meses;
      const anos = Math.floor(paybackMeses / 12);
      const meses = paybackMeses % 12;
      set("payback", `${anos} anos e ${meses} meses`);
      set("payback_meses", String(paybackMeses));
    }

    // Retorno em 10 anos
    if (versaoData?.economia_mensal && valorTotal) {
      const retorno10 = versaoData.economia_mensal * 12 * 10 - valorTotal;
      setIfMissing("fluxo_caixa_acumulado_anual_10", fmtCur(Math.max(retorno10, 0)));
    }

    // ── GARANTIA E SEGURO (from snapshot) ──
    setIfMissing("vc_garantiaservico", snapshot?.garantia_servico || snapshot?.vc_garantiaservico || "2 anos");
    setIfMissing("capo_seguro", snapshot?.seguro || snapshot?.capo_seguro || "Não");
    setIfMissing("vc_calculo_seguro", snapshot?.valor_seguro || snapshot?.vc_calculo_seguro || "-");
    setIfMissing("vc_string_box_cc", snapshot?.string_box || snapshot?.vc_string_box_cc || "Incluída no Projeto");

    // ── FINANCIAMENTO (from snapshot) ──
    setIfMissing("vc_valor_parcela_troca_medidor", snapshot?.valor_parcela_troca_medidor || snapshot?.vc_valor_parcela_troca_medidor);
    setIfMissing("vc_valor_parcelas_4", snapshot?.valor_parcelas_4 || snapshot?.vc_valor_parcelas_4);
    setIfMissing("vc_cartao_credito_parcela_2", snapshot?.cartao_parcela_12 || snapshot?.vc_cartao_credito_parcela_2);
    setIfMissing("vc_cartao_credito_parcela_3", snapshot?.cartao_parcela_18 || snapshot?.vc_cartao_credito_parcela_3);
    setIfMissing("vc_cartao_credito_parcela_4", snapshot?.cartao_parcela_24 || snapshot?.vc_cartao_credito_parcela_4);
    setIfMissing("vc_parcela_1", snapshot?.parcela_36 || snapshot?.vc_parcela_1);
    setIfMissing("vc_parcela_2", snapshot?.parcela_48 || snapshot?.vc_parcela_2);
    setIfMissing("vc_parcela_3", snapshot?.parcela_60 || snapshot?.vc_parcela_3);

    // ── COMERCIAL ──
    set("proposta_data", now.toLocaleDateString("pt-BR"));
    set("proposta_titulo", propostaData?.titulo || nomeCliente);
    set("proposta_identificador", propostaData?.codigo);
    const validadeDias = versaoData?.validade_dias || 15;
    set("proposta_validade", new Date(now.getTime() + validadeDias * 86400000).toLocaleDateString("pt-BR"));

    // ── CONSULTOR / RESPONSÁVEL ──
    if (consultor) {
      set("consultor_nome", consultor.nome);
      set("responsavel_nome", consultor.nome);
      set("responsavel_nom", consultor.nome);
      set("consultor_telefone", consultor.telefone);
      set("consultor_email", consultor.email);
    }
    // Fallback from snapshot
    setIfMissing("responsavel_nome", snapshot?.consultor_nome || snapshot?.responsavel_nome);
    setIfMissing("consultor_nome", snapshot?.consultor_nome);

    // Observações
    set("vc_observacao", lead?.observacoes);

    console.log(`[template-preview] Variables mapped: ${Object.keys(vars).length} keys`);
    console.log(`[template-preview] Snapshot keys: ${snapshot ? Object.keys(snapshot).length : 0}`);

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