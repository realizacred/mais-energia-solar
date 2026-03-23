// ──────────────────────────────────────────────────────────────────────────────
// check-billing-emails — Cron: check Gmail for new energy bill PDFs
// Schedule: every hour via pg_cron
// ──────────────────────────────────────────────────────────────────────────────
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID')!;
  const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!;

  // Validate cron secret or service_role
  const authHeader = req.headers.get('Authorization');
  const cronSecret = Deno.env.get('CRON_SECRET');
  const isCron = cronSecret && req.headers.get('x-cron-secret') === cronSecret;
  const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;

  if (!isCron && !isServiceRole) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  try {
    // ── 1. Fetch active billing email settings with Gmail tokens ──
    const { data: settings, error: settingsErr } = await admin
      .from('unit_billing_email_settings')
      .select(`
        id, unit_id, tenant_id, email_da_uc, billing_capture_email,
        forward_to_email, pdf_password
      `)
      .eq('email_billing_enabled', true);

    if (settingsErr || !settings?.length) {
      console.log('[check-billing-emails] Nenhuma configuração ativa — pulando. Configure Gmail OAuth em /admin/faturas-energia');
      return new Response(JSON.stringify({
        success: true,
        message: 'Nenhuma configuração de e-mail ativa',
        processed: 0,
        hint: 'Configure o Gmail OAuth em /admin/faturas-energia e ative a captura por e-mail nas UCs',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── 2. Group settings by tenant to process Gmail per tenant ──
    const tenantGroups = new Map<string, typeof settings>();
    for (const s of settings) {
      const group = tenantGroups.get(s.tenant_id) || [];
      group.push(s);
      tenantGroups.set(s.tenant_id, group);
    }

    let totalProcessed = 0;
    let totalErrors = 0;
    const results: any[] = [];

    for (const [tenantId, tenantSettings] of tenantGroups) {
      try {
        // Fetch Gmail token for this tenant from integrations_api_configs
        const { data: gmailConfig } = await admin
          .from('integrations_api_configs')
          .select('id, credentials, settings, config')
          .eq('tenant_id', tenantId)
          .eq('provider', 'gmail')
          .eq('is_active', true)
          .maybeSingle();

        if (!gmailConfig) {
          console.log(`[check-billing-emails] No Gmail config for tenant ${tenantId}`);
          continue;
        }

        // Fallback chain: credentials/settings (gmail-oauth) → config (legacy) → top-level
        const creds = (gmailConfig.credentials ?? gmailConfig.config ?? {}) as any;
        const setts = (gmailConfig.settings ?? gmailConfig.config ?? {}) as any;

        let accessToken = creds.access_token;
        const refreshToken = creds.refresh_token;
        const rawExpiry = setts.token_expiry ?? creds.token_expiry;
        const tokenExpiry = rawExpiry ? new Date(rawExpiry).getTime() : 0;

        if (!accessToken) {
          console.log(`[check-billing-emails] No access_token for tenant ${tenantId}`);
          continue;
        }

        // Refresh token if expired
        if (Date.now() > tokenExpiry - 60000 && refreshToken) {
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

            // Update stored token in both credentials and settings for consistency
            const newExpiry = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();
            await admin
              .from('integrations_api_configs')
              .update({
                credentials: { ...creds, access_token: accessToken },
                settings: { ...setts, token_expiry: newExpiry },
                updated_at: new Date().toISOString(),
              })
              .eq('id', gmailConfig.id);
          } else {
            console.error(`[check-billing-emails] Token refresh failed for tenant ${tenantId}`);
            totalErrors++;
            continue;
          }
        }

        // ── 3. Search unread messages with PDF attachments ──
        const searchQuery = encodeURIComponent('is:unread has:attachment filename:pdf newer_than:2d');
        const listRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${searchQuery}&maxResults=20`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!listRes.ok) {
          const errText = await listRes.text();
          console.error(`[check-billing-emails] Gmail list failed for tenant ${tenantId}:`, errText);
          totalErrors++;
          continue;
        }

        const listData = await listRes.json();
        const messages = listData.messages || [];

        for (const msg of messages) {
          try {
            // Check if already processed
            const { data: existing } = await admin
              .from('unit_invoices')
              .select('id')
              .eq('source_message_id', msg.id)
              .eq('tenant_id', tenantId)
              .maybeSingle();

            if (existing) continue; // Already processed

            // Fetch full message
            const msgRes = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );

            if (!msgRes.ok) continue;
            const msgData = await msgRes.json();

            // Check sender
            const fromHeader = msgData.payload?.headers?.find(
              (h: any) => h.name.toLowerCase() === 'from'
            )?.value || '';

            if (!isKnownSender(fromHeader)) continue;

            // Find PDF attachment
            const parts = flattenParts(msgData.payload);
            const pdfPart = parts.find((p: any) =>
              p.mimeType === 'application/pdf' ||
              (p.filename && p.filename.toLowerCase().endsWith('.pdf'))
            );

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

            // Determine which UC this email belongs to
            const toHeader = msgData.payload?.headers?.find(
              (h: any) => h.name.toLowerCase() === 'to' || h.name.toLowerCase() === 'delivered-to'
            )?.value || '';

            let matchedSetting = null;
            for (const s of tenantSettings) {
              const emailUc = s.email_da_uc || s.billing_capture_email || '';
              if (emailUc && toHeader.toLowerCase().includes(emailUc.toLowerCase())) {
                matchedSetting = s;
                break;
              }
            }

            // Call process-fatura-pdf
            const processRes = await fetch(`${supabaseUrl}/functions/v1/process-fatura-pdf`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                unit_id: matchedSetting?.unit_id || null,
                pdf_base64: pdfBase64,
                source: 'email',
                source_message_id: msg.id,
                email_address: toHeader,
                tenant_id: tenantId,
              }),
            });

            const processResult = await processRes.json();

            if (processResult.success) {
              totalProcessed++;

              // Mark email as read
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

            results.push({
              message_id: msg.id,
              tenant_id: tenantId,
              success: processResult.success,
              unit_found: processResult.data?.uc_found,
            });
          } catch (msgErr) {
            console.error(`[check-billing-emails] Message processing error:`, msgErr);
            totalErrors++;
          }
        }
      } catch (tenantErr) {
        console.error(`[check-billing-emails] Tenant ${tenantId} error:`, tenantErr);
        totalErrors++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed: totalProcessed,
      errors: totalErrors,
      results,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error("[check-billing-emails] Error:", err);
    return new Response(JSON.stringify({ error: err.message || 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

// Recursively flatten MIME parts
function flattenParts(part: any): any[] {
  const result: any[] = [];
  if (part.parts) {
    for (const p of part.parts) {
      result.push(...flattenParts(p));
    }
  }
  if (part.filename || part.mimeType === 'application/pdf') {
    result.push(part);
  }
  return result;
}
