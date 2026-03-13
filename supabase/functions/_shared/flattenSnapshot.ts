/**
 * flattenSnapshot.ts — Utilitário compartilhado para achatar
 * snapshots aninhados de propostas em chaves flat para templates DOCX/HTML.
 *
 * Uso: import { flattenSnapshot } from "../_shared/flattenSnapshot.ts";
 *      const flat = flattenSnapshot(snapshot);
 *      // flat é Record<string, string> com todas as chaves prontas
 */

type AnyObj = Record<string, unknown>;

function safeObj(val: unknown): AnyObj {
  return val && typeof val === "object" && !Array.isArray(val) ? (val as AnyObj) : {};
}

function safeArr(val: unknown): AnyObj[] {
  return Array.isArray(val) ? (val as AnyObj[]) : [];
}

function str(v: unknown): string | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  return String(v);
}

/**
 * Achata um snapshot de proposta em Record<string, string>.
 * - Primitivos top-level → direto
 * - Objetos aninhados (tecnico, financeiro, cliente) → prefixados E aliases
 * - Arrays (itens, ucs, pagamentoOpcoes) → chaves canônicas
 *
 * Usa semântica "setIfMissing": primeira fonte ganha.
 */
export function flattenSnapshot(snapshot: AnyObj | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};

  if (!snapshot) return out;

  const setIfMissing = (key: string, value: unknown) => {
    if (!out[key]) {
      const s = str(value);
      if (s) out[key] = s;
    }
  };

  // ── 1. Top-level primitives ──
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === null || value === undefined || value === "") continue;
    if (typeof value === "object") {
      // Dot-flatten nested objects (one level) → prefix_subkey
      if (!Array.isArray(value)) {
        for (const [subKey, subValue] of Object.entries(value as AnyObj)) {
          if (subValue !== null && subValue !== undefined && subValue !== "" && typeof subValue !== "object") {
            setIfMissing(`${key}_${subKey}`, subValue);
          }
        }
      }
      continue;
    }
    setIfMissing(key, value);
  }

  // ── 2. Flatten tecnico ──
  const tecnico = safeObj(snapshot.tecnico);
  setIfMissing("consumo_mensal", tecnico.consumo_total_kwh);
  setIfMissing("geracao_mensal", tecnico.geracao_estimada_kwh);
  setIfMissing("potencia_kwp", tecnico.potencia_kwp);
  setIfMissing("potencia_sistema", tecnico.potencia_kwp);
  setIfMissing("numero_modulos", tecnico.numero_modulos);

  // ── 3. Flatten financeiro ──
  const financeiro = safeObj(snapshot.financeiro);
  setIfMissing("economia_mensal", financeiro.economia_mensal);
  setIfMissing("valor_total", financeiro.valor_total);
  setIfMissing("preco_total", financeiro.valor_total);
  setIfMissing("preco_final", financeiro.valor_total);
  setIfMissing("preco", financeiro.valor_total);
  setIfMissing("capo_i", financeiro.valor_total);
  setIfMissing("payback_meses", financeiro.payback_meses);
  setIfMissing("roi_anual", financeiro.roi_anual);
  setIfMissing("tir", financeiro.tir);
  setIfMissing("vpl", financeiro.vpl);

  // ── 4. Flatten itens (módulos e inversores) ──
  const itens = safeArr(snapshot.itens);
  const modulos = itens.filter(
    (i) => String(i.tipo ?? "").toLowerCase().includes("modulo") || Number(i.potencia_w ?? 0) >= 300,
  );
  const inversores = itens.filter(
    (i) => String(i.tipo ?? "").toLowerCase().includes("inversor") || (Number(i.potencia_w ?? 0) > 0 && Number(i.potencia_w ?? 0) < 300),
  );

  if (modulos[0]) {
    setIfMissing("modulo_fabricante", modulos[0].fabricante);
    setIfMissing("modulo_modelo", modulos[0].modelo);
    if (modulos[0].potencia_w) setIfMissing("modulo_potencia", `${modulos[0].potencia_w} Wp`);
    setIfMissing("vc_modulo_potencia", modulos[0].potencia_w);
    const totalMod = modulos.reduce((s, m) => s + Number(m.quantidade ?? 0), 0);
    if (totalMod > 0) {
      setIfMissing("modulo_quantidade", String(totalMod));
      setIfMissing("vc_total_modulo", String(totalMod));
    }
  }

  if (inversores[0]) {
    setIfMissing("inversor_fabricante", inversores[0].fabricante);
    setIfMissing("inversor_fabricante_1", inversores[0].fabricante);
    setIfMissing("inversor_modelo", inversores[0].modelo);
    if (inversores[0].potencia_w) setIfMissing("inversor_potencia_nominal", `${inversores[0].potencia_w} W`);
  }

  // Indexed inversores (_1, _2, ...)
  inversores.forEach((inv, idx) => {
    const i = idx + 1;
    setIfMissing(`inversor_fabricante_${i}`, inv.fabricante);
    setIfMissing(`inversor_modelo_${i}`, inv.modelo);
    if (inv.potencia_w) setIfMissing(`inversor_potencia_nominal_${i}`, `${inv.potencia_w} W`);
    setIfMissing(`inversor_quantidade_${i}`, inv.quantidade);
  });

  // ── 5. Flatten ucs ──
  const ucs = safeArr(snapshot.ucs);
  if (ucs[0]) {
    setIfMissing("consumo_mensal", ucs[0].consumo_mensal);
    setIfMissing("subgrupo_uc1", ucs[0].subgrupo ?? ucs[0].grupo);
    setIfMissing("dis_energia", ucs[0].concessionaria ?? ucs[0].distribuidora);
    setIfMissing("tarifa_distribuidora", ucs[0].tarifa_kwh ?? ucs[0].tarifa);
  }
  setIfMissing("qtd_ucs", ucs.length > 0 ? String(ucs.length) : undefined);

  // ── 6. Flatten cliente ──
  const cliente = safeObj(snapshot.cliente);
  setIfMissing("cliente_nome", cliente.nome);
  setIfMissing("vc_nome", cliente.nome);
  setIfMissing("cliente_celular", cliente.telefone);
  setIfMissing("cliente_email", cliente.email);
  setIfMissing("cliente_cnpj_cpf", cliente.cpf_cnpj);
  setIfMissing("cliente_empresa", cliente.empresa);
  setIfMissing("cliente_cep", cliente.cep);
  setIfMissing("cliente_endereco", cliente.rua);
  setIfMissing("cliente_numero", cliente.numero);
  setIfMissing("cliente_complemento", cliente.complemento);
  setIfMissing("cliente_bairro", cliente.bairro);
  setIfMissing("cliente_cidade", cliente.cidade);
  setIfMissing("cliente_estado", cliente.estado);
  if (cliente.cidade && cliente.estado) {
    setIfMissing("cidade_estado", `${cliente.cidade} - ${cliente.estado}`);
  }

  // ── 7. Flatten pagamentoOpcoes ──
  const pagamento = safeArr(snapshot.pagamentoOpcoes);
  pagamento.forEach((p, idx) => {
    setIfMissing(`vc_parcela_${idx + 1}`, p.parcela);
    setIfMissing(`f_parcela_${idx + 1}`, p.parcela);
    setIfMissing(`f_nome_${idx + 1}`, p.nome ?? p.banco);
    setIfMissing(`f_prazo_${idx + 1}`, p.prazo);
    setIfMissing(`f_taxa_${idx + 1}`, p.taxa);
    setIfMissing(`f_entrada_${idx + 1}`, p.entrada);
    setIfMissing(`f_valor_${idx + 1}`, p.valor);
  });

  // ── 8. Flatten consultor (if present) ──
  const consultor = safeObj(snapshot.consultor);
  setIfMissing("consultor_nome", consultor.nome);
  setIfMissing("responsavel_nome", consultor.nome);
  setIfMissing("consultor_telefone", consultor.telefone);
  setIfMissing("consultor_email", consultor.email);

  return out;
}
