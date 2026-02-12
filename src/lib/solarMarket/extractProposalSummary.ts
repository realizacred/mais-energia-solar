/**
 * Deterministic extractor: raw_payload (SolarMarket JSONB) → ProposalSummary
 * Safe parse: never throws, never returns NaN to UI.
 */

export interface ProposalSummary {
  projectTitle?: string;
  createdAt?: string;
  status?: string;
  totalValue?: number;
  downPayment?: number;
  installments?: { qty?: number; value?: number };
  equipment?: {
    modules?: string;
    inverter?: string;
    batteries?: string;
    extras?: string[];
  };
  system?: { powerKwp?: number; monthlyGenKwh?: number };
  savings?: {
    monthly?: number;
    yearly?: number;
    roiMonths?: number;
    paybackMonths?: number;
  };
  raw?: { id?: string; linkPdf?: string };
}

// ── helpers ──

function safeNum(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function safeStr(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s.length > 0 ? s : undefined;
}

function findVariable(
  variables: any[] | undefined,
  key: string
): string | undefined {
  if (!Array.isArray(variables)) return undefined;
  const entry = variables.find(
    (v: any) => v?.key === key || v?.item === key
  );
  return entry?.formattedValue ?? entry?.value ?? undefined;
}

function findPricingItem(
  table: any[] | undefined,
  category: string
): string | undefined {
  if (!Array.isArray(table)) return undefined;
  const entry = table.find(
    (r: any) =>
      String(r?.category ?? "").toLowerCase() === category.toLowerCase()
  );
  return safeStr(entry?.item);
}

// ── main extractor ──

export function extractProposalSummary(rawPayload: any): ProposalSummary {
  if (!rawPayload || typeof rawPayload !== "object") return {};

  const p = rawPayload as Record<string, any>;
  const pricingTable: any[] | undefined = p.pricingTable ?? p.pricing_table;
  const variables: any[] | undefined = p.variables;

  // Equipment from pricingTable
  const modules = findPricingItem(pricingTable, "Módulo");
  const inverter = findPricingItem(pricingTable, "Inversor");
  const batteries = findPricingItem(pricingTable, "Bateria");
  const extras: string[] = [];
  if (Array.isArray(pricingTable)) {
    pricingTable.forEach((row: any) => {
      const cat = String(row?.category ?? "").toLowerCase();
      if (
        cat &&
        !["módulo", "inversor", "bateria", "kit", "instalação"].includes(cat) &&
        row?.item
      ) {
        extras.push(String(row.item));
      }
    });
  }

  // Financial from variables
  const totalValueVar = safeNum(findVariable(variables, "valor_total")) ??
    safeNum(findVariable(variables, "valor_total_sistema"));
  const downPaymentVar = safeNum(findVariable(variables, "entrada")) ??
    safeNum(findVariable(variables, "valor_entrada"));
  const installmentsQty = safeNum(findVariable(variables, "parcelas")) ??
    safeNum(findVariable(variables, "qtd_parcelas"));
  const installmentsValue = safeNum(findVariable(variables, "valor_parcela"));

  // System
  const powerKwp = safeNum(findVariable(variables, "potencia_sistema")) ??
    safeNum(findVariable(variables, "potencia_kwp"));
  const monthlyGenKwh = safeNum(findVariable(variables, "geracao_mensal")) ??
    safeNum(findVariable(variables, "geracao_media_mensal"));

  // Savings
  const monthly = safeNum(findVariable(variables, "economia_mensal"));
  const yearly = safeNum(findVariable(variables, "economia_anual")) ??
    (monthly != null ? monthly * 12 : undefined);
  const paybackMonths = safeNum(findVariable(variables, "payback_meses")) ??
    safeNum(findVariable(variables, "payback"));
  const roiMonths = safeNum(findVariable(variables, "roi_meses"));

  // Total value: try pricingTable sum if variable not found
  let totalValue = totalValueVar;
  if (totalValue == null && Array.isArray(pricingTable)) {
    const sum = pricingTable.reduce(
      (acc: number, row: any) => acc + (safeNum(row?.salesValue) ?? safeNum(row?.totalCost) ?? 0),
      0
    );
    if (sum > 0) totalValue = sum;
  }

  const summary: ProposalSummary = {
    projectTitle: safeStr(p.project?.name) ?? safeStr(p.name),
    createdAt: safeStr(p.generatedAt) ?? safeStr(p.createdAt),
    status: safeStr(p.status),
    totalValue,
    downPayment: downPaymentVar,
    installments:
      installmentsQty || installmentsValue
        ? { qty: installmentsQty, value: installmentsValue }
        : undefined,
    equipment: {
      modules,
      inverter,
      batteries,
      extras: extras.length > 0 ? extras : undefined,
    },
    system: {
      powerKwp,
      monthlyGenKwh,
    },
    savings: {
      monthly,
      yearly,
      roiMonths,
      paybackMonths,
    },
    raw: {
      id: safeStr(p.id),
      linkPdf: safeStr(p.linkPdf),
    },
  };

  if (process.env.NODE_ENV === "development") {
    const missing: string[] = [];
    if (!summary.totalValue) missing.push("totalValue");
    if (!summary.equipment?.modules) missing.push("modules");
    if (!summary.savings?.monthly) missing.push("economia_mensal");
    if (missing.length > 0) {
      console.debug("[extractProposalSummary] Missing fields:", missing, {
        payloadKeys: Object.keys(p),
      });
    }
  }

  return summary;
}
