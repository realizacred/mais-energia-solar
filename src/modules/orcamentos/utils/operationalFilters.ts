import { LeadStatus } from "@/types/lead";
import { differenceInDays, parseISO } from "date-fns";

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
  operationalStatus?: string;
}

export type OperationalStatus = 
  | "em_dia" 
  | "atencao" 
  | "urgente" 
  | "reativacao" 
  | "backlog_antigo" 
  | "finalizado"
  | "documentacao_ativa"
  | "documentacao_antiga";

export const OPERATIONAL_STATUS_LABELS: Record<OperationalStatus, string> = {
  em_dia: "Em dia",
  atencao: "Atenção",
  urgente: "Urgente",
  reativacao: "Reativação",
  backlog_antigo: "Backlog Antigo",
  finalizado: "Finalizado",
  documentacao_ativa: "Documentação Ativa",
  documentacao_antiga: "Documentação Antiga"
};

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
 * Helper único para classificação operacional conforme matriz de auditoria
 */
export function classifyOrcamentoOperationalStatus(
  orcamento: { 
    status_id: string | null; 
    ultimo_contato: string | null; 
    created_at: string;
  },
  terminalStatusIds: string[]
): OperationalStatus {
  // 1. Verificar se é finalizado
  if (orcamento.status_id && terminalStatusIds.includes(orcamento.status_id)) {
    return "finalizado";
  }

  // TODO: Em uma implementação futura, verificar 'documentacao_ativa' baseada em metadados de pendências.
  // Por enquanto, seguimos a lógica temporal de contato.

  const now = new Date();
  const lastContact = orcamento.ultimo_contato 
    ? parseISO(orcamento.ultimo_contato) 
    : parseISO(orcamento.created_at);
  const daysSinceContact = differenceInDays(now, lastContact);

  if (daysSinceContact >= 45) return "backlog_antigo";
  if (daysSinceContact >= 16) return "reativacao";
  if (daysSinceContact >= 6) return "urgente";
  if (daysSinceContact >= 3) return "atencao";
  return "em_dia";
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
 */
export function shouldShowOrcamento(
  orcamento: { 
    status_id: string | null; 
    visto: boolean; 
    estado: string | null; 
    created_at: string;
    ultimo_contato: string | null;
  },
  options: OperationalFilterOptions,
  terminalStatusIds: string[] = []
): boolean {
  const { filterVisto, filterEstado, filterStatus, excludeTerminal, maxAgeDays, operationalStatus } = options;

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

  if (operationalStatus && operationalStatus !== "todos") {
    const currentOpStatus = classifyOrcamentoOperationalStatus(orcamento, terminalStatusIds);
    if (currentOpStatus !== operationalStatus) return false;
  }

  return true;
}

/**
 * Calcula estatísticas operacionais respeitando a nova matriz de priorização
 */
export function calculateOperationalStats(
  orcamentos: any[],
  statuses: LeadStatus[]
) {
  const terminalIds = getTerminalStatusIds(statuses);
  
  const stats = {
    total: orcamentos.length,
    em_dia: 0,
    atencao: 0,
    urgente: 0,
    reativacao: 0,
    backlog_antigo: 0,
    finalizado: 0,
    naoVistos: orcamentos.filter(o => !o.visto).length,
  };

  orcamentos.forEach(o => {
    const opStatus = classifyOrcamentoOperationalStatus(o, terminalIds);
    if (opStatus in stats) {
      (stats as any)[opStatus]++;
    }
  });

  return stats;
}


