import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check current count
    const { count } = await supabase
      .from("municipios_ibge")
      .select("*", { count: "exact", head: true });

    if ((count || 0) > 5000) {
      return new Response(
        JSON.stringify({ success: true, message: `Already seeded: ${count} municipalities`, skipped: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch from IBGE API
    console.log("[ibge-seed] Fetching from IBGE API...");
    const res = await fetch(
      "https://servicodados.ibge.gov.br/api/v1/localidades/municipios?view=nivelado",
      { headers: { "Accept": "application/json" } }
    );

    if (!res.ok) {
      throw new Error(`IBGE API returned ${res.status}`);
    }

    const data = await res.json();
    console.log(`[ibge-seed] Got ${data.length} municipalities from IBGE`);

    const ufToRegiao: Record<string, string> = {
      AC: "Norte", AP: "Norte", AM: "Norte", PA: "Norte", RO: "Norte", RR: "Norte", TO: "Norte",
      AL: "Nordeste", BA: "Nordeste", CE: "Nordeste", MA: "Nordeste", PB: "Nordeste",
      PE: "Nordeste", PI: "Nordeste", RN: "Nordeste", SE: "Nordeste",
      DF: "Centro-Oeste", GO: "Centro-Oeste", MT: "Centro-Oeste", MS: "Centro-Oeste",
      ES: "Sudeste", MG: "Sudeste", RJ: "Sudeste", SP: "Sudeste",
      PR: "Sul", RS: "Sul", SC: "Sul",
    };

    function normalize(name: string): string {
      return name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
    }

    const rows = data.map((m: any) => ({
      codigo_ibge: String(m["municipio-id"]),
      nome: m["municipio-nome"],
      nome_normalizado: normalize(m["municipio-nome"]),
      uf_sigla: m["UF-sigla"],
      uf_codigo: String(m["UF-id"]),
      regiao: ufToRegiao[m["UF-sigla"]] || "",
      ativo: true,
    }));

    // Upsert in batches of 500
    const batchSize = 500;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { error } = await supabase
        .from("municipios_ibge")
        .upsert(batch, { onConflict: "codigo_ibge", ignoreDuplicates: false });

      if (error) {
        console.error(`[ibge-seed] Batch ${i / batchSize} error:`, error);
        throw error;
      }
      inserted += batch.length;
      console.log(`[ibge-seed] Batch ${Math.floor(i / batchSize) + 1}: ${inserted}/${rows.length}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        total: inserted,
        message: `${inserted} municípios IBGE importados com sucesso`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[ibge-seed] Error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e.message, code: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
