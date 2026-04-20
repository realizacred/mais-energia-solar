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
// PROJETO
// ─────────────────────────────────────────────────────────────────────────

export interface ParsedSmProjeto {
  nome: string | null;
  descricao: string | null;
  status: string | null;
  motivoPerda: string | null;
  cliente: ExternalRef | null;
  responsavel: ExternalRef | null;
  representante: ExternalRef | null;
  funil: ExternalRef | null;
  etapa: ExternalRef | null;
  funis: Array<{ funil: ExternalRef | null; etapa: ExternalRef | null; status: string | null }>;
  etiquetas: string[];
  cidade: string | null;
  uf: string | null;
  valor: number | null;
  qtdPropostas: number | null;
  qtdSolicitacoes: number | null;
  qtdAtividades: number | null;
  qtdAtividadesConcluidas: number | null;
  qtdAtividadesAFazer: number | null;
  qtdAtividadesVencidas: number | null;
  proximaAtividadeEm: string | null;
  ultimaAtividadeConcluidaEm: string | null;
  criadoEm: string | null;
  atualizadoEm: string | null;
}

function parseEtiquetas(value: any): string[] {
  const arr = asArray(value);
  return arr
    .map((t: any) => {
      if (typeof t === "string") return t;
      if (t && typeof t === "object") return pick(t, "name", "nome", "label", "title", "value") ?? null;
      return null;
    })
    .filter((x): x is string => !!x && x !== "");
}

function parseFunisProjeto(p: any) {
  // SolarMarket pode mandar funnels[] (multi-pipeline) ou funnel + stage soltos
  const list = asArray(pick(p, "funnels", "funis", "pipelines"));
  if (list.length > 0) {
    return list.map((f: any) => ({
      funil: parseExternalRef(pick(f, "funnel", "pipeline") ?? f),
      etapa: parseExternalRef(pick(f, "stage", "step", "etapa")),
      status: pick(f, "status", "situacao") ?? null,
    }));
  }
  return [];
}

export function parseSmProjeto(payload: any): ParsedSmProjeto {
  const p = payload ?? {};
  const funisDetalhe = parseFunisProjeto(p);

  // Cliente: pode vir como objeto `client` ou ID `client_id`
  const clienteRef =
    parseExternalRef(pick(p, "client", "customer", "cliente")) ??
    parseExternalRef(pick(p, "client_id", "cliente_id", "customer_id"));

  return {
    nome: pick(p, "name", "nome", "title", "titulo"),
    descricao: pick(p, "description", "descricao", "notes", "observations"),
    status: pick(p, "status", "situacao", "stage_status"),
    motivoPerda: pick(p, "loss_reason", "lossReason", "motivo_perda", "reason_lost"),
    cliente: clienteRef,
    responsavel: parseExternalRef(pick(p, "responsible", "owner", "responsavel", "user", "consultant")),
    representante: parseExternalRef(pick(p, "representative", "representante", "agent")),
    funil:
      funisDetalhe[0]?.funil ??
      parseExternalRef(pick(p, "funnel", "pipeline") ?? pick(p, "funnel_id", "funil_id", "pipeline_id")),
    etapa:
      funisDetalhe[0]?.etapa ??
      parseExternalRef(pick(p, "stage", "step") ?? pick(p, "stage_id", "etapa_id", "step_id")),
    funis: funisDetalhe,
    etiquetas: parseEtiquetas(pick(p, "tags", "etiquetas", "labels")),
    cidade: pick(p, "city", "cidade") ?? pick(p.address ?? {}, "city", "cidade"),
    uf: pick(p, "state", "estado", "uf") ?? pick(p.address ?? {}, "state", "estado", "uf"),
    valor: toNumber(pick(p, "value", "valor", "budget", "orcamento", "amount", "total_value")),
    qtdPropostas: toNumber(pick(p, "proposals_count", "proposalsCount", "qtd_propostas", "total_proposals")),
    qtdSolicitacoes: toNumber(pick(p, "requests_count", "requestsCount", "qtd_solicitacoes", "total_requests")),
    qtdAtividades: toNumber(pick(p, "activities_count", "activitiesCount", "qtd_atividades", "total_activities")),
    qtdAtividadesConcluidas: toNumber(
      pick(p, "activities_done_count", "activitiesDoneCount", "qtd_atividades_concluidas", "completed_activities"),
    ),
    qtdAtividadesAFazer: toNumber(
      pick(p, "activities_todo_count", "activitiesTodoCount", "qtd_atividades_a_fazer", "pending_activities"),
    ),
    qtdAtividadesVencidas: toNumber(
      pick(p, "activities_overdue_count", "activitiesOverdueCount", "qtd_atividades_vencidas", "overdue_activities"),
    ),
    proximaAtividadeEm: pickDate(
      p,
      "next_activity_due_at",
      "nextActivityDueAt",
      "next_activity_at",
      "proxima_atividade_em",
      "next_activity",
    ),
    ultimaAtividadeConcluidaEm: pickDate(
      p,
      "last_activity_done_at",
      "lastActivityDoneAt",
      "ultima_atividade_concluida_em",
    ),
    criadoEm: pickDate(p, "created_at", "createdAt", "criado_em"),
    atualizadoEm: pickDate(p, "updated_at", "updatedAt", "atualizado_em"),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// PROPOSTA
// ─────────────────────────────────────────────────────────────────────────

export interface ParsedSmProposta {
  titulo: string | null;
  descricao: string | null;
  status: string | null;
  cliente: ExternalRef | null;
  projeto: ExternalRef | null;
  responsavel: ExternalRef | null;
  valorTotal: number | null;
  link: string | null;
  pdfUrl: string | null;
  criadoEm: string | null;
  atualizadoEm: string | null;
  validadeAte: string | null;
}

export function parseSmProposta(payload: any): ParsedSmProposta {
  const p = payload ?? {};
  return {
    titulo: pick(p, "title", "name", "nome", "titulo"),
    descricao: pick(p, "description", "descricao", "notes", "observacoes"),
    status: pick(p, "status", "situacao"),
    cliente:
      parseExternalRef(pick(p, "client", "customer", "cliente")) ??
      parseExternalRef(pick(p, "client_id", "cliente_id", "customer_id")),
    projeto:
      parseExternalRef(pick(p, "project", "deal", "projeto")) ??
      parseExternalRef(pick(p, "project_id", "projeto_id", "deal_id")),
    responsavel: parseExternalRef(pick(p, "responsible", "owner", "responsavel", "user")),
    valorTotal: toNumber(pick(p, "total_value", "valor_total", "total", "amount", "value", "price")),
    link: pick(p, "url", "link", "public_url", "share_url"),
    pdfUrl: pick(p, "pdf_url", "pdfUrl", "file_url", "document_url"),
    criadoEm: pickDate(p, "created_at", "createdAt", "criado_em"),
    atualizadoEm: pickDate(p, "updated_at", "updatedAt", "atualizado_em"),
    validadeAte: pickDate(p, "valid_until", "validUntil", "expires_at", "validade_ate"),
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
