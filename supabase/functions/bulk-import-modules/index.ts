import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface RawModule {
  fabricante: string;
  modelo: string;
  potencia_wp: number;
  num_celulas: number | null;
  eficiencia_percent: number | null;
  tipo_celula: string;
  bifacial: boolean;
  tensao_sistema: string;
}

function parseNumber(val: string): number | null {
  if (!val || val.trim() === "" || val === "-" || val === "%" || val === "N/A") return null;
  const cleaned = val.replace(",", ".").replace("%", "").trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function parseInt2(val: string): number | null {
  const n = parseNumber(val);
  return n !== null ? Math.round(n) : null;
}

function detectCellType(modelo: string, numCelulas: number | null): string {
  const lower = modelo.toLowerCase();
  if (lower.includes("topcon") || lower.includes("-nt") || lower.includes("n5") || lower.includes("n7") ||
      /ntype|n-type|topbihiku|vertex tsm-ne|vertex tsm-neg|ntype/.test(lower)) return "N-Type TOPCon";
  if (lower.includes("hjt") || lower.includes("heterojunction")) return "N-Type HJT";
  if (lower.includes("hpbc")) return "N-Type HPBC";
  if (lower.includes("poli") || lower.includes("poly") || /\bp\d/.test(lower) || /-p-/i.test(lower) ||
      /p6k|p6c|phk|pik|kupower|kumax.*p|maxpower.*p|splitmax|stave|pipro/i.test(lower) ||
      /-p\d{2,3}/i.test(lower) || /6p-/i.test(lower) || /72p|144p|60p/i.test(lower)) return "Policristalino";
  return "Mono PERC";
}

function detectBifacial(modelo: string): boolean {
  return /bifacial|bi[-\s]?facial|\bbf\b|bdv|bdvp|bmdg|bhdg|bihiku|bipro|bistar|biku|mb-ag|dg[/-]/i.test(modelo);
}

function detectTensao(modelo: string): string {
  if (/1000v/i.test(modelo)) return "1000V";
  return "1500V";
}

// 🔧 FIX: aumentado limite de 900 para 1000W (módulos modernos chegam a 700W+)
const MIN_POTENCIA = 50;
const MAX_POTENCIA = 1000;

function parseModulesFromText(text: string): RawModule[] {
  const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  const modules: RawModule[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    // Skip header lines
    if (/^fabricante\s/i.test(line) || /potência.*células.*eficiência/i.test(line)) continue;
    // Skip empty-ish lines
    if (line.length < 5) continue;

    // Try tab split first
    let parts = line.split("\t");
    if (parts.length < 2) {
      // Try semicolon
      parts = line.split(";");
    }

    if (parts.length >= 3) {
      // Structured format: fabricante;modelo;potencia;celulas;eficiencia...
      const fabricante = parts[0]?.trim() || "";
      const modelo = parts[1]?.trim() || "";
      const potencia = parseInt2(parts[2] || "") || 0;
      const celulas = parts.length > 3 ? parseInt2(parts[3] || "") : null;
      const eficiencia = parts.length > 4 ? parseNumber(parts[4] || "") : null;

      // 🔧 FIX: filtro correto 50-1000W
      if (!fabricante || !modelo || potencia < MIN_POTENCIA || potencia > MAX_POTENCIA) continue;
      if (/^fabricante$/i.test(fabricante)) continue; // header row

      const key = `${fabricante}|${modelo}|${potencia}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      modules.push({
        fabricante,
        modelo,
        potencia_wp: potencia,
        num_celulas: celulas != null && celulas > 0 && celulas < 1000 ? celulas : null,
        eficiencia_percent: eficiencia != null && eficiencia <= 100 ? eficiencia : null,
        tipo_celula: detectCellType(modelo, celulas),
        bifacial: detectBifacial(modelo),
        tensao_sistema: detectTensao(modelo),
      });
    } else {
      // Space-separated heuristic format
      // Pattern: FABRICANTE MODELO POTENCIA CELULAS EFICIENCIA [VISUALIZAR]
      const match = line.match(/^(.+?)\s+(\d{3,4})\s+(\d{1,4})\s+([\d,]+%?)\s*.*$/);
      if (match) {
        const fullName = match[1].trim();
        const potencia = parseInt(match[2]);
        const celulas = parseInt(match[3]);
        const eficiencia = parseNumber(match[4]);

        // 🔧 FIX: filtro correto 50-1000W
        if (potencia < MIN_POTENCIA || potencia > MAX_POTENCIA) continue;

        const knownFabs = [
          "AE SOLAR", "AMSO SOLAR", "BEDIN SOLAR", "BOLD ENERGY", "CANADIAN SOLAR",
          "CONSORT SOLAR", "DAS SOLAR", "DMEGC SOLAR", "ERA SOLAR", "GCL", "GOKIN SOLAR",
          "GREENSUN SOLAR", "HONOR SOLAR", "HT-SAAE", "HUANSHENG SOLAR", "HY SOLAR",
          "JA SOLAR", "JETION SOLAR", "JH SOLAR", "LEAPTON SOLAR", "PHONO SOLAR",
          "PULLING ENERGY", "Q CELLS", "QN-SOLAR", "QUALITY SOLAR", "RENEPV",
          "RESUN SOLAR", "RONMA SOLAR", "RUNDA AURORA", "RUNERGY", "SCHUTTEN SOLAR",
          "SENGI SOLAR", "SHINEFAR SOLAR", "SINE ENERGY", "SKY SOLLARIS",
          "SOLAR N PLUS", "SOLARGIGA ENERGY", "SUNPRO POWER", "TAOISTIC SOLAR",
          "TCL SOLAR", "TONGWEI SOLAR", "TRINA SOLAR", "ULICA SOLAR",
          "YINGLI SOLAR", "BELENERGY", "BEYONDSUN", "ASTRONERGY", "AMERISOLAR",
          "AUSTA", "BALFAR", "BYD", "DAH", "ELGIN", "EMPALUX", "EGING",
          "HANERSUN", "HELIA", "HELIUS", "HERSHEY-POWER", "HULTER", "HUASUN",
          "INIMEX", "INTELBRAS", "JAYU", "JINERGY", "JINKO", "KOMECO", "KOPP",
          "KRIPT", "LEDVANCE", "LONGI", "LUXEN", "MAXEON", "MINASOL", "NEXEN",
          "OSDA", "PEIMAR", "PERLIGHT", "RISEN", "RENESOLA", "RENOVIGI",
          "SERAPHIM", "SHANHONG", "SICES", "SINOSOLA", "SIRIUS", "SPOLARPV",
          "SUNERGY", "SUNKET", "SUNOVA", "SUNTECH", "SUNX", "TALESUN",
          "TOPSOLA", "TOPTEC", "TSUN", "VSUN", "WATTSUP", "WDC", "WEG",
          "XPOWER", "ZNSHINE"
        ];

        let fabricante = "";
        let modelo = "";
        const upper = fullName.toUpperCase();

        for (const fab of knownFabs.sort((a, b) => b.length - a.length)) {
          if (upper.startsWith(fab.toUpperCase())) {
            fabricante = fab;
            modelo = fullName.substring(fab.length).trim();
            break;
          }
        }

        if (!fabricante) {
          const spaceIdx = fullName.indexOf(" ");
          if (spaceIdx > 0) {
            fabricante = fullName.substring(0, spaceIdx);
            modelo = fullName.substring(spaceIdx + 1);
          } else {
            continue;
          }
        }

        if (!modelo) continue;

        const key = `${fabricante}|${modelo}|${potencia}`.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        modules.push({
          fabricante,
          modelo,
          potencia_wp: potencia,
          num_celulas: celulas > 0 && celulas < 1000 ? celulas : null,
          eficiencia_percent: eficiencia != null && eficiencia <= 100 ? eficiencia : null,
          tipo_celula: detectCellType(modelo, celulas),
          bifacial: detectBifacial(modelo),
          tensao_sistema: detectTensao(modelo),
        });
      }
    }
  }

  return modules;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Usuário não encontrado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await userClient
      .from("profiles")
      .select("tenant_id")
      .eq("id", userData.user.id)
      .single();

    if (!profile?.tenant_id) {
      return new Response(JSON.stringify({ error: "Tenant não encontrado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { raw_text } = await req.json();
    if (!raw_text || typeof raw_text !== "string") {
      return new Response(JSON.stringify({ error: "raw_text é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Parsing modules from text (${raw_text.length} chars)...`);
    const modules = parseModulesFromText(raw_text);
    console.log(`Parsed ${modules.length} unique modules`);

    if (modules.length === 0) {
      return new Response(JSON.stringify({ success: true, imported: 0, skipped_duplicates: 0, errors: 0, message: "Nenhum módulo válido encontrado. Verifique o formato." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role for insert (bypasses RLS for admin operations)
    const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Check existing modules to skip duplicates - fetch ALL via pagination
    let existing: any[] = [];
    let offset = 0;
    const batchSize = 1000;
    while (true) {
      const { data: batch } = await adminClient
        .from("modulos_solares")
        .select("fabricante, modelo, potencia_wp")
        .or(`tenant_id.eq.${profile.tenant_id},tenant_id.is.null`)
        .range(offset, offset + batchSize - 1);
      if (!batch || batch.length === 0) break;
      existing.push(...batch);
      if (batch.length < batchSize) break;
      offset += batchSize;
    }

    const existingKeys = new Set(
      existing.map((m: any) => `${m.fabricante}|${m.modelo}|${m.potencia_wp}`.toLowerCase())
    );

    const toInsert = modules.filter(m => {
      const key = `${m.fabricante}|${m.modelo}|${m.potencia_wp}`.toLowerCase();
      return !existingKeys.has(key);
    });

    console.log(`${toInsert.length} new modules to insert (${modules.length - toInsert.length} duplicates skipped)`);

    let inserted = 0;
    let errors = 0;

    // Insert in batches of 200 using service role (tenant_id is set explicitly)
    for (let i = 0; i < toInsert.length; i += 200) {
      const chunk = toInsert.slice(i, i + 200).map(m => ({
        ...m,
        tenant_id: profile.tenant_id,
        status: "rascunho",
        ativo: true,
      }));

      const { error: insertErr } = await adminClient
        .from("modulos_solares")
        .insert(chunk);

      if (insertErr) {
        console.error(`Batch ${i} error:`, insertErr.message);
        errors += chunk.length;
      } else {
        inserted += chunk.length;
        console.log(`Batch ${i}: inserted ${chunk.length}`);
      }
    }

    console.log(`Import complete: ${inserted} inserted, ${errors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        total_parsed: modules.length,
        imported: inserted,
        skipped_duplicates: modules.length - toInsert.length,
        errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Import error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
