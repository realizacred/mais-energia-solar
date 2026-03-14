import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's tenant_id
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!profile?.tenant_id) {
      return new Response(JSON.stringify({ error: "No tenant" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tenantId = profile.tenant_id;

    // Parse request body for variable keys to check
    const body = await req.json().catch(() => ({}));
    const keysToCheck: string[] = body.keys || [];

    // Sample up to 20 recent proposta_versoes snapshots
    const { data: versoes, error: versoesError } = await supabase
      .from("proposta_versoes")
      .select("id, snapshot")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (versoesError) {
      return new Response(JSON.stringify({ error: versoesError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const totalSnapshots = versoes?.length || 0;

    // For each key, check if it appears in any snapshot
    const observedKeys: Record<string, { found: boolean; count: number; sample_value?: string }> = {};

    for (const key of keysToCheck) {
      observedKeys[key] = { found: false, count: 0 };
    }

    if (versoes && versoes.length > 0) {
      for (const versao of versoes) {
        if (!versao.snapshot || typeof versao.snapshot !== "object") continue;
        const snap = versao.snapshot as Record<string, unknown>;

        for (const key of keysToCheck) {
          // key is dotted like "sistema_solar.modulo_fabricante"
          const parts = key.split(".");
          let value: unknown = snap;

          // Try dotted path navigation
          for (const part of parts) {
            if (value && typeof value === "object" && !Array.isArray(value)) {
              value = (value as Record<string, unknown>)[part];
            } else {
              value = undefined;
              break;
            }
          }

          // Also try flat key (underscore-joined)
          if (value === undefined) {
            const flatKey = parts.join("_");
            value = snap[flatKey];
          }

          // Also try legacy key (just the field name without group)
          if (value === undefined && parts.length > 1) {
            value = snap[parts[parts.length - 1]];
          }

          // Check in nested objects like financeiro, tecnico, etc.
          if (value === undefined && parts.length >= 2) {
            const group = parts[0];
            const field = parts.slice(1).join("_");
            const nested = snap[group];
            if (nested && typeof nested === "object" && !Array.isArray(nested)) {
              value = (nested as Record<string, unknown>)[field];
              // Also try original dotted subpath
              if (value === undefined) {
                value = (nested as Record<string, unknown>)[parts.slice(1).join(".")];
              }
            }
          }

          if (value !== undefined && value !== null && value !== "") {
            const entry = observedKeys[key];
            entry.count++;
            if (!entry.found) {
              entry.found = true;
              entry.sample_value = typeof value === "object" ? JSON.stringify(value).slice(0, 100) : String(value).slice(0, 100);
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        tenant_id: tenantId,
        total_snapshots_sampled: totalSnapshots,
        observed_keys: observedKeys,
        generated_at: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
