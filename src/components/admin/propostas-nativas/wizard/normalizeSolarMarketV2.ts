/**
 * normalizeSolarMarketV2Snapshot
 *
 * Converte um snapshot gravado pelo motor V2 do SolarMarket
 * (source = "solarmarket", source_version = "v3") para o formato
 * WizardSnapshot esperado pelo ProposalWizard.
 *
 * Snapshot SM v3 vive com chaves agrupadas:
 *   { source: "solarmarket", source_version: "v3",
 *     kit: { nome, itens: [{category, item, qnt, unitCost, salesValue, totalCost}] },
 *     cliente, projeto, financeiro{ pricing_table, valor_total },
 *     pagamento{ condicao, valor_total },
 *     sm_variables{ "Estado", "Cidade", "Distribuidora de Energia",
 *                   "Consumo Mensal UC N", "Estrutura Telhado",
 *                   "Financiamento Ativo …", ... },
 *     raw_sm, geracao, garantias, customFieldValues }
 *
 * NÃO inventa kit: se kit.itens vier vazio/sem módulos, devolve itens=[]
 * e a UI exibe banner pedindo "Duplicar" para editar.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  createEmptyUC,
  mapLeadTipoTelhadoToProposal,
  type WizardSnapshot,
  type UCData,
} from "./types";

const extractPotenciaFromModel = (model: string | null | undefined): number => {
  if (!model) return 0;
  const norm = model.toUpperCase();
  const explicitW = norm.match(/(\d{3,4})\s*W\b/);
  if (explicitW) return parseInt(explicitW[1], 10);
  const explicitKw = norm.match(/(\d{1,2}(?:[.,]\d+)?)\s*KW\b/);
  if (explicitKw) return Math.round(parseFloat(explicitKw[1].replace(",", ".")) * 1000);
  const compactKw = norm.match(/(?:^|[^\d])(\d{1,2}(?:[.,]\d+)?)K(?:[^A-Z\d]|$)/);
  if (compactKw) return Math.round(parseFloat(compactKw[1].replace(",", ".")) * 1000);
  return 0;
};

const firstWord = (s: string) => (s || "").trim().split(/\s+/)[0] || "";

/** Localiza item do kit por categoria (case-insensitive, sem acentos). */
const findKitItem = (itens: any[], catRegex: RegExp) =>
  (itens || []).find((it: any) => {
    const c = String(it?.category ?? it?.categoria ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return catRegex.test(c);
  });

const filterKitItems = (itens: any[], catRegex: RegExp) =>
  (itens || []).filter((it: any) => {
    const c = String(it?.category ?? it?.categoria ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return catRegex.test(c);
  });

const toNum = (v: any): number => {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Lê variável SM com chave canônica (case-insensitive, ignora espaços extras). */
const readSmVar = (smVars: Record<string, any>, key: string): any => {
  if (!smVars) return undefined;
  if (key in smVars) return smVars[key];
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const target = norm(key);
  for (const k of Object.keys(smVars)) {
    if (norm(k) === target) return smVars[k];
  }
  return undefined;
};

export async function normalizeSolarMarketV2Snapshot(
  raw: Record<string, any>,
  propostaId: string,
  versao: { potencia_kwp: number | null; valor_total: number | null; grupo: string | null }
): Promise<Partial<WizardSnapshot>> {
  const sm: Record<string, any> = raw.sm_variables || {};
  const kitItens: any[] = Array.isArray(raw.kit?.itens) ? raw.kit.itens : [];

  // ── Cliente ──────────────────────────────────────────────
  const { data: proposta } = await supabase
    .from("propostas_nativas")
    .select("titulo, cliente_id, lead_id, deal_id")
    .eq("id", propostaId)
    .maybeSingle();

  let clienteData: any = null;
  if (proposta?.cliente_id) {
    const { data } = await supabase
      .from("clientes")
      .select("nome, telefone, email, cpf_cnpj, empresa, cep, estado, cidade, bairro, rua, numero, complemento")
      .eq("id", proposta.cliente_id)
      .maybeSingle();
    clienteData = data;
  }

  // ── Itens (módulos + inversores) a partir de kit.itens ───
  const modulosRaw = filterKitItems(kitItens, /^modulo/i);
  const inversoresRaw = filterKitItems(kitItens, /^inversor/i);
  const kitRow = findKitItem(kitItens, /^kit$/i);
  const instalacaoRow = findKitItem(kitItens, /^instala/i);
  const comissaoRow = findKitItem(kitItens, /^comiss/i);

  // Custo total do KIT (linha agregada) — distribui por quantidade total de módulos
  const custoKitTotal = toNum(kitRow?.totalCost ?? kitRow?.unitCost ?? kitRow?.salesValue);
  const totalModuloQtd = modulosRaw.reduce((s, m) => s + toNum(m.qnt ?? m.quantidade), 0);
  const precoUnitModuloRateado = totalModuloQtd > 0 && custoKitTotal > 0
    ? custoKitTotal / totalModuloQtd
    : 0;

  const itens = [
    ...modulosRaw.map((m) => {
      const modelo = String(m.item || m.modelo || "");
      return {
        id: crypto.randomUUID(),
        descricao: modelo,
        fabricante: firstWord(modelo),
        modelo,
        potencia_w: extractPotenciaFromModel(modelo),
        quantidade: toNum(m.qnt ?? m.quantidade),
        preco_unitario: toNum(m.unitCost ?? m.preco_unitario) || precoUnitModuloRateado,
        categoria: "modulo" as const,
        avulso: false,
        produto_ref: null,
      };
    }),
    ...inversoresRaw.map((inv) => {
      const modelo = String(inv.item || inv.modelo || "");
      return {
        id: crypto.randomUUID(),
        descricao: modelo,
        fabricante: firstWord(modelo),
        modelo,
        potencia_w: extractPotenciaFromModel(modelo),
        quantidade: toNum(inv.qnt ?? inv.quantidade) || 1,
        preco_unitario: toNum(inv.unitCost ?? inv.preco_unitario),
        categoria: "inversor" as const,
        avulso: false,
        produto_ref: null,
      };
    }),
  ];

  // ── Potência total ───────────────────────────────────────
  let potenciaKwp = toNum(versao.potencia_kwp);
  if (!potenciaKwp) {
    const modulosKwp = itens
      .filter((i) => i.categoria === "modulo")
      .reduce((s, m) => s + (m.potencia_w * m.quantidade) / 1000, 0);
    if (modulosKwp > 0) potenciaKwp = modulosKwp;
  }

  // ── Localização ──────────────────────────────────────────
  const estado = String(readSmVar(sm, "Estado") ?? clienteData?.estado ?? raw.cliente?.estado ?? "");
  const cidade = String(readSmVar(sm, "Cidade") ?? clienteData?.cidade ?? raw.cliente?.cidade ?? "");
  const disNome = String(readSmVar(sm, "Distribuidora de Energia") ?? raw.cliente?.dis_energia ?? "");
  const telhadoRaw = String(
    readSmVar(sm, "Estrutura Telhado") ??
    readSmVar(sm, "Estrutura do Telhado") ??
    readSmVar(sm, "Tipo de Telhado") ??
    raw.projeto?.tipo_telhado ??
    ""
  );
  const locTipoTelhado = telhadoRaw ? (mapLeadTipoTelhadoToProposal(telhadoRaw) || telhadoRaw) : "";

  // ── UCs (a partir de "Consumo Mensal UC N" ou "Consumo Mensal") ─
  const consumoUC1 = readSmVar(sm, "Consumo Mensal UC 1") ?? readSmVar(sm, "Consumo Mensal");
  let mediaConsumoUC1 = 0;
  if (Array.isArray(consumoUC1) && consumoUC1.length > 0) {
    const nums = consumoUC1.map((v) => toNum(v)).filter((n) => n > 0);
    mediaConsumoUC1 = nums.length > 0 ? nums.reduce((s, n) => s + n, 0) / nums.length : 0;
  } else {
    mediaConsumoUC1 = toNum(consumoUC1);
  }

  const ucs: UCData[] = [
    {
      ...createEmptyUC(1),
      consumo_mensal: Math.round(mediaConsumoUC1),
      distribuidora: disNome,
    } as UCData,
  ];

  // ── Venda ────────────────────────────────────────────────
  const venda = {
    custo_kit: custoKitTotal,
    custo_instalacao: toNum(instalacaoRow?.salesValue ?? instalacaoRow?.totalCost),
    custo_comissao: toNum(comissaoRow?.salesValue ?? comissaoRow?.totalCost),
    custo_outros: 0,
    margem_percentual: 0,
    desconto_percentual: 0,
    observacoes: "",
  };

  // ── Serviços ─────────────────────────────────────────────
  const servicos = instalacaoRow ? [{
    id: crypto.randomUUID(),
    descricao: "Mão de Obra / Instalação",
    categoria: "instalacao",
    valor: toNum(instalacaoRow.salesValue ?? instalacaoRow.totalCost),
    incluso_no_preco: true,
  }] : [];

  // ── Pagamento (financiamento ativo do SM) ────────────────
  const finNome = readSmVar(sm, "Financiamento Ativo Nome");
  const finPrazo = toNum(readSmVar(sm, "Financiamento Ativo Prazo"));
  const finValor = toNum(readSmVar(sm, "Financiamento Ativo Valor R$"));
  const finParcela = toNum(readSmVar(sm, "Financiamento Ativo Parcela"));
  const finTaxa = toNum(readSmVar(sm, "Financiamento Ativo Taxa"));
  const finEntrada = toNum(readSmVar(sm, "Financiamento Ativo Entrada R$"));
  const finCarencia = toNum(readSmVar(sm, "Financiamento Ativo Carência"));

  const pagamentoOpcoes = finNome || finValor > 0 ? [{
    id: crypto.randomUUID(),
    nome: String(finNome || "Financiamento"),
    tipo: "financiamento" as const,
    valor_financiado: finValor,
    entrada: finEntrada,
    taxa_mensal: finTaxa,
    carencia_meses: finCarencia,
    num_parcelas: finPrazo,
    valor_parcela: finParcela,
    descricao: String(raw.pagamento?.condicao || finNome || ""),
  }] : raw.pagamento?.condicao ? [{
    id: crypto.randomUUID(),
    nome: "",
    tipo: "a_vista" as const,
    valor_financiado: 0,
    entrada: 0,
    taxa_mensal: 0,
    carencia_meses: 0,
    num_parcelas: 1,
    valor_parcela: 0,
    descricao: String(raw.pagamento.condicao),
  }] : [];

  // ── Geração estimada ─────────────────────────────────────
  const geracaoAnualSm = toNum(readSmVar(sm, "Geração Anual") ?? raw.geracao?.anual);
  const geracaoMensalEstimada = geracaoAnualSm > 0 ? geracaoAnualSm / 12 : toNum(raw.geracao?.mensal_media);

  // ── manualKits (espelho do legacy: cria 1 card com itens) ─
  const manualKits = (() => {
    if (itens.length === 0) return [];
    const modItems = itens.filter((i) => i.categoria === "modulo");
    const invItems = itens.filter((i) => i.categoria === "inversor");
    const totalModQtd = modItems.reduce((s, m) => s + m.quantidade, 0);
    const totalModKwp = modItems.reduce((s, m) => s + (m.potencia_w * m.quantidade) / 1000, 0);
    const totalInvQtd = invItems.reduce((s, i) => s + i.quantidade, 0);
    const totalInvKw = invItems.reduce((s, i) => s + (i.potencia_w * i.quantidade) / 1000, 0);
    const precoTotal = custoKitTotal || itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0);
    const precoWp = totalModKwp > 0 ? precoTotal / (totalModKwp * 1000) : 0;
    const modDesc = modItems.map((m) => `${m.fabricante} ${m.modelo}`.trim()).filter(Boolean).join(" + ") || "—";
    const invDesc = invItems.map((i) => `${i.fabricante} ${i.modelo}`.trim()).filter(Boolean).join(" + ") || "—";
    const card = {
      id: `manual-sm-${Date.now()}`,
      distribuidorNome: "Importado SM",
      moduloDescricao: modDesc,
      moduloQtd: totalModQtd,
      moduloPotenciaKwp: totalModKwp,
      inversorDescricao: invDesc,
      inversorQtd: totalInvQtd,
      inversorPotenciaKw: totalInvKw,
      topologia: "Tradicional",
      precoTotal,
      precoWp,
      updatedAt: new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    };
    return [{ card, itens, meta: { distribuidorNome: "Importado SM", nomeKit: raw.kit?.nome || "Kit Importado SM" } }];
  })();

  const normalized: Partial<WizardSnapshot> = {
    locEstado: estado,
    locCidade: cidade,
    locTipoTelhado,
    locDistribuidoraId: "",
    locDistribuidoraNome: disNome,
    locIrradiacao: 0,
    locGhiSeries: null,
    locLatitude: null,
    distanciaKm: toNum(readSmVar(sm, "Distância")),
    projectAddress: clienteData ? {
      cep: clienteData.cep || "",
      rua: clienteData.rua || "",
      numero: clienteData.numero || "",
      bairro: clienteData.bairro || "",
      complemento: clienteData.complemento || "",
      cidade: clienteData.cidade || cidade,
      uf: clienteData.estado || estado,
      lat: null,
      lon: null,
    } : undefined,
    mapSnapshots: [],
    cliente: clienteData ? {
      nome: clienteData.nome || "",
      celular: clienteData.telefone || "",
      email: clienteData.email || "",
      cnpj_cpf: clienteData.cpf_cnpj || "",
      empresa: clienteData.empresa || "",
      cep: clienteData.cep || "",
      endereco: clienteData.rua || "",
      numero: clienteData.numero || "",
      complemento: clienteData.complemento || "",
      bairro: clienteData.bairro || "",
      cidade: clienteData.cidade || "",
      estado: clienteData.estado || "",
    } as any : undefined,
    ucs,
    grupo: (versao.grupo as any) || "B",
    potenciaKwp,
    itens,
    layouts: [],
    manualKits: manualKits as any,
    adicionais: [],
    servicos: servicos as any,
    venda: venda as any,
    pagamentoOpcoes: pagamentoOpcoes as any,
    nomeProposta: raw.projeto?.nome || "",
    descricaoProposta: raw.projeto?.descricao || "",
    templateSelecionado: "",
    step: 0,
    premissas: null,
    preDimensionamento: null,
    customFieldValues: raw.customFieldValues || {},
    geracaoMensalEstimada,
  };

  return normalized;
}
