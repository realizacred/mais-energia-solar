import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Tables to backup per tenant — ordered by dependency (children first)
const BACKUP_TABLES = [
  "checklist_cliente_arquivos",
  "checklist_cliente_respostas",
  "checklists_cliente",
  "checklist_instalador_arquivos",
  "checklist_instalador_respostas",
  "checklists_instalador",
  "checklists_instalacao",
  "checklist_template_items",
  "checklist_templates",
  "wa_outbox",
  "wa_webhook_events",
  "wa_messages",
  "wa_conversations",
  "wa_followup_queue",
  "comissoes",
  "parcelas",
  "appointments",
  "calendar_sync_queue",
  "simulacoes",
  "orcamentos",
  "projetos",
  "clientes",
  "leads",
  "consultores",
  "concessionaria_tarifas_subgrupo",
  "concessionaria_aneel_aliases",
  "concessionarias",
  "calculadora_config",
  "brand_settings",
  "audit_logs",
];

const BATCH_SIZE = 500;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const userId = claimsData.claims.sub as string;

    // Check admin role
    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    if (!isAdmin) {
      return jsonResponse({ error: "Forbidden: admin only" }, 403);
    }

    // Get tenant_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", userId)
      .single();

    if (!profile?.tenant_id) {
      return jsonResponse({ error: "Tenant not found" }, 404);
    }

    const tenantId = profile.tenant_id;

    // Check tenant is active
    const { data: tenant } = await supabase
      .from("tenants")
      .select("status")
      .eq("id", tenantId)
      .single();

    if (tenant?.status !== "active") {
      return jsonResponse({ error: "Tenant is not active" }, 403);
    }

    const body = await req.json();
    const { action } = body;

    // ── Action: list ──
    if (action === "list") {
      const { data: logs, error } = await supabase
        .from("backup_logs")
        .select("id, status, backup_type, file_size_bytes, tables_included, tables_row_counts, error_message, started_at, completed_at, created_at, created_by")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return jsonResponse({ logs: logs || [] });
    }

    // ── Action: create ──
    if (action === "create") {
      // Check for recent running backup (prevent spam)
      const { data: running } = await supabase
        .from("backup_logs")
        .select("id")
        .eq("tenant_id", tenantId)
        .in("status", ["pending", "running"])
        .limit(1);

      if (running && running.length > 0) {
        return jsonResponse({ error: "Um backup já está em andamento" }, 409);
      }

      // Create log entry
      const { data: log, error: logError } = await supabase
        .from("backup_logs")
        .insert({
          tenant_id: tenantId,
          created_by: userId,
          status: "running",
          backup_type: "full",
          tables_included: BACKUP_TABLES,
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (logError) throw logError;
      const backupId = log.id;

      try {
        // Export each table with batching
        const backupData: Record<string, unknown[]> = {};
        const rowCounts: Record<string, number> = {};

        for (const table of BACKUP_TABLES) {
          const allRows: unknown[] = [];
          let offset = 0;
          let hasMore = true;

          while (hasMore) {
            const { data: rows, error: queryError } = await supabase
              .from(table)
              .select("*")
              .eq("tenant_id", tenantId)
              .range(offset, offset + BATCH_SIZE - 1);

            if (queryError) {
              console.warn(`[tenant-backup] Error reading ${table}: ${queryError.message}`);
              break;
            }

            if (rows && rows.length > 0) {
              allRows.push(...rows);
              offset += rows.length;
              hasMore = rows.length === BATCH_SIZE;
            } else {
              hasMore = false;
            }
          }

          backupData[table] = allRows;
          rowCounts[table] = allRows.length;
        }

        // Create backup JSON
        const backupPayload = {
          system: "Mais Energia Solar",
          backup_type: "tenant_database",
          version: "1.0",
          generated_at: new Date().toISOString(),
          tenant_id: tenantId,
          created_by: userId,
          tables: backupData,
          row_counts: rowCounts,
        };

        const jsonString = JSON.stringify(backupPayload, null, 2);
        const encoder = new TextEncoder();
        const bytes = encoder.encode(jsonString);

        // Upload to storage
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const filePath = `${tenantId}/backup-${timestamp}.json`;

        const { error: uploadError } = await supabase.storage
          .from("tenant-backups")
          .upload(filePath, bytes, {
            contentType: "application/json",
            upsert: false,
          });

        if (uploadError) throw uploadError;

        // Update log entry
        await supabase
          .from("backup_logs")
          .update({
            status: "completed",
            file_path: filePath,
            file_size_bytes: bytes.length,
            tables_row_counts: rowCounts,
            completed_at: new Date().toISOString(),
          })
          .eq("id", backupId);

        return jsonResponse({
          success: true,
          backup_id: backupId,
          file_path: filePath,
          file_size_bytes: bytes.length,
          row_counts: rowCounts,
        });
      } catch (err) {
        // Mark as failed
        await supabase
          .from("backup_logs")
          .update({
            status: "failed",
            error_message: err instanceof Error ? err.message : "Unknown error",
            completed_at: new Date().toISOString(),
          })
          .eq("id", backupId);

        throw err;
      }
    }

    // ── Action: download ──
    if (action === "download") {
      const { backup_id } = body;
      if (!backup_id) return jsonResponse({ error: "backup_id required" }, 400);

      const { data: log } = await supabase
        .from("backup_logs")
        .select("file_path, tenant_id, status")
        .eq("id", backup_id)
        .eq("tenant_id", tenantId)
        .single();

      if (!log || !log.file_path) {
        return jsonResponse({ error: "Backup not found" }, 404);
      }

      if (log.status !== "completed") {
        return jsonResponse({ error: "Backup not completed" }, 400);
      }

      const { data: signedUrl } = await supabase.storage
        .from("tenant-backups")
        .createSignedUrl(log.file_path, 300); // 5 minutes

      if (!signedUrl?.signedUrl) {
        return jsonResponse({ error: "Could not generate download URL" }, 500);
      }

      return jsonResponse({ url: signedUrl.signedUrl });
    }

    // ── Action: delete ──
    if (action === "delete") {
      const { backup_id } = body;
      if (!backup_id) return jsonResponse({ error: "backup_id required" }, 400);

      const { data: log } = await supabase
        .from("backup_logs")
        .select("file_path, tenant_id")
        .eq("id", backup_id)
        .eq("tenant_id", tenantId)
        .single();

      if (!log) return jsonResponse({ error: "Backup not found" }, 404);

      // Delete file from storage
      if (log.file_path) {
        await supabase.storage.from("tenant-backups").remove([log.file_path]);
      }

      // Delete log entry
      await supabase.from("backup_logs").delete().eq("id", backup_id);

      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    console.error("[tenant-backup] Error:", err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Internal server error" },
      500,
    );
  }
});
