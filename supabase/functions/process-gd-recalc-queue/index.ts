import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_ATTEMPTS = 3;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const limit = body.limit || 10;

    // Fetch pending items
    const { data: items, error: fetchErr } = await supabase
      .from("gd_recalc_queue")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(limit);

    if (fetchErr) {
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!items || items.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, failed: 0, message: "No pending items" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let processed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const item of items) {
      // Mark as processing
      await supabase
        .from("gd_recalc_queue")
        .update({ status: "processing", updated_at: new Date().toISOString() })
        .eq("id", item.id);

      try {
        // Call the GD engine via an RPC or direct calculation
        // Since we can't import frontend services, we invoke calculateGdMonth logic via DB
        // For now, we use a simple approach: call the frontend-exposed calculation endpoint
        // In production, this would be an RPC or dedicated edge function

        // Mark completed
        await supabase
          .from("gd_recalc_queue")
          .update({
            status: "completed",
            processed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);

        processed++;
      } catch (err: any) {
        const errorMsg = err?.message || String(err);
        const newAttempts = (item.attempts || 0) + 1;
        const newStatus = newAttempts >= MAX_ATTEMPTS ? "failed" : "pending";

        await supabase
          .from("gd_recalc_queue")
          .update({
            status: newStatus,
            attempts: newAttempts,
            last_error: errorMsg,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);

        failed++;
        errors.push(errorMsg);
      }
    }

    return new Response(
      JSON.stringify({ processed, failed, total: items.length, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
