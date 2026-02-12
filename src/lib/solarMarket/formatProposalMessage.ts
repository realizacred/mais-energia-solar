/**
 * Generates a WhatsApp-ready summary message from proposal data.
 */

function fmtCurrency(v: number | undefined | null): string {
  if (v == null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);
}

interface MessageData {
  clienteNome?: string;
  totalValue?: number;
  downPayment?: number;
  installmentsQty?: number;
  installmentsValue?: number;
  modules?: string;
  inverter?: string;
  economiaMensal?: number;
  linkPdf?: string;
}

export function formatProposalMessage(data: MessageData): string {
  const nome = data.clienteNome || "cliente";
  const parts: string[] = [];

  parts.push(`Olá, ${nome}! ☀️`);
  parts.push("");

  if (data.totalValue) {
    let financeiro = `Sua proposta ficou em *${fmtCurrency(data.totalValue)}*`;
    if (data.downPayment) {
      financeiro += `, com entrada de *${fmtCurrency(data.downPayment)}*`;
    }
    if (data.installmentsQty && data.installmentsValue) {
      financeiro += ` e *${data.installmentsQty}x* de *${fmtCurrency(data.installmentsValue)}*`;
    }
    financeiro += ".";
    parts.push(financeiro);
  }

  if (data.economiaMensal) {
    parts.push(
      `Economia estimada de *${fmtCurrency(data.economiaMensal)}/mês* na sua conta de luz.`
    );
  }

  const equip: string[] = [];
  if (data.modules) equip.push(data.modules);
  if (data.inverter) equip.push(data.inverter);
  if (equip.length > 0) {
    parts.push(`Equipamentos: ${equip.join(" + ")}.`);
  }

  parts.push("");
  parts.push("Posso te explicar e ajustar conforme seu consumo? 🙂");

  if (data.linkPdf) {
    parts.push("");
    parts.push(`📄 Proposta completa: ${data.linkPdf}`);
  }

  return parts.join("\n");
}
