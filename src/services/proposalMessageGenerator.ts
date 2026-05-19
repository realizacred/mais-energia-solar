/**
 * proposalMessageGenerator.ts
 * 
 * Gera mensagens textuais da proposta para envio a cliente ou consultor.
 * Usa sistema de templates com placeholders {{var}} para permitir
 * configuração por tenant.
 * 
 * Arquitetura:
 * - templates customizáveis por tenant (tabela: proposal_message_config)
 * - blocos configuráveis com templates próprios
 * - estilos e canais configuráveis
 */

import { formatBRL, formatNumberBR } from "@/lib/formatters";
import { getPublicUrl } from "@/lib/getPublicUrl";
import { formatTaxaMensal } from "@/services/paymentComposition/financingMath";
import { SYSTEM_DEFAULT_BLOCKS, type BlockConfig } from "@/hooks/useProposalMessageConfig";

// ─── Types ──────────────────────────────────────────

export type MessageMode = "cliente" | "consultor";
export type MessageStyle = "curta" | "completa";

export interface ProposalMessageContext {
  clienteNome: string | null;
  potenciaKwp: number | null;
  modulosQtd: number | null;
  moduloPotenciaW: number | null;
  moduloModelo: string | null;
  inversorModelo: string | null;
  consumoMensal: number | null;
  geracaoMensal: number | null;
  economiaMensal: number | null;
  paybackMeses: number | null;
  valorTotal: number | null;
  linkProposta: string | null;
  linkPdf: string | null;
  tipoTelhado: string | null;
  distribuidora: string | null;
  consultorNome: string | null;
  empresaNome: string | null;
  validadeDias: number | null;
  pagamentoOpcoes: Array<{
    nome: string;
    tipo?: string | null;
    entrada?: number | null;
    parcelas?: number | null;
    valor_parcela?: number | null;
    taxa_mensal?: number | null;
    valor_financiado?: number | null;
    carencia_meses?: number | null;
  }>;
  itensInclusos: Array<{
    descricao: string;
    quantidade: number;
    categoria: string;
  }>;
  servicos: Array<{
    descricao: string;
    valor: number;
    incluso?: boolean;
  }>;
  propostaStatus: string;
  propostaCodigo: string | null;
}

export interface GenerateOptions {
  /** Custom template override from tenant config */
  customTemplate?: string;
  /** Blocks config from tenant — controls which blocks appear and their templates */
  blocksConfig?: Record<string, BlockConfig>;
}

// ─── Template Definitions ───────────────────────────
// Default templates — overridden per tenant via proposal_message_config

export const DEFAULT_TEMPLATES: Record<`${MessageMode}_${MessageStyle}`, string> = {
  cliente_curta: [
    "{{bloco_saudacao}}",
    "",
    "Sua proposta de energia solar está pronta! ☀️",
    "",
    "{{bloco_investimento}}",
    "📊 Economia estimada: {{economia_mensal}}/mês",
    "{{bloco_consumo_geracao}}", // Mostra payback se habilitado
    "",
    "{{bloco_link_proposta}}",
    "",
    "Qualquer dúvida, estou à disposição!",
    "{{bloco_assinatura}}",
  ].join("\n"),

  cliente_completa: [
    "{{bloco_saudacao}}",
    "",
    "É com satisfação que apresento sua proposta de energia solar. Confira os detalhes abaixo:",
    "",
    "━━━ *{{titulo_sistema_solar}}* ━━━",
    "{{bloco_resumo_tecnico}}",
    "",
    "━━━ *{{titulo_consumo_geracao}}* ━━━",
    "{{bloco_consumo_geracao}}",
    "",
    "━━━ *{{titulo_investimento}}* ━━━",
    "{{bloco_investimento}}",
    "{{bloco_pagamento}}",
    "",
    "{{bloco_itens_inclusos}}",
    "{{bloco_servicos}}",
    "{{bloco_garantias}}",
    "",
    "{{bloco_link_proposta}}",
    "",
    "{{bloco_validade}}",
    "",
    "Estou à disposição para esclarecer qualquer dúvida!",
    "{{bloco_assinatura}}",
  ].join("\n"),

  consultor_curta: [
    "📋 *Resumo da Proposta* — {{proposta_codigo}}",
    "",
    "👤 Cliente: {{cliente_nome}}",
    "{{bloco_resumo_tecnico}}",
    "{{bloco_investimento}}",
    "📊 Economia: {{economia_mensal}}/mês",
    "📌 Status: {{status}}",
    "{{bloco_link_proposta}}",
  ].join("\n"),

  consultor_completa: [
    "📋 *Proposta — Resumo Interno* — {{proposta_codigo}}",
    "",
    "👤 *Cliente:* {{cliente_nome}}",
    "🏢 Distribuidora: {{distribuidora}}",
    "",
    "━━━ *{{titulo_dimensionamento}}* ━━━",
    "{{bloco_resumo_tecnico}}",
    "",
    "━━━ *{{titulo_financeiro}}* ━━━",
    "{{bloco_consumo_geracao}}",
    "{{bloco_investimento}}",
    "{{bloco_pagamento}}",
    "",
    "📌 *Status:* {{status}}",
    "{{bloco_link_proposta}}",
  ].join("\n"),
};

// ─── Block Resolvers ────────────────────────────────

/** Resolves complex values used in block templates */
function resolveBlockSubVariables(ctx: ProposalMessageContext): Record<string, string> {
  const vars: Record<string, string> = {};

  // Payback info
  if (ctx.paybackMeses && ctx.paybackMeses > 0) {
    const anos = Math.floor(ctx.paybackMeses / 12);
    const meses = ctx.paybackMeses % 12;
    vars.payback_info = anos > 0
      ? (meses > 0 ? `${anos} ano${anos > 1 ? "s" : ""} e ${meses} ${meses > 1 ? "meses" : "mês"}` : `${anos} ano${anos > 1 ? "s" : ""}`)
      : `${meses} ${meses > 1 ? "meses" : "mês"}`;
  } else {
    vars.payback_info = "—";
  }

  // Pagamento detalhes
  if (ctx.pagamentoOpcoes.length > 0) {
    const aVista = ctx.pagamentoOpcoes.filter(op => op.tipo === "a_vista");
    const financiamentos = ctx.pagamentoOpcoes.filter(op => op.tipo === "financiamento");
    const parcelados = ctx.pagamentoOpcoes.filter(op => op.tipo === "parcelado");
    const outros = ctx.pagamentoOpcoes.filter(op => !op.tipo || op.tipo === "outro");

    const sections: string[] = [];
    if (aVista.length > 0) {
      aVista.forEach(op => {
        let line = `💵 *À Vista*`;
        if (op.entrada) line += ` — ${formatBRL(op.entrada)}`;
        sections.push(line);
      });
    }
    if (financiamentos.length > 0) {
      const byBank = new Map<string, typeof financiamentos>();
      financiamentos.forEach(op => {
        const key = op.nome || "Financiamento";
        if (!byBank.has(key)) byBank.set(key, []);
        byBank.get(key)!.push(op);
      });
      byBank.forEach((plans, bankName) => {
        sections.push(`🏦 *${bankName}:*`);
        plans.forEach(op => {
          const parts: string[] = [];
          if (op.entrada) parts.push(`Entrada: ${formatBRL(op.entrada)}`);
          if (op.parcelas && op.valor_parcela) parts.push(`${op.parcelas}x de ${formatBRL(op.valor_parcela)}`);
          if (op.taxa_mensal) parts.push(`Taxa: ${formatTaxaMensal(op.taxa_mensal)} a.m.`);
          sections.push(`  • ${parts.join(" | ")}`);
        });
      });
    }
    // ... other options
    vars.pagamento_detalhes = sections.join("\n");
  } else {
    vars.pagamento_detalhes = "A combinar";
  }

  // Lista Itens
  const itens = ctx.itensInclusos.filter(i => i.quantidade > 0);
  vars.lista_itens = itens.length > 0 ? itens.map(i => `• ${i.quantidade}x ${i.descricao}`).join("\n") : "Equipamentos padrão";

  // Lista Serviços
  const servicos = ctx.servicos.filter(s => s.incluso !== false);
  vars.lista_servicos = servicos.length > 0 ? servicos.map(s => `• ${s.descricao}${s.valor > 0 ? ` (${formatBRL(s.valor)})` : ""}`).join("\n") : "Instalação completa";

  // Garantias
  const snap = (ctx as any)?._snapshot;
  vars.modulo_garantia = snap?.modulo_garantia_performance || snap?.modulo_garantia || "—";
  vars.inversor_garantia = snap?.inversor_garantia || "—";
  vars.instalacao_garantia = snap?.instalacao_garantia || "—";

  return vars;
}

/**
 * Checks if a block is enabled for the given mode/style.
 */
function isBlockEnabled(
  blockKey: string,
  mode: MessageMode,
  style: MessageStyle,
  blocksConfig?: Record<string, BlockConfig>,
): boolean {
  const cfg = blocksConfig ? blocksConfig[blockKey] : SYSTEM_DEFAULT_BLOCKS[blockKey];
  if (!cfg) return true;
  if (!cfg.enabled) return false;
  if (cfg.modes && cfg.modes.length > 0 && !cfg.modes.includes(mode)) return false;
  if (cfg.styles && cfg.styles.length > 0 && !cfg.styles.includes(style)) return false;
  return true;
}

// ─── Main Generator ─────────────────────────────────

export function generateProposalMessage(
  ctx: ProposalMessageContext,
  mode: MessageMode,
  style: MessageStyle,
  options?: GenerateOptions,
): string {
  const { customTemplate, blocksConfig } = options || {};
  const templateKey = `${mode}_${style}` as const;
  const template = customTemplate || DEFAULT_TEMPLATES[templateKey];

  // Base variable map
  const vars: Record<string, string> = {
    cliente_nome: ctx.clienteNome || "Cliente",
    potencia_kwp: ctx.potenciaKwp ? formatNumberBR(ctx.potenciaKwp) : "—",
    modulos_qtd: ctx.modulosQtd != null ? ctx.modulosQtd.toString() : "—",
    modulo_potencia: ctx.moduloPotenciaW ? `${ctx.moduloPotenciaW}W` : "—",
    modulo_modelo: ctx.moduloModelo || "—",
    inversor_modelo: ctx.inversorModelo || "—",
    consumo_mensal: ctx.consumoMensal != null ? formatNumberBR(ctx.consumoMensal) : "—",
    geracao_mensal: ctx.geracaoMensal ? formatNumberBR(ctx.geracaoMensal) : "—",
    economia_mensal: ctx.economiaMensal ? formatBRL(ctx.economiaMensal) : "—",
    valor_total: ctx.valorTotal ? formatBRL(ctx.valorTotal) : "—",
    link_proposta: ctx.linkProposta || "",
    proposta_link: ctx.linkProposta || "",
    link_pdf: ctx.linkPdf || "",
    pdf_link: ctx.linkPdf || "",
    status: ctx.propostaStatus || "—",
    consultor_nome: ctx.consultorNome || "",
    empresa_nome: ctx.empresaNome || "",
    validade_dias: ctx.validadeDias?.toString() || "—",
    proposta_codigo: ctx.propostaCodigo || "—",
    distribuidora: ctx.distribuidora || "—",
    tipo_telhado: ctx.tipoTelhado || "—",
    // Enterprise Titles
    titulo_sistema_solar: blocksConfig?.resumo_tecnico?.title || "Sistema Solar",
    titulo_consumo_geracao: blocksConfig?.consumo_geracao?.title || "Consumo e Geração",
    titulo_investimento: blocksConfig?.investimento?.title || "Investimento",
    titulo_dimensionamento: blocksConfig?.resumo_tecnico?.title || "Dimensionamento",
    titulo_financeiro: blocksConfig?.investimento?.title || "Financeiro",
  };

  // Sub-variables for complex blocks
  const subVars = resolveBlockSubVariables(ctx);
  const allAvailableVars = { ...vars, ...subVars };

  // Render blocks
  const blockResults: Record<string, string> = {};
  const blockKeys = Object.keys(SYSTEM_DEFAULT_BLOCKS);

  for (const blockKey of blockKeys) {
    if (isBlockEnabled(blockKey, mode, style, blocksConfig)) {
      const cfg = blocksConfig?.[blockKey] || SYSTEM_DEFAULT_BLOCKS[blockKey];
      const blockTemplate = cfg.template || SYSTEM_DEFAULT_BLOCKS[blockKey].template || "";
      
      // Render the block template with all available variables
      let rendered = blockTemplate.replace(/\{\{(\w+)\}\}/g, (_match, key) => allAvailableVars[key] ?? "");
      
      // Add optional prefix
      if (cfg.prefix) {
        rendered = `${cfg.prefix} ${rendered}`;
      }

      blockResults[`bloco_${blockKey}`] = rendered;
    } else {
      blockResults[`bloco_${blockKey}`] = "";
    }
  }

  // Final merge
  const finalReplacementMap = { ...allAvailableVars, ...blockResults };

  // Replace placeholders in the main template
  let result = template.replace(/\{\{(\w+)\}\}/g, (_match, key) => finalReplacementMap[key] ?? "");

  // Clean up: remove excessive empty lines
  result = result.replace(/\n{3,}/g, "\n\n").trim();

  return result;
}

// ─── Context Extractor ──────────────────────────────

export function extractMessageContext(
  snapshot: any,
  versao: {
    valor_total: number | null;
    potencia_kwp: number | null;
    economia_mensal: number | null;
    payback_meses: number | null;
    geracao_mensal: number | null;
    public_slug: string | null;
  },
  proposta: {
    cliente_nome: string | null;
    codigo: string | null;
    status: string;
  },
): ProposalMessageContext {
  const snap = snapshot || {};

  const itens = snap.itens || [];
  const isModulo = (i: any) => {
    const c = String(i.categoria || i.tipo || i.tipo_item || "").toLowerCase();
    return c === "modulo" || c === "modulos" || c === "módulo" || c === "módulos";
  };
  const isInversor = (i: any) => {
    const c = String(i.categoria || i.tipo || i.tipo_item || "").toLowerCase();
    return c === "inversor" || c === "inversores";
  };
  
  const modulos = itens.filter(isModulo);
  const inversores = itens.filter(isInversor);

  const modulosQtdSum = modulos.reduce((s: number, m: any) => s + (Number(m.quantidade) || 0), 0);
  const modulosQtd = modulosQtdSum > 0 ? modulosQtdSum : (snap.numero_modulos ?? snap.quantidade_modulos ?? null);

  const moduloPotencia = modulos[0]?.potencia_w || null;
  const moduloModelo = modulos[0] ? `${modulos[0].fabricante || ""} ${modulos[0].modelo || modulos[0].descricao || ""}`.trim() : null;
  const inversorModelo = inversores[0] ? `${inversores[0].fabricante || ""} ${inversores[0].modelo || inversores[0].descricao || ""}`.trim() : null;

  const ucs = snap.ucs || [];
  const consumoSum = ucs.reduce((s: number, uc: any) => s + (Number(uc.consumo_mensal_kwh ?? uc.consumo_mensal) || 0), 0);
  const consumoMensal = ucs.length > 0 ? consumoSum : (snap.consumo_mensal ?? null);

  const pagOpcoes = snap.pagamentoOpcoes || snap.pagamento_opcoes || [];
  const servicos = snap.servicos || [];

  const publicSlug = versao.public_slug;
  const linkProposta = publicSlug ? `${getPublicUrl()}/pl/${publicSlug}` : null;
  const linkPdf = publicSlug ? `${getPublicUrl()}/p/pdf/${publicSlug}` : null;

  const result: ProposalMessageContext & { _snapshot?: any } = {
    clienteNome: proposta.cliente_nome || snap.cliente_nome || null,
    potenciaKwp: versao.potencia_kwp || snap.potencia_kwp || null,
    modulosQtd: modulosQtd != null ? Number(modulosQtd) : null,
    moduloPotenciaW: moduloPotencia,
    moduloModelo,
    inversorModelo,
    consumoMensal: consumoMensal != null ? Number(consumoMensal) : null,
    geracaoMensal: versao.geracao_mensal || snap.geracao_mensal || null,
    economiaMensal: versao.economia_mensal || snap.economia_mensal || null,
    paybackMeses: versao.payback_meses || snap.payback_meses || null,
    valorTotal: versao.valor_total || snap.valor_total || null,
    linkProposta,
    linkPdf,
    tipoTelhado: snap.locTipoTelhado || snap.loc_tipo_telhado || snap.tipo_telhado || null,
    distribuidora: snap.locDistribuidoraNome || snap.loc_distribuidora_nome || snap.distribuidora || null,
    consultorNome: snap.consultor_nome || null,
    empresaNome: snap.empresa_nome || null,
    validadeDias: snap.validade_dias || null,
    pagamentoOpcoes: pagOpcoes.map((op: any) => ({
      nome: op.nome || "",
      tipo: op.tipo || null,
      entrada: op.entrada || null,
      parcelas: op.parcelas || op.num_parcelas || null,
      valor_parcela: op.valor_parcela || null,
      taxa_mensal: op.taxa_mensal || null,
      valor_financiado: op.valor_financiado || null,
      carencia_meses: op.carencia_meses || null,
    })),
    itensInclusos: itens.map((i: any) => ({
      descricao: `${i.fabricante || ""} ${i.modelo || i.descricao || ""}`.trim(),
      quantidade: i.quantidade || 1,
      categoria: i.categoria || "outros",
    })),
    servicos: servicos.map((s: any) => ({
      descricao: s.descricao || s.nome || "",
      valor: s.valor || 0,
      incluso: s.incluso,
    })),
    propostaStatus: proposta.status,
    propostaCodigo: proposta.codigo,
    _snapshot: snap,
  };

  return result as ProposalMessageContext;
}
