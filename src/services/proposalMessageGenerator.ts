/**
 * proposalMessageGenerator.ts
 * 
 * Gera mensagens textuais da proposta para envio a cliente ou consultor.
 * Usa sistema de templates com placeholders {{var}} para permitir
 * configuração por tenant.
 * 
 * Arquitetura:
 * - templates customizáveis por tenant (tabela: proposal_message_config)
 * - blocos configuráveis (habilitado/desabilitado por tenant)
 * - estilos e canais configuráveis
 */

import { formatBRL, formatNumberBR } from "@/lib/formatters";
import { formatTaxaMensal } from "@/services/paymentComposition/financingMath";
import type { BlockConfig } from "@/hooks/useProposalMessageConfig";

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
  /** Blocks config from tenant — controls which blocks appear */
  blocksConfig?: Record<string, BlockConfig>;
}

// ─── Template Definitions ───────────────────────────
// Default templates — overridden per tenant via proposal_message_config

const TEMPLATES: Record<`${MessageMode}_${MessageStyle}`, string> = {
  cliente_curta: [
    "Olá, {{cliente_nome}}! 👋",
    "",
    "Sua proposta de energia solar está pronta! ☀️",
    "",
    "⚡ Sistema de {{potencia_kwp}} kWp",
    "💰 Investimento: {{valor_total}}",
    "📊 Economia estimada: {{economia_mensal}}/mês",
    "{{bloco_payback}}",
    "",
    "{{bloco_link}}",
    "",
    "Qualquer dúvida, estou à disposição!",
    "{{assinatura}}",
  ].join("\n"),

  cliente_completa: [
    "Olá, {{cliente_nome}}! 👋",
    "",
    "É com satisfação que apresento sua proposta de energia solar. Confira os detalhes abaixo:",
    "",
    "━━━ *Sistema Solar* ━━━",
    "⚡ Potência: {{potencia_kwp}} kWp",
    "🔋 {{modulos_qtd}} módulos{{bloco_modulo_modelo}}",
    "{{bloco_inversor}}",
    "{{bloco_telhado}}",
    "",
    "━━━ *Consumo e Geração* ━━━",
    "📊 Consumo mensal: {{consumo_mensal}} kWh",
    "☀️ Geração estimada: {{geracao_mensal}} kWh/mês",
    "{{bloco_economia}}",
    "{{bloco_payback}}",
    "",
    "━━━ *Investimento* ━━━",
    "💰 Valor total: {{valor_total}}",
    "{{bloco_pagamento}}",
    "",
    "{{bloco_itens_inclusos}}",
    "{{bloco_servicos}}",
    "{{bloco_garantias}}",
    "",
    "{{bloco_link}}",
    "",
    "{{bloco_validade}}",
    "",
    "Estou à disposição para esclarecer qualquer dúvida!",
    "{{assinatura}}",
  ].join("\n"),

  consultor_curta: [
    "📋 *Resumo da Proposta*{{bloco_codigo}}",
    "",
    "👤 Cliente: {{cliente_nome}}",
    "⚡ {{potencia_kwp}} kWp • {{modulos_qtd}} módulos",
    "💰 {{valor_total}}",
    "📊 Economia: {{economia_mensal}}/mês",
    "{{bloco_payback}}",
    "📌 Status: {{status}}",
    "{{bloco_link}}",
  ].join("\n"),

  consultor_completa: [
    "📋 *Proposta — Resumo Interno*{{bloco_codigo}}",
    "",
    "👤 *Cliente:* {{cliente_nome}}",
    "{{bloco_distribuidora}}",
    "{{bloco_telhado}}",
    "",
    "━━━ *Dimensionamento* ━━━",
    "⚡ Potência: {{potencia_kwp}} kWp",
    "🔋 {{modulos_qtd}} módulos{{bloco_modulo_modelo}}",
    "{{bloco_inversor}}",
    "",
    "━━━ *Financeiro* ━━━",
    "📊 Consumo: {{consumo_mensal}} kWh/mês",
    "☀️ Geração: {{geracao_mensal}} kWh/mês",
    "💰 Valor total: {{valor_total}}",
    "{{bloco_economia}}",
    "{{bloco_payback}}",
    "{{bloco_pagamento}}",
    "",
    "📌 *Status:* {{status}}",
    "{{bloco_link}}",
  ].join("\n"),
};

// ─── Block-to-bloco mapping ────────────────────────
// Maps block config keys to the bloco_ keys used in templates

const BLOCK_KEY_MAP: Record<string, string[]> = {
  saudacao: [],
  resumo_tecnico: ["bloco_inversor", "bloco_modulo_modelo", "bloco_telhado"],
  consumo_geracao: ["bloco_economia"],
  garantias: ["bloco_garantias"],
  investimento: [],
  pagamento: ["bloco_pagamento"],
  itens_inclusos: ["bloco_itens_inclusos"],
  servicos: ["bloco_servicos"],
  oferta_especial: [],
  link_proposta: ["bloco_link"],
  validade: ["bloco_validade"],
  assinatura: ["assinatura"],
};

// ─── Block Resolvers ────────────────────────────────

function resolveBlocks(ctx: ProposalMessageContext): Record<string, string> {
  const blocks: Record<string, string> = {};

  // Payback
  if (ctx.paybackMeses && ctx.paybackMeses > 0) {
    const anos = Math.floor(ctx.paybackMeses / 12);
    const meses = ctx.paybackMeses % 12;
    const paybackStr = anos > 0
      ? (meses > 0 ? `${anos} ano${anos > 1 ? "s" : ""} e ${meses} mês${meses > 1 ? "es" : ""}` : `${anos} ano${anos > 1 ? "s" : ""}`)
      : `${meses} mês${meses > 1 ? "es" : ""}`;
    blocks.bloco_payback = `⏱️ Retorno do investimento: ${paybackStr}`;
  } else {
    blocks.bloco_payback = "";
  }

  // Economia
  if (ctx.economiaMensal && ctx.economiaMensal > 0) {
    blocks.bloco_economia = `💵 Economia mensal estimada: ${formatBRL(ctx.economiaMensal)}`;
  } else {
    blocks.bloco_economia = "";
  }

  // Link
  if (ctx.linkProposta) {
    blocks.bloco_link = `🔗 Acesse sua proposta: ${ctx.linkProposta}`;
  } else {
    blocks.bloco_link = "";
  }

  // Inversor
  if (ctx.inversorModelo) {
    blocks.bloco_inversor = `🔌 Inversor: ${ctx.inversorModelo}`;
  } else {
    blocks.bloco_inversor = "";
  }

  // Modelo do módulo
  if (ctx.moduloModelo) {
    blocks.bloco_modulo_modelo = ` (${ctx.moduloModelo})`;
  } else {
    blocks.bloco_modulo_modelo = "";
  }

  // Telhado
  if (ctx.tipoTelhado) {
    blocks.bloco_telhado = `🏠 Telhado: ${ctx.tipoTelhado}`;
  } else {
    blocks.bloco_telhado = "";
  }

  // Distribuidora
  if (ctx.distribuidora) {
    blocks.bloco_distribuidora = `🏢 Distribuidora: ${ctx.distribuidora}`;
  } else {
    blocks.bloco_distribuidora = "";
  }

  // Código
  if (ctx.propostaCodigo) {
    blocks.bloco_codigo = ` — ${ctx.propostaCodigo}`;
  } else {
    blocks.bloco_codigo = "";
  }

  // Pagamento — agrupa por tipo e mostra detalhes completos
  if (ctx.pagamentoOpcoes.length > 0) {
    const aVista = ctx.pagamentoOpcoes.filter(op => op.tipo === "a_vista");
    const financiamentos = ctx.pagamentoOpcoes.filter(op => op.tipo === "financiamento");
    const parcelados = ctx.pagamentoOpcoes.filter(op => op.tipo === "parcelado");
    const outros = ctx.pagamentoOpcoes.filter(op => !op.tipo || op.tipo === "outro");

    const sections: string[] = [];

    // À Vista
    if (aVista.length > 0) {
      aVista.forEach(op => {
        let line = `💵 *À Vista*`;
        if (op.entrada) line += ` — ${formatBRL(op.entrada)}`;
        sections.push(line);
      });
    }

    // Financiamentos — agrupa por banco, mostra cada plano
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
          if (op.parcelas && op.valor_parcela) {
            parts.push(`${op.parcelas}x de ${formatBRL(op.valor_parcela)}`);
          }
          if (op.taxa_mensal && op.taxa_mensal > 0) {
            parts.push(`Taxa: ${formatTaxaMensal(op.taxa_mensal)} a.m.`);
          }
          if (op.carencia_meses && op.carencia_meses > 0) {
            parts.push(`Carência: ${op.carencia_meses} meses`);
          }
          sections.push(`  • ${parts.join(" | ") || "Consultar condições"}`);
        });
      });
    }

    // Parcelados
    if (parcelados.length > 0) {
      sections.push(`💳 *Parcelamento direto:*`);
      parcelados.forEach(op => {
        const parts: string[] = [];
        if (op.nome) parts.push(op.nome);
        if (op.entrada) parts.push(`Entrada: ${formatBRL(op.entrada)}`);
        if (op.parcelas && op.valor_parcela) {
          parts.push(`${op.parcelas}x de ${formatBRL(op.valor_parcela)}`);
        }
        sections.push(`  • ${parts.join(" — ")}`);
      });
    }

    // Outros
    if (outros.length > 0) {
      outros.forEach(op => {
        let line = `• ${op.nome || "Outra opção"}`;
        if (op.entrada) line += ` — Entrada: ${formatBRL(op.entrada)}`;
        if (op.parcelas && op.valor_parcela) {
          line += ` + ${op.parcelas}x de ${formatBRL(op.valor_parcela)}`;
        }
        sections.push(line);
      });
    }

    blocks.bloco_pagamento = `\n💳 *Pagamento:*\n${sections.join("\n")}`;
  } else {
    blocks.bloco_pagamento = "";
  }

  // Itens inclusos
  const itens = ctx.itensInclusos.filter(i => i.quantidade > 0);
  if (itens.length > 0) {
    const lines = itens.map(i => `• ${i.quantidade}x ${i.descricao}`);
    blocks.bloco_itens_inclusos = `📦 *Itens inclusos:*\n${lines.join("\n")}`;
  } else {
    blocks.bloco_itens_inclusos = "";
  }

  // Serviços
  const servicosInclusos = ctx.servicos.filter(s => s.incluso !== false);
  if (servicosInclusos.length > 0) {
    const lines = servicosInclusos.map(s => `• ${s.descricao}${s.valor > 0 ? ` (${formatBRL(s.valor)})` : " — Incluso"}`);
    blocks.bloco_servicos = `🛠️ *Serviços:*\n${lines.join("\n")}`;
  } else {
    blocks.bloco_servicos = "";
  }

  // Garantias — uses snapshot data when available, omits block if no data
  blocks.bloco_garantias = "";
  // Check for warranty data in context (populated from snapshot enrichment)
  const garantiasLines: string[] = [];
  const snap = (ctx as any)?._snapshot;
  const moduloGarantia = snap?.modulo_garantia_performance || snap?.modulo_garantia || null;
  const inversorGarantia = snap?.inversor_garantia || null;
  const instalacaoGarantia = snap?.instalacao_garantia || null;
  if (moduloGarantia) garantiasLines.push(`• Módulos: ${moduloGarantia}`);
  if (inversorGarantia) garantiasLines.push(`• Inversor: ${inversorGarantia}`);
  if (instalacaoGarantia) garantiasLines.push(`• Instalação: ${instalacaoGarantia}`);
  if (garantiasLines.length > 0) {
    blocks.bloco_garantias = `✅ *Garantias:*\n${garantiasLines.join("\n")}`;
  }

  // Validade
  if (ctx.validadeDias && ctx.validadeDias > 0) {
    blocks.bloco_validade = `⏰ Proposta válida por ${ctx.validadeDias} dias.`;
  } else {
    blocks.bloco_validade = "";
  }

  // Assinatura
  if (ctx.consultorNome && ctx.empresaNome) {
    blocks.assinatura = `${ctx.consultorNome}\n${ctx.empresaNome}`;
  } else if (ctx.consultorNome) {
    blocks.assinatura = ctx.consultorNome;
  } else if (ctx.empresaNome) {
    blocks.assinatura = ctx.empresaNome;
  } else {
    blocks.assinatura = "";
  }

  return blocks;
}

/**
 * Checks if a block is enabled for the given mode/style.
 * If no blocksConfig provided, all blocks are considered enabled (system default).
 */
function isBlockEnabled(
  blockKey: string,
  mode: MessageMode,
  style: MessageStyle,
  blocksConfig?: Record<string, BlockConfig>,
): boolean {
  if (!blocksConfig) return true;
  const cfg = blocksConfig[blockKey];
  if (!cfg) return true; // unknown block = enabled by default
  if (!cfg.enabled) return false;
  // Check mode/style applicability
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
  const template = customTemplate || TEMPLATES[templateKey];

  // Build variable map
  const vars: Record<string, string> = {
    cliente_nome: ctx.clienteNome || "Cliente",
    potencia_kwp: ctx.potenciaKwp ? formatNumberBR(ctx.potenciaKwp) : "—",
    modulos_qtd: ctx.modulosQtd?.toString() || "—",
    modulo_potencia: ctx.moduloPotenciaW ? `${ctx.moduloPotenciaW}W` : "—",
    modulo_modelo: ctx.moduloModelo || "—",
    inversor_modelo: ctx.inversorModelo || "—",
    consumo_mensal: ctx.consumoMensal ? formatNumberBR(ctx.consumoMensal) : "—",
    geracao_mensal: ctx.geracaoMensal ? formatNumberBR(ctx.geracaoMensal) : "—",
    economia_mensal: ctx.economiaMensal ? formatBRL(ctx.economiaMensal) : "—",
    valor_total: ctx.valorTotal ? formatBRL(ctx.valorTotal) : "—",
    link_proposta: ctx.linkProposta || "",
    status: ctx.propostaStatus || "—",
    consultor_nome: ctx.consultorNome || "",
    empresa_nome: ctx.empresaNome || "",
  };

  // Resolve blocks
  const blocks = resolveBlocks(ctx);

  // Apply blocks_config — zero out disabled blocks
  if (blocksConfig) {
    for (const [configKey, blocoKeys] of Object.entries(BLOCK_KEY_MAP)) {
      if (!isBlockEnabled(configKey, mode, style, blocksConfig)) {
        for (const bk of blocoKeys) {
          blocks[bk] = "";
        }
      }
    }
  }

  // Merge all into replacement map
  const allVars = { ...vars, ...blocks };

  // Replace placeholders
  let result = template.replace(/\{\{(\w+)\}\}/g, (_match, key) => allVars[key] ?? "");

  // Clean up: remove consecutive empty lines (more than 2)
  result = result.replace(/\n{3,}/g, "\n\n").trim();

  return result;
}

// ─── Context Extractor ──────────────────────────────
// Extracts ProposalMessageContext from snapshot + versao data

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

  // Extract modules info from snapshot items
  const itens = snap.itens || [];
  const modulos = itens.filter((i: any) => i.categoria === "modulo" || i.categoria === "modulos");
  const inversores = itens.filter((i: any) => i.categoria === "inversor" || i.categoria === "inversores");

  const modulosQtd = modulos.reduce((s: number, m: any) => s + (m.quantidade || 0), 0);
  const moduloPotencia = modulos[0]?.potencia_w || null;
  const moduloModelo = modulos[0] ? `${modulos[0].fabricante || ""} ${modulos[0].modelo || modulos[0].descricao || ""}`.trim() : null;
  const inversorModelo = inversores[0] ? `${inversores[0].fabricante || ""} ${inversores[0].modelo || inversores[0].descricao || ""}`.trim() : null;

  // Consumo from UCs
  const ucs = snap.ucs || [];
  const consumoMensal = ucs.reduce((s: number, uc: any) => s + (uc.consumo_mensal || uc.consumo_mensal_kwh || 0), 0);

  // Pagamento
  const pagOpcoes = snap.pagamentoOpcoes || snap.pagamento_opcoes || [];

  // Serviços
  const servicos = snap.servicos || [];

  // Link
  const publicSlug = versao.public_slug;
  const linkProposta = publicSlug ? `${window.location.origin}/p/${publicSlug}` : null;

  const result: ProposalMessageContext & { _snapshot?: any } = {
    clienteNome: proposta.cliente_nome || snap.clienteNome || snap.cliente_nome || null,
    potenciaKwp: versao.potencia_kwp || snap.potenciaKwp || snap.potencia_kwp || null,
    modulosQtd: modulosQtd || versao.potencia_kwp ? modulosQtd : null,
    moduloPotenciaW: moduloPotencia,
    moduloModelo,
    inversorModelo,
    consumoMensal: consumoMensal || null,
    geracaoMensal: versao.geracao_mensal || snap.geracaoMensal || snap.geracao_mensal || null,
    economiaMensal: versao.economia_mensal || snap.economiaMensal || snap.economia_mensal || null,
    paybackMeses: versao.payback_meses || snap.paybackMeses || snap.payback_meses || null,
    valorTotal: versao.valor_total || snap.valorTotal || snap.valor_total || null,
    linkProposta,
    tipoTelhado: snap.locTipoTelhado || snap.loc_tipo_telhado || snap.tipo_telhado || null,
    distribuidora: snap.locDistribuidoraNome || snap.loc_distribuidora_nome || snap.distribuidora || null,
    consultorNome: snap.consultorNome || snap.consultor_nome || null,
    empresaNome: snap.empresaNome || snap.empresa_nome || null,
    validadeDias: snap.validade_dias || snap.validadeDias || null,
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
    // Pass snapshot for warranty data extraction in resolveBlocks
    _snapshot: snap,
  };

  return result as ProposalMessageContext;
}
