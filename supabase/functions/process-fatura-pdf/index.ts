// ──────────────────────────────────────────────────────────────────────────────
// process-fatura-pdf — Orchestrator: parse PDF → store → update UC → notify WA
// ──────────────────────────────────────────────────────────────────────────────
import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { extractText, getDocumentProxy } from "npm:unpdf@0.12.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-client-timeout, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ProcessRequest {
  unit_id?: string;
  pdf_base64?: string;
  pdf_storage_path?: string;
  source?: 'email' | 'manual' | 'import' | 'api' | 'upload';
  source_message_id?: string;
  email_address?: string;
  tenant_id?: string; // Required for service_role callers
  force_reprocess?: boolean;
  invoice_id?: string; // For reprocessing existing invoice
}

type InvoiceSource = 'email' | 'manual' | 'import' | 'api';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const authHeader = req.headers.get('Authorization');

  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;
  let tenantId: string | null = null;

  // Admin client for DB operations
  const admin = createClient(supabaseUrl, serviceRoleKey);

  try {
    // ── Auth & tenant resolution ──
    if (isServiceRole) {
      const body: ProcessRequest = await req.json();
      tenantId = body.tenant_id || null;
      if (!tenantId) {
        return new Response(JSON.stringify({ error: 'tenant_id obrigatório para service_role' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return await processInvoice(admin, body, tenantId, supabaseUrl, serviceRoleKey);
    } else {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const token = authHeader.replace('Bearer ', '');
      const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
      if (claimsError || !claimsData?.claims?.sub) {
        return new Response(JSON.stringify({ error: 'Não autorizado' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const userId = claimsData.claims.sub;

      const { data: profile } = await admin
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', userId)
        .single();

      if (!profile?.tenant_id) {
        return new Response(JSON.stringify({ error: 'Tenant não encontrado' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      tenantId = profile.tenant_id;

      const body: ProcessRequest = await req.json();
      return await processInvoice(admin, body, tenantId, supabaseUrl, serviceRoleKey);
    }
  } catch (err: any) {
    console.error("[process-fatura-pdf] Error:", err);
    return new Response(JSON.stringify({ error: err.message || 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

async function processInvoice(
  admin: any,
  body: ProcessRequest,
  tenantId: string,
  supabaseUrl: string,
  serviceRoleKey: string
) {
  const { pdf_base64, pdf_storage_path, unit_id, source, source_message_id, email_address, force_reprocess, invoice_id, test_mode } = body as ProcessRequest & { test_mode?: boolean };
  const invoiceSource = normalizeInvoiceSource(source);

  // ── Reprocess mode: load existing invoice PDF ──
  if (force_reprocess && invoice_id) {
    return await reprocessInvoice(admin, invoice_id, tenantId, supabaseUrl, serviceRoleKey);
  }

  if (!pdf_base64 && !pdf_storage_path) {
    return new Response(JSON.stringify({ error: 'pdf_base64 ou pdf_storage_path obrigatório' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // ── 1. Load PDF bytes ──
  let pdfBytes: Uint8Array;
  let normalizedPdfBase64 = pdf_base64 || null;

  if (pdf_storage_path) {
    const { data: downloadData, error: downloadErr } = await admin.storage
      .from('faturas-energia')
      .download(pdf_storage_path);

    if (downloadErr || !downloadData) {
      return new Response(JSON.stringify({ error: 'Não foi possível ler o PDF enviado para processamento' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    pdfBytes = new Uint8Array(await downloadData.arrayBuffer());
    normalizedPdfBase64 = normalizedPdfBase64 || uint8ToBase64(pdfBytes);
  } else {
    pdfBytes = Uint8Array.from(atob(pdf_base64!), c => c.charCodeAt(0));
    normalizedPdfBase64 = pdf_base64!;
  }

  const pdfText = await extractTextFromPdfBytesAsync(pdfBytes);

  // ── 2. Detect concessionária & resolve extraction config ──
  const detectedConc = detectConcessionariaFromText(pdfText);
  let extractionConfig: any = null;

  if (detectedConc) {
    // Priority: tenant-specific > global (tenant_id IS NULL)
    const { data: configs } = await admin
      .from('invoice_extraction_configs')
      .select('*')
      .eq('concessionaria_code', detectedConc)
      .eq('active', true)
      .order('tenant_id', { ascending: false, nullsFirst: false });

    if (configs && configs.length > 0) {
      // Prefer tenant-specific config
      extractionConfig = configs.find((c: any) => c.tenant_id === tenantId) || configs[0];
      console.log(`[process-fatura-pdf] Using extraction config: ${extractionConfig.concessionaria_nome} (strategy: ${extractionConfig.strategy_mode})`);
    }
  }

  const strategyMode = extractionConfig?.strategy_mode || 'native';
  const requiredFields = extractionConfig?.required_fields || ['consumo_kwh', 'valor_total'];

  // ── 3. Call parse-conta-energia (deterministic parser — NO AI) ──
  let parseAttempt = await callParseContaEnergia(supabaseUrl, serviceRoleKey, pdfText, 30000);
  let parseResult = parseAttempt.body;

  if (!parseAttempt.ok || !parseResult?.success) {
    // Log failed extraction run
    await logExtractionRun(admin, tenantId, extractionConfig?.id, null, null, detectedConc || 'unknown', strategyMode, 'failed', parseResult?.error || 'Parser retornou erro', requiredFields, [], requiredFields);

    if (test_mode) {
      return new Response(JSON.stringify({
        success: false,
        test_mode: true,
        error: 'Falha ao parsear fatura',
        details: parseResult || null,
        concessionaria_detected: detectedConc,
        config_used: extractionConfig ? { id: extractionConfig.id, nome: extractionConfig.concessionaria_nome, strategy: strategyMode } : null,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      error: 'Falha ao parsear fatura (parser determinístico)',
      details: parseResult || null,
      extraction_method: 'deterministic',
      parsing_status: 'failed',
    }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const parsed = parseResult.data;
  console.log(`[process-fatura-pdf] Deterministic parser v${parsed.parser_version || '?'} (${parsed.parser_used || 'generic'}), confidence: ${parsed.confidence}`);

  // ── 4. Validate required fields from config ──
  const foundFields = requiredFields.filter((f: string) => parsed[f] != null);
  const missingFields = requiredFields.filter((f: string) => parsed[f] == null);
  const extractionStatus = missingFields.length === 0 ? 'success' : missingFields.length <= 2 ? 'partial' : 'failed';

  // ── TEST MODE: return results without persisting ──
  if (test_mode) {
    // Run GD consistency on test data too
    const gdChecks = runGdConsistencyChecks(parsed, null);

    await logExtractionRun(admin, tenantId, extractionConfig?.id, null, null, detectedConc || parsed.parser_used || 'unknown', strategyMode, extractionStatus, missingFields.length > 0 ? `Missing: ${missingFields.join(', ')}` : null, requiredFields, foundFields, missingFields, parsed.confidence, parsed.parser_version);

    return new Response(JSON.stringify({
      success: true,
      test_mode: true,
      data: {
        parsed,
        concessionaria_detected: detectedConc || parsed.concessionaria_nome,
        config_used: extractionConfig ? { id: extractionConfig.id, nome: extractionConfig.concessionaria_nome, strategy: strategyMode } : null,
        extraction_status: extractionStatus,
        required_fields: requiredFields,
        fields_found: foundFields,
        fields_missing: missingFields,
        gd_consistency: gdChecks,
      },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // ── 5. Resolve UC ──
  let resolvedUnitId = unit_id || null;
  let ucData: any = null;

  if (!resolvedUnitId && parsed.numero_uc) {
    const { data: uc } = await admin
      .from('units_consumidoras')
      .select('id, codigo_uc, cliente_id')
      .eq('tenant_id', tenantId)
      .eq('codigo_uc', parsed.numero_uc)
      .maybeSingle();

    if (uc) {
      resolvedUnitId = uc.id;
      ucData = uc;
    }
  }

  if (resolvedUnitId && !ucData) {
    const { data: uc } = await admin
      .from('units_consumidoras')
      .select('id, codigo_uc, cliente_id')
      .eq('id', resolvedUnitId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    ucData = uc;
  }

  if (!resolvedUnitId) {
    return new Response(JSON.stringify({
      error: 'Não foi possível vincular a fatura a uma UC.',
      details: { numero_uc: parsed.numero_uc ?? null },
    }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // ── 6. Upload PDF to Storage ──
  let pdfUrl: string | null = null;
  const now = new Date();
  const ano = parsed.mes_referencia ? extractYear(parsed.mes_referencia, now.getFullYear()) : now.getFullYear();
  const mes = parsed.mes_referencia ? extractMonth(parsed.mes_referencia, now.getMonth() + 1) : now.getMonth() + 1;
  const ucCode = ucData?.codigo_uc || parsed.numero_uc || 'unknown';
  const storagePath = `${tenantId}/${ano}/${String(mes).padStart(2, '0')}/${ucCode}.pdf`;

  const { error: uploadErr } = await admin.storage
    .from('faturas-energia')
    .upload(storagePath, pdfBytes, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (!uploadErr) {
    const { data: signedData } = await admin.storage
      .from('faturas-energia')
      .createSignedUrl(storagePath, 86400);
    pdfUrl = signedData?.signedUrl || null;

    if (pdf_storage_path && pdf_storage_path !== storagePath) {
      await admin.storage.from('faturas-energia').remove([pdf_storage_path]);
    }
  } else {
    console.warn("[process-fatura-pdf] Upload error:", uploadErr);
  }

  // ── 7. Lookup previous balance from DB history (SSOT) ──
  let previousBalanceKwh: number | null = null;
  {
    const { data: prevInvoice } = await admin
      .from('unit_invoices')
      .select('current_balance_kwh, reference_year, reference_month')
      .eq('unit_id', resolvedUnitId)
      .eq('tenant_id', tenantId)
      .lt('reference_year', ano)
      .order('reference_year', { ascending: false })
      .order('reference_month', { ascending: false })
      .limit(1)
      .maybeSingle();

    // If no result with year filter, try same year but earlier month
    if (!prevInvoice) {
      const { data: prevSameYear } = await admin
        .from('unit_invoices')
        .select('current_balance_kwh, reference_year, reference_month')
        .eq('unit_id', resolvedUnitId)
        .eq('tenant_id', tenantId)
        .eq('reference_year', ano)
        .lt('reference_month', mes)
        .order('reference_month', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (prevSameYear?.current_balance_kwh != null) {
        previousBalanceKwh = prevSameYear.current_balance_kwh;
        console.log(`[process-fatura-pdf] Previous balance from DB: ${previousBalanceKwh} kWh (${prevSameYear.reference_month}/${prevSameYear.reference_year})`);
      }
    } else if (prevInvoice?.current_balance_kwh != null) {
      previousBalanceKwh = prevInvoice.current_balance_kwh;
      console.log(`[process-fatura-pdf] Previous balance from DB: ${previousBalanceKwh} kWh (${prevInvoice.reference_month}/${prevInvoice.reference_year})`);
    }
  }

  // ── 8. Build invoice payload ──
  let bandeira: string | null = null;
  if (parsed.bandeira_tarifaria) {
    const raw = parsed.bandeira_tarifaria.toLowerCase();
    if (raw.includes('verde')) bandeira = 'verde';
    else if (raw.includes('amarela')) bandeira = 'amarela';
    else if (raw.includes('vermelha') && raw.includes('2')) bandeira = 'vermelha_2';
    else if (raw.includes('vermelha')) bandeira = 'vermelha_1';
  }

  let energyInjected = parsed.energia_injetada_kwh ?? null;
  if (energyInjected === null && parsed.leitura_atual_103 != null && parsed.leitura_anterior_103 != null) {
    energyInjected = Math.max(parsed.leitura_atual_103 - parsed.leitura_anterior_103, 0);
  }

  const currentBalance = parsed.saldo_gd_acumulado ?? parsed.saldo_gd ?? null;

  // ── 9. Run GD consistency checks ──
  const gdPrevious = previousBalanceKwh != null ? { saldo_gd_acumulado: previousBalanceKwh } : null;
  const gdChecks = runGdConsistencyChecks({
    consumo_kwh: parsed.consumo_kwh,
    energia_injetada_kwh: energyInjected,
    energia_compensada_kwh: parsed.energia_compensada_kwh,
    saldo_gd_acumulado: currentBalance,
    saldo_gd_anterior: previousBalanceKwh,
    valor_total: parsed.valor_total,
  }, gdPrevious ? { saldo_gd_acumulado: previousBalanceKwh } : null);

  console.log(`[process-fatura-pdf] GD Consistency: status=${gdChecks.overallLevel} score=${gdChecks.score}`);

  const invoicePayload: any = {
    tenant_id: tenantId,
    unit_id: resolvedUnitId,
    reference_month: mes,
    reference_year: ano,
    total_amount: parsed.valor_total,
    energy_consumed_kwh: parsed.consumo_kwh,
    energy_injected_kwh: energyInjected,
    compensated_kwh: parsed.energia_compensada_kwh ?? null,
    current_balance_kwh: currentBalance,
    previous_balance_kwh: previousBalanceKwh,
    bandeira_tarifaria: bandeira,
    due_date: parsed.vencimento ? parseDateBR(parsed.vencimento) : null,
    pdf_file_url: pdfUrl,
    source: invoiceSource,
    source_message_id: source_message_id || null,
    status: 'received',
    demanda_contratada_kw: parsed.demanda_contratada_kw,
    raw_extraction: parsed,
    parsing_status: extractionStatus,
    parser_version: parsed.parser_version || null,
    last_parsed_at: new Date().toISOString(),
    parsing_error_reason: missingFields.length > 0 ? `Campos faltantes: ${missingFields.join(', ')}` : null,
    // GD consistency results
    consistency_status: gdChecks.overallLevel,
    consistency_score: gdChecks.score,
    consistency_checks_json: gdChecks.checks,
    consistency_warnings_json: gdChecks.checks.filter((c: any) => c.level === 'warning'),
    consistency_errors_json: gdChecks.checks.filter((c: any) => c.level === 'error'),
  };

  const { data: invoice, error: invoiceErr } = await admin
    .from('unit_invoices')
    .insert(invoicePayload)
    .select('id')
    .maybeSingle();

  if (invoiceErr || !invoice?.id) {
    console.error("[process-fatura-pdf] Invoice insert error:", invoiceErr);
    return new Response(JSON.stringify({
      error: 'Falha ao salvar fatura extraída.',
      details: invoiceErr?.message || 'Insert retornou vazio',
    }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // ── 10. Log extraction run ──
  await logExtractionRun(admin, tenantId, extractionConfig?.id, invoice.id, resolvedUnitId, detectedConc || parsed.parser_used || 'unknown', strategyMode, extractionStatus, missingFields.length > 0 ? `Missing: ${missingFields.join(', ')}` : null, requiredFields, foundFields, missingFields, parsed.confidence, parsed.parser_version);

  // ── 11. Update UC with reading data + enrich from first invoice ──
  const ucUpdate: any = {};
  if (parsed.proxima_leitura_data) {
    const parsedDate = parseDateBR(parsed.proxima_leitura_data);
    if (parsedDate) {
      ucUpdate.proxima_leitura_data = parsedDate;
      console.log(`[process-fatura-pdf] Próxima leitura extraída: ${parsed.proxima_leitura_data} → ${parsedDate}`);
    } else {
      console.warn(`[process-fatura-pdf] Próxima leitura inválida: "${parsed.proxima_leitura_data}"`);
    }
  } else {
    console.warn("[process-fatura-pdf] Próxima leitura NÃO encontrada na fatura — campo ficará sem atualização");
  }
  if (parsed.leitura_atual_03 != null) {
    ucUpdate.ultima_leitura_data = now.toISOString().split('T')[0];
    ucUpdate.ultima_leitura_kwh_03 = parsed.leitura_atual_03;
  }
  if (parsed.leitura_atual_103 != null) {
    ucUpdate.ultima_leitura_kwh_103 = parsed.leitura_atual_103;
  }

  // Enrich UC from first invoice — only fill empty fields, never overwrite
  const enrichFields = [
    'categoria_gd', 'concessionaria_nome', 'endereco',
    'classificacao_grupo', 'classificacao_subgrupo', 'modalidade_tarifaria', 'nome',
  ] as const;

  const hasEnrichData = parsed.categoria_gd || parsed.concessionaria_nome || parsed.endereco
    || parsed.classe_consumo || parsed.cliente_nome;

  if (hasEnrichData) {
    const { data: currentUc } = await admin
      .from('units_consumidoras')
      .select(enrichFields.join(', '))
      .eq('id', resolvedUnitId)
      .maybeSingle();

    if (currentUc) {
      if (parsed.categoria_gd && !currentUc.categoria_gd) ucUpdate.categoria_gd = parsed.categoria_gd;
      if (parsed.concessionaria_nome && !currentUc.concessionaria_nome) ucUpdate.concessionaria_nome = parsed.concessionaria_nome;
      if (!currentUc.endereco) {
        const parts = [parsed.endereco, parsed.cidade, parsed.estado].filter(Boolean);
        if (parts.length > 0) ucUpdate.endereco = parts.join(', ');
      }
      if (parsed.classe_consumo && !currentUc.classificacao_grupo) {
        const grupoMatch = parsed.classe_consumo.match(/^([AB]\d?)/i);
        if (grupoMatch) ucUpdate.classificacao_grupo = grupoMatch[1].toUpperCase();
      }
      if (parsed.classe_consumo && !currentUc.classificacao_subgrupo) {
        const subMatch = parsed.classe_consumo.replace(/^[AB]\d?\s*[-:]?\s*/i, '').trim();
        if (subMatch) ucUpdate.classificacao_subgrupo = subMatch;
      }
      if (parsed.modalidade_tarifaria && !currentUc.modalidade_tarifaria) ucUpdate.modalidade_tarifaria = parsed.modalidade_tarifaria;
      if (parsed.cliente_nome && !currentUc.nome) ucUpdate.nome = parsed.cliente_nome;

      const enrichedKeys = Object.keys(ucUpdate).filter(k => enrichFields.includes(k as any));
      if (enrichedKeys.length > 0) console.log(`[process-fatura-pdf] UC enriched from invoice: ${enrichedKeys.join(', ')}`);
    }
  }

  if (Object.keys(ucUpdate).length > 0) {
    await admin
      .from('units_consumidoras')
      .update(ucUpdate)
      .eq('id', resolvedUnitId)
      .eq('tenant_id', tenantId);
  }

  // Update billing settings status
  await admin
    .from('unit_billing_email_settings')
    .update({ setup_status: 'active' })
    .eq('unit_id', resolvedUnitId)
    .eq('tenant_id', tenantId);

  // ── 12. WhatsApp notification ──
  if (ucData?.cliente_id) {
    try {
      const { data: cliente } = await admin
        .from('clientes')
        .select('nome, telefone')
        .eq('id', ucData.cliente_id)
        .maybeSingle();

      if (cliente?.telefone) {
        const saldoLine = (parsed.saldo_gd && parsed.saldo_gd > 0)
          ? `\n✅ Saldo GD: ${parsed.saldo_gd} kWh`
          : '';
        const proxLine = parsed.proxima_leitura_data
          ? `\n📅 Próxima leitura: ${parsed.proxima_leitura_data}`
          : '';
        const refMes = parsed.mes_referencia || `${String(mes).padStart(2, '0')}/${ano}`;

        const mensagem = `Olá ${cliente.nome}! 🌞\nSua fatura de ${refMes} foi recebida:\n📊 Leitura: ${parsed.leitura_atual_03 ?? '—'} kWh\n⚡ Consumo: ${parsed.consumo_kwh ?? '—'} kWh\n💰 Valor: R$ ${parsed.valor_total?.toFixed(2) ?? '—'}\n📅 Vencimento: ${parsed.vencimento ?? '—'}${saldoLine}${proxLine}`;

        await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-message`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            telefone: cliente.telefone,
            mensagem,
            tipo: 'automatico',
            tenant_id: tenantId,
          }),
        });
      }
    } catch (waErr) {
      console.warn("[process-fatura-pdf] WA notification error:", waErr);
    }
  }

  return new Response(JSON.stringify({
    success: true,
    data: {
      parsed,
      unit_id: resolvedUnitId,
      invoice_id: invoice.id,
      pdf_url: pdfUrl,
      uc_found: !!ucData,
      source: invoiceSource,
      extraction_status: extractionStatus,
      gd_consistency: gdChecks,
      config_used: extractionConfig ? { id: extractionConfig.id, nome: extractionConfig.concessionaria_nome } : null,
    },
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ── Reprocess existing invoice ──
async function reprocessInvoice(
  admin: any,
  invoiceId: string,
  tenantId: string,
  supabaseUrl: string,
  serviceRoleKey: string
) {
  // 1. Fetch existing invoice
  const { data: invoice, error: invErr } = await admin
    .from('unit_invoices')
    .select('id, unit_id, pdf_file_url, raw_extraction, tenant_id, reference_month, reference_year')
    .eq('id', invoiceId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (invErr || !invoice) {
    return new Response(JSON.stringify({ error: 'Fatura não encontrada' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // 2. Try to find PDF in storage to re-extract text
  const { data: ucData } = await admin
    .from('units_consumidoras')
    .select('id, codigo_uc')
    .eq('id', invoice.unit_id)
    .maybeSingle();

  let pdfText = '';
  let pdfFound = false;

  const raw = invoice.raw_extraction as Record<string, any> | null;
  const ucCode = ucData?.codigo_uc || raw?.numero_uc || 'unknown';

  // Strategy 1: Extract storage path from pdf_file_url (signed URL contains the path)
  const possiblePaths: string[] = [];
  if (invoice.pdf_file_url) {
    try {
      const urlObj = new URL(invoice.pdf_file_url);
      // Signed URLs have path like /storage/v1/object/sign/faturas-energia/{tenant}/{year}/{month}/{uc}.pdf
      const pathMatch = urlObj.pathname.match(/\/faturas-energia\/(.+\.pdf)/);
      if (pathMatch) {
        possiblePaths.push(pathMatch[1]);
      }
    } catch { /* ignore URL parse errors */ }
  }

  // Strategy 2: Use invoice's own reference_month/reference_year fields
  if (invoice.reference_month && invoice.reference_year) {
    possiblePaths.push(`${tenantId}/${invoice.reference_year}/${String(invoice.reference_month).padStart(2, '0')}/${ucCode}.pdf`);
  }

  // Strategy 3: Use raw_extraction mes_referencia
  if (raw?.mes_referencia) {
    const year = extractYear(raw.mes_referencia, new Date().getFullYear());
    const month = extractMonth(raw.mes_referencia, new Date().getMonth() + 1);
    possiblePaths.push(`${tenantId}/${year}/${String(month).padStart(2, '0')}/${ucCode}.pdf`);
  }

  // Strategy 4: List files in tenant folder to find any matching UC PDF
  if (!possiblePaths.length && ucCode !== 'unknown') {
    // Try current year/month as last resort
    const now = new Date();
    for (let m = now.getMonth() + 1; m >= 1; m--) {
      possiblePaths.push(`${tenantId}/${now.getFullYear()}/${String(m).padStart(2, '0')}/${ucCode}.pdf`);
    }
  }

  // Deduplicate paths
  const uniquePaths = [...new Set(possiblePaths)];
  console.log(`[process-fatura-pdf] Reprocess: trying ${uniquePaths.length} storage paths for invoice ${invoiceId}`);

  for (const path of uniquePaths) {
    const { data: dlData, error: dlErr } = await admin.storage
      .from('faturas-energia')
      .download(path);
    if (!dlErr && dlData) {
      const bytes = new Uint8Array(await dlData.arrayBuffer());
      pdfText = await extractTextFromPdfBytesAsync(bytes);
      pdfFound = true;
      console.log(`[process-fatura-pdf] Reprocess: PDF found at ${path}`);
      break;
    }
  }

  // Fallback: try using raw text from raw_extraction
  if (!pdfFound && raw?.texto_bruto) {
    pdfText = raw.texto_bruto;
    console.log(`[process-fatura-pdf] Reprocess: using texto_bruto from raw_extraction`);
  }

  if (!pdfText || pdfText.length < 20) {
    await admin.from('unit_invoices').update({
      parsing_status: 'failed',
      parsing_error_reason: `PDF não encontrado no storage (tentados ${uniquePaths.length} caminhos)`,
      last_parsed_at: new Date().toISOString(),
    }).eq('id', invoiceId);

    return new Response(JSON.stringify({
      error: 'PDF não encontrado para reprocessamento.',
      parsing_status: 'failed',
      paths_tried: uniquePaths,
    }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // 3. Re-parse
  const parseAttempt = await callParseContaEnergia(supabaseUrl, serviceRoleKey, pdfText, 30000);
  const parseResult = parseAttempt.body;

  if (!parseAttempt.ok || !parseResult?.success) {
    await admin.from('unit_invoices').update({
      parsing_status: 'failed',
      parsing_error_reason: parseResult?.error || 'Parser retornou erro',
      last_parsed_at: new Date().toISOString(),
      parser_version: parseResult?.data?.parser_version || null,
    }).eq('id', invoiceId);

    return new Response(JSON.stringify({
      error: 'Reprocessamento falhou',
      details: parseResult || null,
      parsing_status: 'failed',
    }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const parsed = parseResult.data;

  // 4. Calculate derived fields
  let energyInjected = parsed.energia_injetada_kwh ?? null;
  if (energyInjected === null && parsed.leitura_atual_103 != null && parsed.leitura_anterior_103 != null) {
    energyInjected = Math.max(parsed.leitura_atual_103 - parsed.leitura_anterior_103, 0);
  }
  const currentBalance = parsed.saldo_gd_acumulado ?? parsed.saldo_gd ?? null;
  const reprocessedYear = parsed.mes_referencia ? extractYear(parsed.mes_referencia, invoice.reference_year) : invoice.reference_year;
  const reprocessedMonth = parsed.mes_referencia ? extractMonth(parsed.mes_referencia, invoice.reference_month) : invoice.reference_month;

  // Lookup previous balance from DB
  let previousBalance: number | null = null;
  {
    const { data: prevInv } = await admin
      .from('unit_invoices')
      .select('current_balance_kwh')
      .eq('unit_id', invoice.unit_id)
      .eq('tenant_id', tenantId)
      .neq('id', invoiceId)
      .or(`reference_year.lt.${reprocessedYear},and(reference_year.eq.${reprocessedYear},reference_month.lt.${reprocessedMonth})`)
      .order('reference_year', { ascending: false })
      .order('reference_month', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (prevInv?.current_balance_kwh != null) {
      previousBalance = prevInv.current_balance_kwh;
    }
  }

  // Run GD consistency
  const gdChecks = runGdConsistencyChecks({
    consumo_kwh: parsed.consumo_kwh,
    energia_injetada_kwh: energyInjected,
    energia_compensada_kwh: parsed.energia_compensada_kwh,
    saldo_gd_acumulado: currentBalance,
    saldo_gd_anterior: previousBalance,
    valor_total: parsed.valor_total,
  }, previousBalance != null ? { saldo_gd_acumulado: previousBalance } : null);

  let bandeira: string | null = null;
  if (parsed.bandeira_tarifaria) {
    const rawB = parsed.bandeira_tarifaria.toLowerCase();
    if (rawB.includes('verde')) bandeira = 'verde';
    else if (rawB.includes('amarela')) bandeira = 'amarela';
    else if (rawB.includes('vermelha') && rawB.includes('2')) bandeira = 'vermelha_2';
    else if (rawB.includes('vermelha')) bandeira = 'vermelha_1';
  }

  // 5. Update the invoice
  const updatePayload: any = {
    reference_month: reprocessedMonth,
    reference_year: reprocessedYear,
    total_amount: parsed.valor_total,
    energy_consumed_kwh: parsed.consumo_kwh,
    energy_injected_kwh: energyInjected,
    compensated_kwh: parsed.energia_compensada_kwh ?? null,
    current_balance_kwh: currentBalance,
    previous_balance_kwh: previousBalance,
    bandeira_tarifaria: bandeira,
    due_date: parsed.vencimento ? parseDateBR(parsed.vencimento) : null,
    demanda_contratada_kw: parsed.demanda_contratada_kw,
    raw_extraction: parsed,
    parsing_status: 'success',
    parser_version: parsed.parser_version || null,
    last_parsed_at: new Date().toISOString(),
    parsing_error_reason: null,
    updated_at: new Date().toISOString(),
    consistency_status: gdChecks.overallLevel,
    consistency_score: gdChecks.score,
    consistency_checks_json: gdChecks.checks,
    consistency_warnings_json: gdChecks.checks.filter((c: any) => c.level === 'warning'),
    consistency_errors_json: gdChecks.checks.filter((c: any) => c.level === 'error'),
  };

  const { data: updatedInvoice, error: updateErr } = await admin
    .from('unit_invoices')
    .update(updatePayload)
    .eq('id', invoiceId)
    .select('id, unit_id, reference_month, reference_year, due_date, total_amount, energy_consumed_kwh, energy_injected_kwh, compensated_kwh, previous_balance_kwh, current_balance_kwh, pdf_file_url, source, status, created_at, demanda_contratada_kw, demanda_medida_kw, ultrapassagem_kw, multa_ultrapassagem, bandeira_tarifaria, raw_extraction, parsing_status, parsing_error_reason, parser_version, last_parsed_at, consistency_status, consistency_score')
    .maybeSingle();

  if (updateErr || !updatedInvoice) {
    console.error("[process-fatura-pdf] Reprocess update error:", updateErr);
    return new Response(JSON.stringify({
      error: 'Falha ao atualizar fatura reprocessada',
      details: updateErr?.message || 'Update retornou vazio',
    }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Log extraction run
  const detectedConc = detectConcessionariaFromText(pdfText);
  await logExtractionRun(admin, tenantId, null, invoiceId, invoice.unit_id, detectedConc || parsed.parser_used || 'unknown', 'native', 'success', null, [], [], [], parsed.confidence, parsed.parser_version);

  console.log(`[process-fatura-pdf] Reprocessed invoice ${invoiceId} — parser v${parsed.parser_version}, confidence: ${parsed.confidence}, GD: ${gdChecks.overallLevel}`);

  return new Response(JSON.stringify({
    success: true,
    data: {
      parsed,
      invoice: updatedInvoice,
      invoice_id: invoiceId,
      unit_id: invoice.unit_id,
      reprocessed: true,
      parser_version: parsed.parser_version,
      gd_consistency: gdChecks,
    },
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function callParseContaEnergia(
  supabaseUrl: string,
  serviceRoleKey: string,
  text: string,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/parse-conta-energia`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: text || "" }),
      signal: controller.signal,
    });

    let body: any = null;
    try {
      body = await response.json();
    } catch {
      body = { error: 'Resposta inválida do parser de faturas' };
    }

    return { ok: response.ok, body };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return {
        ok: false,
        body: { error: 'Tempo esgotado ao extrair dados da fatura.' },
      };
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── Helpers ──

async function extractTextFromPdfBytesAsync(bytes: Uint8Array): Promise<string> {
  const MAX_OUTPUT_CHARS = 30_000;
  try {
    const doc = await getDocumentProxy(new Uint8Array(bytes));
    const { text } = await extractText(doc, { mergePages: true });
    if (text && text.trim().length > 10) {
      console.log(`[process-fatura-pdf] unpdf extracted ${text.length} chars`);
      return text.slice(0, MAX_OUTPUT_CHARS);
    }
  } catch (err) {
    console.warn("[process-fatura-pdf] unpdf extraction failed, using fallback:", err);
  }

  // Fallback: rudimentary extraction for edge cases
  return extractTextFromPdfBytesFallback(bytes);
}

function extractTextFromPdfBytesFallback(bytes: Uint8Array): string {
  const MAX_DECODE_BYTES = 1_000_000;
  const MAX_OUTPUT_CHARS = 10_000;
  const MAX_STREAMS = 40;
  const decoder = new TextDecoder('latin1');
  const sample = bytes.byteLength > MAX_DECODE_BYTES ? bytes.subarray(0, MAX_DECODE_BYTES) : bytes;
  const raw = decoder.decode(sample);

  const textChunks: string[] = [];
  let collectedChars = 0;
  let match: RegExpExecArray | null;

  const shouldInspectStreams = sample.byteLength <= 750_000;

  if (shouldInspectStreams) {
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let streamCount = 0;

    while ((match = streamRegex.exec(raw)) !== null && streamCount < MAX_STREAMS && collectedChars < MAX_OUTPUT_CHARS) {
      streamCount += 1;
      const content = match[1];

      const textOps = content.match(/\(([^)]*)\)\s*Tj/g) ?? [];
      for (const op of textOps) {
        const textMatch = op.match(/\(([^)]*)\)/);
        if (!textMatch?.[1]) continue;
        textChunks.push(textMatch[1]);
        collectedChars += textMatch[1].length;
        if (collectedChars >= MAX_OUTPUT_CHARS) break;
      }

      if (collectedChars >= MAX_OUTPUT_CHARS) break;

      const tjArrays = content.match(/\[(.*?)\]\s*TJ/gs) ?? [];
      for (const arr of tjArrays) {
        const parts = arr.match(/\(([^)]*)\)/g);
        if (!parts?.length) continue;
        const joined = parts.map((part) => part.slice(1, -1)).join('');
        textChunks.push(joined);
        collectedChars += joined.length;
        if (collectedChars >= MAX_OUTPUT_CHARS) break;
      }
    }
  }

  const readableText = raw
    .replace(/[^\x20-\x7EÀ-ú\n\r\t]/g, ' ')
    .replace(/\s{3,}/g, ' ')
    .trim()
    .slice(0, MAX_OUTPUT_CHARS);

  const combined = `${textChunks.join(' ')}\n${readableText}`.trim();
  return combined.slice(0, MAX_OUTPUT_CHARS);
}

function parseDateBR(dateStr: string): string | null {
  if (!dateStr) return null;
  const parts = dateStr.split(/[\/.\-]/);
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  const fullYear = year.length === 2 ? `20${year}` : year;
  return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}



function extractYear(mesRef: string, fallback: number): number {
  const match = mesRef.match(/(\d{4})/);
  if (match) return parseInt(match[1]);
  const match2 = mesRef.match(/(\d{2})$/);
  if (match2) return 2000 + parseInt(match2[1]);
  return fallback;
}

function extractMonth(mesRef: string, fallback: number): number {
  const meses: Record<string, number> = {
    'JAN': 1, 'FEV': 2, 'MAR': 3, 'ABR': 4, 'MAI': 5, 'JUN': 6,
    'JUL': 7, 'AGO': 8, 'SET': 9, 'OUT': 10, 'NOV': 11, 'DEZ': 12,
  };
  const upper = mesRef.toUpperCase();
  for (const [key, val] of Object.entries(meses)) {
    if (upper.includes(key)) return val;
  }
  const match = mesRef.match(/^(\d{2})\//);
  if (match) return parseInt(match[1]);
  return fallback;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function normalizeInvoiceSource(source?: string): InvoiceSource {
  const normalized = (source || '').toLowerCase();

  if (normalized === 'upload' || normalized === 'import') return 'import';
  if (normalized === 'email') return 'email';
  if (normalized === 'manual') return 'manual';
  if (normalized === 'api') return 'api';

  return 'import';
}

// ── Detect concessionária from text ──
function detectConcessionariaFromText(text: string): string | null {
  const upper = text.toUpperCase();
  if (upper.includes("ENERGISA")) return "energisa";
  if (upper.includes("LIGHT S") || upper.includes("LIGHT -")) return "light";
  if (upper.includes("ENEL") || upper.includes("ELETROPAULO")) return "enel";
  if (upper.includes("CEMIG")) return "cemig";
  if (upper.includes("CPFL")) return "cpfl";
  if (upper.includes("CELESC")) return "celesc";
  if (upper.includes("COPEL")) return "copel";
  if (upper.includes("EQUATORIAL")) return "equatorial";
  if (upper.includes("NEOENERGIA") || upper.includes("COELBA") || upper.includes("CELPE") || upper.includes("COSERN")) return "neoenergia";
  return null;
}

// ── GD Consistency Engine (inline for edge function) ──
interface GdData {
  consumo_kwh?: number | null;
  energia_injetada_kwh?: number | null;
  energia_compensada_kwh?: number | null;
  saldo_gd_acumulado?: number | null;
  saldo_gd_anterior?: number | null;
  valor_total?: number | null;
}

interface GdCheck {
  rule: string;
  level: "ok" | "warning" | "error";
  message: string;
  expected?: number | string | null;
  actual?: number | string | null;
}

function runGdConsistencyChecks(current: GdData, previous: GdData | null) {
  const checks: GdCheck[] = [];

  // 1. Injeção vs Compensado
  const injected = current.energia_injetada_kwh;
  const compensated = current.energia_compensada_kwh;
  if (injected != null && compensated != null) {
    if (compensated > injected) {
      checks.push({ rule: "injection_vs_compensation", level: "warning", message: `Compensado (${compensated} kWh) > injetado (${injected} kWh). Possível uso de saldo anterior.`, expected: injected, actual: compensated });
    } else {
      checks.push({ rule: "injection_vs_compensation", level: "ok", message: "Compensado dentro do limite da injeção." });
    }
  }

  // 2. Saldo coerente
  const saldoAtual = current.saldo_gd_acumulado;
  const saldoAnterior = current.saldo_gd_anterior;
  if (saldoAtual != null && saldoAnterior != null && injected != null && compensated != null) {
    const expected = saldoAnterior + injected - compensated;
    const diff = Math.abs(saldoAtual - expected);
    const tolerance = Math.max(expected * 0.05, 5);
    if (diff > tolerance) {
      checks.push({ rule: "balance_coherence", level: "error", message: `Saldo acumulado (${saldoAtual}) diverge do esperado (${Math.round(expected)}). Diferença: ${Math.round(diff)} kWh.`, expected: Math.round(expected), actual: saldoAtual });
    } else {
      checks.push({ rule: "balance_coherence", level: "ok", message: "Saldo acumulado coerente." });
    }
  }

  // 3. Histórico de saldo
  if (previous?.saldo_gd_acumulado != null && saldoAnterior != null) {
    if (Math.abs(previous.saldo_gd_acumulado - saldoAnterior) > 5) {
      checks.push({ rule: "historical_balance_match", level: "warning", message: `Saldo anterior desta fatura (${saldoAnterior}) difere do saldo acumulado da fatura anterior (${previous.saldo_gd_acumulado}).`, expected: previous.saldo_gd_acumulado, actual: saldoAnterior });
    } else {
      checks.push({ rule: "historical_balance_match", level: "ok", message: "Saldo anterior confere com histórico." });
    }
  }

  // 4. Valores não negativos
  const nonNegFields: Array<{ key: keyof GdData; label: string }> = [
    { key: "energia_injetada_kwh", label: "Energia injetada" },
    { key: "energia_compensada_kwh", label: "Energia compensada" },
    { key: "saldo_gd_acumulado", label: "Saldo acumulado" },
    { key: "consumo_kwh", label: "Consumo" },
  ];
  for (const { key, label } of nonNegFields) {
    const val = current[key];
    if (val != null && (val as number) < 0) {
      checks.push({ rule: `non_negative_${key}`, level: "error", message: `${label} é negativo (${val}).`, actual: val });
    }
  }

  // 5. Balance reduction check
  if (previous?.saldo_gd_acumulado != null && saldoAtual != null && compensated != null) {
    const reduction = previous.saldo_gd_acumulado - saldoAtual;
    if (reduction > 0 && reduction > compensated * 1.1 + 10) {
      checks.push({ rule: "balance_reduction_exceeds_compensation", level: "warning", message: `Saldo reduziu ${Math.round(reduction)} kWh mas compensado foi ${compensated} kWh.`, expected: compensated, actual: Math.round(reduction) });
    }
  }

  const overallLevel = checks.some(c => c.level === "error") ? "error" : checks.some(c => c.level === "warning") ? "warning" : "ok";
  const score = checks.length === 0 ? 100 : Math.round((checks.reduce((sum, c) => sum + ({ ok: 1, warning: 0.5, error: 0 }[c.level]), 0) / checks.length) * 100);

  return { checks, overallLevel, score };
}

// ── Log extraction run ──
async function logExtractionRun(
  admin: any,
  tenantId: string,
  configId: string | null,
  invoiceId: string | null,
  unitId: string | null,
  concessionariaCode: string,
  strategyUsed: string,
  status: string,
  errorReason: string | null,
  requiredFields: string[],
  foundFields: string[],
  missingFields: string[],
  confidenceScore?: number | null,
  parserVersion?: string | null,
) {
  try {
    await admin.from('invoice_extraction_runs').insert({
      tenant_id: tenantId,
      config_id: configId,
      invoice_id: invoiceId,
      uc_id: unitId,
      concessionaria_code: concessionariaCode,
      strategy_used: strategyUsed,
      provider_used: null,
      parser_version: parserVersion || null,
      status,
      error_reason: errorReason,
      required_fields_found: foundFields,
      required_fields_missing: missingFields,
      confidence_score: confidenceScore ?? null,
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[process-fatura-pdf] Failed to log extraction run:", err);
  }
}
