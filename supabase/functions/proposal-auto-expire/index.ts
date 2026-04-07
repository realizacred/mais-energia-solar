/**
 * proposal-auto-expire
 * 
 * Cron job: runs daily at 08:00 UTC.
 * Finds proposals with valido_ate < NOW() and transitions to 'expirada'.
 * Uses proposta_versoes.valido_ate (latest version).
 * 
 * RB-48: Automatic expiry for proposals past their validity date.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const now = new Date().toISOString();

    // Find proposals that should be expired:
    // - Latest version has valido_ate < NOW() and valido_ate IS NOT NULL
    // - Proposal status is one of the actionable statuses
    const { data: expiredVersions, error: queryErr } = await admin
      .from("proposta_versoes")
      .select("proposta_id, valido_ate, proposta:propostas_nativas!inner(id, status, tenant_id, projeto_id)")
      .lt("valido_ate", now)
      .not("valido_ate", "is", null)
      .in("proposta.status", ["enviada", "vista", "gerada"]);

    if (queryErr) {
      console.error("[proposal-auto-expire] Query error:", queryErr);
      return new Response(
        JSON.stringify({ error: queryErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!expiredVersions || expiredVersions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, expired_count: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Deduplicate by proposta_id (a proposal may have multiple versions)
    const uniquePropostas = new Map<string, any>();
    for (const v of expiredVersions) {
      const p = (v as any).proposta;
      if (p && !uniquePropostas.has(p.id)) {
        uniquePropostas.set(p.id, p);
      }
    }

    let expiredCount = 0;

    for (const [propostaId, proposta] of uniquePropostas) {
      try {
        // Update proposal status to 'expirada'
        const { error: updateErr } = await admin
          .from("propostas_nativas")
          .update({ status: "expirada" })
          .eq("id", propostaId);

        if (updateErr) {
          console.error(`[proposal-auto-expire] Error expiring ${propostaId}:`, updateErr);
          continue;
        }

        // Sync version status
        const { data: latestVersao } = await admin
          .from("proposta_versoes")
          .select("id")
          .eq("proposta_id", propostaId)
          .order("versao_numero", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestVersao?.id) {
          await admin
            .from("proposta_versoes")
            .update({ status: "expired" })
            .eq("id", latestVersao.id);
        }

        // Log event
        await admin.from("proposal_events").insert({
          proposta_id: propostaId,
          tipo: "proposta_expirada",
          payload: {
            previous_status: proposta.status,
            new_status: "expirada",
            source: "auto_expire_cron",
          },
          tenant_id: proposta.tenant_id,
        });

        expiredCount++;
      } catch (err) {
        console.error(`[proposal-auto-expire] Error processing ${propostaId}:`, err);
      }
    }

    return new Response(
      JSON.stringify({ success: true, expired_count: expiredCount, checked: uniquePropostas.size }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[proposal-auto-expire] Fatal error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
