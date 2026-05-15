import { LeadStatus } from "@/types/lead";

export const TERMINAL_STATUS_KEYWORDS = [
  "convertido", "perdido", "cancelado", "recusado", 
  "inativo", "fechado", "ganho", "cliente", "arquivado", "aguardando validação"
];

export const CONVERTED_STATUS_KEYWORDS = [
  "convertido", "fechado", "ganho", "cliente"
];

export const LOST_STATUS_KEYWORDS = [
  "perdido", "cancelado", "recusado", "inativo"
];

export interface OperationalFilterOptions {
  filterVisto?: string;
  filterEstado?: string;
  filterStatus?: string;
  excludeTerminal?: boolean;
  maxAgeDays?: number | null;
}

/**
 * Identifica IDs de status que são considerados terminais (finalizados/arquivados)
 */
export function getTerminalStatusIds(statuses: LeadStatus[]): string[] {
  return statuses
    .filter(s => TERMINAL_STATUS_KEYWORDS.some(kw => s.nome.toLowerCase().includes(kw)))
    .map(s => s.id);
}

/**
 * Identifica IDs de status que representam sucesso/conversão
 */
export function getConvertedStatusIds(statuses: LeadStatus[]): string[] {
  return statuses
    .filter(s => CONVERTED_STATUS_KEYWORDS.some(kw => s.nome.toLowerCase().includes(kw)))
    .map(s => s.id);
}

/**
 * Identifica IDs de status que representam perda
 */
export function getLostStatusIds(statuses: { id: string; nome: string }[]): string[] {
  return statuses
    .filter(s => LOST_STATUS_KEYWORDS.some(kw => s.nome.toLowerCase().includes(kw)))
    .map(s => s.id);
}

/**
 * Constrói a query base do Supabase aplicando os filtros operacionais centralizados.
 * PROTEÇÃO: Garante que status_id NULL (novos) não sejam filtrados por engano.
 */
export function buildOperationalFilters(
  query: any,
  options: OperationalFilterOptions,
  terminalStatusIds: string[] = []
) {
  let q = query;
  const { filterVisto, filterEstado, filterStatus, excludeTerminal, maxAgeDays } = options;

  if (filterVisto === "visto") q = q.eq("visto", true);
  else if (filterVisto === "nao_visto") q = q.eq("visto", false);

  if (filterEstado && filterEstado !== "todos") q = q.eq("estado", filterEstado);

  if (filterStatus === "novo") {
    q = q.is("status_id", null);
  } else if (filterStatus && filterStatus !== "todos") {
    q = q.eq("status_id", filterStatus);
  } else if (excludeTerminal && terminalStatusIds.length > 0) {
    // A lógica 'or' garante que NULL (novos) apareçam, e apenas os terminais sejam removidos
    q = q.or(`status_id.is.null,status_id.not.in.(${terminalStatusIds.join(",")})`);
  }

  if (maxAgeDays) {
    const minDate = new Date();
    minDate.setDate(minDate.getDate() - maxAgeDays);
    q = q.gte("created_at", minDate.toISOString());
  }

  return q;
}

/**
 * Verifica se um orçamento individual deve ser exibido baseado nos filtros.
 * Útil para filtragem em memória (KPIs, Badges, etc)
 */
export function shouldShowOrcamento(
  orcamento: { status_id: string | null; visto: boolean; estado: string | null; created_at: string },
  options: OperationalFilterOptions,
  terminalStatusIds: string[] = []
): boolean {
  const { filterVisto, filterEstado, filterStatus, excludeTerminal, maxAgeDays } = options;

  if (filterVisto === "visto" && !orcamento.visto) return false;
  if (filterVisto === "nao_visto" && orcamento.visto) return false;

  if (filterEstado && filterEstado !== "todos" && orcamento.estado !== filterEstado) return false;

  if (filterStatus === "novo") {
    if (orcamento.status_id !== null) return false;
  } else if (filterStatus && filterStatus !== "todos") {
    if (orcamento.status_id !== filterStatus) return false;
  } else if (excludeTerminal && orcamento.status_id && terminalStatusIds.includes(orcamento.status_id)) {
    return false;
  }

  if (maxAgeDays) {
    const minDate = new Date();
    minDate.setDate(minDate.getDate() - maxAgeDays);
    if (new Date(orcamento.created_at) < minDate) return false;
  }

  return true;
}

/**
 * Calcula quantos itens estão sendo ocultados pela regra operacional (terminal/idade)
 */
export function getHiddenCounts(
  allOrcamentos: any[],
  options: OperationalFilterOptions,
  terminalStatusIds: string[]
): number {
  const visible = allOrcamentos.filter(o => shouldShowOrcamento(o, options, terminalStatusIds));
  return allOrcamentos.length - visible.length;
}

/**
 * Atalho para aplicar filtros em uma lista (in-memory)
 */
export function applyOperationalVisibility<T extends { status_id: string | null; visto: boolean; estado: string | null; created_at: string }>(
  orcamentos: T[],
  options: OperationalFilterOptions,
  terminalStatusIds: string[]
): T[] {
  return orcamentos.filter(o => shouldShowOrcamento(o, options, terminalStatusIds));
}

/**
 * Calcula estatísticas básicas respeitando a lógica centralizada
 */
export function calculateOperationalStats(
  orcamentos: any[],
  statuses: LeadStatus[]
) {
  const convertedIds = getConvertedStatusIds(statuses);
  const terminalIds = getTerminalStatusIds(statuses);
  
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  return {
    total: orcamentos.length,
    naoVistos: orcamentos.filter(o => !o.visto).length,
    esteMes: orcamentos.filter(o => {
      const d = new Date(o.created_at);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    }).length,
    convertidos: orcamentos.filter(o => o.status_id && convertedIds.includes(o.status_id)).length,
    terminais: orcamentos.filter(o => o.status_id && terminalIds.includes(o.status_id)).length,
  };
}

