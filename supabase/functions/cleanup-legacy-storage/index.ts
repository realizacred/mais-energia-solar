import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { action } = await req.json(); // "dry-run" or "delete"

    // Load migration log — only items that were successfully updated
    const { data: items, error: logErr } = await admin
      .from("storage_migration_log")
      .select("*")
      .eq("status", "updated");

    if (logErr || !items || items.length === 0) {
      return new Response(
        JSON.stringify({ message: "No migrated items found", items: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: Array<{
      bucket: string;
      old_path: string;
      new_path: string;
      old_exists: boolean;
      new_exists: boolean;
      size_match: boolean | null;
      old_size: number | null;
      new_size: number | null;
      safe_to_delete: boolean;
      action_taken: string;
    }> = [];

    for (const item of items) {
      const entry: (typeof results)[0] = {
        bucket: item.bucket,
        old_path: item.old_path,
        new_path: item.new_path || "",
        old_exists: false,
        new_exists: false,
        size_match: null,
        old_size: null,
        new_size: null,
        safe_to_delete: false,
        action_taken: "skipped",
      };

      // Check old file exists
      const { data: oldFile, error: oldErr } = await admin.storage
        .from(item.bucket)
        .download(item.old_path);

      if (oldErr || !oldFile) {
        entry.action_taken = "old_not_found";
        results.push(entry);
        continue;
      }

      entry.old_exists = true;
      entry.old_size = oldFile.size;

      // Check new file exists
      if (!item.new_path) {
        entry.action_taken = "no_new_path";
        results.push(entry);
        continue;
      }

      const { data: newFile, error: newErr } = await admin.storage
        .from(item.bucket)
        .download(item.new_path);

      if (newErr || !newFile) {
        entry.action_taken = "new_not_found";
        results.push(entry);
        continue;
      }

      entry.new_exists = true;
      entry.new_size = newFile.size;
      entry.size_match = oldFile.size === newFile.size;
      entry.safe_to_delete = entry.size_match === true;

      if (action === "delete" && entry.safe_to_delete) {
        const { error: delErr } = await admin.storage
          .from(item.bucket)
          .remove([item.old_path]);

        if (delErr) {
          entry.action_taken = `delete_failed: ${delErr.message}`;
        } else {
          entry.action_taken = "deleted";
          // Update migration log status
          await admin
            .from("storage_migration_log")
            .update({ status: "cleaned" })
            .eq("id", item.id);
        }
      } else {
        entry.action_taken = action === "delete" && !entry.safe_to_delete
          ? "unsafe_skipped"
          : "dry_run_ok";
      }

      results.push(entry);
    }

    const summary = {
      total: results.length,
      old_found: results.filter((r) => r.old_exists).length,
      old_not_found: results.filter((r) => !r.old_exists).length,
      new_verified: results.filter((r) => r.new_exists).length,
      size_matched: results.filter((r) => r.size_match === true).length,
      safe_to_delete: results.filter((r) => r.safe_to_delete).length,
      deleted: results.filter((r) => r.action_taken === "deleted").length,
      skipped: results.filter((r) => r.action_taken !== "deleted" && r.action_taken !== "dry_run_ok").length,
      action,
      results,
    };

    return new Response(JSON.stringify(summary, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
