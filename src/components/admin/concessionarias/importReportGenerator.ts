/**
 * TarifaCore Solar — Post-import report generator
 * Generates 4 structured reports after each import.
 */

import type { ValidationReport, RowValidation } from "./importCsvAneelValidation";
import type { ParsedTarifa, FileType } from "./importCsvAneelUtils";

// ────── Report Types ──────

export interface ReportResumo {
  tipo: "resumo";
  tipoArquivo: string;
  nomeArquivo: string;
  dataImportacao: string;
  totalLinhasLidas: number;
  totalLinhasValidas: number;
  totalLinhasRejeitadas: number;
  totalLinhasAvisos: number;
  totalConcessionariasArquivo: number;
  totalMapeadas: number;
  totalNaoMapeadas: number;
  taxaMapeamento: number; // 0-100
  vigenciasDetectadas: string[];
  grupoA: number;
  grupoB: number;
  registrosImportados: number;
  errosPersistencia: number;
}

export interface ReportConcNaoImportada {
  nomeArquivo: string;
  motivo: string;
  acaoRecomendada: string;
}

export interface ReportConcessionarias {
  tipo: "concessionarias_nao_importadas";
  items: ReportConcNaoImportada[];
}

export interface ReportErroColuna {
  colunaEsperada: string;
  colunaEncontrada: string | null;
  taxaPreenchimento: number; // 0-100
  exemplosInvalidos: string[];
  sugestao: string;
}

export interface ReportErrosColunas {
  tipo: "erros_colunas";
  items: ReportErroColuna[];
}

export interface ReportSanidade {
  tipo: "sanidade_valores";
  teTusdZero: number;
  valoresSuspeitosMwh: number; // values > 1 R$/kWh likely still in MWh
  camposVaziosCriticos: number;
  detalhesTeTusdZero: Array<{ agente: string; subgrupo: string; campo: string }>;
  detalhesSuspeitos: Array<{ agente: string; subgrupo: string; campo: string; valor: number }>;
}

export interface ImportReports {
  resumo: ReportResumo;
  concessionarias: ReportConcessionarias;
  errosColunas: ReportErrosColunas;
  sanidade: ReportSanidade;
  geradoEm: string;
}

// ────── Generator ──────

interface GenerateReportsInput {
  fileName: string;
  fileType: FileType;
  validation: ValidationReport;
  parsed: ParsedTarifa[];
  matchedAgents: Array<{ agent: string; conc: string }>;
  unmatchedAgents: string[];
  importResult: {
    updated: number;
    matched: number;
    skipped: number;
    errors: string[];
    grupoA: number;
    grupoB: number;
  };
  detectedColumns: Record<string, number>;
  headers: string[];
}

const EXPECTED_COLUMNS: Record<string, string> = {
  sigAgente: "Sigla do Agente",
  nomAgente: "Nome do Agente",
  subgrupo: "Subgrupo",
  modalidade: "Modalidade Tarifária",
  posto: "Posto Tarifário",
  vlrTUSD: "Valor TUSD",
  vlrTE: "Valor TE",
  unidade: "Unidade",
  vigencia: "Início Vigência",
  baseTarifaria: "Base Tarifária",
};

export function generateImportReports(input: GenerateReportsInput): ImportReports {
  const {
    fileName, fileType, validation, parsed, matchedAgents,
    unmatchedAgents, importResult, detectedColumns, headers,
  } = input;

  const now = new Date().toISOString();
  const fileTypeLabel = fileType === "componentes" ? "Componentes Tarifários" : "Tarifas Homologadas";

  // ── Report 1: Resumo ──
  const vigencias = [...new Set(parsed.map(r => r.vigencia).filter(Boolean))];
  const allAgents = [...new Set(parsed.map(r => r.sigAgente || r.nomAgente))];

  const resumo: ReportResumo = {
    tipo: "resumo",
    tipoArquivo: fileTypeLabel,
    nomeArquivo: fileName,
    dataImportacao: now,
    totalLinhasLidas: validation.totalRows,
    totalLinhasValidas: validation.validRows,
    totalLinhasRejeitadas: validation.invalidRows,
    totalLinhasAvisos: validation.warningRows,
    totalConcessionariasArquivo: allAgents.length,
    totalMapeadas: matchedAgents.length,
    totalNaoMapeadas: unmatchedAgents.length,
    taxaMapeamento: allAgents.length > 0
      ? Math.round((matchedAgents.length / allAgents.length) * 100)
      : 0,
    vigenciasDetectadas: vigencias.sort(),
    grupoA: importResult.grupoA,
    grupoB: importResult.grupoB,
    registrosImportados: importResult.updated,
    errosPersistencia: importResult.errors.length,
  };

  // ── Report 2: Concessionárias não importadas ──
  const concItems: ReportConcNaoImportada[] = unmatchedAgents.map(agent => {
    // Try to determine reason
    const agentRecords = parsed.filter(r => (r.sigAgente || r.nomAgente) === agent);
    let motivo = "Não mapeada no dicionário de correspondência";
    let acaoRecomendada = `Cadastre "${agent}" no Dicionário ANEEL ou adicione como alias`;

    if (agentRecords.length === 0) {
      motivo = "Sem registros válidos no arquivo";
      acaoRecomendada = "Verifique se o nome está correto no arquivo";
    }

    return { nomeArquivo: agent, motivo, acaoRecomendada };
  });

  const concessionarias: ReportConcessionarias = {
    tipo: "concessionarias_nao_importadas",
    items: concItems,
  };

  // ── Report 3: Erros de coluna ──
  const errosItems: ReportErroColuna[] = [];
  for (const [key, label] of Object.entries(EXPECTED_COLUMNS)) {
    const colIdx = detectedColumns[key];
    const found = colIdx !== undefined;

    if (!found) {
      errosItems.push({
        colunaEsperada: label,
        colunaEncontrada: null,
        taxaPreenchimento: 0,
        exemplosInvalidos: [],
        sugestao: `Coluna "${label}" não foi encontrada. Verifique se o cabeçalho contém variações como: ${key}`,
      });
    } else {
      // Calculate fill rate from validation rows
      const invalidForCol = validation.rows.filter(r =>
        r.errors.some(e => e.toLowerCase().includes(key.toLowerCase())) ||
        r.warnings.some(w => w.toLowerCase().includes(key.toLowerCase()))
      );
      const fillRate = validation.totalRows > 0
        ? Math.round(((validation.totalRows - invalidForCol.length) / validation.totalRows) * 100)
        : 100;

      if (fillRate < 95) {
        const examples = invalidForCol.slice(0, 5).map(r => {
          const msgs = [...r.errors, ...r.warnings].filter(m =>
            m.toLowerCase().includes(key.toLowerCase())
          );
          return `Linha ${r.rowIndex}: ${msgs.join("; ")}`;
        });

        errosItems.push({
          colunaEsperada: label,
          colunaEncontrada: headers[colIdx] || `col${colIdx}`,
          taxaPreenchimento: fillRate,
          exemplosInvalidos: examples,
          sugestao: fillRate < 50
            ? `Coluna "${headers[colIdx]}" pode estar mapeada incorretamente. Verifique o arquivo.`
            : `${100 - fillRate}% dos valores estão inválidos ou vazios.`,
        });
      }
    }
  }

  const errosColunas: ReportErrosColunas = {
    tipo: "erros_colunas",
    items: errosItems,
  };

  // ── Report 4: Sanidade de valores ──
  const teTusdZeroDetails: Array<{ agente: string; subgrupo: string; campo: string }> = [];
  const suspeitosDetails: Array<{ agente: string; subgrupo: string; campo: string; valor: number }> = [];

  for (const r of parsed) {
    const agent = r.sigAgente || r.nomAgente;
    // TE/TUSD = 0 check (only for homologadas)
    if (fileType !== "componentes") {
      if (r.vlrTE === 0 && r.vlrTUSD === 0) {
        teTusdZeroDetails.push({ agente: agent, subgrupo: r.subgrupo, campo: "TE+TUSD" });
      }
    }
    // Suspicious values > 1 R$/kWh (likely still in MWh) 
    // Only flag if unit doesn't say MWh (those will be converted)
    const unit = (r.unidade || "").toLowerCase();
    if (!unit.includes("mwh")) {
      if (r.vlrTE > 1) {
        suspeitosDetails.push({ agente: agent, subgrupo: r.subgrupo, campo: "TE", valor: r.vlrTE });
      }
      if (r.vlrTUSD > 1) {
        suspeitosDetails.push({ agente: agent, subgrupo: r.subgrupo, campo: "TUSD", valor: r.vlrTUSD });
      }
    }
  }

  // Count unique zero entries and suspicious (cap display at 20)
  const camposVazios = validation.rows.filter(r =>
    r.errors.some(e => e.toLowerCase().includes("vazi"))
  ).length;

  const sanidade: ReportSanidade = {
    tipo: "sanidade_valores",
    teTusdZero: teTusdZeroDetails.length,
    valoresSuspeitosMwh: suspeitosDetails.length,
    camposVaziosCriticos: camposVazios,
    detalhesTeTusdZero: teTusdZeroDetails.slice(0, 20),
    detalhesSuspeitos: suspeitosDetails.slice(0, 20),
  };

  return {
    resumo,
    concessionarias,
    errosColunas,
    sanidade,
    geradoEm: now,
  };
}
