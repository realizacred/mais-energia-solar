/**
 * Shared types for domain resolvers.
 * All resolvers accept a raw snapshot object and return Record<string, string>.
 */

export type AnyObj = Record<string, unknown>;

export function safeObj(val: unknown): AnyObj {
  return val && typeof val === "object" && !Array.isArray(val) ? (val as AnyObj) : {};
}

export function safeArr(val: unknown): AnyObj[] {
  return Array.isArray(val) ? (val as AnyObj[]) : [];
}

export function str(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  if (v === "") return "";
  return String(v);
}

export function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

export function fmtCur(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(v);
}

/** Format number without currency symbol — AP-17: variables return pure values */
export function fmtVal(v: number, decimals = 2): string {
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v);
}

export function fmtNum(v: number, decimals = 2): string {
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v);
}

/**
 * Context passed to resolvers with related DB data (optional).
 * template-preview fetches these from DB; flattenSnapshot uses only snapshot.
 */
export interface ResolverExternalContext {
  lead?: AnyObj | null;
  cliente?: AnyObj | null;
  projeto?: AnyObj | null;
  consultor?: AnyObj | null;
  tenantNome?: string | null;
  versaoData?: AnyObj | null;
  propostaData?: AnyObj | null;
  brandSettings?: AnyObj | null;
  projetoData?: AnyObj | null;
  clienteData?: AnyObj | null;
  dealData?: AnyObj | null;
}

export type DomainResolver = (
  snapshot: AnyObj | null | undefined,
  ext?: ResolverExternalContext,
) => Record<string, string>;
