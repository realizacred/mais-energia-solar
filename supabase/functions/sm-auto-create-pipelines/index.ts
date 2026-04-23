/**
 * sm-auto-create-pipelines — DEPRECATED (410 Gone)
 *
 * Esta função foi neutralizada porque criava pipelines em massa varrendo
 * sm_funis_raw, gerando pipelines indesejados (ex: "Compensação", "Verificar
 * Dados"). Substituída por `sm-criar-pipeline-auto`, acionada pelo usuário
 * via UI (Step 2 da migração SolarMarket).
 *
 * Mantida intencionalmente como barreira: qualquer chamada antiga retorna 410.
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.error("[sm-auto-create-pipelines] Chamada bloqueada — function depreciada.");

  return new Response(
    JSON.stringify({
      error: "deprecated",
      message:
        "Esta função foi descontinuada. Use 'sm-criar-pipeline-auto' via UI (Step 2 da migração SolarMarket) para criar pipelines individualmente.",
      replacement: "sm-criar-pipeline-auto",
    }),
    {
      status: 410,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
