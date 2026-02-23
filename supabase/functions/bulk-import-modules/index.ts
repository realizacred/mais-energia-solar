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

function parseEfficiency(val: string): number | null {
  if (!val || val.trim() === "" || val === "-" || val === "%" || val === "N/A") return null;
  const cleaned = val.replace(",", ".").replace("%", "").trim();
  const n = parseFloat(cleaned);
  if (isNaN(n) || n <= 0 || n > 50) return null; // efficiency sanity check (0-50%)
  return n;
}

function parseInt2(val: string): number | null {
  if (!val || val.trim() === "") return null;
  const cleaned = val.replace(",", ".").trim();
  const n = parseFloat(cleaned);
  if (isNaN(n)) return null;
  return Math.round(n);
}

function detectCellType(modelo: string): string {
  const lower = modelo.toLowerCase();
  if (lower.includes("topcon") || lower.includes("-nt") || lower.includes("n5") || lower.includes("n7") ||
      /ntype|n-type|topbihiku|vertex tsm-ne|vertex tsm-neg|ntype|hjt/.test(lower)) {
    if (lower.includes("hjt")) return "N-Type HJT";
    return "N-Type TOPCon";
  }
  if (lower.includes("hjt") || lower.includes("heterojunction")) return "N-Type HJT";
  if (lower.includes("hpbc")) return "N-Type HPBC";
  if (lower.includes("poli") || lower.includes("poly") || /\bp\d/.test(lower) || /-p-/i.test(lower) ||
      /p6k|p6c|phk|pik|kupower|kumax.*p|maxpower.*p|splitmax|stave|pipro/i.test(lower) ||
      /-p\d{2,3}/i.test(lower) || /6p-/i.test(lower) || /72p|144p|60p/i.test(lower)) return "Policristalino";
  return "Mono PERC";
}

function detectBifacial(modelo: string): boolean {
  return /bifacial|bi[-\s]?facial|\bbf\b|bdv|bdvp|bmdg|bhdg|bihiku|bipro|bistar|biku|mb-ag|dg[/-]|\bdg\b/i.test(modelo);
}

function detectTensao(modelo: string): string {
  if (/1000v/i.test(modelo)) return "1000V";
  return "1500V";
}

// Known fabricante names (longest first for greedy matching)
const KNOWN_FABS = [
  "AE SOLAR", "AMSO SOLAR", "BEDIN SOLAR", "BOLD ENERGY", "CANADIAN SOLAR",
  "CONSORT SOLAR", "DAS SOLAR", "DMEGC SOLAR", "ERA SOLAR", "GOKIN SOLAR",
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
  "XPOWER", "ZNSHINE", "GCL", "SolarSpace"
].sort((a, b) => b.length - a.length);

/**
 * Parse the space-separated format:
 * FABRICANTE MODELO POTENCIA CELULAS EFICIENCIA%
 * 
 * Strategy: from the right side, extract numbers (potencia, celulas, eficiencia)
 * then split remaining text into fabricante + modelo
 */
function parseSpaceLine(line: string): RawModule | null {
  const trimmed = line.trim();
  
  // Skip header lines and empty/short lines
  if (trimmed.length < 10) return null;
  if (/^fabricante\s/i.test(trimmed)) return null;
  if (/potência.*células.*eficiência/i.test(trimmed)) return null;
  if (/^Fabricante\s+Modelo/i.test(trimmed)) return null;

  // Try to match from right: ...POTENCIA CELULAS EFICIENCIA[%] [VISUALIZAR|link]
  // Potencia: 2-4 digit number (100-999W or 1000W)
  // Celulas: 1-4 digit number
  // Eficiencia: number with comma or dot, possibly followed by %
  
  // Pattern: captures trailing numbers
  // "AE SOLAR AE340M6-72 340 72 17,52%"
  // "TRINA SOLAR VERTEX TSM-NEG21C.20 720 720 23,30%"
  
  const rightMatch = trimmed.match(
    /^(.+?)\s+(\d{2,4})\s+(\d{1,4})\s+([\d,.]+%?)\s*(?:Visualizar)?\s*$/i
  );
  
  if (!rightMatch) return null;

  const fullName = rightMatch[1].trim();
  const potencia = parseInt(rightMatch[2]);
  const celulas = parseInt(rightMatch[3]);
  const eficiencia = parseEfficiency(rightMatch[4]);

  // Validate potencia range
  if (potencia < 50 || potencia > 1000) return null;
  
  // celulas sanity check (1-500)
  const numCelulas = celulas > 0 && celulas <= 500 ? celulas : null;

  // Split fullName into fabricante + modelo
  let fabricante = "";
  let modelo = "";
  const upper = fullName.toUpperCase();

  for (const fab of KNOWN_FABS) {
    if (upper.startsWith(fab.toUpperCase())) {
      fabricante = fab;
      modelo = fullName.substring(fab.length).trim();
      break;
    }
  }

  if (!fabricante || !modelo) {
    // Fallback: first word is fabricante
    const parts = fullName.split(/\s+/);
    if (parts.length >= 2) {
      fabricante = parts[0];
      modelo = parts.slice(1).join(" ");
    } else {
      return null;
    }
  }

  if (!fabricante || !modelo) return null;

  return {
    fabricante: fabricante.trim(),
    modelo: modelo.trim(),
    potencia_wp: potencia,
    num_celulas: numCelulas,
    eficiencia_percent: eficiencia,
    tipo_celula: detectCellType(modelo),
    bifacial: detectBifacial(modelo),
    tensao_sistema: detectTensao(modelo),
  };
}

function parseModulesFromText(text: string): RawModule[] {
  const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  const modules: RawModule[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    // Skip obvious header lines
    if (/^fabricante\s/i.test(line)) continue;
    if (/^Fabricante\s+Modelo/i.test(line)) continue;
    if (line.length < 10) continue;

    // Try tab-separated first
    let parts = line.split("\t");
    if (parts.length < 3) {
      // Try semicolon
      parts = line.split(";");
    }

    if (parts.length >= 3 && !parts[0].includes(" ")) {
      // Pure structured format: no spaces in fabricante field
      const fabricante = parts[0]?.trim() || "";
      const modelo = parts[1]?.trim() || "";
      const potencia = parseInt2(parts[2] || "") || 0;
      const celulas = parts.length > 3 ? parseInt2(parts[3] || "") : null;
      const eficiencia = parts.length > 4 ? parseEfficiency(parts[4] || "") : null;

      if (!fabricante || !modelo || potencia < 50 || potencia > 1000) continue;
      if (/^fabricante$/i.test(fabricante)) continue;

      const key = `${fabricante}|${modelo}|${potencia}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      modules.push({
        fabricante,
        modelo,
        potencia_wp: potencia,
        num_celulas: celulas != null && celulas > 0 && celulas <= 500 ? celulas : null,
        eficiencia_percent: eficiencia,
        tipo_celula: detectCellType(modelo),
        bifacial: detectBifacial(modelo),
        tensao_sistema: detectTensao(modelo),
      });
    } else {
      // Space-separated format — use our right-anchored parser
      const parsed = parseSpaceLine(line);
      if (!parsed) continue;

      const key = `${parsed.fabricante}|${parsed.modelo}|${parsed.potencia_wp}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      modules.push(parsed);
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
      .eq("user_id", userData.user.id)
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

    console.log(`Parsing modules (${raw_text.length} chars, ${raw_text.split("\n").length} lines)...`);
    const modules = parseModulesFromText(raw_text);
    console.log(`Parsed ${modules.length} unique modules`);

    if (modules.length === 0) {
      return new Response(JSON.stringify({
        success: true, imported: 0, skipped_duplicates: 0, errors: 0,
        message: "Nenhum módulo válido encontrado. Verifique o formato (FABRICANTE MODELO POTENCIA CELULAS EFICIENCIA)."
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Use service role for insert (bypasses RLS)
    const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Fetch ALL existing modules via pagination to detect duplicates
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

    console.log(`${toInsert.length} to insert, ${modules.length - toInsert.length} duplicates skipped`);

    let inserted = 0;
    let errors = 0;

    // Insert in batches of 200
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
        console.error(`Batch ${i}: ${insertErr.message}`);
        errors += chunk.length;
      } else {
        inserted += chunk.length;
        console.log(`Batch ${i}: +${chunk.length} (total: ${inserted})`);
      }
    }

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
