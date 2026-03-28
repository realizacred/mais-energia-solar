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
  if (key === "comercial.responsavel_email") return s(ctx.comercial?.responsavel_email);
  if (key === "comercial.responsavel_celular") return s(ctx.comercial?.responsavel_celular);
  if (key === "comercial.representante_nome") {
    return s(
      ctx.comercial?.representante_nome
      ?? (ctx.finalSnapshot as any)?.representante_nome
      ?? (ctx.finalSnapshot as any)?.consultor_nome
      ?? ctx.consultorNome
    );
  }
  if (key === "comercial.representante_email") return s(ctx.comercial?.representante_email);
  if (key === "comercial.representante_celular") return s(ctx.comercial?.representante_celular);
  if (key === "comercial.empresa_nome") return s(ctx.comercial?.empresa_nome ?? ctx.empresaNome);

  // QW9 — consultor fields
  if (key === "comercial.consultor_nome") {
    return s(ctx.consultorNome)
      ?? s((ctx.finalSnapshot as any)?.consultor_nome)
      ?? s(ctx.comercial?.responsavel_nome)
      ?? null;
  }
  if (key === "comercial.consultor_telefone") {
    return s((ctx.finalSnapshot as any)?.consultor_telefone)
      ?? s(ctx.comercial?.responsavel_celular)
      ?? null;
  }
  if (key === "comercial.consultor_email") {
    return s((ctx.finalSnapshot as any)?.consultor_email)
      ?? s(ctx.comercial?.responsavel_email)
      ?? null;
  }

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

  // ── Área útil (AP-15: espelhar resolveEntrada.ts do backend) ──
  if (key === "entrada.area_util" || key === "sistema_solar.area_util") {
    const uc1Val = ctx.ucs?.[0] as unknown as Record<string, unknown> | undefined;
    const snapVal = ctx.finalSnapshot as Record<string, unknown> | undefined;
    const areaRaw = snapVal?.area_util ?? uc1Val?.area_util ?? snapVal?.area_util_m2 ?? uc1Val?.area_util_m2;
    if (areaRaw != null && Number(areaRaw) > 0) return fmtNumber(Number(areaRaw), 1);
    // Fallback: calcular a partir das dimensões do módulo × quantidade
    const kitI = (ctx.kit as any)?.itens as Array<Record<string, unknown>> | undefined;
    if (kitI) {
      const mod = kitI.find((i) => {
        const cat = String(i.categoria || i.tipo || "").toLowerCase();
        return cat.includes("modulo") || cat.includes("painel") || cat.includes("placa");
      });
      if (mod) {
        const dim = String(mod.dimensoes_mm || mod.dimensoes || "");
        const parts = dim.split(/[xX×]/);
        if (parts.length >= 2) {
          const compM = Number(parts[0]) / 1000;
          const largM = Number(parts[1]) / 1000;
          if (compM > 0 && largM > 0) {
            const qty = Number(mod.quantidade ?? ctx.numeroPlacas ?? 0);
            return fmtNumber(compM * largM * qty, 1);
          }
        }
      }
    }
    return null;
  }
  if (key === "sistema_solar.area_necessaria") {
    // area_necessaria = area_util dos módulos (mesmo cálculo, diferente semântica no template)
    const kitI2 = (ctx.kit as any)?.itens as Array<Record<string, unknown>> | undefined;
    if (kitI2) {
      const mod = kitI2.find((i) => {
        const cat = String(i.categoria || i.tipo || "").toLowerCase();
        return cat.includes("modulo") || cat.includes("painel") || cat.includes("placa");
      });
      if (mod) {
        const dim = String(mod.dimensoes_mm || mod.dimensoes || "");
        const parts = dim.split(/[xX×]/);
        if (parts.length >= 2) {
          const compM = Number(parts[0]) / 1000;
          const largM = Number(parts[1]) / 1000;
          if (compM > 0 && largM > 0) {
            const qty = Number(mod.quantidade ?? ctx.numeroPlacas ?? 0);
            return fmtNumber(compM * largM * qty, 1);
          }
        }
      }
    }
    return null;
  }

  // ── Sistema Solar — Equipamentos ──
  if (key === "sistema_solar.potencia_sistema") return ctx.potenciaKwp ? `${fmtNumber(ctx.potenciaKwp, 2)} kWp` : null;
  if (key === "sistema_solar.potencia_sistema_numero") return ctx.potenciaKwp ? fmtNumber(ctx.potenciaKwp, 2) : null;
  if (key === "sistema_solar.geracao_mensal") return ctx.geracaoMensal ? `${fmtNumber(ctx.geracaoMensal, 0)} kWh/mês` : null;
  if (key === "sistema_solar.geracao_mensal_numero") return ctx.geracaoMensal ? fmtNumber(ctx.geracaoMensal, 0) : null;
  if (key === "sistema_solar.numero_modulos") return ctx.numeroPlacas ? String(ctx.numeroPlacas) : null;

  // Equipment from kit items
  const kitItens = (ctx.kit as any)?.itens as Array<Record<string, unknown>> | undefined;
  if (kitItens && Array.isArray(kitItens)) {
    const findItem = (cat: string) => kitItens.find((i) => String(i.categoria || i.tipo || "").toLowerCase().includes(cat));
    const modulo = findItem("modulo") || findItem("painel") || findItem("placa");
    const inversor = findItem("inversor");

    if (key === "sistema_solar.modulo_fabricante") return s(modulo?.fabricante as string);
    if (key === "sistema_solar.modulo_modelo") return s(modulo?.modelo as string);
    if (key === "sistema_solar.modulo_potencia") return modulo?.potencia_w ? `${modulo.potencia_w} Wp` : null;
    if (key === "sistema_solar.modulo_potencia_numero") return modulo?.potencia_w ? String(modulo.potencia_w) : null;
    if (key === "sistema_solar.modulo_quantidade") return s((modulo?.quantidade ?? ctx.numeroPlacas) as string | number);
    if (key === "sistema_solar.inversor_fabricante") return s(inversor?.fabricante as string);
    if (key === "sistema_solar.inversor_fabricante_1") return s(inversor?.fabricante as string);
    if (key === "sistema_solar.inversor_modelo") return s(inversor?.modelo as string);
    if (key === "sistema_solar.inversor_potencia_nominal") return inversor?.potencia_w ? `${inversor.potencia_w} W` : null;
    if (key === "sistema_solar.inversor_potencia_nominal_numero") return inversor?.potencia_w ? String(inversor.potencia_w) : null;
    if (key === "sistema_solar.inversor_quantidade") return s(inversor?.quantidade as string | number);
  }

  // ── Financeiro ──
  if (key === "financeiro.preco_total") {
    // ctx.precoTotal can be 0 (valid) — only block if truly null/undefined
    if (ctx.precoTotal != null && !isNaN(ctx.precoTotal)) return fmtCurrency(ctx.precoTotal);
    // Fallback: try to sum kit items if available
    if (ctx.kit && typeof ctx.kit === "object") {
      const kitTotal = (ctx as unknown as { itensTotal?: number }).itensTotal;
      if (kitTotal != null && kitTotal > 0) return fmtCurrency(kitTotal);
    }
    // Fallback: try gdResult economia_anual * payback
    if (ctx.gdResult?.economia_mensal_rs && ctx.paybackAnos) {
      return fmtCurrency(ctx.gdResult.economia_mensal_rs * 12 * ctx.paybackAnos);
    }
    return null;
  }
  if (key === "financeiro.preco") return ctx.precoTotal != null ? fmtCurrency(ctx.precoTotal) : null;
  if (key === "financeiro.preco_final") return ctx.precoTotal != null ? fmtCurrency(ctx.precoTotal) : null;
  if (key === "financeiro.valor_total") return ctx.precoTotal != null ? fmtCurrency(ctx.precoTotal) : null;
  if (key === "financeiro.economia_mensal") return ctx.economiaMensal ? fmtCurrency(ctx.economiaMensal) : null;
  if (key === "financeiro.economia_anual") return ctx.economiaAnual ? fmtCurrency(ctx.economiaAnual) : null;
  if (key === "financeiro.economia_25_anos") return ctx.economia25Anos ? fmtCurrency(ctx.economia25Anos) : null;
  if (key === "financeiro.payback_anos") return ctx.paybackAnos ? fmtNumber(ctx.paybackAnos, 1) : null;
  if (key === "financeiro.payback_meses") return ctx.paybackAnos ? fmtNumber(ctx.paybackAnos * 12, 0) : null;
  if (key === "financeiro.preco_kwp") return (ctx.precoTotal && ctx.potenciaKwp) ? fmtCurrency(ctx.precoTotal / ctx.potenciaKwp) : null;
  if (key === "financeiro.preco_watt") return (ctx.precoTotal && ctx.potenciaKwp) ? `${fmtNumber(ctx.precoTotal / (ctx.potenciaKwp * 1000), 2)} R$/W` : null;

  // ── Financial Center costs (from VendaData) ──
  if (key === "financeiro.valor_kit" || key === "financeiro.custo_kit") {
    const custoKit = (ctx.venda as any)?.custo_kit_override > 0
      ? (ctx.venda as any).custo_kit_override
      : ((ctx.kit as any)?.itens as Array<Record<string, unknown>> | undefined)?.reduce(
          (s: number, i: Record<string, unknown>) => s + (Number(i.quantidade ?? 0) * Number(i.preco_unitario ?? 0)), 0
        ) ?? 0;
    return custoKit > 0 ? fmtCurrency(custoKit) : null;
  }
  if (key === "financeiro.valor_instalacao" || key === "financeiro.custo_instalacao_total") {
    return (ctx.venda as any)?.custo_instalacao > 0 ? fmtCurrency((ctx.venda as any).custo_instalacao) : null;
  }
  if (key === "financeiro.valor_comissao" || key === "financeiro.comissao_total") {
    return (ctx.venda as any)?.custo_comissao > 0 ? fmtCurrency((ctx.venda as any).custo_comissao) : null;
  }
  if (key === "financeiro.valor_outros_custos") {
    return (ctx.venda as any)?.custo_outros > 0 ? fmtCurrency((ctx.venda as any).custo_outros) : null;
  }
  if (key === "financeiro.valor_servicos") {
    const inst = Number((ctx.venda as any)?.custo_instalacao ?? 0);
    const outros = Number((ctx.venda as any)?.custo_outros ?? 0);
    return (inst + outros) > 0 ? fmtCurrency(inst + outros) : null;
  }
  if (key === "financeiro.margem_percentual") {
    return (ctx.venda as any)?.margem_percentual != null ? `${fmtNumber((ctx.venda as any).margem_percentual, 1)}%` : null;
  }
  if (key === "financeiro.margem_valor") {
    if (ctx.precoTotal != null && (ctx.venda as any)) {
      const v = ctx.venda as any;
      const custoTotal = (v.custo_instalacao ?? 0) + (v.custo_comissao ?? 0) + (v.custo_outros ?? 0) +
        (v.custo_kit_override > 0 ? v.custo_kit_override : ((ctx.kit as any)?.itens as Array<Record<string, unknown>> | undefined)?.reduce(
          (s: number, i: Record<string, unknown>) => s + (Number(i.quantidade ?? 0) * Number(i.preco_unitario ?? 0)), 0
        ) ?? 0);
      return fmtCurrency(ctx.precoTotal - custoTotal);
    }
    return null;
  }
  // AP-15: margem_real — markup sobre custo (paridade com backend resolveFinanceiro)
  if (key === "financeiro.margem_real") {
    if (ctx.precoTotal != null && (ctx.venda as any)) {
      const v = ctx.venda as any;
      const custoTotal = (v.custo_instalacao ?? 0) + (v.custo_comissao ?? 0) + (v.custo_outros ?? 0) +
        (v.custo_kit_override > 0 ? v.custo_kit_override : ((ctx.kit as any)?.itens as Array<Record<string, unknown>> | undefined)?.reduce(
          (s: number, i: Record<string, unknown>) => s + (Number(i.quantidade ?? 0) * Number(i.preco_unitario ?? 0)), 0
        ) ?? 0);
      if (custoTotal > 0) {
        const margemReal = ((ctx.precoTotal - custoTotal) / custoTotal) * 100;
        return `${fmtNumber(margemReal, 1)}%`;
      }
    }
    return null;
  }

  // ── Desconto (D1, QW4) ──
  if (key === "financeiro.desconto_percentual") {
    const dp = Number((ctx.venda as any)?.desconto_percentual ?? 0);
    return dp > 0 ? `${fmtNumber(dp, 1)}%` : "0,0%";
  }
  if (key === "financeiro.desconto_valor") {
    const dp2 = Number((ctx.venda as any)?.desconto_percentual ?? 0);
    if (dp2 > 0 && ctx.precoTotal != null) {
      // desconto_valor = precoComMargem * desconto / 100
      // precoTotal already includes discount via calcPrecoFinal — reverse to find pre-discount
      const precoPreDesconto = ctx.precoTotal / (1 - dp2 / 100);
      return fmtCurrency(Math.round(precoPreDesconto * dp2 / 100 * 100) / 100);
    }
    return "R$ 0,00";
  }

  // ── Comissão do consultor (D3) ──
  if (key === "financeiro.percentual_comissao") {
    const pc = Number((ctx.venda as any)?.percentual_comissao_consultor ?? 0);
    return `${fmtNumber(pc, 1)}%`;
  }
  if (key === "financeiro.consultor_comissao") {
    return s((ctx.venda as any)?.consultor_nome_comissao) ?? s(ctx.consultorNome) ?? "-";
  }


  if (kitItens && Array.isArray(kitItens)) {
    const findItem = (cat: string) => kitItens.find((i) => String(i.categoria || i.tipo || "").toLowerCase().includes(cat));
    const modulo = findItem("modulo") || findItem("painel") || findItem("placa");
    const inversor = findItem("inversor");

    if (key === "financeiro.modulo_custo_un") return modulo?.custo_unitario ? fmtCurrency(Number(modulo.custo_unitario)) : null;
    if (key === "financeiro.modulo_preco_un") return modulo?.preco_unitario ? fmtCurrency(Number(modulo.preco_unitario)) : null;
    if (key === "financeiro.modulo_custo_total") return (modulo?.custo_unitario && modulo?.quantidade) ? fmtCurrency(Number(modulo.custo_unitario) * Number(modulo.quantidade)) : null;
    if (key === "financeiro.modulo_preco_total") return (modulo?.preco_unitario && modulo?.quantidade) ? fmtCurrency(Number(modulo.preco_unitario) * Number(modulo.quantidade)) : null;
    if (key === "financeiro.inversor_custo_un") return inversor?.custo_unitario ? fmtCurrency(Number(inversor.custo_unitario)) : null;
    if (key === "financeiro.inversor_preco_un") return inversor?.preco_unitario ? fmtCurrency(Number(inversor.preco_unitario)) : null;
    if (key === "financeiro.inversor_custo_total") return (inversor?.custo_unitario && inversor?.quantidade) ? fmtCurrency(Number(inversor.custo_unitario) * Number(inversor.quantidade)) : null;
    if (key === "financeiro.inversor_preco_total") return (inversor?.preco_unitario && inversor?.quantidade) ? fmtCurrency(Number(inversor.preco_unitario) * Number(inversor.quantidade)) : null;
  }

  // Financiamento from pagamento opcoes
  if (ctx.pagamentoOpcoes && ctx.pagamentoOpcoes.length > 0) {
    const pOps = ctx.pagamentoOpcoes;
    // Financeira ativa (first financiamento)
    const finAtiva = pOps.find((p) => (p as any).tipo?.toLowerCase?.()?.includes("financ"));
    if (key === "customizada.vc_financeira_nome") return s((finAtiva as any)?.nome ?? (finAtiva as any)?.banco);

    // vc_nome = client name (not financing)
    if (key === "customizada.vc_nome") return s(ctx.cliente?.nome);

    // Indexed financing variables
    const fins = pOps.filter((p) =>
      (p as any).tipo?.toLowerCase?.()?.includes("financ") ||
      (p as any).tipo?.toLowerCase?.()?.includes("parcel")
    );
    for (let i = 0; i < Math.min(fins.length, 3); i++) {
      const f = fins[i] as any;
      if (key === `customizada.vc_parcela_${i + 1}`) return f.valor_parcela ? fmtCurrency(Number(f.valor_parcela)) : null;
      if (key === `customizada.vc_taxa_${i + 1}`) return f.taxa_mensal ? `${fmtNumber(Number(f.taxa_mensal), 2)}%` : null;
      if (key === `customizada.vc_prazo_${i + 1}`) return f.num_parcelas ? String(f.num_parcelas) : null;
      if (key === `customizada.vc_entrada_${i + 1}`) return f.entrada ? fmtCurrency(Number(f.entrada)) : null;
    }

    // f_* indexed
    const allOps = [...pOps] as any[];
    for (let i = 0; i < Math.min(allOps.length, 5); i++) {
      const p = allOps[i];
      if (key === `financeiro.f_nome_${i + 1}`) return s(p.nome ?? p.banco);
      if (key === `financeiro.f_parcela_${i + 1}`) return p.valor_parcela ? fmtCurrency(Number(p.valor_parcela)) : null;
      if (key === `financeiro.f_taxa_${i + 1}`) return p.taxa_mensal ? `${fmtNumber(Number(p.taxa_mensal), 2)}%` : null;
      if (key === `financeiro.f_prazo_${i + 1}`) return p.num_parcelas ? String(p.num_parcelas) : null;
      if (key === `financeiro.f_entrada_${i + 1}`) return p.entrada ? fmtCurrency(Number(p.entrada)) : null;
      if (key === `financeiro.f_valor_${i + 1}`) return p.valor_financiado ? fmtCurrency(Number(p.valor_financiado)) : null;
    }

    // f_ativo_* (first active financing)
    if (finAtiva) {
      const fa = finAtiva as any;
      if (key === "financeiro.f_ativo_nome") return s(fa.nome ?? fa.banco);
      if (key === "financeiro.f_ativo_parcela") return fa.valor_parcela ? fmtCurrency(Number(fa.valor_parcela)) : null;
      if (key === "financeiro.f_ativo_taxa") return fa.taxa_mensal ? `${fmtNumber(Number(fa.taxa_mensal), 2)}%` : null;
      if (key === "financeiro.f_ativo_prazo") return fa.num_parcelas ? String(fa.num_parcelas) : null;
      if (key === "financeiro.f_ativo_entrada") return fa.entrada ? fmtCurrency(Number(fa.entrada)) : null;
      if (key === "financeiro.f_ativo_valor") return fa.valor_financiado ? fmtCurrency(Number(fa.valor_financiado)) : null;
    }

    // à vista
    const aVista = pOps.find((p) => (p as any).tipo?.toLowerCase?.()?.includes("vista"));
    if (key === "customizada.vc_a_vista") return aVista ? fmtCurrency(Number((aVista as any).valor ?? ctx.precoTotal)) : (ctx.precoTotal ? fmtCurrency(ctx.precoTotal) : null);
  } else {
    // vc_nome fallback when no pagamento opcoes
    if (key === "customizada.vc_nome") return s(ctx.cliente?.nome);
    if (key === "customizada.vc_a_vista") return ctx.precoTotal ? fmtCurrency(ctx.precoTotal) : null;
  }

  // ── Conta Energia ──
  if (key === "conta_energia.co2_evitado_ano") return ctx.co2Evitado ? fmtNumber(ctx.co2Evitado, 0) : null;
  // Try to resolve conta_energia fields from gdResult
  if (key === "conta_energia.gasto_atual_mensal" && ctx.gdResult) {
    const consumo = ctx.gdResult.consumo_kwh;
    const tarifa = (ctx.gdResult.valor_credito_breakdown as any)?.tarifa_energia ?? ctx.gdResult.valor_credito_breakdown?.te;
    if (consumo && tarifa) return fmtCurrency(consumo * tarifa);
  }
  if (key === "conta_energia.economia_percentual" && ctx.economiaMensal && ctx.gdResult) {
    const tarifa = (ctx.gdResult.valor_credito_breakdown as any)?.tarifa_energia ?? ctx.gdResult.valor_credito_breakdown?.te ?? 0;
    const gastoAtual = ctx.gdResult.consumo_kwh * tarifa;
    if (gastoAtual > 0) return `${fmtNumber((ctx.economiaMensal / gastoAtual) * 100, 0)}%`;
  }

  // ── Extras override ──
  if (ctx.extras && key in ctx.extras) return String(ctx.extras[key]);

  return null;
}

// ── Required keys (variáveis que DEVEM existir para gerar PDF) ──
// Sprint atual: template-only permitido, portanto nenhuma variável bloqueia geração.
const REQUIRED_KEYS = new Set<string>();

// ── Main resolver ────────────────────────────────────────────

export function resolveProposalVariables(
  ctx: ProposalResolverContext
): ResolverResult {
  // Diagnostic: log key financial inputs
  console.debug("[resolveProposalVariables] precoTotal:", ctx.precoTotal, "type:", typeof ctx.precoTotal, "isNaN:", isNaN(ctx.precoTotal as number));
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
