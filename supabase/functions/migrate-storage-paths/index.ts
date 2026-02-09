import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface MigrationItem {
  bucket: string;
  old_path: string;
  new_path: string;
  tabela: string;
  registro_id: string;
  campo: string;
  tenant_id: string;
  is_full_url: boolean;
}

/**
 * Extract storage path from a full Supabase URL.
 * e.g. https://xxx.supabase.co/storage/v1/object/public/brand-assets/logo/123.png
 *   → { bucket: "brand-assets", path: "logo/123.png" }
 */
function parseStorageUrl(url: string): { bucket: string; path: string } | null {
  const match = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
  if (match) return { bucket: match[1], path: match[2] };
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { action } = await req.json();
    const TENANT_ID = "00000000-0000-0000-0000-000000000001";

    // Auth: require admin for execute action
    if (action === "execute") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await admin.auth.getUser(token);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
      if (!roles?.some((r) => ["admin", "gerente", "super_admin"].includes(r.role))) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (action === "plan") {
      // ── PHASE A: List all files that need migration ──
      const items: MigrationItem[] = [];

      // 1. orcamentos.arquivos_urls (bucket: contas-luz)
      const { data: orcs } = await admin
        .from("orcamentos")
        .select("id, tenant_id, arquivos_urls")
        .not("arquivos_urls", "is", null);

      for (const orc of orcs || []) {
        for (const path of orc.arquivos_urls || []) {
          // Skip if already tenant-scoped
          if (path.startsWith(TENANT_ID)) continue;
          if (path.startsWith("http")) continue; // full URLs not expected here
          items.push({
            bucket: "contas-luz",
            old_path: path,
            new_path: `${orc.tenant_id || TENANT_ID}/${path}`,
            tabela: "orcamentos",
            registro_id: orc.id,
            campo: "arquivos_urls",
            tenant_id: orc.tenant_id || TENANT_ID,
            is_full_url: false,
          });
        }
      }

      // 2. brand_settings URLs (bucket: brand-assets, public)
      const { data: brands } = await admin
        .from("brand_settings")
        .select("id, tenant_id, logo_url, logo_white_url, logo_small_url, favicon_url, login_image_url");

      for (const bs of brands || []) {
        const fields = ["logo_url", "logo_white_url", "logo_small_url", "favicon_url", "login_image_url"] as const;
        for (const field of fields) {
          const val = bs[field];
          if (!val) continue;
          if (typeof val !== "string") continue;

          // Check if full URL pointing to brand-assets
          const parsed = parseStorageUrl(val);
          if (parsed && parsed.bucket === "brand-assets") {
            // Skip if already tenant-scoped
            if (parsed.path.startsWith(TENANT_ID)) continue;
            items.push({
              bucket: "brand-assets",
              old_path: parsed.path,
              new_path: `${bs.tenant_id || TENANT_ID}/${parsed.path}`,
              tabela: "brand_settings",
              registro_id: bs.id,
              campo: field,
              tenant_id: bs.tenant_id || TENANT_ID,
              is_full_url: true,
            });
          }
        }
      }

      // 3. obras.imagens_urls (bucket: obras-portfolio, public)
      const { data: obras } = await admin
        .from("obras")
        .select("id, tenant_id, imagens_urls");

      for (const obra of obras || []) {
        for (const url of obra.imagens_urls || []) {
          if (typeof url !== "string") continue;
          const parsed = parseStorageUrl(url);
          if (parsed && parsed.bucket === "obras-portfolio") {
            if (parsed.path.startsWith(TENANT_ID)) continue;
            items.push({
              bucket: "obras-portfolio",
              old_path: parsed.path,
              new_path: `${obra.tenant_id || TENANT_ID}/${parsed.path}`,
              tabela: "obras",
              registro_id: obra.id,
              campo: "imagens_urls",
              tenant_id: obra.tenant_id || TENANT_ID,
              is_full_url: true,
            });
          }
        }
      }

      // Insert all planned items into migration log
      if (items.length > 0) {
        const rows = items.map((i) => ({
          bucket: i.bucket,
          old_path: i.old_path,
          new_path: i.new_path,
          tabela: i.tabela,
          registro_id: i.registro_id,
          campo: i.campo,
          tenant_id: i.tenant_id,
          status: "pending",
        }));
        await admin.from("storage_migration_log").insert(rows);
      }

      return new Response(
        JSON.stringify({ planned: items.length, items }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "execute") {
      // ── PHASE B+C: Copy files and update DB references (batch of 3) ──
      const { data: pending } = await admin
        .from("storage_migration_log")
        .select("*")
        .eq("status", "pending")
        .order("migrated_at", { ascending: true })
        .limit(3);

      if (!pending || pending.length === 0) {
        return new Response(
          JSON.stringify({ message: "No pending items", migrated: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const results: Array<{ id: string; status: string; error?: string }> = [];

      for (const item of pending) {
        try {
          // Step 1: Download the file from old path
          const { data: fileData, error: dlError } = await admin.storage
            .from(item.bucket)
            .download(item.old_path);

          if (dlError || !fileData) {
            // File doesn't exist in storage — mark as orphan
            await admin
              .from("storage_migration_log")
              .update({ status: "orphan", error: dlError?.message || "File not found" })
              .eq("id", item.id);
            results.push({ id: item.id, status: "orphan", error: dlError?.message });
            continue;
          }

          // Step 2: Upload to new path
          const { error: upError } = await admin.storage
            .from(item.bucket)
            .upload(item.new_path, fileData, {
              contentType: fileData.type || "application/octet-stream",
              upsert: false,
            });

          if (upError) {
            // If already exists, that's OK
            if (!upError.message?.includes("already exists") && !upError.message?.includes("Duplicate")) {
              await admin
                .from("storage_migration_log")
                .update({ status: "failed", error: `Upload: ${upError.message}` })
                .eq("id", item.id);
              results.push({ id: item.id, status: "failed", error: upError.message });
              continue;
            }
          }

          // Step 3: Mark as copied
          await admin
            .from("storage_migration_log")
            .update({ status: "copied" })
            .eq("id", item.id);

          // Step 4: Verify new file exists
          const { data: verifyData } = await admin.storage
            .from(item.bucket)
            .download(item.new_path);

          if (!verifyData) {
            await admin
              .from("storage_migration_log")
              .update({ status: "failed", error: "Verification failed: new file not found" })
              .eq("id", item.id);
            results.push({ id: item.id, status: "failed", error: "Verification failed" });
            continue;
          }

          await admin
            .from("storage_migration_log")
            .update({ status: "verified" })
            .eq("id", item.id);

          // Step 5: Update DB reference
          await updateDbReference(admin, item);

          await admin
            .from("storage_migration_log")
            .update({ status: "updated" })
            .eq("id", item.id);

          results.push({ id: item.id, status: "updated" });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await admin
            .from("storage_migration_log")
            .update({ status: "failed", error: msg })
            .eq("id", item.id);
          results.push({ id: item.id, status: "failed", error: msg });
        }
      }

      return new Response(
        JSON.stringify({
          migrated: results.filter((r) => r.status === "updated").length,
          orphaned: results.filter((r) => r.status === "orphan").length,
          failed: results.filter((r) => r.status === "failed").length,
          results,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "status") {
      const { data } = await admin
        .from("storage_migration_log")
        .select("*")
        .order("migrated_at", { ascending: true });

      const summary = {
        total: data?.length || 0,
        pending: data?.filter((d) => d.status === "pending").length || 0,
        copied: data?.filter((d) => d.status === "copied").length || 0,
        verified: data?.filter((d) => d.status === "verified").length || 0,
        updated: data?.filter((d) => d.status === "updated").length || 0,
        failed: data?.filter((d) => d.status === "failed").length || 0,
        orphan: data?.filter((d) => d.status === "orphan").length || 0,
        items: data,
      };

      return new Response(JSON.stringify(summary), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use: plan, execute, or status" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/**
 * Update the DB reference for a migrated file.
 * Handles both single-value fields and array fields.
 */
async function updateDbReference(
  admin: ReturnType<typeof createClient>,
  item: {
    tabela: string | null;
    registro_id: string | null;
    campo: string | null;
    old_path: string;
    new_path: string | null;
    bucket: string;
    tenant_id: string | null;
  }
) {
  if (!item.tabela || !item.registro_id || !item.campo || !item.new_path) return;

  const { data: record } = await admin
    .from(item.tabela)
    .select(item.campo)
    .eq("id", item.registro_id)
    .maybeSingle();

  if (!record) return;

  const currentValue = record[item.campo];

  if (Array.isArray(currentValue)) {
    // For arrays: replace the old path/URL with new path/URL
    const BASE_URL = `${SUPABASE_URL}/storage/v1/object/public/${item.bucket}`;
    const isFullUrl = item.old_path.startsWith("http") || currentValue.some((v: string) => typeof v === "string" && v.startsWith("http"));

    const oldRef = isFullUrl ? `${BASE_URL}/${item.old_path}` : item.old_path;
    const newRef = isFullUrl ? `${BASE_URL}/${item.new_path}` : item.new_path;

    const updatedArray = currentValue.map((v: string) => (v === oldRef ? newRef : v));
    await admin
      .from(item.tabela)
      .update({ [item.campo]: updatedArray })
      .eq("id", item.registro_id);
  } else if (typeof currentValue === "string") {
    // For single values: replace if matches
    const BASE_URL = `${SUPABASE_URL}/storage/v1/object/public/${item.bucket}`;
    const isFullUrl = currentValue.startsWith("http");

    const oldRef = isFullUrl ? `${BASE_URL}/${item.old_path}` : item.old_path;
    const newRef = isFullUrl ? `${BASE_URL}/${item.new_path}` : item.new_path;

    if (currentValue === oldRef) {
      await admin
        .from(item.tabela)
        .update({ [item.campo]: newRef })
        .eq("id", item.registro_id);
    }
  }
}
