import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const [backlog, locks, health] = await Promise.all([
      supabase.from("wa_webhook_events").select("id", { count: "exact", head: true }).eq("processed", false),
      supabase.from("wa_webhook_processing_locks").select("*"),
      supabase.from("wa_instances").select("id, status").eq("ativo", true)
    ]);

    const stats = {
      backlog_size: backlog.count || 0,
      active_locks: locks.data?.length || 0,
      instances_health: health.data || [],
      timestamp: new Date().toISOString(),
      status: (backlog.count || 0) > 100 ? "degraded" : "healthy"
    };

    return new Response(JSON.stringify(stats), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
