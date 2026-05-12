/**
 * formatUcsTabela.ts
 * Builds a multi-line text block describing every UC in the proposal,
 * for use with the {{ucs_tabela}} placeholder in DOCX templates.
 *
 * The DOCX processor (docxProcessor.replaceVars) converts \n into <w:br/>
 * inside the same run, so the block renders as multiple lines.
 */

function fmtNum(v: unknown, digits = 0): string {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function fmtBRL(v: unknown, digits = 2): string {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "—";
  return `R$ ${n.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

function consumoMedio(uc: any): number {
  if (uc?.tipo_dimensionamento === "MT") {
    return Number(uc.consumo_mensal_p ?? 0) + Number(uc.consumo_mensal_fp ?? 0);
  }
  return Number(uc?.consumo_mensal ?? 0);
}

/**
 * Returns a single string with one UC per line.
 * Each line:  "UC <n> <nome> | Consumo: X kWh/mês | Tarifa: R$ X/kWh
 *              | Custo Disp.: R$ X | Economia est.: R$ X/mês"
 */
export function buildUcsTabela(snapshot: any, opts?: { economiaTotalMensal?: number }): string {
  const ucs: any[] = Array.isArray(snapshot?.ucs) ? snapshot.ucs : [];
  if (ucs.length === 0) return "";

  // Distribute total monthly savings proportionally to each UC's consumption,
  // since per-UC savings are not stored explicitly.
  const totalConsumo = ucs.reduce((s, u) => s + consumoMedio(u), 0);
  const economiaTotal = Number(opts?.economiaTotalMensal ?? 0);

  return ucs
    .map((uc, i) => {
      const numero = uc?.numero_uc ?? uc?.numero ?? uc?.uc ?? (i + 1);
      const nome = uc?.nome ?? "";
      const consumo = consumoMedio(uc);
      const tarifa = uc?.tarifa_distribuidora;
      const custoDisp = uc?.custo_disponibilidade_valor;
      const ecoUc =
        totalConsumo > 0 && economiaTotal > 0
          ? (consumo / totalConsumo) * economiaTotal
          : null;

      const partes = [
        `UC ${numero}${nome ? " — " + nome : ""}`,
        `Consumo: ${fmtNum(consumo)} kWh/mês`,
        `Tarifa: ${fmtBRL(tarifa, 4)}/kWh`,
        `Custo disp.: ${fmtBRL(custoDisp)}`,
      ];
      if (ecoUc != null) partes.push(`Economia est.: ${fmtBRL(ecoUc)}/mês`);
      return partes.join(" | ");
    })
    .join("\n");
}
