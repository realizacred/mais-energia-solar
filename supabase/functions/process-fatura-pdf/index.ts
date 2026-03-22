// ──────────────────────────────────────────────────────────────────────────────
// process-fatura-pdf — Orchestrator: parse PDF → store → update UC → notify WA
// ──────────────────────────────────────────────────────────────────────────────
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-client-timeout, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ProcessRequest {
  unit_id?: string;
  pdf_base64?: string;
  pdf_storage_path?: string;
  source: 'email' | 'upload';
  source_message_id?: string;
  email_address?: string;
  tenant_id?: string; // Required for service_role callers
}

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
      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userData?.user?.id) {
        return new Response(JSON.stringify({ error: 'Não autorizado' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const userId = userData.user.id;

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
  const { pdf_base64, unit_id, source, source_message_id, email_address } = body;

  if (!pdf_base64) {
    return new Response(JSON.stringify({ error: 'pdf_base64 obrigatório' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // ── 1. Decode PDF & extract text ──
  const pdfBytes = Uint8Array.from(atob(pdf_base64), c => c.charCodeAt(0));
  const pdfText = extractTextFromPdfBytes(pdfBytes);

  // ── 2. Call parse-conta-energia (with PDF base64 for AI multimodal fallback) ──
  let parseAttempt = await callParseContaEnergia(supabaseUrl, serviceRoleKey, pdfText, pdf_base64, true, 30000);
  let parseResult = parseAttempt.body;

  if (!parseAttempt.ok || !parseResult?.success) {
    // Retry without AI text fallback but still with PDF base64
    const regexOnlyAttempt = await callParseContaEnergia(supabaseUrl, serviceRoleKey, pdfText, pdf_base64, false, 15000);
    if (regexOnlyAttempt.ok && regexOnlyAttempt.body?.success) {
      parseResult = regexOnlyAttempt.body;
    } else {
      return new Response(JSON.stringify({
        error: 'Falha ao parsear fatura',
        details: parseResult || regexOnlyAttempt.body || null,
      }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }

  const parsed = parseResult.data;

  // ── 3. Resolve UC ──
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

  // ── 4. Upload PDF to Storage ──
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
  } else {
    console.warn("[process-fatura-pdf] Upload error:", uploadErr);
  }

  // ── 5. Upsert unit_invoices ──
  // Map bandeira to valid enum value
  let bandeira: string | null = null;
  if (parsed.bandeira_tarifaria) {
    const raw = parsed.bandeira_tarifaria.toLowerCase();
    if (raw.includes('verde')) bandeira = 'verde';
    else if (raw.includes('amarela')) bandeira = 'amarela';
    else if (raw.includes('vermelha') && raw.includes('2')) bandeira = 'vermelha_2';
    else if (raw.includes('vermelha')) bandeira = 'vermelha_1';
  }

  const invoicePayload: any = {
    tenant_id: tenantId,
    reference_month: mes,
    reference_year: ano,
    total_amount: parsed.valor_total,
    energy_consumed_kwh: parsed.consumo_kwh,
    current_balance_kwh: parsed.saldo_gd,
    bandeira_tarifaria: bandeira,
    due_date: parsed.vencimento ? parseDateBR(parsed.vencimento) : null,
    pdf_file_url: pdfUrl,
    source,
    source_message_id: source_message_id || null,
    status: 'received',
    demanda_contratada_kw: parsed.demanda_contratada_kw,
    raw_extraction: parsed,
  };

  if (resolvedUnitId) {
    invoicePayload.unit_id = resolvedUnitId;
  }

  const { data: invoice, error: invoiceErr } = await admin
    .from('unit_invoices')
    .insert(invoicePayload)
    .select('id')
    .maybeSingle();

  if (invoiceErr) {
    console.error("[process-fatura-pdf] Invoice insert error:", invoiceErr);
  }

  // ── 6. Update UC with reading data ──
  if (resolvedUnitId) {
    const ucUpdate: any = {};
    if (parsed.proxima_leitura_data) ucUpdate.proxima_leitura_data = parseDateBR(parsed.proxima_leitura_data);
    if (parsed.leitura_atual_03 != null) {
      ucUpdate.ultima_leitura_data = now.toISOString().split('T')[0];
      ucUpdate.ultima_leitura_kwh_03 = parsed.leitura_atual_03;
    }
    if (parsed.leitura_atual_103 != null) {
      ucUpdate.ultima_leitura_kwh_103 = parsed.leitura_atual_103;
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
  }

  // ── 7. WhatsApp notification ──
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
      invoice_id: invoice?.id || null,
      pdf_url: pdfUrl,
      uc_found: !!ucData,
    },
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function callParseContaEnergia(
  supabaseUrl: string,
  serviceRoleKey: string,
  text: string,
  pdfBase64: string,
  useAiFallback: boolean,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const payload: Record<string, any> = {
      text: text || "",
      use_ai_fallback: useAiFallback,
    };

    // Include PDF base64 for AI multimodal extraction when text is poor
    if (!text || text.length < 200) {
      payload.pdf_base64 = pdfBase64;
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/parse-conta-energia`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
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
        body: {
          error: useAiFallback
            ? 'Timeout ao extrair dados com IA; tentando modo rápido.'
            : 'Tempo esgotado ao extrair dados da fatura.',
        },
      };
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── Helpers ──

function extractTextFromPdfBytes(bytes: Uint8Array): string {
  // Basic text extraction from PDF: find text between stream markers
  // This is a simplified approach — works for text-based PDFs, not scanned
  const decoder = new TextDecoder('latin1');
  const raw = decoder.decode(bytes);
  
  const textChunks: string[] = [];
  
  // Extract text from PDF streams
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;
  while ((match = streamRegex.exec(raw)) !== null) {
    const content = match[1];
    // Look for text operators: Tj, TJ, '
    const textOps = content.match(/\(([^)]*)\)\s*Tj/g);
    if (textOps) {
      for (const op of textOps) {
        const textMatch = op.match(/\(([^)]*)\)/);
        if (textMatch) textChunks.push(textMatch[1]);
      }
    }
    // TJ array operator
    const tjArrays = content.match(/\[(.*?)\]\s*TJ/gs);
    if (tjArrays) {
      for (const arr of tjArrays) {
        const parts = arr.match(/\(([^)]*)\)/g);
        if (parts) {
          textChunks.push(parts.map(p => p.slice(1, -1)).join(''));
        }
      }
    }
  }

  // Also try to find readable text directly
  const readableText = raw.replace(/[^\x20-\x7EÀ-ú\n\r\t]/g, ' ')
    .replace(/\s{3,}/g, ' ')
    .trim();

  const combined = textChunks.join(' ') + '\n' + readableText;
  return combined.substring(0, 10000); // Limit to 10k chars
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
