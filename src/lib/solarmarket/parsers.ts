/**
 * SolarMarket — Parsers centralizados por entidade (raw/staging).
 *
 * Cada parser:
 * - aceita payload bruto (snake_case ou camelCase, nested objects, arrays)
 * - aplica fallback múltiplo de chaves
 * - normaliza relações (cliente, responsável, etc.) para { id, label, raw }
 * - NUNCA devolve [object Object] — objetos viram { id, label } legíveis
 * - é defensivo: campo ausente vira null, exibição decide o "—"
 *
 * Reutiliza formatadores canônicos de @/lib/formatters (RB-09).
 */

// ─────────────────────────────────────────────────────────────────────────
// Helpers de leitura resiliente
// ─────────────────────────────────────────────────────────────────────────

/** Retorna o primeiro valor não-nulo entre as chaves informadas. */
export function pick(obj: any, ...keys: string[]): any {
  if (!obj || typeof obj !== "object") return null;
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return null;
}

/** Retorna SEMPRE um array (envolve valor único). */
export function asArray(v: any): any[] {
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  return [v];
}

/** Converte qualquer valor a um número ou null. */
export function toNumber(v: any): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Converte boolean-ish (true/"true"/1/"sim") em boolean. */
export function toBool(v: any): boolean | null {
  if (v === true || v === 1 || v === "1" || v === "true" || v === "sim" || v === "yes") return true;
  if (v === false || v === 0 || v === "0" || v === "false" || v === "nao" || v === "não" || v === "no") return false;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────
// Tipo "Relação externa" — transforma objeto/primitivo em algo legível
// ─────────────────────────────────────────────────────────────────────────

export interface ExternalRef {
  id: string | null;
  label: string | null;
  email?: string | null;
  raw: any;
}

/**
 * Normaliza referência externa.
 * Aceita:
 *  - primitivo (id puro): "82" ou 82
 *  - objeto com {id, name, email, ...}
 *  - array: pega primeiro elemento
 */
export function parseExternalRef(value: any): ExternalRef | null {
  if (value == null || value === "") return null;
  if (Array.isArray(value)) return parseExternalRef(value[0]);

  if (typeof value === "object") {
    const id = pick(value, "id", "uuid", "external_id", "_id");
    const label =
      pick(value, "name", "nome", "title", "label", "fantasia", "razao_social", "company", "fullName", "full_name") ??
      pick(value, "email") ??
      (id != null ? String(id) : null);
    const email = pick(value, "email");
    return {
      id: id != null ? String(id) : null,
      label: label != null ? String(label) : null,
      email: email != null ? String(email) : null,
      raw: value,
    };
  }

  // primitivo (string/number) → tratamos como ID
  return { id: String(value), label: String(value), raw: value };
}

// ─────────────────────────────────────────────────────────────────────────
// Datas — devolvem string ISO (formatação fica na UI)
// ─────────────────────────────────────────────────────────────────────────

function pickDate(p: any, ...keys: string[]): string | null {
  const v = pick(p, ...keys);
  return v == null ? null : String(v);
}

// ─────────────────────────────────────────────────────────────────────────
// CLIENTE
// ─────────────────────────────────────────────────────────────────────────

export interface ParsedSmCliente {
  nome: string | null;
  email: string | null;
  telefone: string | null;
  telefoneSecundario: string | null;
  documento: string | null;
  dataNascimento: string | null;
  cep: string | null;
  rua: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  observacoes: string | null;
  responsavel: ExternalRef | null;
  criadoEm: string | null;
  atualizadoEm: string | null;
}

export function parseSmCliente(payload: any): ParsedSmCliente {
  const p = payload ?? {};
  const endereco = (p.address && typeof p.address === "object") ? p.address : p;
  return {
    nome: pick(p, "name", "nome", "fullName", "full_name", "razao_social", "fantasia", "company"),
    email: pick(p, "email"),
    telefone: pick(p, "primaryPhone", "phone", "telefone", "celular", "mobile", "phone_number"),
    telefoneSecundario: pick(p, "secondaryPhone", "phone2", "telefone2"),
    documento: pick(p, "cnpjCpf", "cpf_cnpj", "document", "documento", "cpf", "cnpj"),
    dataNascimento: pickDate(p, "birth_date", "data_nascimento", "birthday", "birthDate"),
    cep: pick(endereco, "zipCode", "zip", "zip_code", "cep", "postal_code"),
    rua: pick(endereco, "street", "rua", "logradouro", "address_line", "address"),
    numero: pick(endereco, "number", "numero"),
    complemento: pick(endereco, "complement", "complemento"),
    bairro: pick(endereco, "neighborhood", "bairro", "district"),
    cidade: pick(endereco, "city", "cidade", "municipio"),
    uf: pick(endereco, "state", "estado", "uf"),
    observacoes: pick(p, "notes", "observations", "observacoes", "obs", "description"),
    responsavel: parseExternalRef(pick(p, "responsible", "owner", "responsavel", "user", "consultant")),
    criadoEm: pickDate(p, "created_at", "createdAt", "criado_em"),
    atualizadoEm: pickDate(p, "updated_at", "updatedAt", "atualizado_em"),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// PROJETO — shape real do endpoint /projects do SolarMarket:
// { id, name, description, client{...}, responsible{id,name,email},
//   representative{id,name,email}, createdAt, deletedAt }
// Campos como status/valor/funil/etapa/atividades/etiquetas NÃO existem
// nesta rota — vêm de /proposals, /activities, /funnels.
// ─────────────────────────────────────────────────────────────────────────

export interface ParsedSmProjetoCliente {
  id: string | null;
  nome: string | null;
  empresa: string | null;
  documento: string | null;
  email: string | null;
  telefone: string | null;
  telefoneSecundario: string | null;
  cep: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
}

export interface ParsedSmProjeto {
  id: string | null;
  nome: string | null;
  descricao: string | null;
  cliente: ParsedSmProjetoCliente | null;
  clienteRef: ExternalRef | null;
  responsavel: ExternalRef | null;
  representante: ExternalRef | null;
  criadoEm: string | null;
  excluidoEm: string | null;
}

function parseProjetoCliente(c: any): ParsedSmProjetoCliente | null {
  if (!c || typeof c !== "object") return null;
  return {
    id: c.id != null ? String(c.id) : null,
    nome: pick(c, "name", "nome"),
    empresa: pick(c, "company", "empresa"),
    documento: pick(c, "cnpjCpf", "cpf_cnpj", "document", "documento"),
    email: pick(c, "email"),
    telefone: pick(c, "primaryPhone", "phone", "telefone", "celular"),
    telefoneSecundario: pick(c, "secondaryPhone", "phone2", "telefone2"),
    cep: pick(c, "zipCode", "zip", "cep"),
    endereco: pick(c, "address", "street", "rua", "logradouro"),
    numero: pick(c, "number", "numero"),
    complemento: pick(c, "complement", "complemento"),
    bairro: pick(c, "neighborhood", "bairro"),
    cidade: pick(c, "city", "cidade"),
    uf: pick(c, "state", "estado", "uf"),
  };
}

export function parseSmProjeto(payload: any): ParsedSmProjeto {
  const p = payload ?? {};
  const cliente = parseProjetoCliente(p.client ?? p.customer ?? p.cliente);
  return {
    id: p.id != null ? String(p.id) : null,
    nome: pick(p, "name", "nome", "title"),
    descricao: pick(p, "description", "descricao"),
    cliente,
    clienteRef: parseExternalRef(p.client ?? p.customer ?? p.cliente),
    responsavel: parseExternalRef(pick(p, "responsible", "owner", "responsavel")),
    representante: parseExternalRef(pick(p, "representative", "representante", "agent")),
    criadoEm: pickDate(p, "createdAt", "created_at", "criado_em"),
    excluidoEm: pickDate(p, "deletedAt", "deleted_at", "excluido_em"),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// PROPOSTA — shape real do endpoint /proposals do SolarMarket:
// { id, name, description, status, linkPdf, createdAt, generatedAt, sendAt,
//   viewedAt, acceptanceDate, rejectionDate, expirationDate,
//   project{id,name}, pricingTable[], variables[] }
// ─────────────────────────────────────────────────────────────────────────

export interface ParsedSmPricingItem {
  categoria: string | null;
  item: string | null;
  quantidade: number | null;
  custoUnitario: number | null;
  custoTotal: number | null;
  imposto: number | null;
  lucro: number | null;
  valorVenda: number | null;
  raw: any;
}

export interface ParsedSmVariable {
  topic: string | null;
  item: string | null;
  value: any;
  formattedValue: string | null;
  raw: any;
}

export interface ParsedSmProposta {
  id: string | null;
  nome: string | null;
  descricao: string | null;
  status: string | null;
  linkPdf: string | null;
  projeto: ExternalRef | null;
  pricingTable: ParsedSmPricingItem[];
  variables: ParsedSmVariable[];
  valorTotalEstimado: number | null;
  criadoEm: string | null;
  geradoEm: string | null;
  enviadoEm: string | null;
  visualizadoEm: string | null;
  aceitoEm: string | null;
  recusadoEm: string | null;
  expiraEm: string | null;
}

function parsePricingItem(it: any): ParsedSmPricingItem {
  const i = it ?? {};
  return {
    categoria: pick(i, "category", "categoria", "group", "groupName", "type"),
    item: pick(i, "item", "name", "nome", "description", "descricao", "title"),
    quantidade: toNumber(pick(i, "quantity", "qtd", "quantidade", "qty")),
    custoUnitario: toNumber(pick(i, "unitCost", "unit_cost", "custo_unitario", "costUnit")),
    custoTotal: toNumber(pick(i, "totalCost", "total_cost", "custo_total", "cost")),
    imposto: toNumber(pick(i, "tax", "imposto", "taxValue", "tax_value")),
    lucro: toNumber(pick(i, "profit", "lucro", "margin", "margem")),
    valorVenda: toNumber(pick(i, "salesValue", "sales_value", "valor_venda", "saleValue", "price", "totalPrice")),
    raw: it,
  };
}

function parseVariable(v: any): ParsedSmVariable {
  const x = v ?? {};
  return {
    topic: pick(x, "topic", "group", "category", "categoria", "grupo"),
    item: pick(x, "item", "name", "label", "key", "nome"),
    value: x.value ?? x.valor ?? null,
    formattedValue: pick(x, "formattedValue", "formatted_value", "formatted", "displayValue"),
    raw: v,
  };
}

export function parseSmProposta(payload: any): ParsedSmProposta {
  const p = payload ?? {};
  const pricingRaw = asArray(pick(p, "pricingTable", "pricing_table", "pricing", "items"));
  const variablesRaw = asArray(pick(p, "variables", "vars"));
  const pricingTable = pricingRaw.map(parsePricingItem);

  // Soma valorVenda (salesValue) como valor total estimado, se houver itens
  const valorTotalEstimado = pricingTable.length
    ? pricingTable.reduce((acc, it) => acc + (it.valorVenda ?? 0), 0) || null
    : null;

  return {
    id: p.id != null ? String(p.id) : null,
    nome: pick(p, "name", "title", "nome", "titulo"),
    descricao: pick(p, "description", "descricao", "notes", "observacoes"),
    status: pick(p, "status", "situacao"),
    linkPdf: pick(p, "linkPdf", "link_pdf", "pdfUrl", "pdf_url", "url", "link"),
    projeto:
      parseExternalRef(pick(p, "project", "deal", "projeto")) ??
      parseExternalRef(pick(p, "project_id", "projeto_id", "deal_id")),
    pricingTable,
    variables: variablesRaw.map(parseVariable),
    valorTotalEstimado,
    criadoEm: pickDate(p, "createdAt", "created_at", "criado_em"),
    geradoEm: pickDate(p, "generatedAt", "generated_at", "gerado_em"),
    enviadoEm: pickDate(p, "sendAt", "sentAt", "send_at", "sent_at", "enviado_em"),
    visualizadoEm: pickDate(p, "viewedAt", "viewed_at", "visualizado_em"),
    aceitoEm: pickDate(p, "acceptanceDate", "acceptance_date", "acceptedAt", "accepted_at", "aceito_em"),
    recusadoEm: pickDate(p, "rejectionDate", "rejection_date", "rejectedAt", "rejected_at", "recusado_em"),
    expiraEm: pickDate(p, "expirationDate", "expiration_date", "expiresAt", "expires_at", "validade_ate"),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// FUNIL + ETAPAS
// ─────────────────────────────────────────────────────────────────────────

export interface ParsedSmEtapa {
  id: string | null;
  nome: string | null;
  ordem: number | null;
  status: string | null;
  raw: any;
}

export interface ParsedSmFunil {
  nome: string | null;
  descricao: string | null;
  ordem: number | null;
  etapas: ParsedSmEtapa[];
  criadoEm: string | null;
  atualizadoEm: string | null;
}

export function parseSmFunil(payload: any): ParsedSmFunil {
  const p = payload ?? {};
  const stages = asArray(pick(p, "stages", "etapas", "steps"));
  return {
    nome: pick(p, "name", "nome", "title"),
    descricao: pick(p, "description", "descricao"),
    ordem: toNumber(pick(p, "order", "ordem", "position", "sort")),
    etapas: stages.map((s: any, idx: number) => ({
      id: s && typeof s === "object" ? (s.id != null ? String(s.id) : null) : null,
      nome: typeof s === "object"
        ? (pick(s, "name", "nome", "title", "label") ?? null)
        : String(s),
      ordem: typeof s === "object" ? toNumber(pick(s, "order", "ordem", "position", "sort")) ?? idx + 1 : idx + 1,
      status: typeof s === "object" ? pick(s, "status", "situacao", "type") : null,
      raw: s,
    })),
    criadoEm: pickDate(p, "created_at", "createdAt"),
    atualizadoEm: pickDate(p, "updated_at", "updatedAt"),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// CAMPO CUSTOMIZADO
// ─────────────────────────────────────────────────────────────────────────

export interface ParsedSmCustomField {
  nome: string | null;
  tipo: string | null;
  obrigatorio: boolean | null;
  opcoes: string[];
  valorPadrao: any;
  grupo: string | null;
  entidade: string | null;
  criadoEm: string | null;
}

export function parseSmCustomField(payload: any): ParsedSmCustomField {
  const p = payload ?? {};
  const opcoesRaw = asArray(pick(p, "options", "opcoes", "values", "choices"));
  return {
    nome: pick(p, "name", "nome", "label", "title"),
    tipo: pick(p, "type", "tipo", "field_type"),
    obrigatorio: toBool(pick(p, "required", "obrigatorio", "is_required")),
    opcoes: opcoesRaw
      .map((o: any) => (typeof o === "object" ? pick(o, "label", "name", "value", "nome") : o))
      .filter((x: any) => x != null && x !== "")
      .map(String),
    valorPadrao: pick(p, "default_value", "default", "valor_padrao"),
    grupo: pick(p, "group", "grupo", "category", "categoria"),
    entidade: pick(p, "entity", "entidade", "applies_to", "scope"),
    criadoEm: pickDate(p, "created_at", "createdAt"),
  };
}
