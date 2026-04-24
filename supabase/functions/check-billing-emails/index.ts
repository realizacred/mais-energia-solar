import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-client-timeout, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const MANUAL_VERIFICATION_TIMEBOX_MS = 45_000;

// Known utility company email domains
const KNOWN_SENDERS = [
  'energisa.com.br', 'cemig.com.br', 'enel.com', 'enel.com.br',
  'cpfl.com.br', 'copel.com', 'light.com.br', 'celesc.com.br',
  'equatorial.com.br', 'neoenergia.com', 'celpe.com.br', 'coelba.com.br',
  'cosern.com.br', 'edp.com.br', 'elektro.com.br', 'rge-rs.com.br',
  'ceb.com.br', 'celpa.com.br', 'cemar.com.br',
  // Common notification platforms used by utilities
  'notificacoes.energisa.com.br', 'fatura.enel.com.br',
];

function isKnownSender(from: string): boolean {
  const lower = from.toLowerCase();
  return KNOWN_SENDERS.some(domain => lower.includes(domain));
}

function decodeBase64Url(data?: string | null): string {
  if (!data) return '';

  try {
    const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return '';
  }
}

function stripHtml(value: string): string {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function flattenAllParts(part: any): any[] {
  const result: any[] = [];

  if (!part) return result;
  result.push(part);

  if (part.parts) {
    for (const child of part.parts) {
      result.push(...flattenAllParts(child));
    }
  }

  return result;
}

function extractMessageText(payload: any): string {
  const parts = flattenAllParts(payload);
  const chunks: string[] = [];

  for (const part of parts) {
    const mimeType = String(part?.mimeType || '').toLowerCase();
    const decoded = decodeBase64Url(part?.body?.data);
    if (!decoded) continue;

    if (mimeType.includes('text/html')) {
      chunks.push(stripHtml(decoded));
      continue;
    }

    if (mimeType.includes('text/plain') || mimeType === 'multipart/alternative' || mimeType === 'multipart/mixed') {
      chunks.push(decoded.replace(/\s+/g, ' ').trim());
    }
  }

  return chunks.filter(Boolean).join(' ').trim();
}

function normalizeUnitIdentifier(value: string): string {
  return value.replace(/[^\dA-Za-z/-]/g, '').trim().toLowerCase();
}

function extractUnitCandidates(text: string): string[] {
  const candidates = new Set<string>();
  const normalizedText = text.replace(/\s+/g, ' ').trim();

  const labeledRegex = /(unidade\s*consumidora|c[oó]digo\s*(da\s*)?(instala[cç][aã]o|uc)|n[uú]mero\s*da?\s*uc|\buc\b)[^\d]{0,20}([\d./-]{6,20})/gi;
  for (const match of normalizedText.matchAll(labeledRegex)) {
    const candidate = normalizeUnitIdentifier(match[4] || '');
    if (candidate.length >= 6) candidates.add(candidate);
  }

  const genericRegex = /\b\d{6,12}(?:[-/]\d{1,4})?\b/g;
  for (const match of normalizedText.matchAll(genericRegex)) {
    const candidate = normalizeUnitIdentifier(match[0] || '');
    if (candidate.length >= 6) candidates.add(candidate);
  }

  return Array.from(candidates).slice(0, 12);
}

function buildUnitLookup(units: any[] | null | undefined) {
  const lookupByTenant = new Map<string, Map<string, string>>();

  for (const unit of (units || [])) {
    const tenantId = unit.tenant_id;
    if (!tenantId) continue;

    const tenantLookup = lookupByTenant.get(tenantId) || new Map<string, string>();
    const keys = [unit.codigo_uc, unit.unit_identifier]
      .filter(Boolean)
      .map((value: string) => normalizeUnitIdentifier(value))
      .filter(Boolean);

    for (const key of keys) {
      tenantLookup.set(key, unit.id);
    }

    lookupByTenant.set(tenantId, tenantLookup);
  }

  return lookupByTenant;
}

function findMatchedUnitId(params: {
  toHeader: string;
  searchText: string;
  tenantSettings: any[];
  tenantUnitLookup: Map<string, string>;
}) {
  const { toHeader, searchText, tenantSettings, tenantUnitLookup } = params;

  for (const setting of tenantSettings) {
    const emailUc = String(setting.email_da_uc || setting.billing_capture_email || '').trim().toLowerCase();
    if (emailUc && toHeader.toLowerCase().includes(emailUc)) {
      return { unitId: setting.unit_id as string, matchSource: `to_header:${emailUc}` };
    }
  }

  for (const candidate of extractUnitCandidates(searchText)) {
    const match = tenantUnitLookup.get(normalizeUnitIdentifier(candidate));
    if (match) {
      return { unitId: match, matchSource: `content:${candidate}` };
    }
  }

  return { unitId: null, matchSource: null };
}

// Recursively flatten MIME parts for attachments
function flattenParts(part: any): any[] {
  const result: any[] = [];
  if (part?.parts) {
    for (const p of part.parts) {
      result.push(...flattenParts(p));
    }
  }
  if (part?.filename || part?.mimeType === 'application/pdf') {
    result.push(part);
  }
  return result;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Validate cron secret, service_role, or anon key (pg_cron uses anon key)
  const authHeader = req.headers.get('Authorization');
  const cronSecret = Deno.env.get('CRON_SECRET');
  const isCron = cronSecret && req.headers.get('x-cron-secret') === cronSecret;
  const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const isAnonKey = anonKey && authHeader === `Bearer ${anonKey}`;

  // Also allow authenticated users (manual trigger from UI)
  let isAuthedUser = false;
  if (!isCron && !isServiceRole && !isAnonKey && authHeader?.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '');
    const tmpClient = createClient(supabaseUrl, anonKey || serviceRoleKey);
    const { data: { user } } = await tmpClient.auth.getUser(token);
    isAuthedUser = !!user;
  }

  if (!isCron && !isServiceRole && !isAnonKey && !isAuthedUser) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  // Parse optional body for specific account
  let bodyAccountId: string | null = null;
  try {
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      bodyAccountId = body.email_account_id || null;
    }
  } catch {
    /* ignore */
  }

  const isManualVerification = !!bodyAccountId;
  const requestStartedAt = Date.now();
  let timedOut = false;

  const exceededTimebox = () => isManualVerification && (Date.now() - requestStartedAt) >= MANUAL_VERIFICATION_TIMEBOX_MS;

  try {
    // ── 1. Fetch active Gmail accounts directly (no dependency on unit_billing_email_settings) ──
    let gmailQuery = admin
      .from('gmail_accounts')
      .select('id, credentials, settings, email, tenant_id, nome, gmail_label')
      .eq('is_active', true);

    if (bodyAccountId) {
      gmailQuery = gmailQuery.eq('id', bodyAccountId);
    }

    const { data: gmailAccounts, error: gmailErr } = await gmailQuery;

    if (gmailErr || !gmailAccounts?.length) {
      console.log('[check-billing-emails] Nenhuma conta Gmail ativa encontrada');
      return new Response(JSON.stringify({
        success: true,
        message: 'Nenhuma conta Gmail ativa',
        processed: 0,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[check-billing-emails] Encontradas ${gmailAccounts.length} conta(s) Gmail ativa(s)`);

    // ── 2. Load billing settings + unit identifiers for UC matching ──
    const tenantIds = [...new Set(gmailAccounts.map(a => a.tenant_id))];
    const { data: billingSettings } = await admin
      .from('unit_billing_email_settings')
      .select('id, unit_id, tenant_id, email_da_uc, billing_capture_email')
      .in('tenant_id', tenantIds)
      .eq('email_billing_enabled', true);

    const { data: units } = await admin
      .from('units_consumidoras')
      .select('id, tenant_id, codigo_uc, unit_identifier')
      .in('tenant_id', tenantIds)
      .eq('is_archived', false);

    const settingsByTenant = new Map<string, any[]>();
    for (const setting of (billingSettings || [])) {
      const group = settingsByTenant.get(setting.tenant_id) || [];
      group.push(setting);
      settingsByTenant.set(setting.tenant_id, group);
    }

    const unitLookupByTenant = buildUnitLookup(units);

    let totalProcessed = 0;
    let totalErrors = 0;
    let totalSkipped = 0;
    const results: any[] = [];

    for (const gmailAccount of gmailAccounts) {
      const tenantId = gmailAccount.tenant_id;
      const tenantSettings = settingsByTenant.get(tenantId) || [];
      const tenantUnitLookup = unitLookupByTenant.get(tenantId) || new Map<string, string>();

      try {
        const creds = (gmailAccount.credentials ?? {}) as any;
        const setts = (gmailAccount.settings ?? {}) as any;

        let accessToken = creds.access_token;
        const refreshToken = creds.refresh_token;
        const rawExpiry = setts.token_expiry ?? creds.token_expiry;
        const tokenExpiry = rawExpiry ? new Date(rawExpiry).getTime() : 0;

        if (!accessToken) {
          console.log(`[check-billing-emails] No access_token for account ${gmailAccount.id} (${gmailAccount.email})`);
          totalErrors++;
          results.push({ account: gmailAccount.email, error: 'no_access_token' });
          continue;
        }

        // Resolve Google OAuth credentials for token refresh
        let googleClientId = Deno.env.get('GOOGLE_CLIENT_ID') || '';
        let googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET') || '';
        const { data: siteConf } = await admin
          .from('site_settings')
          .select('google_client_id, google_client_secret')
          .eq('tenant_id', tenantId)
          .maybeSingle();
        if (siteConf?.google_client_id && siteConf?.google_client_secret) {
          googleClientId = siteConf.google_client_id;
          googleClientSecret = siteConf.google_client_secret;
        }

        // Refresh token if expired
        if (Date.now() > tokenExpiry - 60000 && refreshToken) {
          console.log(`[check-billing-emails] Refreshing token for ${gmailAccount.email}`);
          const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: googleClientId,
              client_secret: googleClientSecret,
              refresh_token: refreshToken,
              grant_type: 'refresh_token',
            }),
          });

          if (tokenRes.ok) {
            const tokenData = await tokenRes.json();
            accessToken = tokenData.access_token;
            const newExpiry = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();
            await admin
              .from('gmail_accounts')
              .update({
                credentials: { ...creds, access_token: accessToken },
                settings: { ...setts, token_expiry: newExpiry },
                updated_at: new Date().toISOString(),
              })
              .eq('id', gmailAccount.id);
            console.log(`[check-billing-emails] Token refreshed for ${gmailAccount.email}`);
          } else {
            const errBody = await tokenRes.text();
            console.error(`[check-billing-emails] Token refresh failed for ${gmailAccount.email}: ${errBody}`);
            totalErrors++;
            results.push({ account: gmailAccount.email, error: 'token_refresh_failed', details: errBody });
            continue;
          }
        }

        // ── 3. Search messages — use Gmail label if configured, otherwise inbox ──
        const labelFilter = gmailAccount.gmail_label
          ? `label:${gmailAccount.gmail_label}`
          : 'in:inbox';
        const gmailQueryString = isManualVerification
          ? `${labelFilter} has:attachment filename:pdf newer_than:30d`
          : `${labelFilter} is:unread has:attachment filename:pdf newer_than:7d`;
        const pageSize = isManualVerification ? 50 : 30;
        const maxPages = isManualVerification ? 5 : 1;

        const collectedMessages: Array<{ id: string }> = [];
        let nextPageToken: string | null = null;

        for (let page = 0; page < maxPages; page++) {
          if (exceededTimebox()) {
            timedOut = true;
            console.warn(`[check-billing-emails] Manual verification timebox reached while listing messages for ${gmailAccount.email}`);
            break;
          }

          const params = new URLSearchParams({
            q: gmailQueryString,
            maxResults: String(pageSize),
          });
          if (nextPageToken) params.set('pageToken', nextPageToken);

          const listRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
            { headers: { Authorization: `Bearer ${accessToken}` } },
          );

          if (!listRes.ok) {
            const errText = await listRes.text();
            console.error(`[check-billing-emails] Gmail list failed for ${gmailAccount.email}: ${errText}`);
            totalErrors++;
            results.push({ account: gmailAccount.email, error: 'gmail_list_failed', details: errText });
            break;
          }

          const listData = await listRes.json();
          if (Array.isArray(listData.messages)) {
            collectedMessages.push(...listData.messages);
          }

          nextPageToken = listData.nextPageToken || null;
          if (!nextPageToken) break;
        }

        const seenMessageIds = new Set<string>();
        const messages = collectedMessages.filter((message) => {
          if (!message?.id || seenMessageIds.has(message.id)) return false;
          seenMessageIds.add(message.id);
          return true;
        });

        console.log(`[check-billing-emails] ${gmailAccount.email}: ${messages.length} message(s) found (${isManualVerification ? 'manual' : 'auto'})`);

        for (const msg of messages) {
          if (exceededTimebox()) {
            timedOut = true;
            console.warn(`[check-billing-emails] Manual verification timebox reached while processing messages for ${gmailAccount.email}`);
            break;
          }

          try {
            // Check if already processed (by source_message_id)
            const { data: existing } = await admin
              .from('unit_invoices')
              .select('id')
              .eq('source_message_id', msg.id)
              .maybeSingle();

            if (existing) {
              totalSkipped++;
              continue;
            }

            // Also check email_ingestion_messages if table exists
            const { data: existingIngestion } = await admin
              .from('email_ingestion_messages')
              .select('id')
              .eq('gmail_message_id', msg.id)
              .maybeSingle()
              .then(r => r)
              .catch(() => ({ data: null }));

            if (existingIngestion) {
              totalSkipped++;
              continue;
            }

            // Fetch full message
            const msgRes = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );

            if (!msgRes.ok) continue;
            const msgData = await msgRes.json();

            const fromHeader = msgData.payload?.headers?.find(
              (h: any) => h.name.toLowerCase() === 'from'
            )?.value || '';

            const subject = msgData.payload?.headers?.find(
              (h: any) => h.name.toLowerCase() === 'subject'
            )?.value || '';

            const toHeader = msgData.payload?.headers?.find(
              (h: any) => h.name.toLowerCase() === 'to' || h.name.toLowerCase() === 'delivered-to'
            )?.value || '';

            // When using a label filter, trust the label — skip sender check
            // When no label, fall back to known sender filtering
            if (!gmailAccount.gmail_label && !isKnownSender(fromHeader)) {
              console.log(`[check-billing-emails] Skipping unknown sender: ${fromHeader.substring(0, 60)}`);
              continue;
            }

            console.log(`[check-billing-emails] Processing: "${subject}" from ${fromHeader.substring(0, 60)}`);

            const bodyText = extractMessageText(msgData.payload);
            const snippet = String(msgData.snippet || '');

            // Find PDF attachment
            const parts = flattenParts(msgData.payload);
            const pdfParts = parts.filter((p: any) =>
              p.mimeType === 'application/pdf' ||
              (p.filename && p.filename.toLowerCase().endsWith('.pdf'))
            );

            if (pdfParts.length === 0) continue;

            for (const pdfPart of pdfParts) {
              if (exceededTimebox()) {
                timedOut = true;
                console.warn(`[check-billing-emails] Manual verification timebox reached while processing attachments for ${gmailAccount.email}`);
                break;
              }

              if (!pdfPart?.body?.attachmentId) continue;

              // Download attachment
              const attRes = await fetch(
                `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}/attachments/${pdfPart.body.attachmentId}`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
              );

              if (!attRes.ok) continue;
              const attData = await attRes.json();

              // Gmail uses URL-safe base64
              const pdfBase64 = attData.data.replace(/-/g, '+').replace(/_/g, '/');

              const searchableText = [
                toHeader,
                subject,
                snippet,
                bodyText,
                pdfPart.filename || '',
              ].filter(Boolean).join(' ');

              const { unitId: matchedUnitId, matchSource } = findMatchedUnitId({
                toHeader,
                searchText: searchableText,
                tenantSettings,
                tenantUnitLookup,
              });

              if (matchSource) {
                console.log(`[check-billing-emails] Matched unit ${matchedUnitId} via ${matchSource}`);
              }

              // Call process-fatura-pdf (works with or without unit_id)
              const processRes = await fetch(`${supabaseUrl}/functions/v1/process-fatura-pdf`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${serviceRoleKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  unit_id: matchedUnitId,
                  pdf_base64: pdfBase64,
                  source: 'email',
                  source_message_id: msg.id,
                  email_address: gmailAccount.email,
                  tenant_id: tenantId,
                  filename: pdfPart.filename || 'fatura.pdf',
                }),
              });

              const processResult = await processRes.json().catch(() => ({ success: false }));

              if (processResult.success) {
                totalProcessed++;
                console.log(`[check-billing-emails] ✓ Processed: ${pdfPart.filename || 'fatura.pdf'} (UC: ${matchedUnitId || 'auto-detect'})`);
              } else {
                console.log(`[check-billing-emails] ✗ Failed: ${pdfPart.filename || 'fatura.pdf'} — ${processResult.error || 'unknown'}`);
                totalErrors++;
              }

              results.push({
                message_id: msg.id,
                account: gmailAccount.email,
                subject,
                filename: pdfPart.filename,
                success: processResult.success,
                unit_id: matchedUnitId,
                auto_detect: !matchedUnitId,
                match_source: matchSource,
                error: processResult.success ? undefined : (processResult.error || 'Erro desconhecido'),
              });
            }

            if (timedOut) {
              break;
            }

            // Mark email as read only in automatic flow
            if (!isManualVerification) {
              await fetch(
                `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}/modify`,
                {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
                }
              );
            }
          } catch (msgErr) {
            console.error(`[check-billing-emails] Message processing error:`, msgErr);
            totalErrors++;
          }
        }

        if (timedOut) {
          console.warn(`[check-billing-emails] Manual verification finished with partial results for ${gmailAccount.email}`);
        }

        // Update ultimo_verificado_at
        await admin
          .from('gmail_accounts')
          .update({ ultimo_verificado_at: new Date().toISOString() })
          .eq('id', gmailAccount.id);

      } catch (accountErr) {
        console.error(`[check-billing-emails] Account ${gmailAccount.email} error:`, accountErr);
        totalErrors++;
      }
    }

    console.log(`[check-billing-emails] Done: ${totalProcessed} processed, ${totalSkipped} skipped, ${totalErrors} errors`);

    return new Response(JSON.stringify({
      success: true,
      processed: totalProcessed,
      skipped: totalSkipped,
      errors: totalErrors,
      timed_out: timedOut,
      results,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error('[check-billing-emails] Error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
