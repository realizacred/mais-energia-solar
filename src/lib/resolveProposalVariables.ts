/**
 * ═══════════════════════════════════════════════════════════════
 * RESOLVER UNIFICADO DE VARIÁVEIS — Proposta Comercial
 * ═══════════════════════════════════════════════════════════════
 *
 * Função pura que recebe todo o contexto de uma proposta e retorna
 * um mapa { chave: valor_formatado } para uso em templates (PDF/HTML/email).
 *
 * REGRAS:
 *  1. Todas as variáveis do VARIABLES_CATALOG são resolvidas aqui.
 *  2. Nunca retorna undefined — optional → "-", required → missing_required.
 *  3. PDF só pode ser gerado se missing_required estiver vazio.
 *  4. Registra auditoria (missing, fallbacks).
 */

import { VARIABLES_CATALOG, type CatalogVariable } from "./variablesCatalog";
import type { CalcGrupoBResult } from "./calcGrupoB";
import type {
  WizardState,
  ClienteData,
  PremissasData,
  UCData,
  VendaData,
  KitData,
  ServicoItem,
  PagamentoOpcao,
  ComercialData,
} from "@/components/admin/propostas-nativas/wizard/types";

// ── Types ────────────────────────────────────────────────────

export interface TariffVersionContext {
  te_kwh: number;
  tusd_total_kwh: number;
  fio_b_real_kwh: number | null;
  precisao: "exato" | "estimado";
  precisao_motivo?: string;
  origem: string;
  vigencia_inicio?: string;
  vigencia_fim?: string;
}

export interface AneelRunContext {
  last_sync_at?: string;
  run_id?: string;
  snapshot_hash?: string;
}

export interface ProposalResolverContext {
  // Wizard state (partial — only what's available)
  cliente?: Partial<ClienteData>;
  comercial?: Partial<ComercialData>;
  ucs?: UCData[];
  premissas?: Partial<PremissasData>;
  kit?: Partial<KitData>;
  servicos?: ServicoItem[];
  venda?: Partial<VendaData>;
  pagamentoOpcoes?: PagamentoOpcao[];
  // Tariff
  tariffVersion?: TariffVersionContext;
  // GD calc result
  gdResult?: CalcGrupoBResult;
  // ANEEL sync
  aneelRun?: AneelRunContext;
  // Computed totals
  potenciaKwp?: number;
  geracaoMensal?: number;
  numeroPlacas?: number;
  precoTotal?: number;
  economiaMensal?: number;
  economiaAnual?: number;
  economia25Anos?: number;
  paybackAnos?: number;
  co2Evitado?: number;
  // Consultor / Empresa
  consultorNome?: string;
  consultorCodigo?: string;
  empresaNome?: string;
  empresaTelefone?: string;
  // Extra overrides
  extras?: Record<string, string | number>;
  // Final snapshot (SSOT for finalized versions — inputs + outputs)
  finalSnapshot?: Record<string, unknown> | null;
}

export interface ResolverResult {
  /** Mapa key → valor formatado (usando canonicalKey sem {{ }}) */
  variables: Record<string, string>;
  /** Lista de chaves required que não puderam ser resolvidas */
  missing_required: string[];
  /** Lista de chaves que caíram em fallback "-" */
  fallbacks: string[];
  /** Se a proposta pode gerar PDF (missing_required vazio) */
  canGeneratePdf: boolean;
  /** Precisão geral da proposta */
  precisao: "exato" | "estimado" | "desconhecido";
}

// ── Formatters ───────────────────────────────────────────────

function fmtCurrency(v: number | null | undefined): string {
  if (v == null) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(v);
}

function fmtNumber(v: number | null | undefined, decimals = 2): string {
  if (v == null) return "-";
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v);
}

function fmtPercent(v: number | null | undefined): string {
  if (v == null) return "-";
  return `${fmtNumber(v)}%`;
}

function fmtKwh(v: number | null | undefined): string {
  if (v == null) return "-";
  return `${fmtNumber(v, 1)} kWh`;
}

// ── Deep get helper ──────────────────────────────────────────
// Resolves nested paths like "outputs.cenarios.0.tir" from an object

function deepGet(obj: unknown, path: string): unknown {
  if (obj == null || typeof obj !== "object") return undefined;
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

// ── Source resolver maps ─────────────────────────────────────
// Each function maps a dotted key to a value from context

function resolveFromContext(
  key: string,
  ctx: ProposalResolverContext
): string | null {
  // ── Priority 1: final_snapshot (SSOT for finalized versions) ──
  if (ctx.finalSnapshot) {
    // Try direct key match in final_snapshot
    const fsVal = deepGet(ctx.finalSnapshot, key);
    if (fsVal != null && fsVal !== "") {
      if (typeof fsVal === "number") return fmtNumber(fsVal);
      return String(fsVal);
    }
    // Try outputs.{key} and inputs.{key}
    const outVal = deepGet(ctx.finalSnapshot, `outputs.${key}`);
    if (outVal != null && outVal !== "") {
      if (typeof outVal === "number") return fmtNumber(outVal);
      return String(outVal);
    }
    const inVal = deepGet(ctx.finalSnapshot, `inputs.${key}`);
    if (inVal != null && inVal !== "") {
      if (typeof inVal === "number") return fmtNumber(inVal);
      return String(inVal);
    }
  }

  const uc1 = ctx.ucs?.[0];
  const t = ctx.tariffVersion;
  const gd = ctx.gdResult;
  const aneel = ctx.aneelRun;

  // Helper for safe access
  const s = (v: string | number | null | undefined): string | null =>
    v != null && v !== "" ? String(v) : null;

  // ── Tarifa ──
  if (key === "tarifa.te_kwh") return t ? fmtNumber(t.te_kwh, 6) : null;
  if (key === "tarifa.tusd_total_kwh") return t ? fmtNumber(t.tusd_total_kwh, 6) : null;
  if (key === "tarifa.fio_b_real_kwh") return t?.fio_b_real_kwh ? fmtNumber(t.fio_b_real_kwh, 6) : "-";
  if (key === "tarifa.fio_b_usado_kwh") return gd ? fmtNumber(gd.valor_credito_breakdown.fio_b_compensado, 6) : null;
  if (key === "tarifa.precisao") return t?.precisao?.toUpperCase() ?? null;
  if (key === "tarifa.precisao_motivo") return s(t?.precisao_motivo ?? gd?.precisao_motivo);
  if (key === "tarifa.origem") return s(t?.origem ?? gd?.origem_tariff);
  if (key === "tarifa.vigencia_inicio") return s(t?.vigencia_inicio ?? gd?.vigencia_tariff);
  if (key === "tarifa.vigencia_fim") return s(t?.vigencia_fim);

  // ── ANEEL ──
  if (key === "aneel.last_sync_at") return s(aneel?.last_sync_at);
  if (key === "aneel.run_id") return s(aneel?.run_id);
  if (key === "aneel.snapshot_hash_curto") return aneel?.snapshot_hash ? aneel.snapshot_hash.substring(0, 8) : "-";

  // ── GD ──
  if (key === "gd.regra") return gd ? gd.regra_aplicada.replace("_", " ") : null;
  if (key === "gd.ano_aplicado") return gd ? String(2026) : null;
  if (key === "gd.fio_b_percent_cobrado") return gd?.fio_b_percent_cobrado != null ? fmtPercent(gd.fio_b_percent_cobrado * 100) : "-";
  if (key === "gd.fio_b_percent_compensado") return gd?.fio_b_percent_cobrado != null ? fmtPercent((1 - gd.fio_b_percent_cobrado) * 100) : "-";

  // ── Cálculo ──
  if (key === "calculo.consumo_mensal_kwh") return gd ? fmtKwh(gd.consumo_kwh) : s(ctx.ucs?.[0]?.consumo_mensal);
  if (key === "calculo.custo_disponibilidade_kwh") return gd ? `${gd.custo_disponibilidade_kwh} kWh` : null;
  if (key === "calculo.consumo_compensavel_kwh") return gd ? fmtKwh(gd.consumo_compensavel_kwh) : null;
  if (key === "calculo.geracao_mensal_kwh") return gd ? fmtKwh(gd.geracao_kwh) : (ctx.geracaoMensal ? fmtKwh(ctx.geracaoMensal) : null);
  if (key === "calculo.energia_compensada_kwh") return gd ? fmtKwh(gd.energia_compensada_kwh) : null;
  if (key === "calculo.valor_credito_kwh") return gd ? `R$ ${gd.valor_credito_kwh.toFixed(6)}/kWh` : null;
  if (key === "calculo.economia_mensal_rs") return gd ? fmtCurrency(gd.economia_mensal_rs) : (ctx.economiaMensal ? fmtCurrency(ctx.economiaMensal) : null);
  if (key === "alerta.estimado.texto_pdf") {
    const precisao = t?.precisao ?? gd?.precisao;
    if (precisao === "estimado") {
      return "ATENÇÃO: Esta simulação utiliza estimativa de Fio B baseada no TUSD total da ANEEL. O valor real pode variar conforme estrutura tarifária da distribuidora.";
    }
    return "";
  }

  // ── Cliente ──
  if (key === "cliente.nome") return s(ctx.cliente?.nome);
  if (key === "cliente.empresa") return s(ctx.cliente?.empresa);
  if (key === "cliente.cnpj_cpf") return s(ctx.cliente?.cnpj_cpf);
  if (key === "cliente.email") return s(ctx.cliente?.email);
  if (key === "cliente.celular") return s(ctx.cliente?.celular);
  if (key === "cliente.endereco") {
    const c = ctx.cliente;
    if (!c) return null;
    return [c.endereco, c.numero, c.complemento, c.bairro, c.cidade, c.estado].filter(Boolean).join(", ") || null;
  }
  if (key === "cliente.cidade") return s(ctx.cliente?.cidade);
  if (key === "cliente.estado") return s(ctx.cliente?.estado);
  if (key === "cliente.bairro") return s(ctx.cliente?.bairro);
  if (key === "cliente.cep") return s(ctx.cliente?.cep);

  // ── Comercial ──
  if (key === "comercial.responsavel_nome") return s(ctx.comercial?.responsavel_nome);
  if (key === "comercial.empresa_nome") return s(ctx.comercial?.empresa_nome ?? ctx.empresaNome);

  // ── Entrada ──
  if (key === "entrada.consumo_mensal") return uc1 ? fmtNumber(uc1.consumo_mensal, 0) : null;
  if (key === "entrada.dis_energia") return s(uc1?.distribuidora);
  if (key === "entrada.estado") return s(ctx.cliente?.estado ?? uc1?.estado);
  if (key === "entrada.cidade") return s(ctx.cliente?.cidade ?? uc1?.cidade);
  if (key === "entrada.fase") return s(uc1?.fase);
  if (key === "entrada.tipo_telhado") return s(uc1?.tipo_telhado);
  if (key === "entrada.tarifa_distribuidora") return uc1 ? fmtNumber(uc1.tarifa_distribuidora, 2) : null;
  if (key === "entrada.custo_disponibilidade_kwh") return uc1 ? String(uc1.custo_disponibilidade_kwh) : null;
  if (key === "entrada.tensao_rede") return s(uc1?.tensao_rede);
  if (key === "entrada.tipo_sistema") return s(ctx.kit?.tipo_sistema);

  // ── Sistema Solar ──
  if (key === "sistema_solar.potencia_sistema") return ctx.potenciaKwp ? fmtNumber(ctx.potenciaKwp, 2) : null;
  if (key === "sistema_solar.geracao_mensal") return ctx.geracaoMensal ? fmtNumber(ctx.geracaoMensal, 0) : null;

  // ── Financeiro ──
  if (key === "financeiro.preco_total") return ctx.precoTotal ? fmtCurrency(ctx.precoTotal) : null;
  if (key === "financeiro.economia_mensal") return ctx.economiaMensal ? fmtCurrency(ctx.economiaMensal) : null;
  if (key === "financeiro.economia_anual") return ctx.economiaAnual ? fmtCurrency(ctx.economiaAnual) : null;
  if (key === "financeiro.economia_25_anos") return ctx.economia25Anos ? fmtCurrency(ctx.economia25Anos) : null;
  if (key === "financeiro.payback_anos") return ctx.paybackAnos ? fmtNumber(ctx.paybackAnos, 1) : null;

  // ── Conta Energia ──
  if (key === "conta_energia.co2_evitado_ano") return ctx.co2Evitado ? fmtNumber(ctx.co2Evitado, 0) : null;

  // ── Extras override ──
  if (ctx.extras && key in ctx.extras) return String(ctx.extras[key]);

  return null;
}

// ── Required keys (variáveis que DEVEM existir para gerar PDF) ──

const REQUIRED_KEYS = new Set([
  "cliente.nome",
  "entrada.consumo_mensal",
  "sistema_solar.potencia_sistema",
  "financeiro.preco_total",
]);

// ── Main resolver ────────────────────────────────────────────

export function resolveProposalVariables(
  ctx: ProposalResolverContext
): ResolverResult {
  const variables: Record<string, string> = {};
  const missing_required: string[] = [];
  const fallbacks: string[] = [];

  for (const catalogVar of VARIABLES_CATALOG) {
    // Extract the dotted key from canonical: {{grupo.campo}} → grupo.campo
    const dottedKey = catalogVar.canonicalKey.replace(/^\{\{/, "").replace(/\}\}$/, "");
    const flatKey = dottedKey.replace(/\./g, "_");

    const resolved = resolveFromContext(dottedKey, ctx);

    if (resolved != null) {
      variables[dottedKey] = resolved;
      variables[flatKey] = resolved;
    } else {
      // Check if required
      if (REQUIRED_KEYS.has(dottedKey)) {
        missing_required.push(dottedKey);
      }
      // Fallback
      variables[dottedKey] = "-";
      variables[flatKey] = "-";
      fallbacks.push(dottedKey);
    }
  }

  // Determine precision
  const precisao: ResolverResult["precisao"] =
    ctx.tariffVersion?.precisao ??
    ctx.gdResult?.precisao ??
    "desconhecido";

  return {
    variables,
    missing_required,
    fallbacks,
    canGeneratePdf: missing_required.length === 0,
    precisao,
  };
}
