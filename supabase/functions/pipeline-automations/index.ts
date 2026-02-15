import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startMs = Date.now();
  console.log("[pipeline-automations] Starting automation check...");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch all active automations with tipo_gatilho = 'tempo_parado'
    const { data: automations, error: autoErr } = await supabase
      .from("pipeline_automations")
      .select("id, tenant_id, stage_id, tempo_horas, tipo_acao, destino_stage_id, notificar_responsavel, pipeline_id")
      .eq("ativo", true)
      .eq("tipo_gatilho", "tempo_parado");

    if (autoErr) throw autoErr;
    if (!automations || automations.length === 0) {
      console.log("[pipeline-automations] No active automations found.");
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[pipeline-automations] Found ${automations.length} active automations`);

    let totalProcessed = 0;
    let totalMoved = 0;
    let totalErrors = 0;

    for (const auto of automations) {
      const cutoffDate = new Date(Date.now() - auto.tempo_horas * 60 * 60 * 1000).toISOString();

      // Find deals in the trigger stage that haven't moved since the cutoff
      const { data: stalledDeals, error: dealsErr } = await supabase
        .from("deal_kanban_projection")
        .select("deal_id, customer_name, owner_id, last_stage_change")
        .eq("stage_id", auto.stage_id)
        .eq("tenant_id", auto.tenant_id)
        .lt("last_stage_change", cutoffDate)
        .limit(50);

      if (dealsErr) {
        console.error(`[pipeline-automations] Error fetching deals for auto ${auto.id}:`, dealsErr.message);
        totalErrors++;
        continue;
      }

      if (!stalledDeals || stalledDeals.length === 0) continue;

      console.log(`[pipeline-automations] Auto ${auto.id}: ${stalledDeals.length} stalled deals found`);

      for (const deal of stalledDeals) {
        try {
          // Check if this deal was already processed by this automation recently (24h dedup)
          const { count: recentLogCount } = await supabase
            .from("pipeline_automation_logs")
            .select("id", { count: "exact", head: true })
            .eq("automation_id", auto.id)
            .eq("deal_id", deal.deal_id)
            .eq("status", "sucesso")
            .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

          if ((recentLogCount ?? 0) > 0) continue; // Already processed recently

          if (auto.tipo_acao === "mover_etapa" && auto.destino_stage_id) {
            // Use the move_deal_to_stage RPC for atomic move
            const { error: moveErr } = await supabase.rpc("move_deal_to_stage", {
              _deal_id: deal.deal_id,
              _to_stage_id: auto.destino_stage_id,
            });

            if (moveErr) {
              console.error(`[pipeline-automations] Error moving deal ${deal.deal_id}:`, moveErr.message);
              await supabase.from("pipeline_automation_logs").insert({
                tenant_id: auto.tenant_id,
                automation_id: auto.id,
                deal_id: deal.deal_id,
                acao_executada: "mover_etapa",
                status: "erro",
                erro_mensagem: moveErr.message,
                detalhes: { from_stage: auto.stage_id, to_stage: auto.destino_stage_id },
              });
              totalErrors++;
              continue;
            }

            totalMoved++;
          }

          // Log success
          await supabase.from("pipeline_automation_logs").insert({
            tenant_id: auto.tenant_id,
            automation_id: auto.id,
            deal_id: deal.deal_id,
            acao_executada: auto.tipo_acao,
            status: "sucesso",
            detalhes: {
              customer_name: deal.customer_name,
              from_stage: auto.stage_id,
              to_stage: auto.destino_stage_id,
              stalled_since: deal.last_stage_change,
            },
          });

          totalProcessed++;

          // Update automation execution counter
          await supabase
            .from("pipeline_automations")
            .update({
              execucoes_total: auto.execucoes_total + totalProcessed,
              ultima_execucao: new Date().toISOString(),
            } as any)
            .eq("id", auto.id);

        } catch (err) {
          console.error(`[pipeline-automations] Error processing deal ${deal.deal_id}:`, err);
          totalErrors++;
        }
      }
    }

    const elapsed = Date.now() - startMs;
    console.log(
      `[pipeline-automations] Done in ${elapsed}ms. Processed: ${totalProcessed}, Moved: ${totalMoved}, Errors: ${totalErrors}`
    );

    return new Response(
      JSON.stringify({ processed: totalProcessed, moved: totalMoved, errors: totalErrors, elapsed_ms: elapsed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[pipeline-automations] Fatal error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
