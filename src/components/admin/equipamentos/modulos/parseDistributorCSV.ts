/**
 * Parser para CSV de distribuidoras de equipamentos solares.
 * Formato: Categoria;Item;Preço1;Preço2;...
 * Coluna "Item" contém fabricante + modelo concatenados.
 */

export interface ParsedDistributorModule {
  fabricante: string;
  modelo: string;
  potencia_wp: number;
  bifacial: boolean;
  tipo_celula: string;
  status: "rascunho";
  ativo: boolean;
  tensao_sistema: string;
}

// Fabricantes com nomes compostos (ordem: mais específico primeiro)
const KNOWN_MULTI_WORD_BRANDS = [
  "CANADIAN SOLAR",
  "AE SOLAR",
  "BEDIN SOLAR",
  "BOLD ENERGY",
  "AMSO SOLAR",
  "TECH POWER",
  "JA SOLAR",
  "LONGi SOLAR",
  "RISEN ENERGY",
  "TRINA SOLAR",
  "SERAPHIM SOLAR",
  "Q CELLS",
  "AMERISOLAR ENERGY",
  "SUNOVA SOLAR",
  "SOLAR FRONTIER",
  "FIRST SOLAR",
  "REC SOLAR",
  "SHARP SOLAR",
  "ET SOLAR",
  "GCL SYSTEM",
  "HT SAAE",
  "ZN SHINE",
  "SUN EARTH",
  "DAH SOLAR",
  "YINGLI SOLAR",
];

/**
 * Separa fabricante e modelo de uma string concatenada.
 * Heurística:
 *  1. Tenta match com fabricantes conhecidos de múltiplas palavras
 *  2. Senão, fabricante = palavras iniciais que são puramente alfabéticas (sem números/hífens)
 *     modelo = restante a partir da primeira palavra com número ou hífen
 */
function splitFabricanteModelo(raw: string): { fabricante: string; modelo: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { fabricante: "", modelo: "" };

  // 1. Tentar fabricantes conhecidos (case-insensitive)
  const upper = trimmed.toUpperCase();
  for (const brand of KNOWN_MULTI_WORD_BRANDS) {
    if (upper.startsWith(brand + " ")) {
      return {
        fabricante: brand,
        modelo: trimmed.substring(brand.length).trim(),
      };
    }
  }

  // 2. Heurística: palavras puramente alfabéticas = fabricante
  const words = trimmed.split(/\s+/);
  let splitIdx = 0;

  for (let i = 0; i < words.length; i++) {
    // Se a palavra contém número ou hífen seguido de número, é início do modelo
    if (/\d/.test(words[i]) || /^[A-Z]+-[A-Z0-9]/.test(words[i])) {
      splitIdx = i;
      break;
    }
    splitIdx = i + 1;
  }

  // Garantir pelo menos 1 palavra como fabricante
  if (splitIdx === 0) splitIdx = 1;

  const fabricante = words.slice(0, splitIdx).join(" ");
  const modelo = words.slice(splitIdx).join(" ");

  return { fabricante, modelo: modelo || trimmed };
}

/**
 * Extrai potência em Wp do nome do modelo.
 * Procura números de 3-4 dígitos que tipicamente representam watts.
 */
function extractPotenciaWp(modelo: string): number {
  // Padrões comuns: 410MS, 530W, MLK-36-530, etc.
  // Pegar o maior número de 3-4 dígitos que pareça potência (100-999)
  const matches = modelo.match(/(\d{3,4})/g);
  if (!matches) return 0;

  // Filtrar candidatos razoáveis para potência (100W a 999W tipicamente)
  const candidates = matches
    .map(Number)
    .filter(n => n >= 100 && n <= 999);

  // Retornar o maior (geralmente a potência está no range mais alto)
  return candidates.length > 0 ? Math.max(...candidates) : 0;
}

function detectBifacial(text: string): boolean {
  return /bifacial|(\bBF\b)|(\bBD\b)/i.test(text);
}

function detectCellType(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("topcon") || lower.includes("n-type topcon")) return "N-Type TOPCon";
  if (lower.includes("hjt")) return "N-Type HJT";
  if (lower.includes("hpbc")) return "N-Type HPBC";
  if (lower.includes("perc") || lower.includes("mono perc")) return "Mono PERC";
  if (lower.includes("poli") || lower.includes("poly")) return "Policristalino";
  if (lower.includes("mono")) return "Mono PERC";
  return "Mono PERC"; // default
}

export interface ParseResult {
  modules: ParsedDistributorModule[];
  warnings: Array<{ line: number; raw: string; issue: string }>;
  totalLines: number;
  filteredLines: number;
}

/**
 * Parse do CSV de distribuidora.
 * @param csvText - conteúdo completo do CSV
 * @param categoria - filtro por tipo: 'Módulo', 'Inversor', 'Otimizador'
 */
export function parseDistributorCSV(
  csvText: string,
  categoria: "Módulo" | "Inversor" | "Otimizador" = "Módulo"
): ParseResult {
  const lines = csvText.split("\n").filter(l => l.trim());
  if (lines.length < 2) {
    return { modules: [], warnings: [], totalLines: 0, filteredLines: 0 };
  }

  const warnings: ParseResult["warnings"] = [];
  const modules: ParsedDistributorModule[] = [];
  const seenKeys = new Set<string>();

  // Skip header (line 0)
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(";").map(c => c.trim());
    const cat = cols[0] || "";
    const itemName = cols[1] || "";

    // Filtrar por categoria
    if (!cat.toLowerCase().includes(categoria.toLowerCase())) continue;

    if (!itemName) {
      warnings.push({ line: i + 1, raw: lines[i], issue: "Nome do item vazio" });
      continue;
    }

    const { fabricante, modelo } = splitFabricanteModelo(itemName);

    if (!fabricante || !modelo) {
      warnings.push({ line: i + 1, raw: itemName, issue: "Não foi possível separar fabricante/modelo" });
      continue;
    }

    const potencia_wp = extractPotenciaWp(modelo);

    if (potencia_wp === 0) {
      warnings.push({
        line: i + 1,
        raw: itemName,
        issue: `Potência não detectada no modelo "${modelo}"`,
      });
    }

    // Dedup dentro do próprio CSV
    const key = `${fabricante}|${modelo}`.toLowerCase();
    if (seenKeys.has(key)) {
      warnings.push({ line: i + 1, raw: itemName, issue: "Duplicado dentro do CSV" });
      continue;
    }
    seenKeys.add(key);

    modules.push({
      fabricante,
      modelo,
      potencia_wp,
      bifacial: detectBifacial(itemName),
      tipo_celula: detectCellType(itemName),
      status: "rascunho",
      ativo: true,
      tensao_sistema: "1500V",
    });
  }

  return {
    modules,
    warnings,
    totalLines: lines.length - 1,
    filteredLines: modules.length + warnings.filter(w => w.issue.includes("Duplicado")).length,
  };
}
