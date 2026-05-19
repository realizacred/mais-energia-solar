/**
 * isProjetoTerminalForOperationalQueue
 * SSOT frontend para identificar projetos que NÃO devem aparecer na
 * Fila Inteligente / "Prioridade Agora".
 *
 * Critérios (qualquer um verdadeiro → terminal):
 *  - etapa atual com nome terminal (instalação realizada, sistema em operação,
 *    concluído, finalizado, encerrado, homologação aprovada)
 *  - categoria da etapa em { ganho, perdido, excluido }
 *  - projeto.status em { concluido, cancelado, em_operacao }
 *
 * Escopo: somente frontend. Não substitui flag de banco; é guarda visual da fila.
 */

function norm(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

const TERMINAL_STAGE_PATTERNS = [
  "instalacao realizada",
  "sistema em operacao",
  "concluido",
  "concluida",
  "finalizado",
  "finalizada",
  "encerrado",
  "encerrada",
  "homologacao aprovada",
];

const TERMINAL_CATEGORIES = new Set(["ganho", "perdido", "excluido", "concluido"]);

const TERMINAL_PROJECT_STATUS = new Set([
  "concluido",
  "cancelado",
  "em_operacao",
  "em operacao",
]);

export interface TerminalCheckInput {
  // SSOT canônico (preenchido pelo banco — Fase 2)
  is_terminal?: boolean | null;
  etapa?: { nome?: string | null; categoria?: string | null; is_terminal?: boolean | null } | null;
  // Fallbacks legados (mantidos para projeções sem is_terminal)
  stage_name?: string | null;
  etapa_nome?: string | null;
  categoria?: string | null;
  status?: string | null;
}

export function isProjetoTerminalForOperationalQueue(
  projeto: TerminalCheckInput | null | undefined
): boolean {
  if (!projeto) return false;

  // 1) SSOT canônico — banco já sabe se a etapa é terminal
  if (projeto.is_terminal === true) return true;
  if (projeto.etapa?.is_terminal === true) return true;

  // 2) Fallback legado: nome da etapa (para projetos/projeções sem is_terminal hidratado)
  const stageName = norm(projeto.stage_name ?? projeto.etapa_nome ?? projeto.etapa?.nome);
  if (stageName && TERMINAL_STAGE_PATTERNS.some((p) => stageName.includes(p))) {
    return true;
  }

  // 3) Fallback legado: categoria da etapa
  const categoria = norm(projeto.categoria ?? projeto.etapa?.categoria);
  if (categoria && TERMINAL_CATEGORIES.has(categoria)) return true;

  // 4) Fallback legado: status do projeto
  const status = norm(projeto.status);
  if (status && TERMINAL_PROJECT_STATUS.has(status)) return true;

  return false;
}
