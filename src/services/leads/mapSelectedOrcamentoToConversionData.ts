/**
 * SSOT mapper: converts a selected Orçamento (or Lead fallback)
 * into the hydration payload consumed by the Conversion modal.
 *
 * Keep this pure — no React, no side effects.
 */
import type { OrcamentoDisplayItem } from "@/types/orcamento";
import type { Lead } from "@/types/lead";

export interface ConversionHydrationData {
  // Step 1 — Pessoal
  nome: string;
  telefone: string;
  email: string;
  cep: string;
  estado: string;
  cidade: string;
  bairro: string;
  rua: string;
  numero: string;
  complemento: string;
  cpf_cnpj: string;
  data_nascimento: string;
  // Step 2 — Técnico
  media_consumo: number;
  consumo_previsto: number;
  observacoes: string;
  localizacao: string;
  // Meta
  _orcamento_id: string | null;
  _lead_id: string | null;
}

const s = (v: unknown): string => (v == null ? "" : String(v));
const n = (v: unknown): number => {
  const num = Number(v);
  return Number.isFinite(num) ? num : 0;
};

export function mapSelectedOrcamentoToConversionData(
  selectedOrcamento: OrcamentoDisplayItem | null | undefined,
  lead?: Lead | null,
): ConversionHydrationData {
  // selectedOrcamento has authoritative orçamento-specific fields
  // (cidade/estado/consumo can differ across orçamentos of same lead).
  // lead is used only for fields not present on the orçamento row.
  const o = selectedOrcamento ?? ({} as Partial<OrcamentoDisplayItem>);
  const l = (lead ?? {}) as Partial<Lead>;

  return {
    nome: s(o.nome || l.nome),
    telefone: s(o.telefone || l.telefone),
    email: s(o.email || l.email),
    cep: s(o.cep || l.cep),
    estado: s(o.estado || l.estado),
    cidade: s(o.cidade || l.cidade),
    bairro: s(o.bairro || l.bairro),
    rua: s(o.rua || l.rua),
    numero: s(o.numero || l.numero),
    complemento: s(o.complemento || l.complemento),
    cpf_cnpj: s((l as any).cpf_cnpj),
    data_nascimento: s((l as any).data_nascimento),
    media_consumo: n(o.media_consumo ?? l.media_consumo),
    consumo_previsto: n(o.consumo_previsto ?? l.consumo_previsto),
    observacoes: s(o.observacoes || l.observacoes),
    localizacao: s((o as any).localizacao || (l as any).localizacao),
    _orcamento_id: (o.id as string) || null,
    _lead_id: (o.lead_id as string) || (l.id as string) || null,
  };
}
