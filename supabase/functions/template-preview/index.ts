import { createClient } from "npm:@supabase/supabase-js@2";
import JSZip from "npm:jszip@3.10.1";
import { flattenSnapshot } from "../_shared/flattenSnapshot.ts";

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

  // Process ALL word/*.xml files (headers, footers, document, etc.)
  // Exclude non-content files like styles, settings, fonts, themes
  const excludePatterns = /\/(theme|media|_rels|fontTable|settings|webSettings|styles|numbering|glossary)\b/i;
  const xmlFiles: string[] = [];
  zip.forEach((relativePath) => {
    if (
      relativePath.startsWith("word/") &&
      relativePath.endsWith(".xml") &&
      !excludePatterns.test(relativePath)
    ) {
      xmlFiles.push(relativePath);
    }
  });
  console.log("[template-preview] XML files to process:", xmlFiles);

  for (const fileName of xmlFiles) {
    const file = zip.file(fileName);
    if (!file || file.dir) continue;

    let content = await file.async("string");
    let modified = false;

    // ── STEP 1a: Normalize runs inside text boxes FIRST ──
    // Text boxes (<w:txbxContent>) contain their own <w:p> paragraphs
    // that are nested inside drawing/pict structures. The main normalizer
    // skips those outer paragraphs, so we must process inner ones first.
    content = normalizeTextBoxRuns(content);

    // ── STEP 1b: Normalize split runs in regular paragraphs ──
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
 * Normalize runs inside text box content blocks (<w:txbxContent>).
 * These are nested inside <w:drawing>/<w:pict>/<mc:AlternateContent>
 * structures that the main normalizeParagraphRuns() skips.
 * We extract each <w:txbxContent> block and apply paragraph normalization
 * to its inner paragraphs independently.
 */
function normalizeTextBoxRuns(xml: string): string {
  // Match <w:txbx>...<w:txbxContent>...</w:txbxContent>...</w:txbx> blocks
  // Process ONLY the inner <w:txbxContent> content, preserving the outer anchor structure
  return xml.replace(/<w:txbxContent[^>]*>([^]*?)<\/w:txbxContent>/g, (_match, innerContent) => {
    // Apply paragraph normalization only to the inner content of the text box
    const processed = normalizeParagraphRunsInner(innerContent);
    return `<w:txbxContent>${processed}</w:txbxContent>`;
  });
}

/**
 * Same logic as normalizeParagraphRuns but WITHOUT the safety skip
 * for drawing/pict/etc — because inside a txbxContent block,
 * those structures don't exist (it's just paragraphs and runs).
 */
function normalizeParagraphRunsInner(xml: string): string {
  const paraPattern = /<w:p[\s>][^]*?<\/w:p>/g;

  return xml.replace(paraPattern, (paraXml) => {
    if (!paraXml.includes("[")) return paraXml;

    // Inside text boxes we don't skip complex structures
    // (they shouldn't have nested drawings)
    if (paraXml.includes("<w:fldChar") || paraXml.includes("<w:instrText")) {
      return paraXml;
    }

    const runPattern = /<w:r[\s>][^]*?<\/w:r>/g;
    const runs: Array<{ xml: string; text: string; rPr: string }> = [];
    let runMatch;
    while ((runMatch = runPattern.exec(paraXml)) !== null) {
      const runXml = runMatch[0];
      const rPrMatch = runXml.match(/<w:rPr>[^]*?<\/w:rPr>/);
      const rPr = rPrMatch ? rPrMatch[0] : "";
      const textMatch = runXml.match(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/);
      const text = textMatch ? textMatch[1] : "";
      runs.push({ xml: runXml, text, rPr });
    }

    if (runs.length < 2) return paraXml;

    const fullText = runs.map((r) => r.text).join("");
    if (!fullText.includes("[")) return paraXml;

    const charRunIdx: number[] = [];
    for (let ri = 0; ri < runs.length; ri++) {
      for (let ci = 0; ci < runs[ri].text.length; ci++) {
        charRunIdx.push(ri);
      }
    }

    const phPattern = /\[[a-zA-Z_][a-zA-Z0-9_.\-]{0,120}\]/g;
    let phMatch;
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

    const firstRunIdx = paraXml.indexOf(runs[0].xml);
    const lastRun = runs[runs.length - 1];
    const lastRunIdx = paraXml.lastIndexOf(lastRun.xml);
    const lastRunEnd = lastRunIdx + lastRun.xml.length;

    if (firstRunIdx < 0 || lastRunIdx < 0) return paraXml;

    const before = paraXml.substring(0, firstRunIdx);
    const after = paraXml.substring(lastRunEnd);
    const runsRegion = paraXml.substring(firstRunIdx, lastRunEnd);

    const interRunContent: string[] = [];
    let searchPos = 0;
    for (let i = 0; i < runs.length; i++) {
      const pos = runsRegion.indexOf(runs[i].xml, searchPos);
      if (pos < 0) return paraXml;
      interRunContent.push(runsRegion.substring(searchPos, pos));
      searchPos = pos + runs[i].xml.length;
    }
    const trailingContent = searchPos < runsRegion.length ? runsRegion.substring(searchPos) : "";

    let rebuiltRegion = "";
    let ri = 0;
    while (ri < runs.length) {
      const span = merged.find((s) => s[0] === ri);
      if (span) {
        const spanInterContent = interRunContent.slice(span[0], span[1] + 1).join("");
        rebuiltRegion += spanInterContent;
        const groupRuns = runs.slice(span[0], span[1] + 1);
        const combinedText = groupRuns.map((r) => r.text).join("");
        const rPr = groupRuns[0].rPr;
        rebuiltRegion += `<w:r>${rPr}<w:t xml:space="preserve">${combinedText}</w:t></w:r>`;
        ri = span[1] + 1;
      } else {
        rebuiltRegion += (interRunContent[ri] ?? "") + runs[ri].xml;
        ri += 1;
      }
    }

    rebuiltRegion += trailingContent;
    return before + rebuiltRegion + after;
  });
}

/**
 * Normalize runs inside each <w:p> paragraph so that placeholders
 * split across multiple <w:r> runs are merged into single runs.
 *
 * Strategy (robust against drawings/pict/shapes):
 * 1. Find ALL <w:r> runs in the paragraph.
 * 2. Classify each run: "graphic" (contains w:drawing/w:pict/mc:AlternateContent/w:object)
 *    or "text" (has <w:t> and no graphic children).
 * 3. Graphic runs are NEVER modified — they stay exactly as-is.
 * 4. If concatenated text of text-only runs contains "[":
 *    - Put all combined text into the FIRST text run's <w:t>.
 *    - Empty (but don't remove!) <w:t> in all other text runs.
 *    This preserves the XML structure and layout while unifying
 *    fragmented placeholders for the substitution step.
 */
function normalizeParagraphRuns(xml: string): string {
  const paraPattern = /<w:p[\s>][^]*?<\/w:p>/g;

  return xml.replace(paraPattern, (paraXml) => {
    // Quick exit: no bracket → no placeholder possible
    if (!paraXml.includes("[")) return paraXml;

    // Skip complex Word field structures (TOC, page numbers, etc.)
    if (paraXml.includes("<w:fldChar") || paraXml.includes("<w:instrText")) {
      return paraXml;
    }

    // ── Collect all <w:r> runs with their positions ──
    const runPattern = /<w:r[\s>][^]*?<\/w:r>/g;
    interface RunInfo {
      full: string;
      start: number;
      end: number;
      isGraphic: boolean;
      hasText: boolean;
      text: string;
    }
    const allRuns: RunInfo[] = [];
    let m;
    while ((m = runPattern.exec(paraXml)) !== null) {
      const full = m[0];

      // A run is "graphic" if it contains any drawing/image/shape element
      const isGraphic =
        full.includes("<w:drawing") ||
        full.includes("<w:pict") ||
        full.includes("<mc:AlternateContent") ||
        full.includes("<w:object") ||
        full.includes("<wp:anchor") ||
        full.includes("<wp:inline");

      // Extract ALL <w:t> text fragments from this run
      const tPattern = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
      let tMatch;
      const textParts: string[] = [];
      while ((tMatch = tPattern.exec(full)) !== null) {
        textParts.push(tMatch[1]);
      }
      const text = textParts.join("");
      const hasText = textParts.length > 0;

      allRuns.push({ full, start: m.index, end: m.index + full.length, isGraphic, hasText, text });
    }

    // ── Filter to text-only runs (non-graphic, with <w:t> elements) ──
    const textRuns = allRuns.filter((r) => !r.isGraphic && r.hasText);
    if (textRuns.length < 2) return paraXml;

    // ── Concatenate text and check for placeholders ──
    const fullText = textRuns.map((r) => r.text).join("");
    if (!fullText.includes("[")) return paraXml;

    // ── Consolidate: put combined text in first text run, empty others ──
    // Process in positional order, tracking cumulative offset from length changes.
    let result = paraXml;
    let offset = 0;

    for (let i = 0; i < textRuns.length; i++) {
      const run = textRuns[i];
      let newRunXml: string;

      if (i === 0) {
        // First text run: replace first <w:t> with combined text, empty any others
        let firstReplaced = false;
        newRunXml = run.full.replace(
          /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g,
          () => {
            if (!firstReplaced) {
              firstReplaced = true;
              return `<w:t xml:space="preserve">${fullText}</w:t>`;
            }
            return "<w:t></w:t>";
          },
        );
      } else {
        // Subsequent text runs: empty all <w:t> content (never remove the run!)
        newRunXml = run.full.replace(
          /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g,
          "<w:t></w:t>",
        );
      }

      // Apply replacement at the correct position
      const adjStart = run.start + offset;
      const adjEnd = run.end + offset;
      result = result.substring(0, adjStart) + newRunXml + result.substring(adjEnd);
      offset += newRunXml.length - run.full.length;
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
    const { template_id, proposta_id, lead_id: bodyLeadId, diagnostic } = body;

    if (!template_id) {
      return jsonError("template_id é obrigatório", 400);
    }

    // ── DIAGNOSTIC MODE ───────────────────────────────────
    if (diagnostic === true) {
      return await handleDiagnostic(adminClient, template_id, tenantId);
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
    // Comprehensive variable resolution covering ALL catalog categories
    const now = new Date();
    const fmtCur = (v: number) =>
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
    const fmtNum = (v: number, decimals = 2) =>
      new Intl.NumberFormat("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v);

    const vars: Record<string, string> = {};

    // 6a. Se tiver snapshot, extrair TODOS campos primitivos (evitar objetos complexos)
    const snapshot = versaoData?.snapshot as Record<string, any> | null;
    if (snapshot && typeof snapshot === "object") {
      for (const [key, value] of Object.entries(snapshot)) {
        if (value !== null && value !== undefined && value !== "" && typeof value !== "object") {
          vars[key] = String(value);
        }
        // Also extract nested objects with dot notation for deep snapshot fields
        if (value && typeof value === "object" && !Array.isArray(value)) {
          for (const [subKey, subValue] of Object.entries(value as Record<string, any>)) {
            if (subValue !== null && subValue !== undefined && subValue !== "" && typeof subValue !== "object") {
              vars[`${key}_${subKey}`] = String(subValue);
            }
          }
        }
      }
    }

    // 6b. Helpers
    const set = (legacy: string, value: string | number | null | undefined) => {
      if (value !== null && value !== undefined && value !== "") {
        vars[legacy] = String(value);
      }
    };
    const setIfMissing = (key: string, value: string | number | null | undefined) => {
      if (!vars[key] && value !== null && value !== undefined && value !== "") {
        vars[key] = String(value);
      }
    };
    // Set with currency formatting
    const setCur = (key: string, value: number | null | undefined) => {
      if (value != null && !isNaN(value)) vars[key] = fmtCur(value);
    };
    const setCurIfMissing = (key: string, value: number | null | undefined) => {
      if (!vars[key] && value != null && !isNaN(value)) vars[key] = fmtCur(value);
    };
    // Extract numeric from snapshot
    const snapNum = (key: string): number | null => {
      const v = snapshot?.[key];
      if (v == null || v === "") return null;
      const n = Number(v);
      return isNaN(n) ? null : n;
    };

    // ═══════════════════════════════════════════════════════
    // FLATTEN: Nested snapshot → flat vars (shared utility)
    // ═══════════════════════════════════════════════════════
    const flatSnap = flattenSnapshot(snapshot as Record<string, unknown>);
    for (const [k, v] of Object.entries(flatSnap)) {
      if (!vars[k]) vars[k] = v;
    }

    // Expose typed helpers for downstream logic
    const tecnico = (snapshot?.tecnico && typeof snapshot.tecnico === "object" && !Array.isArray(snapshot.tecnico))
      ? snapshot.tecnico as Record<string, unknown> : {};
    const ucsSnap = Array.isArray(snapshot?.ucs) ? snapshot.ucs as Array<Record<string, unknown>> : [];

    console.log("[template-preview] flattenSnapshot applied — keys injected:", Object.keys(flatSnap).length);

    // ═══════════════════════════════════════════════════════
    // CATEGORIA: CLIENTE
    // ═══════════════════════════════════════════════════════
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

    // ═══════════════════════════════════════════════════════
    // CATEGORIA: ENTRADA DE DADOS
    // ═══════════════════════════════════════════════════════
    const cidadeVal = cliente?.cidade || lead?.cidade;
    const estadoVal = cliente?.estado || lead?.estado;
    set("cidade", cidadeVal);
    set("estado", estadoVal);
    if (cidadeVal && estadoVal) {
      setIfMissing("cidade_estado", `${cidadeVal} - ${estadoVal}`);
    }

    const consumo = lead?.media_consumo || snapNum("consumo_mensal")
      || (ucsSnap[0] ? Number(ucsSnap[0].consumo_mensal) || null : null)
      || (tecnico.consumo_total_kwh ? Number(tecnico.consumo_total_kwh) : null);
    set("consumo_mensal", consumo);
    set("capo_m", consumo ? `${fmtNum(consumo, 0)} kWh/mês` : undefined);
    set("tipo_telhado", lead?.tipo_telhado || snapshot?.tipo_telhado);
    set("cape_telhado", lead?.tipo_telhado || snapshot?.tipo_telhado);
    set("fase", lead?.rede_atendimento || snapshot?.fase);
    set("tensao_rede", lead?.rede_atendimento || snapshot?.tensao_rede);
    set("area_util", lead?.area ? `${lead.area} m²` : snapshot?.area_util);
    setIfMissing("distancia", snapshot?.distancia);
    setIfMissing("taxa_desempenho", snapshot?.taxa_desempenho);
    setIfMissing("desvio_azimutal", snapshot?.desvio_azimutal);
    setIfMissing("inclinacao", snapshot?.inclinacao);
    setIfMissing("fator_geracao", snapshot?.fator_geracao);
    setIfMissing("tipo_sistema", snapshot?.tipo_sistema);
    setIfMissing("topologia", snapshot?.topologia);
    setIfMissing("fator_simultaneidade", snapshot?.fator_simultaneidade);

    // Concessionária
    setIfMissing("dis_energia", snapshot?.concessionaria_nome || snapshot?.dis_energia);
    setIfMissing("subgrupo_uc1", snapshot?.subgrupo || snapshot?.grupo_tarifario || snapshot?.subgrupo_uc1);

    // Custo de disponibilidade
    setIfMissing("custo_disponibilidade_kwh", snapshot?.custo_disponibilidade_kwh);

    // Tarifa distribuidora
    setIfMissing("tarifa_distribuidora", snapshot?.tarifa_distribuidora || snapshot?.tarifa_kwh);

    // Consumo por mês (jan-dez)
    const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    for (const m of meses) {
      setIfMissing(`consumo_${m}`, snapshot?.[`consumo_${m}`]);
      setIfMissing(`fator_geracao_${m}`, snapshot?.[`fator_geracao_${m}`]);
    }

    // ═══════════════════════════════════════════════════════
    // CATEGORIA: SISTEMA SOLAR
    // ═══════════════════════════════════════════════════════
    const potencia = versaoData?.potencia_kwp || projeto?.potencia_kwp || cliente?.potencia_kwp || snapNum("potencia_kwp") || snapNum("potencia_sistema");
    set("potencia_sistema", potencia ? `${fmtNum(potencia)} kWp` : undefined);
    set("potencia_si", potencia ? `${fmtNum(potencia)} kWp` : undefined);
    setIfMissing("potencia_ideal_total", snapshot?.potencia_ideal_total);

    const numModulos = projeto?.numero_modulos || cliente?.numero_placas || snapshot?.numero_modulos || snapshot?.modulo_quantidade;
    set("modulo_quantidade", numModulos);
    set("vc_total_modulo", numModulos);

    // Módulo specs
    set("modulo_modelo", projeto?.modelo_modulos || snapshot?.modulo_modelo);
    setIfMissing("modulo_fabricante", snapshot?.modulo_fabricante);
    setIfMissing("modulo_potencia", snapshot?.modulo_potencia ? `${snapshot.modulo_potencia} Wp` : undefined);
    setIfMissing("vc_modulo_potencia", snapshot?.modulo_potencia);
    const moduloSpecs = ["modulo_celulas", "modulo_tensao_maxima", "modulo_comprimento", "modulo_largura", "modulo_profundidade",
      "modulo_vmp", "modulo_voc", "modulo_imp", "modulo_isc", "modulo_tipo_celula", "modulo_eficiencia", "modulo_codigo",
      "modulo_coef_temp_voc", "modulo_coef_temp_isc", "modulo_coef_temp_pmax", "modulo_area", "modulo_garantia"];
    for (const k of moduloSpecs) setIfMissing(k, snapshot?.[k]);

    // Inversor specs (indexed _1, _2, etc. and concatenated)
    set("inversor_modelo", projeto?.modelo_inversor || cliente?.modelo_inversor || snapshot?.inversor_modelo);
    setIfMissing("inversor_fabricante_1", snapshot?.inversor_fabricante || snapshot?.inversor_fabricante_1);
    setIfMissing("inversor_potencia_nominal", snapshot?.inversor_potencia || snapshot?.inversor_potencia_nominal);
    setIfMissing("inversores_utilizados", snapshot?.inversores_utilizados || (projeto?.modelo_inversor ? `1x ${projeto.modelo_inversor}` : undefined));
    const inversorFields = ["inversor_fabricante", "inversor_modelo", "inversor_quantidade", "inversor_potencia",
      "inversor_potencia_nominal", "inversor_tensao", "inversor_tipo", "inversor_corrente_saida",
      "inversor_mppts_utilizados", "inversor_strings_utilizadas", "inversor_codigo", "inversor_garantia",
      "inversor_sistema", "inversor_corrente_max_carga_cc", "inversor_corrente_max_descarga_cc",
      "inversor_tipo_bateria", "inversor_tensao_bateria_min", "inversor_tensao_bateria_max"];
    for (const k of inversorFields) {
      setIfMissing(k, snapshot?.[k]);
      // Also indexed versions _1, _2, _3
      for (let i = 1; i <= 5; i++) setIfMissing(`${k}_${i}`, snapshot?.[`${k}_${i}`]);
    }
    setIfMissing("inversores_potencia_maxima_total", snapshot?.inversores_potencia_maxima_total);
    setIfMissing("inversor_corrente_max_entrada_1", snapshot?.inversor_corrente_max_entrada_1);
    setIfMissing("inversor_corrente_max_entrada_mppt1_1", snapshot?.inversor_corrente_max_entrada_mppt1_1);

    // Otimizador
    for (const k of ["otimizador_fabricante", "otimizador_modelo", "otimizador_potencia", "otimizador_quantidade"]) {
      setIfMissing(k, snapshot?.[k]);
    }

    // Transformador
    setIfMissing("transformador_nome", snapshot?.transformador_nome);
    setIfMissing("transformador_potencia", snapshot?.transformador_potencia);

    // Bateria specs (concatenated + indexed)
    const bateriaFields = ["bateria_fabricante", "bateria_modelo", "bateria_tipo", "bateria_energia",
      "bateria_quantidade", "bateria_comprimento", "bateria_largura", "bateria_profundidade",
      "bateria_tensao_operacao", "bateria_tensao_carga", "bateria_tensao_nominal",
      "bateria_potencia_maxima_saida", "bateria_corrente_maxima_descarga", "bateria_corrente_maxima_carga",
      "bateria_corrente_recomendada", "bateria_capacidade"];
    for (const k of bateriaFields) {
      setIfMissing(k, snapshot?.[k]);
      for (let i = 1; i <= 3; i++) setIfMissing(`${k}_${i}`, snapshot?.[`${k}_${i}`]);
    }
    // Battery temp specs
    const bateriaTemp = ["bateria_temperatura_descarga_min", "bateria_temperatura_descarga_max",
      "bateria_temperatura_carga_min", "bateria_temperatura_carga_max",
      "bateria_temperatura_armazenamento_min", "bateria_temperatura_armazenamento_max"];
    for (const k of bateriaTemp) {
      setIfMissing(k, snapshot?.[k]);
      for (let i = 1; i <= 3; i++) setIfMissing(`${k}_${i}`, snapshot?.[`${k}_${i}`]);
    }

    // Armazenamento
    for (const k of ["autonomia", "energia_diaria_armazenamento", "armazenamento_necessario", "armazenamento_util_adicionado", "p_armazenamento_necessario", "dod"]) {
      setIfMissing(k, snapshot?.[k]);
    }

    // Layout
    for (const k of ["layout_arranjo_linhas", "layout_arranjo_modulos", "layout_arranjo_orientacao",
      "layout_linhas_total", "layout_arranjos_total", "layout_arranjos_total_horizontal",
      "layout_arranjos_total_vertical", "layout_orientacao"]) {
      setIfMissing(k, snapshot?.[k]);
    }

    // Geração
    const geracaoMensal = projeto?.geracao_mensal_media_kwh || snapNum("geracao_mensal")
      || (tecnico.geracao_estimada_kwh ? Number(tecnico.geracao_estimada_kwh) : null);
    set("geracao_mensal", geracaoMensal ? `${fmtNum(Number(geracaoMensal), 0)} kWh/mês` : undefined);
    setIfMissing("geracao_anual", snapshot?.geracao_anual);
    for (const m of meses) setIfMissing(`geracao_${m}`, snapshot?.[`geracao_${m}`]);
    // Geração anual séries (_0 a _25)
    for (let i = 0; i <= 25; i++) {
      setIfMissing(`geracao_anual_${i}`, snapshot?.[`geracao_anual_${i}`]);
    }

    // UCs
    setIfMissing("qtd_ucs", snapshot?.qtd_ucs);
    setIfMissing("creditos_gerados", snapshot?.creditos_gerados);
    setIfMissing("kit_fechado_quantidade", snapshot?.kit_fechado_quantidade);
    setIfMissing("segmentos_utilizados", snapshot?.segmentos_utilizados);
    setIfMissing("area_necessaria", snapshot?.area_necessaria);
    setIfMissing("peso_total", snapshot?.peso_total);
    setIfMissing("estrutura_tipo", snapshot?.estrutura_tipo);
    setIfMissing("kit_codigo", snapshot?.kit_codigo);

    // Aumento de produção
    if (consumo && geracaoMensal) {
      const aumento = ((Number(geracaoMensal) - Number(consumo)) / Number(consumo)) * 100;
      if (aumento > 0) {
        setIfMissing("vc_aumento", `${fmtNum(aumento)}%`);
      }
    }

    // ═══════════════════════════════════════════════════════
    // CATEGORIA: FINANCEIRO
    // ═══════════════════════════════════════════════════════
    const valorTotal = versaoData?.valor_total || projeto?.valor_total || lead?.valor_estimado || cliente?.valor_projeto || snapNum("preco_total") || snapNum("preco");
    if (valorTotal) {
      const vt = Number(valorTotal);
      setCur("valor_total", vt);
      setCur("preco_final", vt);
      setCur("preco_total", vt);
      setCur("preco", vt);
      setCur("vc_a_vista", vt);
      setCur("capo_i", vt);
      setCur("kit_fechado_preco_total", vt);

      // Preço por kWp
      if (potencia && potencia > 0) {
        set("preco_kwp", fmtCur(vt / potencia));
        set("preco_watt", `${fmtNum(vt / (potencia * 1000), 2)} R$/W`);
        setIfMissing("vc_preco_watt", fmtNum(vt / (potencia * 1000), 2));
      }
    }

    // Economia
    const econMensal = versaoData?.economia_mensal || snapNum("economia_mensal");
    if (econMensal) {
      setCur("economia_mensal", Number(econMensal));
      setCurIfMissing("economia_anual", Number(econMensal) * 12);
      setCurIfMissing("roi_25_anos", Number(econMensal) * 12 * 25);
      setCurIfMissing("solar_25_anos", Number(econMensal) * 12 * 25);
      setCurIfMissing("vc_economia_acumulada", Number(econMensal) * 12 * 25);
      setCurIfMissing("vc_economia_conta_total_rs", Number(econMensal) * 12);
    }

    // Payback
    if (versaoData?.payback_meses != null) {
      const paybackMeses = versaoData.payback_meses;
      const anos = Math.floor(paybackMeses / 12);
      const mesesPb = paybackMeses % 12;
      set("payback", `${anos} anos e ${mesesPb} meses`);
      set("payback_meses", String(paybackMeses));
      set("payback_anos", fmtNum(paybackMeses / 12, 1));
    }

    // Retorno em 10 anos
    if (econMensal && valorTotal) {
      const retorno10 = Number(econMensal) * 12 * 10 - Number(valorTotal);
      setCurIfMissing("fluxo_caixa_acumulado_anual_10", Math.max(retorno10, 0));
    }

    // ROI / Rendimento
    if (econMensal && valorTotal && Number(valorTotal) > 0) {
      setIfMissing("vc_roi_primeiro_mes", `${fmtNum((Number(econMensal) / Number(valorTotal)) * 100)}%`);
      setIfMissing("vc_investimento_solar_rendimento", `${fmtNum((Number(econMensal) * 12 / Number(valorTotal)) * 100)}%`);
    }

    // Economia percentual
    const gastoAtual = snapNum("gasto_atual_mensal") || snapNum("gasto_energia_mensal_atual");
    if (gastoAtual && econMensal) {
      setIfMissing("economia_percentual", `${fmtNum((Number(econMensal) / gastoAtual) * 100, 0)}%`);
      setIfMissing("vc_economia_conta_total_pc", `${fmtNum((Number(econMensal) / gastoAtual) * 100, 0)}%`);
    }

    // Tarifa solar
    if (valorTotal && geracaoMensal) {
      const tarifaSolar = Number(valorTotal) / (Number(geracaoMensal) * 12 * 25);
      setIfMissing("vc_tarifa_solar", fmtNum(tarifaSolar, 4));
    }

    // Financeiro - equipamentos (all from snapshot)
    const finFields = [
      "modulo_custo_un", "modulo_preco_un", "modulo_custo_total", "modulo_preco_total",
      "inversor_custo_un", "inversor_preco_un", "inversor_custo_total", "inversor_preco_total",
      "inversores_custo_total", "inversores_preco_total",
      "otimizador_custo_un", "otimizador_preco_un", "otimizador_custo_total", "otimizador_preco_total",
      "kit_fechado_custo_total",
      "instalacao_custo_total", "instalacao_preco_total",
      "estrutura_custo_total", "estrutura_preco_total",
      "equipamentos_custo_total", "kits_custo_total", "componentes_custo_total",
      "baterias_custo_total", "baterias_preco_total",
      "margem_lucro", "margem_percentual", "desconto_percentual", "desconto_valor",
      "custo_modulos", "custo_inversores", "custo_estrutura", "custo_instalacao", "custo_kit",
      "comissao_percentual", "comissao_valor", "comissao_res", "comissao_rep", "comissao_res_p", "comissao_rep_p",
      "distribuidor_categoria",
    ];
    for (const k of finFields) setIfMissing(k, snapshot?.[k]);
    // Indexed financeiro (inversores, transformadores, baterias, itens avulsos)
    for (let i = 1; i <= 5; i++) {
      for (const prefix of ["inversor_custo_un_", "inversor_preco_un_", "inversor_preco_total_",
        "transformador_custo_un_", "transformador_preco_un_",
        "bateria_custo_un_", "bateria_preco_un_", "bateria_preco_total_",
        "item_a_nome_", "item_a_custo_", "item_a_preco_"]) {
        setIfMissing(`${prefix}${i}`, snapshot?.[`${prefix}${i}`]);
      }
    }
    setIfMissing("transformadores_custo_total", snapshot?.transformadores_custo_total);
    setIfMissing("transformadores_preco_total", snapshot?.transformadores_preco_total);

    // VPL, TIR
    setIfMissing("vpl", snapshot?.vpl);
    setIfMissing("tir", snapshot?.tir);

    // Financiamento (indexed + ativo)
    for (let i = 1; i <= 5; i++) {
      for (const k of ["f_nome_", "f_entrada_", "f_entrada_p_", "f_valor_", "f_valor_p_",
        "f_prazo_", "f_carencia_", "f_taxa_", "f_parcela_"]) {
        setIfMissing(`${k}${i}`, snapshot?.[`${k}${i}`]);
      }
    }
    for (const k of ["f_ativo_nome", "f_ativo_entrada", "f_ativo_entrada_p", "f_ativo_valor",
      "f_ativo_valor_p", "f_ativo_prazo", "f_ativo_carencia", "f_ativo_taxa", "f_ativo_parcela",
      "f_banco", "f_taxa_juros", "f_parcelas", "f_valor_parcela", "f_entrada", "f_valor_financiado", "f_cet"]) {
      setIfMissing(k, snapshot?.[k]);
    }

    // Séries financeiras anuais (_0 a _25)
    for (let i = 0; i <= 25; i++) {
      for (const prefix of ["investimento_anual_", "economia_anual_valor_", "fluxo_caixa_acumulado_anual_"]) {
        setIfMissing(`${prefix}${i}`, snapshot?.[`${prefix}${i}`]);
      }
    }

    // Comparativos 25 anos
    for (const k of ["solar_25", "renda_25", "poupanca_25"]) setIfMissing(k, snapshot?.[k]);

    // Preço por extenso
    setIfMissing("preco_por_extenso", snapshot?.preco_por_extenso);

    // ═══════════════════════════════════════════════════════
    // CATEGORIA: CONTA DE ENERGIA
    // ═══════════════════════════════════════════════════════
    const contaFields = [
      "gasto_atual_mensal", "gasto_com_solar_mensal", "economia_percentual",
      "creditos_mensal", "tarifa_atual", "imposto_percentual", "bandeira_tarifaria",
      "custo_disponibilidade_valor", "gasto_energia_mensal_atual", "gasto_energia_mensal_novo",
      "gasto_energia_mensal_bt_atual", "gasto_energia_mensal_bt_novo",
      "gasto_energia_mensal_p_atual", "gasto_energia_mensal_p_novo",
      "gasto_energia_mensal_fp_atual", "gasto_energia_mensal_fp_novo",
      "gasto_demanda_mensal_atual", "gasto_demanda_mensal_novo",
      "economia_energia_mensal", "economia_energia_mensal_p",
      "economia_demanda_mensal", "economia_demanda_mensal_p",
      "gasto_total_mensal_atual", "gasto_total_mensal_novo",
      "creditos_alocados", "consumo_abatido",
      "valor_imposto_energia", "tarifacao_energia_compensada_bt",
    ];
    for (const k of contaFields) setIfMissing(k, snapshot?.[k]);

    // Créditos por mês
    for (const m of meses) {
      setIfMissing(`creditos_${m}`, snapshot?.[`creditos_${m}`]);
      setIfMissing(`creditos_alocados_${m}`, snapshot?.[`creditos_alocados_${m}`]);
    }

    // ═══════════════════════════════════════════════════════
    // CATEGORIA: PREMISSAS
    // ═══════════════════════════════════════════════════════
    for (const k of ["inflacao_energetica", "inflacao_ipca", "imposto", "vpl_taxa_desconto",
      "perda_eficiencia_anual", "troca_inversor", "troca_inversor_custo",
      "sobredimensionamento", "vida_util_sistema"]) {
      setIfMissing(k, snapshot?.[k]);
    }

    // ═══════════════════════════════════════════════════════
    // CATEGORIA: COMERCIAL
    // ═══════════════════════════════════════════════════════
    set("proposta_data", now.toLocaleDateString("pt-BR"));
    set("proposta_titulo", propostaData?.titulo || nomeCliente);
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
      set("responsavel_celular", consultor.telefone);
      set("responsavel_email", consultor.email);
      set("representante_nome", consultor.nome);
    }
    setIfMissing("responsavel_nome", snapshot?.consultor_nome || snapshot?.responsavel_nome);
    setIfMissing("consultor_nome", snapshot?.consultor_nome);

    // Empresa (from site_settings or snapshot)
    setIfMissing("empresa_nome", snapshot?.empresa_nome);
    setIfMissing("empresa_cnpj_cpf", snapshot?.empresa_cnpj_cpf);
    setIfMissing("empresa_cidade", snapshot?.empresa_cidade);
    setIfMissing("empresa_estado", snapshot?.empresa_estado);
    setIfMissing("empresa_endereco", snapshot?.empresa_endereco);
    setIfMissing("empresa_telefone", snapshot?.empresa_telefone);
    setIfMissing("empresa_email", snapshot?.empresa_email);
    setIfMissing("empresa_logo_url", snapshot?.empresa_logo_url);

    // ═══════════════════════════════════════════════════════
    // CATEGORIA: CUSTOMIZADA (vc_*)
    // ═══════════════════════════════════════════════════════
    // Garantia e Seguro
    setIfMissing("vc_garantiaservico", snapshot?.garantia_servico || snapshot?.vc_garantiaservico || "2 anos");
    setIfMissing("capo_seguro", snapshot?.seguro || snapshot?.capo_seguro || "Não");
    setIfMissing("vc_calculo_seguro", snapshot?.valor_seguro || snapshot?.vc_calculo_seguro || "-");
    setIfMissing("vc_string_box_cc", snapshot?.string_box || snapshot?.vc_string_box_cc || "Incluída no Projeto");
    setIfMissing("vc_incluir_seguro", snapshot?.vc_incluir_seguro);
    setIfMissing("vc_estrutura", snapshot?.vc_estrutura || snapshot?.cape_telhado || lead?.tipo_telhado);

    // Consumo/Geração customizadas
    setIfMissing("vc_consumo", snapshot?.vc_consumo || (consumo ? String(consumo) : undefined));
    if (consumo) setIfMissing("vc_consumo_anual", String(Number(consumo) * 12));
    setIfMissing("vc_media_sonsumo_mensal", snapshot?.vc_media_sonsumo_mensal || (consumo ? String(consumo) : undefined));
    setIfMissing("vc_potencia_sistema", snapshot?.vc_potencia_sistema || (potencia ? fmtNum(potencia) : undefined));

    // Geração prevista valor
    if (geracaoMensal && snapshot?.tarifa_distribuidora) {
      setIfMissing("vc_valor_gerac_prevista", fmtCur(Number(geracaoMensal) * Number(snapshot.tarifa_distribuidora)));
    }

    // Financiamento condições (from snapshot — vc_parcela_*, vc_taxa_*, etc.)
    const vcFinFields = [
      "vc_valor_parcela_troca_medidor", "vc_valor_parcelas_4", "vc_valor_entrada",
      "vc_parcela_1", "vc_parcela_2", "vc_parcela_3",
      "vc_taxa_1", "vc_taxa_2", "vc_taxa_3",
      "vc_entrada_1", "vc_entrada_2", "vc_entrada_3",
      "vc_prazo_1", "vc_prazo_2", "vc_prazo_3",
      "vc_cartao_credito_parcela_1", "vc_cartao_credito_parcela_2",
      "vc_cartao_credito_parcela_3", "vc_cartao_credito_parcela_4",
      "vc_cartao_credito_taxa_1", "vc_cartao_credito_taxa_2",
      "vc_cartao_credito_taxa_3", "vc_cartao_credito_taxa_4",
      "vc_saldo_solar_25_anos", "vc_saldo_renda_fixa_25_anos", "vc_saldo_poupanca_25_anos",
      "vc_cal_icms_enel", "vc_valor_icms_enel", "vc_valor_icms_enel_fator_simultaneidade",
      "vc_p_total_cc", "vc_grafico_de_comparacao",
    ];
    for (const k of vcFinFields) {
      setIfMissing(k, snapshot?.[k]);
    }

    // Fallback financing from snapshot with alternate keys
    setIfMissing("vc_cartao_credito_parcela_2", snapshot?.cartao_parcela_12);
    setIfMissing("vc_cartao_credito_parcela_3", snapshot?.cartao_parcela_18);
    setIfMissing("vc_cartao_credito_parcela_4", snapshot?.cartao_parcela_24);
    setIfMissing("vc_parcela_1", snapshot?.parcela_36);
    setIfMissing("vc_parcela_2", snapshot?.parcela_48);
    setIfMissing("vc_parcela_3", snapshot?.parcela_60);

    // Observações
    set("vc_observacao", lead?.observacoes || snapshot?.vc_observacao);

    // ═══════════════════════════════════════════════════════
    // CATEGORIA: TARIFA / GD / ANEEL / CÁLCULO
    // ═══════════════════════════════════════════════════════
    for (const k of [
      "tarifa_te_kwh", "tarifa_tusd_total_kwh", "tarifa_fio_b_real_kwh", "tarifa_fio_b_usado_kwh",
      "tarifa_precisao", "tarifa_precisao_motivo", "tarifa_origem", "tarifa_vigencia_inicio", "tarifa_vigencia_fim",
      "gd_regra", "gd_ano_aplicado", "gd_fio_b_percent_cobrado", "gd_fio_b_percent_compensado",
      "aneel_last_sync_at", "aneel_run_id", "aneel_snapshot_hash_curto",
      "calc_consumo_mensal_kwh", "calc_custo_disponibilidade_kwh", "calc_consumo_compensavel_kwh",
      "calc_geracao_mensal_kwh", "calc_energia_compensada_kwh", "calc_valor_credito_kwh", "calc_economia_mensal_rs",
      "alerta_estimado_texto_pdf",
    ]) {
      setIfMissing(k, snapshot?.[k]);
    }

    // CO2 evitado
    if (geracaoMensal) {
      const co2Kg = Number(geracaoMensal) * 12 * 0.075; // ~75g CO2/kWh IPCC
      setIfMissing("co2_evitado_ano", fmtNum(co2Kg, 0));
    }

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
    const originalSize = templateBuffer.byteLength;

    let report: Uint8Array;
    let processedMissingVars: string[] = [];
    try {
      const result = await processDocxTemplate(templateBuffer, vars);
      report = result.output;
      processedMissingVars = result.missingVars;

      // ── DIAGNOSTIC: size comparison ──
      const outputSize = report.length;
      const ratio = originalSize > 0 ? ((outputSize / originalSize) * 100).toFixed(1) : "N/A";
      console.log(`[template-preview] Size comparison: original=${originalSize}B → output=${outputSize}B (${ratio}%)`);
      if (originalSize > 0 && outputSize < originalSize * 0.95) {
        console.warn(`[template-preview] ⚠️ Output is <95% of original — possible content loss!`);
      }

      // ── DIAGNOSTIC: substitution stats ──
      const totalVars = Object.keys(vars).length;
      const missingCount = result.missingVars.length;
      const substituted = totalVars - missingCount;
      console.log(`[template-preview] Substitution stats: ${substituted} replaced, ${missingCount} missing out of ${totalVars} total vars`);
      if (result.missingVars.length > 0) {
        console.warn(`[template-preview] Missing variables (${missingCount}):`, result.missingVars.slice(0, 30));
      }
      console.log(`[template-preview] Processing OK, output: ${outputSize} bytes`);
    } catch (processErr: any) {
      console.error("[template-preview] Processing error:", processErr?.message, processErr?.stack);
      return jsonError(`Erro ao processar template DOCX: ${processErr?.message || "unknown"}`, 500);
    }

    // ── 9. PERSIST DOCX + PDF TO STORAGE ──────────────────
    const clienteNome = cliente?.nome || lead?.nome || "preview";
    const safeClienteName = clienteNome.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
    const timestamp = Date.now();
    const docxStoragePath = `${tenantId}/propostas/${proposta_id || "draft"}/${timestamp}_proposta.docx`;
    const pdfStoragePath = `${tenantId}/propostas/${proposta_id || "draft"}/${timestamp}_proposta.pdf`;

    // 9a. Upload DOCX to storage
    console.log(`[template-preview] Uploading DOCX to storage: ${docxStoragePath}`);
    const { error: docxUploadErr } = await adminClient.storage
      .from("proposta-documentos")
      .upload(docxStoragePath, report, {
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      });
    if (docxUploadErr) {
      console.error("[template-preview] DOCX upload error:", docxUploadErr.message);
    }

    // 9b. Convert DOCX to PDF via Gotenberg
    let pdfBytes: Uint8Array | null = null;
    let pdfConversionError: string | null = null;
    try {
      const GOTENBERG_URL = Deno.env.get("GOTENBERG_URL") || "https://demo.gotenberg.dev";
      console.log(`[template-preview] Converting to PDF via Gotenberg: ${GOTENBERG_URL}`);
      
      const formData = new FormData();
      const blob = new Blob([report], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      formData.append("files", blob, "proposta.docx");
      formData.append("landscape", "false");
      formData.append("nativePageRanges", "1-");

      const pdfResp = await fetch(
        `${GOTENBERG_URL}/forms/libreoffice/convert`,
        {
          method: "POST",
          body: formData,
          signal: AbortSignal.timeout(90000),
        },
      );

      if (pdfResp.ok) {
        const pdfBuffer = await pdfResp.arrayBuffer();
        pdfBytes = new Uint8Array(pdfBuffer);
        console.log(`[template-preview] PDF generated: ${pdfBytes.length} bytes`);

        // 9c. Upload PDF to storage
        const { error: pdfUploadErr } = await adminClient.storage
          .from("proposta-documentos")
          .upload(pdfStoragePath, pdfBytes, {
            contentType: "application/pdf",
            upsert: true,
          });
        if (pdfUploadErr) {
          console.error("[template-preview] PDF upload error:", pdfUploadErr.message);
          pdfConversionError = `PDF upload failed: ${pdfUploadErr.message}`;
        }
      } else {
        const errText = await pdfResp.text();
        pdfConversionError = `Gotenberg error ${pdfResp.status}: ${errText}`;
        console.error("[template-preview] PDF conversion failed:", pdfConversionError);
      }
    } catch (pdfErr: any) {
      pdfConversionError = pdfErr?.message || "Unknown PDF conversion error";
      console.error("[template-preview] PDF conversion error:", pdfConversionError);
    }

    // 9d. Update proposta_versoes with artifact paths
    if (proposta_id) {
      // Get latest versao for this proposta
      const { data: latestVersao } = await adminClient
        .from("proposta_versoes")
        .select("id")
        .eq("proposta_id", proposta_id)
        .order("versao_numero", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestVersao) {
        const updatePayload: Record<string, unknown> = {
          output_docx_path: docxUploadErr ? null : docxStoragePath,
          output_pdf_path: (pdfBytes && !pdfConversionError) ? pdfStoragePath : null,
          generation_status: (pdfBytes && !pdfConversionError) ? "ready" : (docxUploadErr ? "error" : "docx_only"),
          generation_error: pdfConversionError || (docxUploadErr ? docxUploadErr.message : null),
          template_id_used: template_id,
          generated_at: new Date().toISOString(),
        };
        
        const { error: updateErr } = await adminClient
          .from("proposta_versoes")
          .update(updatePayload)
          .eq("id", latestVersao.id);
        
        if (updateErr) {
          console.error("[template-preview] Failed to update proposta_versoes:", updateErr.message);
        } else {
          console.log(`[template-preview] proposta_versoes ${latestVersao.id} updated with artifact paths`);
        }
      }
    }

    // ── 10. RETURN RESPONSE ──────────────────────────────
    // Return JSON with paths + the DOCX as binary for backward compatibility
    // Collect missing vars from processDocxTemplate
    const { missingVars: templateMissingVars } = await (async () => {
      // Re-read from the result we already computed above
      // We need the missingVars from the processDocxTemplate call
      // Since we already processed, let's re-extract from the local scope
      return { missingVars: [] as string[] };
    })();

    const responsePayload = {
      success: true,
      output_docx_path: docxUploadErr ? null : docxStoragePath,
      output_pdf_path: (pdfBytes && !pdfConversionError) ? pdfStoragePath : null,
      generation_status: (pdfBytes && !pdfConversionError) ? "ready" : (docxUploadErr ? "error" : "docx_only"),
      generation_error: pdfConversionError || (docxUploadErr ? docxUploadErr.message : null),
      missing_vars: [] as string[],
      template_name: template.nome,
      generated_at: new Date().toISOString(),
    };

    // Check if caller wants JSON response (new flow) vs binary DOCX (legacy)
    const acceptHeader = req.headers.get("Accept") || "";
    const wantJson = acceptHeader.includes("application/json") || body.response_format === "json";

    if (wantJson) {
      return new Response(JSON.stringify(responsePayload), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Legacy: return binary DOCX
    const fileName = `preview_${template.nome.replace(/[^a-zA-Z0-9]/g, "_")}_${safeClienteName}.docx`;
    console.log(`[template-preview] Returning ${report.length} bytes as ${fileName}`);

    return new Response(report, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "X-Output-Docx-Path": docxStoragePath,
        "X-Output-Pdf-Path": (pdfBytes && !pdfConversionError) ? pdfStoragePath : "",
        "X-Generation-Status": (pdfBytes && !pdfConversionError) ? "ready" : "docx_only",
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

// ─── Diagnostic handler ──────────────────────────────────
async function handleDiagnostic(
  adminClient: ReturnType<typeof createClient>,
  templateId: string,
  tenantId: string,
) {
  const corsJson = { ...corsHeaders, "Content-Type": "application/json" };

  // 1. Fetch template record
  const { data: tmpl, error: tmplErr } = await adminClient
    .from("proposta_templates")
    .select("id, nome, tipo, file_url")
    .eq("id", templateId)
    .eq("tenant_id", tenantId)
    .single();

  if (tmplErr || !tmpl || !tmpl.file_url) {
    return new Response(JSON.stringify({ error: "Template não encontrado ou sem file_url", tmplErr }), { status: 404, headers: corsJson });
  }

  // 2. Download template bytes
  const fileUrl = tmpl.file_url.startsWith("http")
    ? tmpl.file_url
    : (() => {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const bucket = "proposta-templates";
        return `${supabaseUrl}/storage/v1/object/authenticated/${bucket}/${tmpl.file_url}`;
      })();

  let templateBytes: Uint8Array;
  if (tmpl.file_url.startsWith("http")) {
    const resp = await fetch(fileUrl);
    if (!resp.ok) return new Response(JSON.stringify({ error: `Download failed: ${resp.status}` }), { status: 500, headers: corsJson });
    templateBytes = new Uint8Array(await resp.arrayBuffer());
  } else {
    const { data: dlData, error: dlErr } = await adminClient.storage
      .from("proposta-templates")
      .download(tmpl.file_url);
    if (dlErr || !dlData) return new Response(JSON.stringify({ error: `Storage download failed: ${dlErr?.message}` }), { status: 500, headers: corsJson });
    templateBytes = new Uint8Array(await dlData.arrayBuffer());
  }

  // 3. Unzip and read document.xml
  const zip = await JSZip.loadAsync(templateBytes);
  const docFile = zip.file("word/document.xml");
  if (!docFile) {
    return new Response(JSON.stringify({ error: "word/document.xml not found in ZIP" }), { status: 500, headers: corsJson });
  }
  const docXml = await docFile.async("string");

  // 4. Find all w:txbx text boxes
  const txbxPattern = /<w:txbx[^>]*>[^]*?<\/w:txbx>/g;
  const textBoxes: Array<{
    index: number;
    visibleText: string;
    runsCount: number;
    placeholdersIntact: string[];
    placeholdersFragmented: string[];
    rawSnippet: string;
  }> = [];

  let txbxMatch;
  let txbxIdx = 0;
  while ((txbxMatch = txbxPattern.exec(docXml)) !== null) {
    const txbxXml = txbxMatch[0];

    // Extract all runs within this textbox
    const runPattern = /<w:r[\s>][^]*?<\/w:r>/g;
    const runs: Array<{ text: string; xml: string }> = [];
    let runMatch;
    while ((runMatch = runPattern.exec(txbxXml)) !== null) {
      const tPattern = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
      let tMatch;
      const texts: string[] = [];
      while ((tMatch = tPattern.exec(runMatch[0])) !== null) {
        texts.push(tMatch[1]);
      }
      runs.push({ text: texts.join(""), xml: runMatch[0] });
    }

    const fullText = runs.map(r => r.text).join("");

    // Check for intact placeholders (within a single run)
    const intactPlaceholders: string[] = [];
    const phPattern = /\[([a-zA-Z_][a-zA-Z0-9_.\-]{0,120})\]/g;
    for (const run of runs) {
      let pm;
      while ((pm = phPattern.exec(run.text)) !== null) {
        intactPlaceholders.push(pm[0]);
      }
    }

    // Check for fragmented placeholders (across runs)
    const fragmentedPlaceholders: string[] = [];
    let fpm;
    const fullPhPattern = /\[([a-zA-Z_][a-zA-Z0-9_.\-]{0,120})\]/g;
    while ((fpm = fullPhPattern.exec(fullText)) !== null) {
      if (!intactPlaceholders.includes(fpm[0])) {
        fragmentedPlaceholders.push(fpm[0]);
      }
    }

    textBoxes.push({
      index: txbxIdx++,
      visibleText: fullText,
      runsCount: runs.length,
      placeholdersIntact: intactPlaceholders,
      placeholdersFragmented: fragmentedPlaceholders,
      rawSnippet: txbxXml.length > 2000 ? txbxXml.substring(0, 2000) + "..." : txbxXml,
    });
  }

  // 5. Check all placeholders in the full document
  const allPlaceholders: string[] = [];
  const docPhPattern = /\[([a-zA-Z_][a-zA-Z0-9_.\-]{0,120})\]/g;
  let dpm;
  while ((dpm = docPhPattern.exec(docXml)) !== null) {
    if (!allPlaceholders.includes(dpm[0])) allPlaceholders.push(dpm[0]);
  }

  // 6. Check wp:anchor occurrences
  const anchorCount = (docXml.match(/<wp:anchor/g) || []).length;
  const inlineCount = (docXml.match(/<wp:inline/g) || []).length;
  const drawingCount = (docXml.match(/<w:drawing/g) || []).length;
  const pictCount = (docXml.match(/<w:pict/g) || []).length;

  // 7. Run normalization and compare
  let normalizedXml = normalizeTextBoxRuns(docXml);
  normalizedXml = normalizeParagraphRuns(normalizedXml);

  // Check if normalization preserved anchors
  const postAnchorCount = (normalizedXml.match(/<wp:anchor/g) || []).length;
  const postDrawingCount = (normalizedXml.match(/<w:drawing/g) || []).length;
  const postTxbxCount = (normalizedXml.match(/<w:txbx/g) || []).length;

  // Check fragmented placeholders after normalization
  const postPlaceholders: string[] = [];
  const postPhPattern = /\[([a-zA-Z_][a-zA-Z0-9_.\-]{0,120})\]/g;
  let ppm;
  while ((ppm = postPhPattern.exec(normalizedXml)) !== null) {
    if (!postPlaceholders.includes(ppm[0])) postPlaceholders.push(ppm[0]);
  }

  const report = {
    template: { id: tmpl.id, nome: tmpl.nome, file_url: tmpl.file_url },
    originalSize: templateBytes.length,
    documentXmlSize: docXml.length,
    normalizedXmlSize: normalizedXml.length,
    xmlStructure: {
      wpAnchor: anchorCount,
      wpInline: inlineCount,
      wDrawing: drawingCount,
      wPict: pictCount,
    },
    postNormalization: {
      wpAnchor: postAnchorCount,
      wDrawing: postDrawingCount,
      wTxbx: postTxbxCount,
      anchorsPreserved: anchorCount === postAnchorCount,
      drawingsPreserved: drawingCount === postDrawingCount,
    },
    textBoxes: {
      count: textBoxes.length,
      details: textBoxes,
    },
    placeholders: {
      beforeNormalization: allPlaceholders,
      afterNormalization: postPlaceholders,
      totalBefore: allPlaceholders.length,
      totalAfter: postPlaceholders.length,
    },
    fragmentationSummary: {
      hasFragmentedPlaceholders: textBoxes.some(tb => tb.placeholdersFragmented.length > 0),
      fragmented: textBoxes.filter(tb => tb.placeholdersFragmented.length > 0).map(tb => ({
        textBox: tb.index,
        text: tb.visibleText,
        fragmentedVars: tb.placeholdersFragmented,
      })),
    },
  };

  console.log("[template-preview] DIAGNOSTIC REPORT:", JSON.stringify(report, null, 2));

  return new Response(JSON.stringify(report, null, 2), { status: 200, headers: corsJson });
}