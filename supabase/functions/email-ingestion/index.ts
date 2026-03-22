import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getUser();
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabaseUser
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", claimsData.user.id)
      .single();

    if (!profile?.tenant_id) {
      return new Response(JSON.stringify({ error: "Tenant not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tenantId = profile.tenant_id;
    const body = await req.json().catch(() => ({}));
    const action = body.action || "sync";
    const emailAccountId = body.email_account_id;

    if (action !== "sync" || !emailAccountId) {
      return new Response(JSON.stringify({ error: "Missing action or email_account_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify account belongs to tenant
    const { data: account } = await admin
      .from("email_accounts")
      .select("*")
      .eq("id", emailAccountId)
      .eq("tenant_id", tenantId)
      .single();

    if (!account) {
      return new Response(JSON.stringify({ error: "Account not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create ingestion run
    const { data: run } = await admin
      .from("email_ingestion_runs")
      .insert({
        tenant_id: tenantId,
        email_account_id: emailAccountId,
        status: "running",
      })
      .select()
      .single();

    if (!run) {
      return new Response(JSON.stringify({ error: "Failed to create run" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For Gmail accounts, use existing gmail-oauth tokens
    // For IMAP accounts, connect directly
    // This is a placeholder — actual email reading requires provider-specific implementation
    let processed = 0;
    let imported = 0;
    let duplicates = 0;
    let errors = 0;

    try {
      if (account.provider_type === "gmail") {
        // Get Gmail tokens from integrations_api_configs
        const { data: gmailConfig } = await admin
          .from("integrations_api_configs")
          .select("credentials, settings")
          .eq("tenant_id", tenantId)
          .eq("provider", "gmail")
          .eq("is_active", true)
          .maybeSingle();

        if (!gmailConfig?.credentials?.access_token) {
          throw new Error("Gmail não conectado. Conecte via OAuth primeiro.");
        }

        // Fetch ingestion rules for this account
        const { data: rules = [] } = await admin
          .from("email_ingestion_rules")
          .select("*")
          .eq("email_account_id", emailAccountId)
          .eq("is_active", true);

        // Build Gmail query from rules
        let gmailQuery = "has:attachment filename:pdf";
        if (rules.length > 0) {
          const senderFilters = rules
            .filter((r: any) => r.sender_contains)
            .map((r: any) => `from:${r.sender_contains}`);
          if (senderFilters.length > 0) {
            gmailQuery += ` {${senderFilters.join(" ")}}`;
          }
        }

        // Only fetch recent unread messages
        gmailQuery += " newer_than:7d is:unread";

        const token = gmailConfig.credentials.access_token;

        // List messages
        const listResp = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(gmailQuery)}&maxResults=20`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!listResp.ok) {
          const errBody = await listResp.text();
          // If token expired, try refresh
          if (listResp.status === 401 && gmailConfig.credentials.refresh_token) {
            // Token refresh would happen here — for now mark error
            throw new Error(`Gmail token expirado. Reconecte via OAuth. (${listResp.status})`);
          }
          throw new Error(`Gmail API error: ${listResp.status} - ${errBody}`);
        }

        const listData = await listResp.json();
        const messageIds = (listData.messages || []).map((m: any) => m.id);

        for (const msgId of messageIds) {
          processed++;
          try {
            // Get message details
            const msgResp = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            if (!msgResp.ok) continue;
            const msg = await msgResp.json();

            const headers = msg.payload?.headers || [];
            const from = headers.find((h: any) => h.name === "From")?.value || "";
            const subject = headers.find((h: any) => h.name === "Subject")?.value || "";
            const date = headers.find((h: any) => h.name === "Date")?.value || "";

            // Check for duplicate
            const { data: existing } = await admin
              .from("email_ingestion_messages")
              .select("id")
              .eq("tenant_id", tenantId)
              .eq("external_message_id", msgId)
              .maybeSingle();

            if (existing) {
              duplicates++;
              await admin.from("email_ingestion_messages").insert({
                tenant_id: tenantId,
                run_id: run.id,
                external_message_id: msgId,
                sender: from,
                subject,
                received_at: date ? new Date(date).toISOString() : null,
                result_status: "duplicate",
              });
              continue;
            }

            // Find PDF attachments
            const parts = msg.payload?.parts || [];
            const pdfParts = parts.filter(
              (p: any) => p.filename && p.filename.toLowerCase().endsWith(".pdf") && p.body?.attachmentId
            );

            if (pdfParts.length === 0) {
              await admin.from("email_ingestion_messages").insert({
                tenant_id: tenantId,
                run_id: run.id,
                external_message_id: msgId,
                sender: from,
                subject,
                received_at: date ? new Date(date).toISOString() : null,
                attachment_count: 0,
                result_status: "skipped",
              });
              continue;
            }

            // Download attachments and create import job
            for (const part of pdfParts) {
              const attResp = await fetch(
                `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}/attachments/${part.body.attachmentId}`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              if (!attResp.ok) continue;
              const attData = await attResp.json();
              const base64Data = attData.data?.replace(/-/g, "+").replace(/_/g, "/");

              if (!base64Data) continue;

              // Upload to storage
              const fileName = `email-invoices/${tenantId}/${run.id}/${part.filename}`;
              const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

              await admin.storage
                .from("invoices")
                .upload(fileName, binaryData, { contentType: "application/pdf", upsert: false });

              // Create invoice import job
              const { data: job } = await admin
                .from("invoice_import_jobs")
                .insert({
                  tenant_id: tenantId,
                  source: "email",
                  status: "queued",
                  total_files: 1,
                  processed_files: 0,
                  success_count: 0,
                  duplicate_count: 0,
                  error_count: 0,
                  created_by: claimsData.user.id,
                  summary_json: { email_message_id: msgId, file_name: part.filename },
                })
                .select("id")
                .single();

              await admin.from("email_ingestion_messages").insert({
                tenant_id: tenantId,
                run_id: run.id,
                external_message_id: msgId,
                sender: from,
                subject,
                received_at: date ? new Date(date).toISOString() : null,
                attachment_count: pdfParts.length,
                result_status: "imported",
                invoice_import_job_id: job?.id || null,
              });

              imported++;
            }
          } catch (msgErr) {
            errors++;
            console.error(`Error processing message ${msgId}:`, msgErr);
            await admin.from("email_ingestion_messages").insert({
              tenant_id: tenantId,
              run_id: run.id,
              external_message_id: msgId,
              result_status: "failed",
              error_message: msgErr instanceof Error ? msgErr.message : String(msgErr),
            });
          }
        }
      } else {
        // IMAP requires TCP sockets — not available in Supabase Edge Functions
        throw new Error(
          "IMAP não é suportado nas Edge Functions (limitação TCP). " +
          "Use Gmail OAuth ou configure o encaminhamento automático para uma conta Gmail conectada."
        );
      }

      // Update run as completed
      await admin
        .from("email_ingestion_runs")
        .update({
          status: "completed",
          processed_count: processed,
          imported_count: imported,
          duplicate_count: duplicates,
          error_count: errors,
          finished_at: new Date().toISOString(),
        })
        .eq("id", run.id);

      // Update account last_sync
      await admin
        .from("email_accounts")
        .update({ last_sync_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() })
        .eq("id", emailAccountId);

    } catch (syncErr) {
      console.error("Sync error:", syncErr);
      const errMsg = syncErr instanceof Error ? syncErr.message : String(syncErr);

      await admin
        .from("email_ingestion_runs")
        .update({
          status: "failed",
          processed_count: processed,
          imported_count: imported,
          duplicate_count: duplicates,
          error_count: errors + 1,
          finished_at: new Date().toISOString(),
        })
        .eq("id", run.id);

      await admin
        .from("email_accounts")
        .update({ last_error: errMsg, updated_at: new Date().toISOString() })
        .eq("id", emailAccountId);

      return new Response(JSON.stringify({ success: false, error: errMsg, run_id: run.id }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      run_id: run.id,
      processed,
      imported,
      duplicates,
      errors,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("email-ingestion error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
