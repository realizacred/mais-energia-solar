/**
 * Utilitário centralizado para exibição de códigos humanos de entidades.
 * REGRA: Nunca mostrar UUID/hash na UI. Sempre "#N" como principal.
 */

export interface ProjetoLabelInput {
  id?: string;
  projeto_num?: number | null;
  deal_num?: number | null;
  codigo?: string | null;
}

export interface PropostaLabelInput {
  id?: string;
  proposta_num?: number | null;
  codigo?: string | null;
  status?: string | null;
  created_at?: string | null;
  titulo?: string | null;
}

export interface EntityLabel {
  /** Ex: "Projeto #1" ou "Proposta #3" */
  primary: string;
  /** Ex: "PROJ-0001" ou "PROP-0003 • rascunho • 22/02/2026" */
  secondary: string | null;
}

export function formatProjetoLabel(input: ProjetoLabelInput): EntityLabel {
  const num = input.deal_num ?? input.projeto_num;
  if (num != null) {
    return {
      primary: `Projeto #${num}`,
      secondary: input.codigo || null,
    };
  }
  // Fallback — nunca mostrar hash
  if (input.id) {
    console.error(`[formatProjetoLabel] projeto_num/deal_num ausente para id=${input.id}`);
  }
  return {
    primary: input.codigo ? `Projeto ${input.codigo}` : "Projeto —",
    secondary: null,
  };
}

export function formatPropostaLabel(input: PropostaLabelInput): EntityLabel & { titleFallback: string } {
  const num = input.proposta_num;
  const dateStr = input.created_at
    ? new Date(input.created_at).toLocaleDateString("pt-BR")
    : null;
  const secondaryParts = [input.codigo, input.status, dateStr].filter(Boolean);

  if (num != null) {
    return {
      primary: `Proposta #${num}`,
      secondary: secondaryParts.length > 0 ? secondaryParts.join(" • ") : null,
      titleFallback: input.titulo || `Proposta #${num}`,
    };
  }
  // Fallback — nunca mostrar hash
  if (input.id) {
    console.error(`[formatPropostaLabel] proposta_num ausente para id=${input.id}`);
  }
  return {
    primary: input.codigo ? `Proposta ${input.codigo}` : "Proposta —",
    secondary: secondaryParts.length > 0 ? secondaryParts.join(" • ") : null,
    titleFallback: input.titulo || "Proposta sem título",
  };
}
